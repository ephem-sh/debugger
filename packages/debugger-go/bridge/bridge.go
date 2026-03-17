// Package bridge implements the NDJSON IPC server that listens on a Unix
// socket (or Windows named pipe) and responds to queries from the dbg CLI.
package bridge

import (
	"bufio"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"github.com/ephem-sh/debugger/packages/ephem-debugger-go/protocol"
	"github.com/ephem-sh/debugger/packages/ephem-debugger-go/store"
)

// Bridge is the IPC server that the dbg CLI connects to.
type Bridge struct {
	store      *store.Store
	listener   net.Listener
	socketPath string
	done       chan struct{}
	wg         sync.WaitGroup
}

// New creates a Bridge but does not start listening. Call Start to begin
// accepting connections.
func New(s *store.Store, socketPath string) (*Bridge, error) {
	return &Bridge{
		store:      s,
		socketPath: socketPath,
		done:       make(chan struct{}),
	}, nil
}

// Start begins listening for CLI connections on the socket path.
func (b *Bridge) Start() error {
	if runtime.GOOS == "windows" {
		return b.startWindows()
	}
	return b.startUnix()
}

func (b *Bridge) startWindows() error {
	// Windows named pipes (\\.\pipe\) are not supported by Go's net package.
	// Use TCP on localhost as a fallback. The port is written to a file so
	// the dbg CLI can discover it.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return fmt.Errorf("bridge: listen tcp: %w", err)
	}
	b.listener = ln

	// Write the TCP address to .debugger/bridge.addr in the working directory
	// so the CLI can find it.
	cwd, _ := os.Getwd()
	addrDir := filepath.Join(cwd, ".debugger")
	if err := os.MkdirAll(addrDir, 0o755); err != nil {
		ln.Close()
		return fmt.Errorf("bridge: create addr dir: %w", err)
	}
	addrFile := filepath.Join(addrDir, "bridge.addr")
	if err := os.WriteFile(addrFile, []byte(ln.Addr().String()), 0o644); err != nil {
		ln.Close()
		return fmt.Errorf("bridge: write addr file: %w", err)
	}

	// Update session socket path to actual TCP address for discovery
	b.store.Session().SocketPath = ln.Addr().String()

	b.wg.Add(1)
	go b.acceptLoop()
	b.writeSessionFile()
	return nil
}

func (b *Bridge) startUnix() error {
	dir := filepath.Dir(b.socketPath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("bridge: create socket dir: %w", err)
	}
	_ = os.Remove(b.socketPath)

	ln, err := net.Listen("unix", b.socketPath)
	if err != nil {
		return fmt.Errorf("bridge: listen: %w", err)
	}
	b.listener = ln

	b.wg.Add(1)
	go b.acceptLoop()
	b.writeSessionFile()
	return nil
}

// Stop gracefully shuts down the bridge and cleans up the socket file.
func (b *Bridge) Stop() error {
	close(b.done)
	if b.listener != nil {
		b.listener.Close()
	}
	b.wg.Wait()

	// Clean up session.json (both platforms).
	cwd, _ := os.Getwd()
	_ = os.Remove(filepath.Join(cwd, ".debugger", "session.json"))

	if runtime.GOOS != "windows" {
		_ = os.Remove(b.socketPath)
	} else {
		// Clean up .debugger/bridge.addr
		_ = os.Remove(filepath.Join(cwd, ".debugger", "bridge.addr"))
	}
	return nil
}

// Addr returns the listener address. Useful on Windows where the TCP port
// is dynamically assigned.
func (b *Bridge) Addr() net.Addr {
	if b.listener == nil {
		return nil
	}
	return b.listener.Addr()
}

func (b *Bridge) writeSessionFile() {
	cwd, err := os.Getwd()
	if err != nil {
		return
	}
	sessionDir := filepath.Join(cwd, ".debugger")
	_ = os.MkdirAll(sessionDir, 0o755)

	data, err := json.Marshal(b.store.Session())
	if err != nil {
		return
	}
	data = append(data, '\n')
	_ = os.WriteFile(filepath.Join(sessionDir, "session.json"), data, 0o644)
}

func (b *Bridge) acceptLoop() {
	defer b.wg.Done()
	for {
		conn, err := b.listener.Accept()
		if err != nil {
			select {
			case <-b.done:
				return
			default:
				continue
			}
		}
		b.wg.Add(1)
		go b.handleConn(conn)
	}
}

func (b *Bridge) handleConn(conn net.Conn) {
	defer b.wg.Done()
	defer conn.Close()

	scanner := bufio.NewScanner(conn)
	// Allow up to 1MB lines.
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		req, err := protocol.UnmarshalQueryRequest(line)
		if err != nil {
			b.writeError(conn, "", fmt.Sprintf("invalid request: %v", err))
			continue
		}

		b.handleRequest(conn, req, line)
	}
}

func (b *Bridge) handleRequest(conn net.Conn, req *protocol.QueryRequest, rawLine []byte) {
	if req.Command == "push" {
		b.handlePush(conn, req, rawLine)
		return
	}

	data := b.store.Query(req.Command, req.Filters)
	resp := &protocol.QueryResponse{
		ID:      req.ID,
		OK:      true,
		Data:    data,
		Session: b.store.Session(),
	}

	respBytes, err := protocol.MarshalQueryResponse(resp)
	if err != nil {
		b.writeError(conn, req.ID, fmt.Sprintf("marshal response: %v", err))
		return
	}
	respBytes = append(respBytes, '\n')
	_, _ = conn.Write(respBytes)
}

func (b *Bridge) handlePush(conn net.Conn, req *protocol.QueryRequest, rawLine []byte) {
	// For push commands, the entry data is embedded in the request as a
	// "data" field alongside id and command.
	var pushReq struct {
		ID      string          `json:"id"`
		Command string          `json:"command"`
		Data    json.RawMessage `json:"data"`
	}

	if err := json.Unmarshal(rawLine, &pushReq); err != nil || len(pushReq.Data) == 0 {
		b.writeOK(conn, req.ID)
		return
	}

	entry, err := protocol.UnmarshalEntry(pushReq.Data)
	if err != nil {
		b.writeError(conn, req.ID, fmt.Sprintf("unmarshal push data: %v", err))
		return
	}
	b.store.Push(entry)
	b.writeOK(conn, req.ID)
}

func (b *Bridge) writeOK(conn net.Conn, id string) {
	resp := &protocol.QueryResponse{
		ID:   id,
		OK:   true,
		Data: nil,
	}
	respBytes, err := protocol.MarshalQueryResponse(resp)
	if err != nil {
		return
	}
	respBytes = append(respBytes, '\n')
	_, _ = conn.Write(respBytes)
}

func (b *Bridge) writeError(conn net.Conn, id string, msg string) {
	resp := &protocol.QueryResponse{
		ID:    id,
		OK:    false,
		Error: msg,
	}
	respBytes, err := protocol.MarshalQueryResponse(resp)
	if err != nil {
		return
	}
	respBytes = append(respBytes, '\n')
	_, _ = conn.Write(respBytes)
}

// ComputeSocketPath returns the conventional socket path for the given
// working directory. On Unix this is <cwd>/.debugger/bridge.sock, on
// Windows it is \\.\pipe\debugger-<md5(cwd)[0:8]>.
func ComputeSocketPath(cwd string) string {
	if runtime.GOOS == "windows" {
		hash := md5.Sum([]byte(strings.ToLower(cwd)))
		return `\\.\pipe\debugger-` + hex.EncodeToString(hash[:4])
	}
	return filepath.Join(cwd, ".debugger", "bridge.sock")
}

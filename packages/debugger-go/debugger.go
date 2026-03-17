// Package debugger provides dev-only observability for Go web applications.
// It captures console logs, errors, network requests, and application state
// into in-memory ring buffers and exposes them over an IPC bridge that the
// dbg CLI connects to.
//
// Usage:
//
//	dbg, err := debugger.New(debugger.Options{Framework: "chi", Port: 3000})
//	if err != nil { log.Fatal(err) }
//	defer dbg.Close()
//
//	// Use dbg.Store to push entries, or install middleware/slog handler.
package debugger

import (
	"fmt"
	"os"
	"time"

	"github.com/ephem-sh/debugger/packages/ephem-debugger-go/bridge"
	"github.com/ephem-sh/debugger/packages/ephem-debugger-go/protocol"
	"github.com/ephem-sh/debugger/packages/ephem-debugger-go/store"
)

// Options configures the debugger instance.
type Options struct {
	// Framework is the name of the web framework (e.g. "chi", "gin", "echo").
	Framework string

	// Port is the HTTP port the application listens on.
	Port int

	// SocketPath overrides the default socket path. If empty, the path is
	// computed from the current working directory.
	SocketPath string
}

// Debugger is the main entry point. It owns the log store and IPC bridge.
type Debugger struct {
	Store   *store.Store
	Bridge  *bridge.Bridge
	Session *protocol.SessionInfo
}

// New creates and starts a Debugger instance. The IPC bridge begins
// listening immediately so the dbg CLI can connect.
func New(opts Options) (*Debugger, error) {
	socketPath := opts.SocketPath
	if socketPath == "" {
		cwd, err := os.Getwd()
		if err != nil {
			return nil, fmt.Errorf("debugger: get working directory: %w", err)
		}
		socketPath = ComputeSocketPath(cwd)
	}

	session := &protocol.SessionInfo{
		SessionID:  protocol.GenerateID(),
		Framework:  opts.Framework,
		Port:       opts.Port,
		PID:        os.Getpid(),
		StartedAt:  time.Now().UnixMilli(),
		SocketPath: socketPath,
	}

	s := store.NewStore(session)

	b, err := bridge.New(s, socketPath)
	if err != nil {
		return nil, fmt.Errorf("debugger: create bridge: %w", err)
	}

	if err := b.Start(); err != nil {
		return nil, fmt.Errorf("debugger: start bridge: %w", err)
	}

	return &Debugger{
		Store:   s,
		Bridge:  b,
		Session: session,
	}, nil
}

// Close stops the IPC bridge and releases resources.
func (d *Debugger) Close() error {
	if d.Bridge != nil {
		return d.Bridge.Stop()
	}
	return nil
}

// ComputeSocketPath returns the conventional socket path for the given
// working directory. This is a convenience re-export of bridge.ComputeSocketPath.
func ComputeSocketPath(cwd string) string {
	return bridge.ComputeSocketPath(cwd)
}

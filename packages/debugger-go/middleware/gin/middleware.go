// Package gin provides Gin middleware for the debugger.
//
// Usage:
//
//	import dbg "github.com/ephem-sh/debugger/packages/debugger-go/middleware/gin"
//
//	r := gin.New()
//	r.Use(gin.Recovery())
//	r.Use(dbg.Middleware(9876))
//
// This single call:
//   - Creates a debugger session with IPC bridge
//   - Captures Gin's internal log output
//   - Logs every HTTP request (method, path, status, latency)
//   - Captures slog calls in your handlers
//   - Prints the session ID to stdout
//
// Use dbg.Logger() after Middleware() to get a *slog.Logger that
// writes to both stdout and the debugger store:
//
//	log := dbg.Logger()
//	log.Info("hello", "key", "value")
package gin

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"time"

	ggin "github.com/gin-gonic/gin"

	debugger "github.com/ephem-sh/debugger/packages/debugger-go"
	"github.com/ephem-sh/debugger/packages/debugger-go/capture"
	"github.com/ephem-sh/debugger/packages/debugger-go/protocol"
)

var instance *debugger.Debugger

// Middleware returns a Gin middleware that instruments the application
// with debugger observability. Call this once when setting up the router.
//
// The port parameter is the HTTP port the Gin server listens on.
// It's used for session metadata only — the middleware does not bind
// to this port.
func Middleware(port int) ggin.HandlerFunc {
	dbg, err := debugger.New(debugger.Options{
		Framework: "gin",
		Port:      port,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "@ephem-sh/debugger: %v\n", err)
		// Return a no-op middleware if debugger fails to start.
		return func(c *ggin.Context) { c.Next() }
	}
	instance = dbg

	// Capture Gin's internal log output.
	ggin.DefaultWriter = io.MultiWriter(os.Stdout, capture.NewWriter(dbg.Store, "info"))

	fmt.Printf("> @ephem-sh/debugger: session %s\n", dbg.Session.SessionID)

	return func(c *ggin.Context) {
		start := time.Now()
		c.Next()
		dbg.Store.Push(&protocol.ConsoleEntry{
			Type:      "console",
			Level:     "info",
			Args:      []any{c.Request.Method, c.Request.URL.Path, c.Writer.Status(), time.Since(start).Milliseconds()},
			Timestamp: start.UnixMilli(),
			Source:    "server",
		})
	}
}

// Logger returns a *slog.Logger that writes to both os.Stdout and the
// debugger store. Safe to call before or after Middleware() — the
// returned logger resolves the store lazily on first log call.
func Logger() *slog.Logger {
	return slog.New(&lazyHandler{})
}

// lazyHandler defers to the real capture handler once the debugger
// instance is available. Before that, it falls back to a plain text
// handler writing to stdout.
type lazyHandler struct {
	resolved slog.Handler
}

func (h *lazyHandler) resolve() slog.Handler {
	if h.resolved != nil {
		return h.resolved
	}
	if instance != nil {
		h.resolved = capture.NewHandler(
			instance.Store,
			slog.NewTextHandler(os.Stdout, nil),
		)
		return h.resolved
	}
	return slog.NewTextHandler(os.Stdout, nil)
}

func (h *lazyHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.resolve().Enabled(ctx, level)
}
func (h *lazyHandler) Handle(ctx context.Context, r slog.Record) error {
	return h.resolve().Handle(ctx, r)
}
func (h *lazyHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return h.resolve().WithAttrs(attrs)
}
func (h *lazyHandler) WithGroup(name string) slog.Handler {
	return h.resolve().WithGroup(name)
}

// Close stops the debugger. Call this in a defer after setting up
// the router, or let the process exit handle it.
func Close() {
	if instance != nil {
		instance.Close()
	}
}

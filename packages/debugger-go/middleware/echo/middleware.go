// Package echo provides Echo middleware for the debugger.
//
// Usage:
//
//	import dbg "github.com/ephem-sh/debugger/packages/ephem-debugger-go/middleware/echo"
//
//	e := echo.New()
//	e.Use(dbg.Middleware(9877))
//
// This single call:
//   - Creates a debugger session with IPC bridge
//   - Logs every HTTP request (method, path, status, latency)
//   - Captures slog calls in your handlers
//   - Prints the session ID to stdout
//
// Use dbg.Logger() after Middleware() to get a *slog.Logger that
// writes to both stdout and the debugger store:
//
//	log := dbg.Logger()
//	log.Info("hello", "key", "value")
package echo

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	lecho "github.com/labstack/echo/v4"

	debugger "github.com/ephem-sh/debugger/packages/ephem-debugger-go"
	"github.com/ephem-sh/debugger/packages/ephem-debugger-go/browser"
	"github.com/ephem-sh/debugger/packages/ephem-debugger-go/capture"
	"github.com/ephem-sh/debugger/packages/ephem-debugger-go/protocol"
)

var instance *debugger.Debugger

// Middleware returns an Echo middleware that instruments the application
// with debugger observability. Call this once when setting up the router.
//
// The port parameter is the HTTP port the Echo server listens on.
// It's used for session metadata only — the middleware does not bind
// to this port.
func Middleware(port int) lecho.MiddlewareFunc {
	dbg, err := debugger.New(debugger.Options{
		Framework: "echo",
		Port:      port,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "@ephem-sh/debugger: %v\n", err)
		// Return a no-op middleware if debugger fails to start.
		return func(next lecho.HandlerFunc) lecho.HandlerFunc {
			return func(c lecho.Context) error { return next(c) }
		}
	}
	instance = dbg

	fmt.Printf("> @ephem-sh/debugger: session %s\n", dbg.Session.SessionID)

	return func(next lecho.HandlerFunc) lecho.HandlerFunc {
		return func(c lecho.Context) error {
			if browser.HandleRoutes(c.Response().Writer, c.Request(), dbg.Store) {
				return nil
			}
			start := time.Now()
			err := next(c)
			dbg.Store.Push(&protocol.ConsoleEntry{
				Type:      "console",
				Level:     "info",
				Args:      []any{c.Request().Method, c.Request().URL.Path, c.Response().Status, time.Since(start).Milliseconds()},
				Timestamp: start.UnixMilli(),
				Source:    "server",
			})
			return err
		}
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

// Routes registers debugger browser routes on an Echo instance.
// Call after Middleware():
//
//	e.Use(dbg.Middleware(9877))
//	dbg.Routes(e)
func Routes(e *lecho.Echo) {
	if instance == nil {
		return
	}
	s := instance.Store

	e.GET("/_/d.js", func(c lecho.Context) error {
		return c.Blob(200, "application/javascript", []byte(browser.ClientScript))
	})

	e.POST("/_/d", func(c lecho.Context) error {
		browser.HandleRoutes(c.Response().Writer, c.Request(), s)
		return nil
	})

	e.OPTIONS("/_/d", func(c lecho.Context) error {
		browser.HandleRoutes(c.Response().Writer, c.Request(), s)
		return nil
	})
}

// Close stops the debugger. Call this in a defer after setting up
// the router, or let the process exit handle it.
func Close() {
	if instance != nil {
		instance.Close()
	}
}

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
	"strings"
	"time"

	ggin "github.com/gin-gonic/gin"

	debugger "github.com/ephem-sh/debugger/packages/debugger-go"
	"github.com/ephem-sh/debugger/packages/debugger-go/browser"
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

		// Buffer response to check for HTML and inject scripts
		bw := &bodyWriter{ResponseWriter: c.Writer, body: &strings.Builder{}}
		c.Writer = bw

		c.Next()

		// Write the (possibly injected) body to the real writer
		body := bw.body.String()
		ct := bw.Header().Get("Content-Type")
		if strings.Contains(ct, "text/html") {
			body = browser.InjectScripts(body)
		}
		// Fix content-length since body may have changed size
		bw.ResponseWriter.Header().Set("Content-Length", fmt.Sprintf("%d", len(body)))
		bw.ResponseWriter.WriteHeader(bw.Status())
		bw.ResponseWriter.Write([]byte(body))

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

// Routes registers the debugger browser routes on a Gin router.
// Call this after Middleware() has been invoked:
//
//	r.Use(dbg.Middleware(9876))
//	dbg.Routes(r)
func Routes(r *ggin.Engine) {
	if instance == nil {
		return
	}
	s := instance.Store

	r.GET("/_/d.js", func(c *ggin.Context) {
		c.Data(200, "application/javascript", []byte(browser.ClientScript))
		c.Header("Cache-Control", "no-store")
	})

	r.POST("/_/d", func(c *ggin.Context) {
		browser.HandleRoutes(c.Writer, c.Request, s)
	})

	r.OPTIONS("/_/d", func(c *ggin.Context) {
		browser.HandleRoutes(c.Writer, c.Request, s)
	})
}

// bodyWriter buffers the response body so we can inspect and modify it
// (for HTML injection) before sending to the client.
type bodyWriter struct {
	ggin.ResponseWriter
	body   *strings.Builder
	status int
}

func (w *bodyWriter) WriteHeader(code int) {
	w.status = code
	// Don't forward — we write headers after injection
}

func (w *bodyWriter) Write(b []byte) (int, error) {
	return w.body.Write(b)
}

func (w *bodyWriter) Status() int {
	if w.status == 0 {
		return 200
	}
	return w.status
}

// Close stops the debugger. Call this in a defer after setting up
// the router, or let the process exit handle it.
func Close() {
	if instance != nil {
		instance.Close()
	}
}

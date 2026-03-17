// Package chi provides Chi middleware for the debugger.
//
// Usage:
//
//	import dbg "github.com/ephem-sh/debugger/packages/ephem-debugger-go/middleware/chi"
//
//	r := chi.NewRouter()
//	r.Use(dbg.Middleware(9878))
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
package chi

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	debugger "github.com/ephem-sh/debugger/packages/ephem-debugger-go"
	"github.com/ephem-sh/debugger/packages/ephem-debugger-go/browser"
	"github.com/ephem-sh/debugger/packages/ephem-debugger-go/capture"
	"github.com/ephem-sh/debugger/packages/ephem-debugger-go/protocol"
)

var instance *debugger.Debugger

// Middleware returns a standard net/http middleware that instruments the
// application with debugger observability. Call this once when setting
// up the router.
//
// The port parameter is the HTTP port the server listens on.
// It's used for session metadata only — the middleware does not bind
// to this port.
func Middleware(port int) func(http.Handler) http.Handler {
	dbg, err := debugger.New(debugger.Options{
		Framework: "chi",
		Port:      port,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "@ephem-sh/debugger: %v\n", err)
		// Return a no-op middleware if debugger fails to start.
		return func(next http.Handler) http.Handler { return next }
	}
	instance = dbg

	fmt.Printf("> @ephem-sh/debugger: session %s\n", dbg.Session.SessionID)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if browser.HandleRoutes(w, r, dbg.Store) {
				return
			}
			start := time.Now()

			// Wrap response writer to capture status code.
			wrapped := &responseWriter{ResponseWriter: w, status: http.StatusOK}

			next.ServeHTTP(wrapped, r)

			dbg.Store.Push(&protocol.ConsoleEntry{
				Type:      "console",
				Level:     "info",
				Args:      []any{r.Method, r.URL.Path, wrapped.status, time.Since(start).Milliseconds()},
				Timestamp: start.UnixMilli(),
				Source:    "server",
			})
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

// Routes registers debugger browser routes on a Chi router.
// Optional — the middleware already handles these routes. Use this
// if you want explicit route registration.
func Routes(r interface{ Get(string, http.HandlerFunc); Post(string, http.HandlerFunc) }) {
	if instance == nil {
		return
	}
	s := instance.Store

	r.Get("/_/d.js", func(w http.ResponseWriter, req *http.Request) {
		browser.HandleRoutes(w, req, s)
	})

	r.Post("/_/d", func(w http.ResponseWriter, req *http.Request) {
		browser.HandleRoutes(w, req, s)
	})
}

// Close stops the debugger. Call this in a defer after setting up
// the router, or let the process exit handle it.
func Close() {
	if instance != nil {
		instance.Close()
	}
}

// responseWriter wraps http.ResponseWriter to capture the status code
// written by the handler. It defaults to 200 if WriteHeader is never
// called explicitly (matching net/http behavior).
type responseWriter struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

// WriteHeader captures the status code and delegates to the underlying
// ResponseWriter. Only the first call takes effect, matching the
// behavior of net/http.
func (w *responseWriter) WriteHeader(code int) {
	if !w.wroteHeader {
		w.status = code
		w.wroteHeader = true
	}
	w.ResponseWriter.WriteHeader(code)
}

// Write delegates to the underlying ResponseWriter. If WriteHeader has
// not been called yet, it implicitly sets status 200.
func (w *responseWriter) Write(b []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(b)
}

// Unwrap returns the underlying ResponseWriter, supporting
// http.ResponseController and middleware that check for optional
// interfaces (http.Flusher, http.Hijacker, etc.).
func (w *responseWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

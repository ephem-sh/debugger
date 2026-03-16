// Package stdlib provides net/http middleware that captures HTTP request and
// response metadata into the debugger store. It works with any router that
// uses the standard http.Handler interface (Chi, Gorilla Mux, stdlib
// ServeMux, etc.).
package stdlib

import (
	"fmt"
	"net/http"
	"time"

	debugger "github.com/ephem-sh/debugger/packages/debugger-go"
	"github.com/ephem-sh/debugger/packages/debugger-go/browser"
	"github.com/ephem-sh/debugger/packages/debugger-go/protocol"
)

// Middleware returns an http.Handler middleware that captures HTTP
// request/response metadata into the debugger store. Each request is
// recorded as a ConsoleEntry with method, path, status code, and
// duration in milliseconds.
func Middleware(dbg *debugger.Debugger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if browser.HandleRoutes(w, r, dbg.Store) {
				return
			}
			start := time.Now()

			// Wrap response writer to capture status code.
			wrapped := &responseWriter{ResponseWriter: w, status: http.StatusOK}

			next.ServeHTTP(wrapped, r)

			duration := time.Since(start).Milliseconds()

			dbg.Store.Push(&protocol.NetworkEntry{
				URL:       r.URL.String(),
				Method:    r.Method,
				Status:    wrapped.status,
				Duration:  float64(duration),
				Timestamp: start.UnixMilli(),
				Source:    "server",
				Kind:      "fetch",
			})
		})
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

// String returns a human-readable summary of the captured response,
// useful for debugging the middleware itself.
func (w *responseWriter) String() string {
	return fmt.Sprintf("responseWriter{status: %d, wroteHeader: %v}", w.status, w.wroteHeader)
}

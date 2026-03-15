package stdlib_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	debugger "github.com/ephem-sh/debugger/packages/debugger-go"
	"github.com/ephem-sh/debugger/packages/debugger-go/middleware/stdlib"
	"github.com/ephem-sh/debugger/packages/debugger-go/protocol"
	"github.com/ephem-sh/debugger/packages/debugger-go/store"
)

// newDebuggerWithStore constructs a Debugger with only the Store field set,
// bypassing the IPC bridge. This is safe because the middleware only reads
// dbg.Store.
func newDebuggerWithStore(s *store.Store) *debugger.Debugger {
	return &debugger.Debugger{
		Store: s,
		Session: &protocol.SessionInfo{
			SessionID: "test-session",
			Framework: "stdlib",
			Port:      8080,
			PID:       1234,
			StartedAt: time.Now().UnixMilli(),
		},
	}
}

func newTestStore() *store.Store {
	return store.NewStore(&protocol.SessionInfo{
		SessionID: "test-session",
		Framework: "stdlib",
		Port:      8080,
		PID:       1234,
		StartedAt: time.Now().UnixMilli(),
	})
}

func TestMiddleware_CapturesRequest(t *testing.T) {
	s := newTestStore()
	dbg := newDebuggerWithStore(s)

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("hello"))
	})

	mw := stdlib.Middleware(dbg)
	wrapped := mw(handler)

	req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
	rec := httptest.NewRecorder()
	wrapped.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	entries := s.Query("network", nil)
	if len(entries) != 1 {
		t.Fatalf("expected 1 network entry, got %d", len(entries))
	}

	ne, ok := entries[0].(*protocol.NetworkEntry)
	if !ok {
		t.Fatal("expected *protocol.NetworkEntry")
	}

	if ne.Method != "GET" {
		t.Errorf("expected method GET, got %s", ne.Method)
	}
	if ne.URL != "/api/users" {
		t.Errorf("expected URL /api/users, got %s", ne.URL)
	}
	if ne.Status != 200 {
		t.Errorf("expected status 200, got %d", ne.Status)
	}
	if ne.Source != "server" {
		t.Errorf("expected source server, got %s", ne.Source)
	}
	if ne.Duration < 0 {
		t.Errorf("expected non-negative duration, got %f", ne.Duration)
	}
}

func TestMiddleware_CapturesStatusCodes(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
	}{
		{"200 OK", http.StatusOK},
		{"201 Created", http.StatusCreated},
		{"204 No Content", http.StatusNoContent},
		{"400 Bad Request", http.StatusBadRequest},
		{"404 Not Found", http.StatusNotFound},
		{"500 Internal Server Error", http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := newTestStore()
			dbg := newDebuggerWithStore(s)

			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.statusCode)
			})

			mw := stdlib.Middleware(dbg)
			wrapped := mw(handler)

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			rec := httptest.NewRecorder()
			wrapped.ServeHTTP(rec, req)

			entries := s.Query("network", nil)
			if len(entries) != 1 {
				t.Fatalf("expected 1 entry, got %d", len(entries))
			}

			ne := entries[0].(*protocol.NetworkEntry)
			if ne.Status != tt.statusCode {
				t.Errorf("expected status %d, got %d", tt.statusCode, ne.Status)
			}
		})
	}
}

func TestMiddleware_DefaultStatus200(t *testing.T) {
	s := newTestStore()
	dbg := newDebuggerWithStore(s)

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("no explicit status"))
	})

	mw := stdlib.Middleware(dbg)
	wrapped := mw(handler)

	req := httptest.NewRequest(http.MethodPost, "/submit", nil)
	rec := httptest.NewRecorder()
	wrapped.ServeHTTP(rec, req)

	entries := s.Query("network", nil)
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}

	ne := entries[0].(*protocol.NetworkEntry)
	if ne.Status != 200 {
		t.Errorf("expected default status 200, got %d", ne.Status)
	}
	if ne.Method != "POST" {
		t.Errorf("expected method POST, got %s", ne.Method)
	}
}

func TestMiddleware_MultipleRequests(t *testing.T) {
	s := newTestStore()
	dbg := newDebuggerWithStore(s)

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	mw := stdlib.Middleware(dbg)
	wrapped := mw(handler)

	paths := []string{"/a", "/b", "/c"}
	for _, p := range paths {
		req := httptest.NewRequest(http.MethodGet, p, nil)
		rec := httptest.NewRecorder()
		wrapped.ServeHTTP(rec, req)
	}

	entries := s.Query("network", nil)
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(entries))
	}

	for i, e := range entries {
		ne := e.(*protocol.NetworkEntry)
		if ne.URL != paths[i] {
			t.Errorf("entry %d: expected URL %s, got %s", i, paths[i], ne.URL)
		}
	}
}

func TestMiddleware_RecordsDuration(t *testing.T) {
	s := newTestStore()
	dbg := newDebuggerWithStore(s)

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(10 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	})

	mw := stdlib.Middleware(dbg)
	wrapped := mw(handler)

	req := httptest.NewRequest(http.MethodGet, "/slow", nil)
	rec := httptest.NewRecorder()
	wrapped.ServeHTTP(rec, req)

	entries := s.Query("network", nil)
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}

	ne := entries[0].(*protocol.NetworkEntry)
	if ne.Duration < 10 {
		t.Errorf("expected duration >= 10ms, got %f", ne.Duration)
	}
}

package browser

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ephem-sh/debugger/packages/ephem-debugger-go/protocol"
	"github.com/ephem-sh/debugger/packages/ephem-debugger-go/store"
)

func newTestStore() *store.Store {
	return store.NewStore(&protocol.SessionInfo{
		SessionID: "test-session",
		Framework: "test",
		Port:      3000,
	})
}

func TestHandleRoutes_ScriptServing(t *testing.T) {
	s := newTestStore()
	req := httptest.NewRequest(http.MethodGet, "/_/d.js", nil)
	rec := httptest.NewRecorder()

	handled := HandleRoutes(rec, req, s)
	if !handled {
		t.Fatal("expected HandleRoutes to return true for /_/d.js GET")
	}

	resp := rec.Result()
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); ct != "application/javascript" {
		t.Fatalf("expected Content-Type application/javascript, got %q", ct)
	}
	if cc := resp.Header.Get("Cache-Control"); cc != "no-store" {
		t.Fatalf("expected Cache-Control no-store, got %q", cc)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "__DEBUGGER_INITIALIZED__") {
		t.Fatal("expected script body to contain __DEBUGGER_INITIALIZED__")
	}
}

func TestHandleRoutes_CORSPreflight(t *testing.T) {
	s := newTestStore()
	req := httptest.NewRequest(http.MethodOptions, "/_/d", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	rec := httptest.NewRecorder()

	handled := HandleRoutes(rec, req, s)
	if !handled {
		t.Fatal("expected HandleRoutes to return true for /_/d OPTIONS")
	}

	resp := rec.Result()
	if resp.StatusCode != 204 {
		t.Fatalf("expected 204, got %d", resp.StatusCode)
	}
	if origin := resp.Header.Get("Access-Control-Allow-Origin"); origin != "http://localhost:3000" {
		t.Fatalf("expected origin http://localhost:3000, got %q", origin)
	}
	if methods := resp.Header.Get("Access-Control-Allow-Methods"); methods != "POST, GET, OPTIONS" {
		t.Fatalf("expected methods POST, GET, OPTIONS, got %q", methods)
	}
}

func TestHandleRoutes_CORSPreflight_NoOrigin(t *testing.T) {
	s := newTestStore()
	req := httptest.NewRequest(http.MethodOptions, "/_/d", nil)
	rec := httptest.NewRecorder()

	HandleRoutes(rec, req, s)

	resp := rec.Result()
	if origin := resp.Header.Get("Access-Control-Allow-Origin"); origin != "*" {
		t.Fatalf("expected origin *, got %q", origin)
	}
}

func TestHandleRoutes_Ingest(t *testing.T) {
	s := newTestStore()
	payload := `[{"type":"console","level":"info","args":["hello"],"timestamp":1710000000000,"source":"browser"}]`
	req := httptest.NewRequest(http.MethodPost, "/_/d", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:3000")
	rec := httptest.NewRecorder()

	handled := HandleRoutes(rec, req, s)
	if !handled {
		t.Fatal("expected HandleRoutes to return true for /_/d POST")
	}

	resp := rec.Result()
	if resp.StatusCode != 204 {
		t.Fatalf("expected 204, got %d", resp.StatusCode)
	}
	if origin := resp.Header.Get("Access-Control-Allow-Origin"); origin != "http://localhost:3000" {
		t.Fatalf("expected origin http://localhost:3000, got %q", origin)
	}

	// Verify entries were pushed to the store.
	entries := s.Query("console", nil)
	if len(entries) != 1 {
		t.Fatalf("expected 1 console entry, got %d", len(entries))
	}
}

func TestHandleRoutes_IngestMultipleTypes(t *testing.T) {
	s := newTestStore()
	payload := `[
		{"type":"console","level":"warn","args":["warning"],"timestamp":1710000000000,"source":"browser"},
		{"type":"error","message":"oops","timestamp":1710000000001,"source":"browser"},
		{"type":"network","url":"https://api.example.com","method":"GET","status":200,"duration":42,"timestamp":1710000000002,"failed":false,"source":"browser","kind":"fetch"}
	]`
	req := httptest.NewRequest(http.MethodPost, "/_/d", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	HandleRoutes(rec, req, s)

	consoleEntries := s.Query("console", nil)
	if len(consoleEntries) != 1 {
		t.Fatalf("expected 1 console entry, got %d", len(consoleEntries))
	}
	errorEntries := s.Query("errors", nil)
	if len(errorEntries) != 1 {
		t.Fatalf("expected 1 error entry, got %d", len(errorEntries))
	}
	networkEntries := s.Query("network", nil)
	if len(networkEntries) != 1 {
		t.Fatalf("expected 1 network entry, got %d", len(networkEntries))
	}
}

func TestHandleRoutes_UnhandledPath(t *testing.T) {
	s := newTestStore()
	req := httptest.NewRequest(http.MethodGet, "/api/hello", nil)
	rec := httptest.NewRecorder()

	handled := HandleRoutes(rec, req, s)
	if handled {
		t.Fatal("expected HandleRoutes to return false for /api/hello")
	}
}

func TestHandleRoutes_IngestMalformedBody(t *testing.T) {
	s := newTestStore()
	req := httptest.NewRequest(http.MethodPost, "/_/d", strings.NewReader("not json"))
	rec := httptest.NewRecorder()

	handled := HandleRoutes(rec, req, s)
	if !handled {
		t.Fatal("expected HandleRoutes to return true for /_/d POST even with malformed body")
	}
	if rec.Code != 204 {
		t.Fatalf("expected 204 even for malformed body, got %d", rec.Code)
	}

	entries := s.Query("all", nil)
	if len(entries) != 0 {
		t.Fatalf("expected 0 entries for malformed body, got %d", len(entries))
	}
}

func TestInjectScripts(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		contains string
		changed  bool
	}{
		{
			name:     "injects before </body>",
			input:    "<html><body><h1>Hello</h1></body></html>",
			contains: `__DEBUGGER_INGEST_URL__`,
			changed:  true,
		},
		{
			name:     "no </body> tag",
			input:    "<html><h1>Hello</h1></html>",
			contains: "",
			changed:  false,
		},
		{
			name:     "already injected",
			input:    `<html><body><script>window.__DEBUGGER_INGEST_URL__="/_/d";</script></body></html>`,
			contains: "",
			changed:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := InjectScripts(tt.input)
			if tt.changed {
				if result == tt.input {
					t.Fatal("expected HTML to be modified")
				}
				if !strings.Contains(result, tt.contains) {
					t.Fatalf("expected result to contain %q", tt.contains)
				}
				if !strings.Contains(result, "</body>") {
					t.Fatal("expected </body> to still be present")
				}
			} else {
				if tt.contains != "" && !strings.Contains(result, tt.contains) {
					t.Fatalf("expected result to contain %q", tt.contains)
				}
				if result != tt.input && !strings.Contains(tt.input, "__DEBUGGER_INGEST_URL__") {
					t.Fatal("expected HTML to be unchanged")
				}
			}
		})
	}
}

func TestClientScript_NotEmpty(t *testing.T) {
	if len(ClientScript) == 0 {
		t.Fatal("ClientScript must not be empty")
	}
	if !strings.Contains(ClientScript, "__DEBUGGER_INITIALIZED__") {
		t.Fatal("ClientScript must contain __DEBUGGER_INITIALIZED__")
	}
}

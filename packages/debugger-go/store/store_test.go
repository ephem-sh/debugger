package store

import (
	"testing"
	"time"

	"github.com/ephem-sh/debugger/packages/debugger-go/protocol"
)

func newTestSession() *protocol.SessionInfo {
	return &protocol.SessionInfo{
		SessionID: "test-session",
		Framework: "test",
		Port:      3000,
		PID:       1,
		StartedAt: time.Now().UnixMilli(),
	}
}

func TestStore_PushAndQueryConsole(t *testing.T) {
	s := NewStore(newTestSession())

	s.Push(&protocol.ConsoleEntry{
		Level:     "info",
		Args:      []any{"hello", "world"},
		Timestamp: time.Now().UnixMilli(),
		Source:    "server",
	})
	s.Push(&protocol.ConsoleEntry{
		Level:     "warn",
		Args:      []any{"warning"},
		Timestamp: time.Now().UnixMilli(),
		Source:    "server",
	})

	entries := s.Query("console", nil)
	if len(entries) != 2 {
		t.Fatalf("expected 2 console entries, got %d", len(entries))
	}

	// Verify auto-assigned IDs.
	for i, e := range entries {
		if e.GetID() == "" {
			t.Errorf("entry %d: expected non-empty ID", i)
		}
		if e.EntryType() != "console" {
			t.Errorf("entry %d: expected type console, got %s", i, e.EntryType())
		}
	}
}

func TestStore_PushAndQueryError(t *testing.T) {
	s := NewStore(newTestSession())

	s.Push(&protocol.ErrorEntry{
		Message:   "something broke",
		Stack:     "at main.go:42",
		Timestamp: time.Now().UnixMilli(),
		Source:    "server",
	})

	entries := s.Query("errors", nil)
	if len(entries) != 1 {
		t.Fatalf("expected 1 error entry, got %d", len(entries))
	}

	ee := entries[0].(*protocol.ErrorEntry)
	if ee.Message != "something broke" {
		t.Errorf("expected message 'something broke', got %q", ee.Message)
	}
}

func TestStore_PushAndQueryNetwork(t *testing.T) {
	s := NewStore(newTestSession())

	s.Push(&protocol.NetworkEntry{
		URL:       "/api/test",
		Method:    "GET",
		Status:    200,
		Duration:  42,
		Timestamp: time.Now().UnixMilli(),
		Source:    "server",
	})

	entries := s.Query("network", nil)
	if len(entries) != 1 {
		t.Fatalf("expected 1 network entry, got %d", len(entries))
	}

	ne := entries[0].(*protocol.NetworkEntry)
	if ne.URL != "/api/test" {
		t.Errorf("expected URL /api/test, got %s", ne.URL)
	}
	if ne.Status != 200 {
		t.Errorf("expected status 200, got %d", ne.Status)
	}
}

func TestStore_PushAndQueryApp(t *testing.T) {
	s := NewStore(newTestSession())

	s.Push(&protocol.AppEntry{
		Timestamp: time.Now().UnixMilli(),
		Source:    "browser",
		Cookies:   []protocol.CookieInfo{{Name: "sid", Value: "abc123"}},
	})

	entries := s.Query("app", nil)
	if len(entries) != 1 {
		t.Fatalf("expected 1 app entry, got %d", len(entries))
	}
}

func TestStore_QueryAll(t *testing.T) {
	s := NewStore(newTestSession())
	now := time.Now().UnixMilli()

	s.Push(&protocol.ConsoleEntry{
		Level: "info", Args: []any{"log"}, Timestamp: now, Source: "server",
	})
	s.Push(&protocol.ErrorEntry{
		Message: "err", Timestamp: now + 1, Source: "server",
	})
	s.Push(&protocol.NetworkEntry{
		URL: "/", Method: "GET", Status: 200, Timestamp: now + 2, Source: "server",
	})

	entries := s.Query("all", nil)
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries from all, got %d", len(entries))
	}

	// Verify sorted by timestamp.
	for i := 1; i < len(entries); i++ {
		if entries[i].GetTimestamp() < entries[i-1].GetTimestamp() {
			t.Error("entries not sorted by timestamp")
		}
	}
}

func TestStore_FilterByLevel(t *testing.T) {
	s := NewStore(newTestSession())
	now := time.Now().UnixMilli()

	s.Push(&protocol.ConsoleEntry{
		Level: "info", Args: []any{"info msg"}, Timestamp: now, Source: "server",
	})
	s.Push(&protocol.ConsoleEntry{
		Level: "warn", Args: []any{"warn msg"}, Timestamp: now + 1, Source: "server",
	})
	s.Push(&protocol.ConsoleEntry{
		Level: "error", Args: []any{"error msg"}, Timestamp: now + 2, Source: "server",
	})

	entries := s.Query("console", &protocol.Filters{Level: "warn"})
	if len(entries) != 1 {
		t.Fatalf("expected 1 warn entry, got %d", len(entries))
	}

	ce := entries[0].(*protocol.ConsoleEntry)
	if ce.Level != "warn" {
		t.Errorf("expected level warn, got %s", ce.Level)
	}
}

func TestStore_FilterBySource(t *testing.T) {
	s := NewStore(newTestSession())
	now := time.Now().UnixMilli()

	s.Push(&protocol.ConsoleEntry{
		Level: "info", Args: []any{"server log"}, Timestamp: now, Source: "server",
	})
	s.Push(&protocol.ConsoleEntry{
		Level: "info", Args: []any{"browser log"}, Timestamp: now + 1, Source: "browser",
	})

	entries := s.Query("console", &protocol.Filters{Source: "browser"})
	if len(entries) != 1 {
		t.Fatalf("expected 1 browser entry, got %d", len(entries))
	}

	ce := entries[0].(*protocol.ConsoleEntry)
	if ce.Source != "browser" {
		t.Errorf("expected source browser, got %s", ce.Source)
	}
}

func TestStore_FilterByLimit(t *testing.T) {
	s := NewStore(newTestSession())
	now := time.Now().UnixMilli()

	for i := 0; i < 10; i++ {
		s.Push(&protocol.ConsoleEntry{
			Level: "info", Args: []any{i}, Timestamp: now + int64(i), Source: "server",
		})
	}

	entries := s.Query("console", &protocol.Filters{Limit: 3})
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries with limit, got %d", len(entries))
	}

	// Should be the last 3 entries (indices 7, 8, 9).
	ce := entries[0].(*protocol.ConsoleEntry)
	if ce.Args[0] != 7 {
		t.Errorf("expected first limited entry to have arg 7, got %v", ce.Args[0])
	}
}

func TestStore_FilterByLast(t *testing.T) {
	s := NewStore(newTestSession())
	now := time.Now().UnixMilli()

	// Push an old entry and a recent entry.
	s.Push(&protocol.ConsoleEntry{
		Level: "info", Args: []any{"old"}, Timestamp: now - 60000, Source: "server",
	})
	s.Push(&protocol.ConsoleEntry{
		Level: "info", Args: []any{"recent"}, Timestamp: now, Source: "server",
	})

	// Last 5000ms should only return the recent entry.
	entries := s.Query("console", &protocol.Filters{Last: 5000})
	if len(entries) != 1 {
		t.Fatalf("expected 1 recent entry, got %d", len(entries))
	}

	ce := entries[0].(*protocol.ConsoleEntry)
	if ce.Args[0] != "recent" {
		t.Errorf("expected recent entry, got %v", ce.Args[0])
	}
}

func TestStore_RingBufferOverflow(t *testing.T) {
	s := NewStore(newTestSession())

	// Push more than ConsoleCapacity entries.
	for i := 0; i < ConsoleCapacity+50; i++ {
		s.Push(&protocol.ConsoleEntry{
			Level: "info", Args: []any{i}, Timestamp: int64(i), Source: "server",
		})
	}

	entries := s.Query("console", nil)
	if len(entries) != ConsoleCapacity {
		t.Fatalf("expected %d entries after overflow, got %d", ConsoleCapacity, len(entries))
	}

	// First entry should be index 50 (the oldest surviving).
	first := entries[0].(*protocol.ConsoleEntry)
	if first.Args[0] != 50 {
		t.Errorf("expected first surviving entry arg 50, got %v", first.Args[0])
	}
}

func TestStore_Clear(t *testing.T) {
	s := NewStore(newTestSession())

	s.Push(&protocol.ConsoleEntry{
		Level: "info", Args: []any{"test"}, Timestamp: time.Now().UnixMilli(), Source: "server",
	})
	s.Push(&protocol.ErrorEntry{
		Message: "err", Timestamp: time.Now().UnixMilli(), Source: "server",
	})

	s.Clear()

	for _, cmd := range []string{"console", "errors", "network", "app"} {
		entries := s.Query(cmd, nil)
		if len(entries) != 0 {
			t.Errorf("expected 0 %s entries after clear, got %d", cmd, len(entries))
		}
	}
}

func TestStore_Session(t *testing.T) {
	session := newTestSession()
	s := NewStore(session)

	if s.Session() != session {
		t.Error("Session() should return the same session pointer")
	}
	if s.Session().SessionID != "test-session" {
		t.Errorf("expected session ID test-session, got %s", s.Session().SessionID)
	}
}

func TestStore_UnknownCommand(t *testing.T) {
	s := NewStore(newTestSession())

	entries := s.Query("nonexistent", nil)
	if entries != nil {
		t.Errorf("expected nil for unknown command, got %v", entries)
	}
}

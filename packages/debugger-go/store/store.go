package store

import (
	"sort"
	"time"

	"github.com/ephem-sh/debugger/packages/debugger-go/protocol"
)

// Default ring buffer capacities.
const (
	ConsoleCapacity = 500
	ErrorCapacity   = 100
	NetworkCapacity = 300
	AppCapacity     = 50
)

// Store manages separate ring buffers for each log entry type and provides
// a unified query interface used by the IPC bridge.
type Store struct {
	console *RingBuffer[*protocol.ConsoleEntry]
	errors  *RingBuffer[*protocol.ErrorEntry]
	network *RingBuffer[*protocol.NetworkEntry]
	app     *RingBuffer[*protocol.AppEntry]
	session *protocol.SessionInfo
}

// NewStore creates a Store with default buffer capacities.
func NewStore(session *protocol.SessionInfo) *Store {
	return &Store{
		console: NewRingBuffer[*protocol.ConsoleEntry](ConsoleCapacity),
		errors:  NewRingBuffer[*protocol.ErrorEntry](ErrorCapacity),
		network: NewRingBuffer[*protocol.NetworkEntry](NetworkCapacity),
		app:     NewRingBuffer[*protocol.AppEntry](AppCapacity),
		session: session,
	}
}

// Push adds a log entry to the appropriate ring buffer. It assigns an ID
// if one is not already set.
func (s *Store) Push(entry protocol.LogEntry) {
	if entry.GetID() == "" {
		entry.SetID(protocol.GenerateID())
	}

	switch e := entry.(type) {
	case *protocol.ConsoleEntry:
		e.Type = "console"
		s.console.Push(e)
	case *protocol.ErrorEntry:
		e.Type = "error"
		s.errors.Push(e)
	case *protocol.NetworkEntry:
		e.Type = "network"
		s.network.Push(e)
	case *protocol.AppEntry:
		e.Type = "app"
		s.app.Push(e)
	}
}

// Session returns the current session info.
func (s *Store) Session() *protocol.SessionInfo {
	return s.session
}

// Clear empties all ring buffers.
func (s *Store) Clear() {
	s.console.Clear()
	s.errors.Clear()
	s.network.Clear()
	s.app.Clear()
}

// Query executes a command with optional filters and returns matching entries.
func (s *Store) Query(command string, filters *protocol.Filters) []protocol.LogEntry {
	if filters == nil {
		filters = &protocol.Filters{}
	}

	var results []protocol.LogEntry

	switch command {
	case "console":
		results = s.queryConsole(filters)
	case "errors":
		results = s.queryErrors(filters)
	case "network":
		results = s.queryNetwork(filters)
	case "app":
		results = s.queryApp(filters)
	case "all":
		results = s.queryAll(filters)
	case "status", "push":
		return nil
	default:
		return nil
	}

	results = applyCommonFilters(results, filters)
	return results
}

func (s *Store) queryConsole(f *protocol.Filters) []protocol.LogEntry {
	entries := s.console.Filter(func(e *protocol.ConsoleEntry) bool {
		if f.Level != "" && e.Level != f.Level {
			return false
		}
		if f.Source != "" && e.Source != f.Source {
			return false
		}
		return true
	})
	result := make([]protocol.LogEntry, len(entries))
	for i, e := range entries {
		result[i] = e
	}
	return result
}

func (s *Store) queryErrors(f *protocol.Filters) []protocol.LogEntry {
	entries := s.errors.Filter(func(e *protocol.ErrorEntry) bool {
		if f.Source != "" && e.Source != f.Source {
			return false
		}
		return true
	})
	result := make([]protocol.LogEntry, len(entries))
	for i, e := range entries {
		result[i] = e
	}
	return result
}

func (s *Store) queryNetwork(f *protocol.Filters) []protocol.LogEntry {
	entries := s.network.Filter(func(e *protocol.NetworkEntry) bool {
		if f.Status != 0 && float64(e.Status) != f.Status {
			return false
		}
		if f.Failed != nil && e.Failed != *f.Failed {
			return false
		}
		return true
	})
	result := make([]protocol.LogEntry, len(entries))
	for i, e := range entries {
		result[i] = e
	}
	return result
}

func (s *Store) queryApp(_ *protocol.Filters) []protocol.LogEntry {
	entries := s.app.ToSlice()
	result := make([]protocol.LogEntry, len(entries))
	for i, e := range entries {
		result[i] = e
	}
	return result
}

func (s *Store) queryAll(f *protocol.Filters) []protocol.LogEntry {
	var all []protocol.LogEntry
	all = append(all, s.queryConsole(f)...)
	all = append(all, s.queryErrors(f)...)
	all = append(all, s.queryNetwork(f)...)
	all = append(all, s.queryApp(f)...)

	sort.Slice(all, func(i, j int) bool {
		return all[i].GetTimestamp() < all[j].GetTimestamp()
	})
	return all
}

// applyCommonFilters applies id, ids, last, limit, and source filters that
// are shared across all query commands.
func applyCommonFilters(entries []protocol.LogEntry, f *protocol.Filters) []protocol.LogEntry {
	// Filter by single ID
	if f.ID != "" {
		for _, e := range entries {
			if e.GetID() == f.ID {
				return []protocol.LogEntry{e}
			}
		}
		return nil
	}

	// Filter by multiple IDs
	if len(f.IDs) > 0 {
		idSet := make(map[string]struct{}, len(f.IDs))
		for _, id := range f.IDs {
			idSet[id] = struct{}{}
		}
		var filtered []protocol.LogEntry
		for _, e := range entries {
			if _, ok := idSet[e.GetID()]; ok {
				filtered = append(filtered, e)
			}
		}
		entries = filtered
	}

	// Filter by time window (last N milliseconds)
	if f.Last > 0 {
		cutoff := time.Now().UnixMilli() - int64(f.Last)
		var filtered []protocol.LogEntry
		for _, e := range entries {
			if e.GetTimestamp() >= cutoff {
				filtered = append(filtered, e)
			}
		}
		entries = filtered
	}

	// Apply limit (take last N entries)
	if f.Limit > 0 {
		limit := int(f.Limit)
		if limit < len(entries) {
			entries = entries[len(entries)-limit:]
		}
	}

	return entries
}

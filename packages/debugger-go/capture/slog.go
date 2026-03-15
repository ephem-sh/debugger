// Package capture provides logging integrations that capture log output
// into the debugger store. It includes an slog.Handler for structured
// logging (Go 1.21+) and an io.Writer for the standard log package.
package capture

import (
	"context"
	"log/slog"
	"sync"

	"github.com/ephem-sh/debugger/packages/debugger-go/protocol"
	"github.com/ephem-sh/debugger/packages/debugger-go/store"
)

// Handler is an slog.Handler that captures log records into the debugger
// store while optionally chaining to a next handler so existing logging
// continues to work.
type Handler struct {
	store    *store.Store
	next     slog.Handler
	level    slog.Level
	attrs    []slog.Attr
	groups   []string
	pushing  sync.Mutex // reentrant guard — prevents deadlock when chained handler triggers slog
}

// NewHandler creates a Handler that writes to the given store and chains
// to next (which may be nil if no chaining is desired).
func NewHandler(s *store.Store, next slog.Handler) *Handler {
	return &Handler{
		store: s,
		next:  next,
		level: slog.LevelDebug,
	}
}

// Enabled reports whether the handler handles records at the given level.
func (h *Handler) Enabled(_ context.Context, level slog.Level) bool {
	if h.next != nil {
		return level >= h.level || h.next.Enabled(context.Background(), level)
	}
	return level >= h.level
}

// Handle processes the log record, pushing it to the store and optionally
// forwarding to the next handler.
func (h *Handler) Handle(ctx context.Context, r slog.Record) error {
	// Build args from the message and all attributes.
	args := []any{r.Message}
	// Include handler-level attrs.
	for _, a := range h.attrs {
		args = append(args, attrToMap(a, h.groups))
	}
	// Include record-level attrs.
	r.Attrs(func(a slog.Attr) bool {
		args = append(args, attrToMap(a, h.groups))
		return true
	})

	entry := &protocol.ConsoleEntry{
		Type:      "console",
		Level:     mapSlogLevel(r.Level),
		Args:      args,
		Timestamp: r.Time.UnixMilli(),
		Source:    "server",
	}

	// TryLock prevents deadlock when the chained handler (or its output
	// target) triggers another slog call that re-enters this handler.
	if h.pushing.TryLock() {
		h.store.Push(entry)
		h.pushing.Unlock()
	}

	if h.next != nil {
		return h.next.Handle(ctx, r)
	}
	return nil
}

// WithAttrs returns a new Handler with the given attributes pre-applied.
func (h *Handler) WithAttrs(attrs []slog.Attr) slog.Handler {
	newAttrs := make([]slog.Attr, len(h.attrs)+len(attrs))
	copy(newAttrs, h.attrs)
	copy(newAttrs[len(h.attrs):], attrs)
	var nextWithAttrs slog.Handler
	if h.next != nil {
		nextWithAttrs = h.next.WithAttrs(attrs)
	}
	return &Handler{
		store:  h.store,
		next:   nextWithAttrs,
		level:  h.level,
		attrs:  newAttrs,
		groups: h.groups,
	}
}

// WithGroup returns a new Handler with the given group name applied.
func (h *Handler) WithGroup(name string) slog.Handler {
	if name == "" {
		return h
	}
	newGroups := make([]string, len(h.groups)+1)
	copy(newGroups, h.groups)
	newGroups[len(h.groups)] = name
	var nextWithGroup slog.Handler
	if h.next != nil {
		nextWithGroup = h.next.WithGroup(name)
	}
	return &Handler{
		store:  h.store,
		next:   nextWithGroup,
		level:  h.level,
		attrs:  h.attrs,
		groups: newGroups,
	}
}

// mapSlogLevel converts an slog.Level to the protocol level string.
func mapSlogLevel(l slog.Level) string {
	switch {
	case l >= slog.LevelError:
		return "error"
	case l >= slog.LevelWarn:
		return "warn"
	case l >= slog.LevelInfo:
		return "info"
	default:
		return "debug"
	}
}

// attrToMap converts an slog.Attr into a map representation suitable for
// JSON serialization in the args array.
func attrToMap(a slog.Attr, groups []string) any {
	// If no groups, return a simple key:value map.
	m := map[string]any{a.Key: a.Value.Any()}

	// Wrap in groups (innermost first).
	for i := len(groups) - 1; i >= 0; i-- {
		m = map[string]any{groups[i]: m}
	}
	return m
}

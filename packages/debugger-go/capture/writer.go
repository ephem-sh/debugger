package capture

import (
	"strings"
	"time"

	"github.com/ephem-sh/debugger/packages/debugger-go/protocol"
	"github.com/ephem-sh/debugger/packages/debugger-go/store"
)

// Writer implements io.Writer and captures written bytes as console log
// entries. It is designed to be used with log.SetOutput or io.MultiWriter
// to capture output from the standard log package.
type Writer struct {
	store *store.Store
	level string
}

// NewWriter creates a Writer that pushes entries at the given level
// (e.g. "log", "info", "warn", "error").
func NewWriter(s *store.Store, level string) *Writer {
	return &Writer{
		store: s,
		level: level,
	}
}

// Write implements io.Writer. Each call creates a console entry with the
// written bytes as the message.
func (w *Writer) Write(p []byte) (n int, err error) {
	msg := strings.TrimRight(string(p), "\n\r")
	if msg == "" {
		return len(p), nil
	}

	entry := &protocol.ConsoleEntry{
		Type:      "console",
		Level:     w.level,
		Args:      []any{msg},
		Timestamp: time.Now().UnixMilli(),
		Source:    "server",
	}
	w.store.Push(entry)
	return len(p), nil
}

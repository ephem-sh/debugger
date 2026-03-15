package protocol

import (
	"encoding/json"
	"fmt"
)

// MarshalEntry serializes a LogEntry to JSON, including the discriminator
// "type" field that is already part of each concrete struct.
func MarshalEntry(entry LogEntry) ([]byte, error) {
	return json.Marshal(entry)
}

// UnmarshalEntry deserializes a JSON object into the correct LogEntry
// concrete type by peeking at the "type" discriminator field.
func UnmarshalEntry(data []byte) (LogEntry, error) {
	var peek struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(data, &peek); err != nil {
		return nil, fmt.Errorf("unmarshal entry type: %w", err)
	}

	switch peek.Type {
	case "console":
		var e ConsoleEntry
		if err := json.Unmarshal(data, &e); err != nil {
			return nil, fmt.Errorf("unmarshal console entry: %w", err)
		}
		return &e, nil
	case "error":
		var e ErrorEntry
		if err := json.Unmarshal(data, &e); err != nil {
			return nil, fmt.Errorf("unmarshal error entry: %w", err)
		}
		return &e, nil
	case "network":
		var e NetworkEntry
		if err := json.Unmarshal(data, &e); err != nil {
			return nil, fmt.Errorf("unmarshal network entry: %w", err)
		}
		return &e, nil
	case "app":
		var e AppEntry
		if err := json.Unmarshal(data, &e); err != nil {
			return nil, fmt.Errorf("unmarshal app entry: %w", err)
		}
		return &e, nil
	default:
		return nil, fmt.Errorf("unknown entry type: %q", peek.Type)
	}
}

// marshalQueryResponseJSON is a helper that produces the JSON representation
// of a QueryResponse, correctly serializing the Data field which contains
// interface values.
type queryResponseJSON struct {
	ID      string           `json:"id"`
	OK      bool             `json:"ok"`
	Data    []json.RawMessage `json:"data"`
	Session *SessionInfo     `json:"session,omitempty"`
	Error   string           `json:"error,omitempty"`
}

// MarshalQueryResponse serializes a QueryResponse to JSON.
func MarshalQueryResponse(r *QueryResponse) ([]byte, error) {
	raw := queryResponseJSON{
		ID:      r.ID,
		OK:      r.OK,
		Data:    make([]json.RawMessage, 0, len(r.Data)),
		Session: r.Session,
		Error:   r.Error,
	}
	for _, entry := range r.Data {
		b, err := MarshalEntry(entry)
		if err != nil {
			return nil, fmt.Errorf("marshal response data entry: %w", err)
		}
		raw.Data = append(raw.Data, b)
	}
	return json.Marshal(raw)
}

// UnmarshalQueryRequest deserializes a JSON object into a QueryRequest.
func UnmarshalQueryRequest(data []byte) (*QueryRequest, error) {
	var req QueryRequest
	if err := json.Unmarshal(data, &req); err != nil {
		return nil, fmt.Errorf("unmarshal query request: %w", err)
	}
	return &req, nil
}

// UnmarshalPushData deserializes the "data" field of a push command, which
// contains a single LogEntry sent from the browser client.
func UnmarshalPushData(data []byte) (LogEntry, error) {
	// A push request has {id, command:"push", filters:{...}} but the entry
	// is sent as a separate line. This helper just delegates to UnmarshalEntry.
	return UnmarshalEntry(data)
}

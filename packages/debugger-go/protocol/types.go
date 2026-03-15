// Package protocol defines the NDJSON IPC message types shared between the
// debugger bridge and the CLI client.
package protocol

import (
	"crypto/rand"
	"encoding/hex"
)

// LogEntry is the interface implemented by all entry types (console, error,
// network, app). It provides the discriminator and common accessors needed
// for storage, querying, and serialization.
type LogEntry interface {
	EntryType() string
	GetID() string
	GetTimestamp() int64
	SetID(id string)
}

// GenerateID returns a cryptographically random 6-character hex string
// suitable for use as an entry identifier.
func GenerateID() string {
	b := make([]byte, 3)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// --- ConsoleEntry ---

// ConsoleEntry represents a captured console log message.
type ConsoleEntry struct {
	Type      string `json:"type"`
	ID        string `json:"id,omitempty"`
	Level     string `json:"level"`
	Args      []any  `json:"args"`
	Timestamp int64  `json:"timestamp"`
	Source    string `json:"source"`
}

func (e *ConsoleEntry) EntryType() string  { return "console" }
func (e *ConsoleEntry) GetID() string      { return e.ID }
func (e *ConsoleEntry) GetTimestamp() int64 { return e.Timestamp }
func (e *ConsoleEntry) SetID(id string)    { e.ID = id }

// --- ErrorEntry ---

// ErrorEntry represents a captured runtime error.
type ErrorEntry struct {
	Type      string `json:"type"`
	ID        string `json:"id,omitempty"`
	Message   string `json:"message"`
	Stack     string `json:"stack,omitempty"`
	Timestamp int64  `json:"timestamp"`
	Source    string `json:"source"`
	URL       string `json:"url,omitempty"`
	Component string `json:"component,omitempty"`
}

func (e *ErrorEntry) EntryType() string  { return "error" }
func (e *ErrorEntry) GetID() string      { return e.ID }
func (e *ErrorEntry) GetTimestamp() int64 { return e.Timestamp }
func (e *ErrorEntry) SetID(id string)    { e.ID = id }

// --- NetworkEntry ---

// NetworkEntry represents a captured network request (fetch, XHR, or WebSocket).
type NetworkEntry struct {
	Type            string            `json:"type"`
	ID              string            `json:"id,omitempty"`
	URL             string            `json:"url"`
	Method          string            `json:"method"`
	Status          int               `json:"status"`
	Duration        float64           `json:"duration"`
	Timestamp       int64             `json:"timestamp"`
	Failed          bool              `json:"failed"`
	Source          string            `json:"source"`
	Kind            string            `json:"kind,omitempty"`
	RequestHeaders  map[string]string `json:"requestHeaders,omitempty"`
	ResponseHeaders map[string]string `json:"responseHeaders,omitempty"`
	ResponseBody    string            `json:"responseBody,omitempty"`
	ConnectionID    string            `json:"connectionId,omitempty"`
	MessageCount    int               `json:"messageCount,omitempty"`
	WSReadyState    int               `json:"wsReadyState,omitempty"`
}

func (e *NetworkEntry) EntryType() string  { return "network" }
func (e *NetworkEntry) GetID() string      { return e.ID }
func (e *NetworkEntry) GetTimestamp() int64 { return e.Timestamp }
func (e *NetworkEntry) SetID(id string)    { e.ID = id }

// --- AppEntry ---

// CookieInfo represents a single browser cookie.
type CookieInfo struct {
	Name     string  `json:"name"`
	Value    string  `json:"value"`
	Domain   string  `json:"domain,omitempty"`
	Path     string  `json:"path,omitempty"`
	Expires  float64 `json:"expires,omitempty"`
	Secure   bool    `json:"secure,omitempty"`
	SameSite string  `json:"sameSite,omitempty"`
}

// ServiceWorkerInfo describes a registered service worker.
type ServiceWorkerInfo struct {
	Scope     string `json:"scope"`
	ScriptURL string `json:"scriptURL"`
	State     string `json:"state"`
}

// CacheInfo describes a Cache Storage entry.
type CacheInfo struct {
	Name       string `json:"name"`
	EntryCount int    `json:"entryCount"`
}

// PermissionInfo describes a browser permission state.
type PermissionInfo struct {
	Name  string `json:"name"`
	State string `json:"state"`
}

// StorageEstimate describes the browser storage quota and usage.
type StorageEstimate struct {
	Usage float64 `json:"usage"`
	Quota float64 `json:"quota"`
}

// AppEntry represents a snapshot of browser application state (cookies,
// storage, service workers, etc.).
type AppEntry struct {
	Type            string             `json:"type"`
	ID              string             `json:"id,omitempty"`
	Timestamp       int64              `json:"timestamp"`
	Source          string             `json:"source"`
	Cookies         []CookieInfo       `json:"cookies,omitempty"`
	LocalStorage    map[string]string  `json:"localStorage,omitempty"`
	SessionStorage  map[string]string  `json:"sessionStorage,omitempty"`
	ServiceWorkers  []ServiceWorkerInfo `json:"serviceWorkers,omitempty"`
	CacheStorage    []CacheInfo        `json:"cacheStorage,omitempty"`
	Permissions     []PermissionInfo   `json:"permissions,omitempty"`
	StorageEstimate *StorageEstimate   `json:"storageEstimate,omitempty"`
}

func (e *AppEntry) EntryType() string  { return "app" }
func (e *AppEntry) GetID() string      { return e.ID }
func (e *AppEntry) GetTimestamp() int64 { return e.Timestamp }
func (e *AppEntry) SetID(id string)    { e.ID = id }

// --- Session & Query ---

// SessionInfo describes the running debugger session.
type SessionInfo struct {
	SessionID  string `json:"sessionId"`
	Framework  string `json:"framework"`
	Port       int    `json:"port"`
	PID        int    `json:"pid"`
	StartedAt  int64  `json:"startedAt"`
	SocketPath string `json:"socketPath"`
}

// Filters contains the optional query filters sent by the CLI client.
type Filters struct {
	ID          string   `json:"id,omitempty"`
	IDs         []string `json:"ids,omitempty"`
	Last        float64  `json:"last,omitempty"`
	Level       string   `json:"level,omitempty"`
	Status      float64  `json:"status,omitempty"`
	Failed      *bool    `json:"failed,omitempty"`
	Limit       float64  `json:"limit,omitempty"`
	Source      string   `json:"source,omitempty"`
	Subcommand  string   `json:"subcommand,omitempty"`
	Name        string   `json:"name,omitempty"`
	Key         string   `json:"key,omitempty"`
	StorageType string   `json:"storageType,omitempty"`
}

// QueryRequest is the NDJSON message sent from the CLI to the bridge.
type QueryRequest struct {
	ID      string   `json:"id"`
	Command string   `json:"command"`
	Filters *Filters `json:"filters,omitempty"`
}

// QueryResponse is the NDJSON message sent from the bridge back to the CLI.
type QueryResponse struct {
	ID      string       `json:"id"`
	OK      bool         `json:"ok"`
	Data    []LogEntry   `json:"-"`
	Session *SessionInfo `json:"session,omitempty"`
	Error   string       `json:"error,omitempty"`
}

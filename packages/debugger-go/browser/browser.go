// Package browser provides shared browser support for debugger middlewares.
// It handles serving the browser IIFE script, processing ingest POST requests,
// CORS preflight, and HTML injection of script tags.
package browser

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/ephem-sh/debugger/packages/ephem-debugger-go/protocol"
	"github.com/ephem-sh/debugger/packages/ephem-debugger-go/store"
)

// ScriptTags is the HTML snippet injected before </body> to load the
// browser instrumentation IIFE.
const ScriptTags = `<script>window.__DEBUGGER_INGEST_URL__="/_/d";</script><script src="/_/d.js" defer></script>`

// HandleRoutes checks if the request is a debugger browser route and handles
// it. Returns true if the request was handled, false to continue to the next
// handler.
func HandleRoutes(w http.ResponseWriter, r *http.Request, s *store.Store) bool {
	switch {
	case r.URL.Path == "/_/d.js" && r.Method == http.MethodGet:
		serveScript(w)
		return true

	case r.URL.Path == "/_/d" && r.Method == http.MethodOptions:
		handleCORSPreflight(w, r)
		return true

	case r.URL.Path == "/_/d" && r.Method == http.MethodPost:
		handleIngest(w, r, s)
		return true
	}
	return false
}

// InjectScripts injects debugger script tags into an HTML response body
// before the closing </body> tag. Returns the modified HTML. If the tags
// are already present, the original HTML is returned unchanged.
func InjectScripts(html string) string {
	if strings.Contains(html, "__DEBUGGER_INGEST_URL__") {
		return html
	}
	idx := strings.LastIndex(html, "</body>")
	if idx == -1 {
		return html
	}
	return html[:idx] + ScriptTags + html[idx:]
}

func serveScript(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/javascript")
	w.Header().Set("Cache-Control", "no-store")
	io.WriteString(w, ClientScript)
}

func handleCORSPreflight(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin == "" {
		origin = "*"
	}
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.WriteHeader(204)
}

func handleIngest(w http.ResponseWriter, r *http.Request, s *store.Store) {
	origin := r.Header.Get("Origin")
	if origin == "" {
		origin = "*"
	}

	body, err := io.ReadAll(r.Body)
	if err == nil {
		var rawEntries []json.RawMessage
		if json.Unmarshal(body, &rawEntries) == nil {
			for _, raw := range rawEntries {
				entry, err := protocol.UnmarshalEntry(raw)
				if err == nil {
					s.Push(entry)
				}
			}
		}
	}

	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.WriteHeader(204)
}

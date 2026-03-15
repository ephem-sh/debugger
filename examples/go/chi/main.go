package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	debugger "github.com/ephem-sh/debugger/packages/debugger-go"
	"github.com/ephem-sh/debugger/packages/debugger-go/capture"
	stdlib "github.com/ephem-sh/debugger/packages/debugger-go/middleware/stdlib"
)

func main() {
	dbg, err := debugger.New(debugger.Options{
		Framework: "chi",
		Port:      9876,
	})
	if err != nil {
		slog.Error("failed to start debugger", "error", err)
		os.Exit(1)
	}
	defer dbg.Close()

	// Set up slog to capture logs into the debugger store.
	handler := capture.NewHandler(dbg.Store, slog.Default().Handler())
	slog.SetDefault(slog.New(handler))

	r := chi.NewRouter()
	r.Use(chimiddleware.Recoverer)
	r.Use(stdlib.Middleware(dbg))

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		slog.Info("home page hit")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"status": "ok", "framework": "chi"})
	})

	r.Get("/api/test", func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Query().Get("id")
		slog.Info("test endpoint", "id", id)

		if r.URL.Query().Get("error") == "true" {
			slog.Error("test error triggered", "id", id)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]any{"error": "test error", "id": id})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "id": id})
	})

	r.Get("/api/users", func(w http.ResponseWriter, r *http.Request) {
		slog.Info("fetching users")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"users": []string{"alice", "bob", "charlie"}})
	})

	r.Post("/api/data", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			slog.Error("invalid JSON", "error", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]any{"error": "invalid JSON"})
			return
		}
		slog.Info("received data", "body", body)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"received": body})
	})

	slog.Info("starting chi server", "port", 9876)
	http.ListenAndServe(":9876", r)
}

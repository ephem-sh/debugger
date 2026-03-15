package main

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	dbg "github.com/ephem-sh/debugger/packages/debugger-go/middleware/chi"
)

func main() {
	defer dbg.Close()
	log := dbg.Logger()

	r := chi.NewRouter()
	r.Use(dbg.Middleware(9878))

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		log.Info("home page hit")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"status": "ok", "framework": "chi"})
	})

	r.Get("/api/test", func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Query().Get("id")
		log.Info("test endpoint", "id", id)
		if r.URL.Query().Get("error") == "true" {
			log.Error("test error triggered", "id", id)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]any{"error": "test error", "id": id})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"ok": true, "id": id})
	})

	r.Get("/api/users", func(w http.ResponseWriter, r *http.Request) {
		log.Info("fetching users")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"users": []string{"alice", "bob", "charlie"}})
	})

	r.Post("/api/data", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			log.Error("invalid JSON", "error", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]any{"error": "invalid JSON"})
			return
		}
		log.Info("received data", "body", body)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"received": body})
	})

	http.ListenAndServe(":9878", r)
}

package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	debugger "github.com/ephem-sh/debugger/packages/debugger-go"
	"github.com/ephem-sh/debugger/packages/debugger-go/capture"
	"github.com/ephem-sh/debugger/packages/debugger-go/protocol"
)

func main() {
	dbg, err := debugger.New(debugger.Options{
		Framework: "echo",
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

	e := echo.New()
	e.Use(middleware.Recover())

	// Debugger middleware — captures HTTP requests as network entries.
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()
			err := next(c)
			duration := time.Since(start).Milliseconds()

			dbg.Store.Push(&protocol.NetworkEntry{
				URL:       c.Request().URL.String(),
				Method:    c.Request().Method,
				Status:    c.Response().Status,
				Duration:  float64(duration),
				Timestamp: start.UnixMilli(),
				Source:    "server",
				Kind:      "fetch",
			})

			return err
		}
	})

	e.GET("/", func(c echo.Context) error {
		slog.Info("home page hit")
		return c.JSON(http.StatusOK, map[string]any{"status": "ok", "framework": "echo"})
	})

	e.GET("/api/test", func(c echo.Context) error {
		id := c.QueryParam("id")
		slog.Info("test endpoint", "id", id)

		if c.QueryParam("error") == "true" {
			slog.Error("test error triggered", "id", id)
			return c.JSON(http.StatusInternalServerError, map[string]any{"error": "test error", "id": id})
		}
		return c.JSON(http.StatusOK, map[string]any{"ok": true, "id": id})
	})

	e.GET("/api/users", func(c echo.Context) error {
		slog.Info("fetching users")
		return c.JSON(http.StatusOK, map[string]any{"users": []string{"alice", "bob", "charlie"}})
	})

	e.POST("/api/data", func(c echo.Context) error {
		var body map[string]any
		if err := json.NewDecoder(c.Request().Body).Decode(&body); err != nil {
			slog.Error("invalid JSON", "error", err)
			return c.JSON(http.StatusBadRequest, map[string]any{"error": "invalid JSON"})
		}
		slog.Info("received data", "body", body)
		return c.JSON(http.StatusOK, map[string]any{"received": body})
	})

	slog.Info("starting echo server", "port", 9876)
	e.Logger.Fatal(e.Start(":9876"))
}

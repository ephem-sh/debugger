package main

import (
	"encoding/json"
	"net/http"

	"github.com/labstack/echo/v4"

	dbg "github.com/ephem-sh/debugger/packages/debugger-go/middleware/echo"
)

func main() {
	defer dbg.Close()
	log := dbg.Logger()

	e := echo.New()
	e.Use(dbg.Middleware(9877))

	e.GET("/", func(c echo.Context) error {
		log.Info("home page hit")
		return c.JSON(http.StatusOK, map[string]any{"status": "ok", "framework": "echo"})
	})

	e.GET("/api/test", func(c echo.Context) error {
		id := c.QueryParam("id")
		log.Info("test endpoint", "id", id)
		if c.QueryParam("error") == "true" {
			log.Error("test error triggered", "id", id)
			return c.JSON(http.StatusInternalServerError, map[string]any{"error": "test error", "id": id})
		}
		return c.JSON(http.StatusOK, map[string]any{"ok": true, "id": id})
	})

	e.GET("/api/users", func(c echo.Context) error {
		log.Info("fetching users")
		return c.JSON(http.StatusOK, map[string]any{"users": []string{"alice", "bob", "charlie"}})
	})

	e.POST("/api/data", func(c echo.Context) error {
		var body map[string]any
		if err := json.NewDecoder(c.Request().Body).Decode(&body); err != nil {
			log.Error("invalid JSON", "error", err)
			return c.JSON(http.StatusBadRequest, map[string]any{"error": "invalid JSON"})
		}
		log.Info("received data", "body", body)
		return c.JSON(http.StatusOK, map[string]any{"received": body})
	})

	e.Logger.Fatal(e.Start(":9877"))
}

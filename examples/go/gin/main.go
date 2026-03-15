package main

import (
	"net/http"

	"github.com/gin-gonic/gin"

	dbg "github.com/ephem-sh/debugger/packages/debugger-go/middleware/gin"
)

func main() {
	defer dbg.Close()
	log := dbg.Logger()

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(dbg.Middleware(9876))

	r.GET("/", func(c *gin.Context) {
		log.Info("home page hit")
		c.JSON(http.StatusOK, gin.H{"status": "ok", "framework": "gin"})
	})

	r.GET("/api/test", func(c *gin.Context) {
		id := c.Query("id")
		log.Info("test endpoint", "id", id)
		if c.Query("error") == "true" {
			log.Error("test error triggered", "id", id)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "test error", "id": id})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true, "id": id})
	})

	r.GET("/api/users", func(c *gin.Context) {
		log.Info("fetching users")
		c.JSON(http.StatusOK, gin.H{"users": []string{"alice", "bob", "charlie"}})
	})

	r.POST("/api/data", func(c *gin.Context) {
		var body map[string]any
		if err := c.BindJSON(&body); err != nil {
			log.Error("invalid JSON", "error", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
			return
		}
		log.Info("received data", "body", body)
		c.JSON(http.StatusOK, gin.H{"received": body})
	})

	r.Run(":9876")
}

# ephem-debugger-go

Dev-only observability middleware for Go web frameworks. Part of the [debugger](https://github.com/ephem-sh/debugger) project.

Captures HTTP requests, console output, and browser-side data from your dev server. AI agents query this data through the `dbg` CLI.

> **Preview** — under active development.

## Install

```bash
go get github.com/ephem-sh/debugger/packages/ephem-debugger-go
```

## Gin

```go
package main

import (
	"github.com/gin-gonic/gin"
	debugger "github.com/ephem-sh/debugger/packages/ephem-debugger-go/middleware/gin"
)

func main() {
	r := gin.New()
	r.Use(debugger.Middleware(8080))
	debugger.Routes(r)

	r.GET("/", func(c *gin.Context) {
		c.String(200, "hello")
	})
	r.Run(":8080")
}
```

## Echo

```go
import (
	"github.com/labstack/echo/v4"
	debugger "github.com/ephem-sh/debugger/packages/ephem-debugger-go/middleware/echo"
)

e := echo.New()
e.Use(debugger.Middleware(8080))
debugger.Routes(e)
```

## Chi

```go
import (
	"github.com/go-chi/chi/v5"
	debugger "github.com/ephem-sh/debugger/packages/ephem-debugger-go/middleware/chi"
)

r := chi.NewRouter()
r.Use(debugger.Middleware(8080))
debugger.Mount(r)
```

## Query with CLI

```bash
npx dbg status
npx dbg server console
npx dbg browser console
npx dbg browser network
```

## How it works

1. Middleware captures HTTP request/response metadata and console output
2. IPC bridge exposes data via Unix socket (or TCP on Windows)
3. Browser client script is auto-injected into HTML responses
4. `dbg` CLI queries the session — works the same across all languages

## Other languages

- **Node.js** — [`@ephem-sh/debugger`](https://www.npmjs.com/package/@ephem-sh/debugger)
- **Python** — [`ephem-debugger-py`](https://pypi.org/project/ephem-debugger-py/)
- **Rust** — [`ephem-debugger-rs`](https://crates.io/crates/ephem-debugger-rs)

## License

MIT

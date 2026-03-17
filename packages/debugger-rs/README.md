# ephem-debugger-rs

Dev-only observability middleware for Rust web frameworks. Part of the [debugger](https://github.com/ephem-sh/debugger) project.

Captures HTTP requests, tracing output, and browser-side data from your dev server. AI agents query this data through the `dbg` CLI.

> **Preview** — under active development.

## Install

```toml
[dependencies]
ephem-debugger-rs = { version = "0.1", features = ["axum"] }
```

Available features: `axum`, `actix`, `rocket`, `poem`

## Axum

```rust
use ephem_debugger_rs::axum_middleware::DebuggerLayer;

let dbg = DebuggerLayer::new(3000).await;
let app = Router::new()
    .route("/", get(handler))
    .layer(dbg);
```

## Actix-web

```rust
use ephem_debugger_rs::actix_middleware;

let dbg = actix_middleware::init(8080).await;
App::new()
    .wrap(dbg.middleware())
    .configure(|cfg| dbg.browser_config(cfg))
```

## Rocket

```rust
use ephem_debugger_rs::rocket_middleware;

let dbg = rocket_middleware::init(8000).await;
rocket::build()
    .attach(dbg.fairing())
    .mount("/", dbg.browser_routes())
```

## Poem

```rust
use ephem_debugger_rs::poem_middleware;

let dbg = poem_middleware::init(3000).await;
let app = Route::new()
    .at("/", get(handler))
    .with(dbg.middleware());
```

## Query with CLI

```bash
npx dbg status
npx dbg server console
npx dbg browser console
npx dbg browser network
```

## How it works

1. Middleware captures HTTP request/response metadata and tracing output
2. IPC bridge exposes data via Unix socket (or TCP on Windows)
3. Browser client script is auto-injected into HTML responses
4. `dbg` CLI queries the session — works the same across all languages

## Other languages

- **Node.js** — [`@ephem-sh/debugger`](https://www.npmjs.com/package/@ephem-sh/debugger)
- **Go** — [`ephem-debugger-go`](https://github.com/ephem-sh/debugger/tree/main/packages/debugger-go)
- **Python** — [`ephem-debugger-py`](https://pypi.org/project/ephem-debugger-py/)

## License

MIT

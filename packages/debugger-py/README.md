# ephem-debugger-py

Dev-only observability middleware for Python web frameworks. Part of the [debugger](https://github.com/ephem-sh/debugger) project.

Captures HTTP requests, console output, and browser-side data from your dev server. AI agents query this data through the `dbg` CLI.

> **Preview** — under active development.

## Install

```bash
pip install ephem-debugger-py
```

## FastAPI

```python
from fastapi import FastAPI
from ephem_debugger_py.middleware.fastapi import instrument

app = FastAPI()
instrument(app, port=8000)
```

## Flask

```python
from flask import Flask
from ephem_debugger_py.middleware.flask import init_debugger

app = Flask(__name__)
init_debugger(app, port=5000)
```

## Django

Add to `settings.py`:

```python
MIDDLEWARE = [
    'ephem_debugger_py.middleware.django.DebuggerMiddleware',
    # ... other middleware
]

DEBUGGER_PORT = 8000
```

## Query with CLI

```bash
npx dbg status
npx dbg server console
npx dbg browser console
npx dbg browser network
```

## How it works

1. Middleware captures HTTP request/response metadata and logging output
2. IPC bridge exposes data via Unix socket (or TCP on Windows)
3. Browser client script is auto-injected into HTML responses
4. `dbg` CLI queries the session — works the same across all languages

## Other languages

- **Node.js** — [`@ephem-sh/debugger`](https://www.npmjs.com/package/@ephem-sh/debugger)
- **Go** — [`ephem-debugger-go`](https://github.com/ephem-sh/debugger/tree/main/packages/debugger-go)
- **Rust** — [`ephem-debugger-rs`](https://crates.io/crates/ephem-debugger-rs)

## License

MIT

---
name: debugger
description: Dev-only observability tool for debugging applications. Use this skill when you need to inspect runtime behavior — server logs, browser errors, network requests, application state. Covers setup, CLI usage, and output parsing. Trigger when debugging issues, investigating errors, or checking what an application is doing at runtime.
---

# debugger

Dev-only observability layer. Captures server console output, browser
errors, network requests, and application state from a running dev
server. You query it through the `dbg` CLI.

## When to use this skill

- A server endpoint returns unexpected results
- A browser error or blank page needs diagnosis
- You need to see what network requests the app is making
- You need to check cookies, storage, or permissions state
- You want to verify that a code change produces the expected logs
- The user asks you to "check the logs" or "debug this"

## Reference files

- **Setup** `./setup.md` — Install, instrument, verify. Read when
  debugger is not yet installed or you need to add it to a new
  framework.
- **CLI** `./cli.md` — Every command, flag, and output format. Read
  when you need to query data or parse output.

## Quick diagnosis

Match the symptom to the command:

| Symptom | Command |
|---------|---------|
| Server error / 500 | `npx dbg server errors` |
| Server log output | `npx dbg server console` |
| Browser crash / blank page | `npx dbg browser errors` |
| Browser console output | `npx dbg browser console` |
| API request failing | `npx dbg browser network --failed` |
| Slow API response | `npx dbg browser network` (check duration) |
| Unexpected status code | `npx dbg browser network --status 404` |
| Cookie not set | `npx dbg browser cookies --name session` |
| Storage issue | `npx dbg browser storage --key theme` |
| Everything at once | `npx dbg all` |
| Is debugger running? | `npx dbg status` |

Always use `--json` when you need to parse output programmatically:

```bash
npx dbg browser errors --json | jq '.[0].message'
npx dbg browser network --json | jq '.[] | select(.failed) | .url'
```

## Workflow

1. **Check status.** Run `npx dbg status`. If it fails, debugger is
   not running — read `./setup.md`.
2. **Identify the scope.** Is the problem server-side or browser-side?
   Use `server` or `browser` scope accordingly.
3. **Query.** Run the appropriate command from the diagnosis table.
   Use `--json` to parse structured output.
4. **Filter.** Narrow results with `--last 30s`, `--level error`,
   `--status 500`, `--failed`, or `--limit 10`.
5. **Inspect details.** For network requests, use `--id <id> --headers
   --body` to see the full request/response.
6. **Act.** Fix the code based on what you found. Run the command
   again to verify the fix.

"use client";

const btn =
  "rounded-lg border border-black/[.08] px-4 py-3 text-sm font-medium text-black transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col gap-12 px-16 py-16 bg-white dark:bg-black">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Debugger Test Page
        </h1>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Console & Errors
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              className={btn}
              onClick={() =>
                console.log("[debugger:test] log", {
                  id: crypto.randomUUID().slice(0, 8),
                  ts: new Date().toISOString(),
                })
              }
            >
              Console log
            </button>
            <button
              className={btn}
              onClick={() =>
                console.warn("[debugger:test] warn", {
                  id: crypto.randomUUID().slice(0, 8),
                  ts: new Date().toISOString(),
                })
              }
            >
              Console warn
            </button>
            <button
              className={btn}
              onClick={() =>
                console.error("[debugger:test] error", {
                  id: crypto.randomUUID().slice(0, 8),
                  ts: new Date().toISOString(),
                  error: new Error("test error"),
                })
              }
            >
              Console error
            </button>
            <button
              className={btn}
              onClick={() =>
                setTimeout(() => {
                  throw new Error(
                    "unhandled error " + crypto.randomUUID().slice(0, 8),
                  );
                }, 0)
              }
            >
              Throw error
            </button>
            <button
              className={btn}
              onClick={() =>
                Promise.reject(
                  new Error("rejection " + crypto.randomUUID().slice(0, 8)),
                )
              }
            >
              Unhandled rejection
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Network
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              className={btn}
              onClick={() =>
                fetch("/api/test?id=" + crypto.randomUUID().slice(0, 8))
              }
            >
              Fetch success
            </button>
            <button
              className={btn}
              onClick={() =>
                fetch(
                  "/api/test?error=true&id=" + crypto.randomUUID().slice(0, 8),
                )
              }
            >
              Fetch error
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Application State
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              className={btn}
              onClick={() => {
                document.cookie =
                  "debugger_test_" +
                  Date.now().toString(36) +
                  "=value_" +
                  Math.random().toString(36).slice(2, 6) +
                  "; path=/; max-age=3600; SameSite=Lax";
              }}
            >
              Set Cookie
            </button>
            <button
              className={btn}
              onClick={() => {
                document.cookie =
                  "dbg_secure_" +
                  Date.now().toString(36) +
                  "=secret_" +
                  Math.random().toString(36).slice(2, 6) +
                  "; path=/; max-age=3600; Secure; SameSite=Strict";
              }}
            >
              Set Secure Cookie
            </button>
            <button
              className={btn}
              onClick={() => {
                document.cookie
                  .split(";")
                  .map((c) => c.trim().split("=")[0])
                  .filter(
                    (name) =>
                      name.startsWith("dbg_") ||
                      name.startsWith("debugger_"),
                  )
                  .forEach((name) => {
                    document.cookie =
                      name + "=; path=/; max-age=0";
                  });
              }}
            >
              Remove Cookies
            </button>
            <button
              className={btn}
              onClick={() => {
                const id = Date.now().toString(36);
                localStorage.setItem(
                  "dbg_local_" + id,
                  JSON.stringify({
                    created: new Date().toISOString(),
                    random: Math.random(),
                  }),
                );
              }}
            >
              Set localStorage
            </button>
            <button
              className={btn}
              onClick={() => {
                Object.keys(localStorage)
                  .filter(
                    (k) =>
                      k.startsWith("dbg_") || k.startsWith("debugger_"),
                  )
                  .forEach((k) => localStorage.removeItem(k));
              }}
            >
              Clear localStorage
            </button>
            <button
              className={btn}
              onClick={() => {
                const id = Date.now().toString(36);
                sessionStorage.setItem(
                  "dbg_session_" + id,
                  new Date().toISOString(),
                );
              }}
            >
              Set sessionStorage
            </button>
            <button
              className={btn}
              onClick={() => {
                Object.keys(sessionStorage)
                  .filter(
                    (k) =>
                      k.startsWith("dbg_") || k.startsWith("debugger_"),
                  )
                  .forEach((k) => sessionStorage.removeItem(k));
              }}
            >
              Clear sessionStorage
            </button>
            <button
              className={btn}
              onClick={() => {
                const id = Date.now().toString(36);
                document.cookie =
                  "debugger_test_" +
                  id +
                  "=value_" +
                  Math.random().toString(36).slice(2, 6) +
                  "; path=/; max-age=3600; SameSite=Lax";
                localStorage.setItem(
                  "dbg_local_" + id,
                  JSON.stringify({
                    created: new Date().toISOString(),
                    random: Math.random(),
                  }),
                );
                sessionStorage.setItem(
                  "dbg_session_" + id,
                  new Date().toISOString(),
                );
              }}
            >
              Fill All
            </button>
            <button
              className={btn}
              onClick={() => {
                document.cookie
                  .split(";")
                  .map((c) => c.trim().split("=")[0])
                  .filter(
                    (name) =>
                      name.startsWith("dbg_") ||
                      name.startsWith("debugger_"),
                  )
                  .forEach((name) => {
                    document.cookie =
                      name + "=; path=/; max-age=0";
                  });
                Object.keys(localStorage)
                  .filter(
                    (k) =>
                      k.startsWith("dbg_") || k.startsWith("debugger_"),
                  )
                  .forEach((k) => localStorage.removeItem(k));
                Object.keys(sessionStorage)
                  .filter(
                    (k) =>
                      k.startsWith("dbg_") || k.startsWith("debugger_"),
                  )
                  .forEach((k) => sessionStorage.removeItem(k));
              }}
            >
              Clear All
            </button>
            <button
              className={btn}
              onClick={() => {
                const id = crypto.randomUUID().slice(0, 8);
                fetch("/api/test?id=" + id);
                document.cookie =
                  "debugger_fetch_" +
                  id +
                  "=true; path=/; max-age=3600; SameSite=Lax";
              }}
            >
              Fetch + Cookie
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

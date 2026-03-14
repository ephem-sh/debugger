(function () {
  if ((window as any).__DEBUGER_INITIALIZED__) return;
  (window as any).__DEBUGER_INITIALIZED__ = true;

  // --- Beacon endpoint ---
  const INGEST_URL = "/__debuger/ingest";

  // --- Safe serialization ---
  function safeSerialize(value: unknown, depth = 0, seen?: WeakSet<object>): unknown {
    if (depth > 3) return "[max depth]";
    if (value === null) return null;
    if (value === undefined) return "[undefined]";

    const t = typeof value;
    if (t === "string" || t === "number" || t === "boolean") return value;
    if (t === "bigint") return value.toString() + "n";
    if (t === "symbol") return value.toString();
    if (t === "function") return `[Function: ${(value as Function).name || "anonymous"}]`;

    if (t !== "object") return String(value);

    const obj = value as object;
    if (!seen) seen = new WeakSet();
    if (seen.has(obj)) return "[Circular]";
    seen.add(obj);

    // Error
    if (obj instanceof Error) {
      return { name: obj.name, message: obj.message, stack: obj.stack };
    }

    // DOM Node
    if (typeof Node !== "undefined" && obj instanceof Node) {
      const el = obj as Element;
      return `[${el.tagName || "Node"}]`;
    }

    // Array
    if (Array.isArray(obj)) {
      return obj.map((item) => safeSerialize(item, depth + 1, seen));
    }

    // Plain object
    const out: Record<string, unknown> = {};
    try {
      for (const key of Object.keys(obj)) {
        out[key] = safeSerialize((obj as any)[key], depth + 1, seen);
      }
    } catch {
      return "[unserializable]";
    }
    return out;
  }

  // --- Batched send ---
  let buffer: unknown[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  function flush() {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    flushTimer = null;

    const payload = JSON.stringify(batch);
    try {
      if (navigator.sendBeacon) {
        const sent = navigator.sendBeacon(
          INGEST_URL,
          new Blob([payload], { type: "application/json" })
        );
        if (sent) return;
      }
    } catch {}

    try {
      fetch(INGEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }

  function send(data: unknown) {
    buffer.push(data);
    if (buffer.length >= 10) {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flush();
    } else if (!flushTimer) {
      flushTimer = setTimeout(flush, 100);
    }
  }

  // --- Console interception ---
  const levels = ["log", "warn", "error", "debug", "info"] as const;
  type ConsoleLevel = (typeof levels)[number];

  for (const level of levels) {
    const original = console[level];
    console[level] = function (...args: unknown[]) {
      send({
        type: "console",
        level,
        args: args.map((a) => safeSerialize(a)),
        timestamp: Date.now(),
        source: "browser",
      });
      return original.apply(console, args);
    };
  }

  // --- Error interception ---
  window.addEventListener("error", (event) => {
    send({
      type: "error",
      message: event.message,
      stack: event.error?.stack || null,
      timestamp: Date.now(),
      source: "browser",
      url: location.href,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    send({
      type: "error",
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : null,
      timestamp: Date.now(),
      source: "browser",
      url: location.href,
    });
  });

  // --- Fetch interception ---
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const method = init?.method?.toUpperCase() || "GET";
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const start = Date.now();

    return originalFetch.apply(window, [input, init!]).then(
      (response) => {
        send({
          type: "network",
          url,
          method,
          status: response.status,
          duration: Date.now() - start,
          timestamp: start,
          failed: !response.ok,
        });
        return response;
      },
      (error) => {
        send({
          type: "network",
          url,
          method,
          status: 0,
          duration: Date.now() - start,
          timestamp: start,
          failed: true,
        });
        throw error;
      }
    );
  };

  // --- XMLHttpRequest interception ---
  const XHRProto = XMLHttpRequest.prototype;
  const originalOpen = XHRProto.open;
  const originalSend = XHRProto.send;

  XHRProto.open = function (
    method: string,
    url: string | URL,
    ...rest: any[]
  ) {
    (this as any).__debuger_method = method.toUpperCase();
    (this as any).__debuger_url = typeof url === "string" ? url : url.href;
    return (originalOpen as any).apply(this, [method, url, ...rest]);
  };

  XHRProto.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const start = Date.now();
    const method = (this as any).__debuger_method || "GET";
    const url = (this as any).__debuger_url || "";

    const emitEntry = (status: number, failed: boolean) => {
      send({
        type: "network",
        url,
        method,
        status,
        duration: Date.now() - start,
        timestamp: start,
        failed,
      });
    };

    this.addEventListener("load", function () {
      emitEntry(this.status, this.status >= 400);
    });

    this.addEventListener("error", function () {
      emitEntry(0, true);
    });

    return originalSend.call(this, body);
  };

  // Flush remaining entries on page unload
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
})();

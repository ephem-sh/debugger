/**
 * Debugger browser client IIFE.
 *
 * Intercept console, errors, and network activity in the browser and
 * batch-send log entries to the dev server ingest endpoint. Also captures
 * application state (cookies, storage, workers, etc.) periodically.
 * Self-guards against double-initialization.
 */
(function () {
  if ((window as any).__DEBUGGER_INITIALIZED__) return;
  (window as any).__DEBUGGER_INITIALIZED__ = true;

  const INGEST_URL: string =
    (window as any).__DEBUGGER_INGEST_URL__ || "/_/d";

  function safeSerialize(v: unknown, d = 0, s?: WeakSet<object>): unknown {
    if (d > 3) return "[max depth]";
    if (v === null) return null;
    if (v === undefined) return "[undefined]";

    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") return v;
    if (t === "bigint") return (v as bigint).toString() + "n";
    if (t === "symbol") return (v as symbol).toString();
    if (t === "function") return `[Function: ${(v as Function).name || "anonymous"}]`;
    if (t !== "object") return String(v);

    const o = v as object;
    if (!s) s = new WeakSet();
    if (s.has(o)) return "[Circular]";
    s.add(o);

    if (o instanceof Error) return { name: o.name, message: o.message, stack: o.stack };
    if (typeof Node !== "undefined" && o instanceof Node) return `[${(o as Element).tagName || "Node"}]`;
    if (Array.isArray(o)) return o.map(i => safeSerialize(i, d + 1, s));

    const r: Record<string, unknown> = {};
    try {
      for (const k of Object.keys(o)) r[k] = safeSerialize((o as Record<string, unknown>)[k], d + 1, s);
    } catch {
      return "[unserializable]";
    }
    return r;
  }

  function detectBrowser(): string {
    const ua = navigator.userAgent;
    const n = navigator as any;

    // API-based detection (Brave exposes navigator.brave)
    if (n.brave) return "Brave";

    // Known browser tokens — checked before generic Chrome/Safari/Firefox.
    // Most Chromium-based browsers append their own "Name/" token to the UA.
    // Order: specific tokens first, generic engines last.
    const known: [string, string][] = [
      // Microsoft
      ["Edg/", "Edge"],
      // Opera
      ["OPR/", "Opera"], ["Opera/", "Opera"],
      // AI / agentic browsers
      ["Dia/", "Dia"], ["Arc/", "Arc"], ["Comet/", "Comet"],
      ["Atlas/", "ChatGPT Atlas"], ["Mariner/", "Mariner"],
      ["SigmaOS/", "SigmaOS"], ["Sidekick/", "Sidekick"],
      ["Wavebox/", "Wavebox"], ["Beam/", "Beam"], ["Mighty/", "Mighty"],
      ["Island/", "Island"], ["Stack/", "Stack"], ["Shift/", "Shift"],
      ["Station/", "Station"],
      // Privacy / alternative
      ["DuckDuckGo/", "DuckDuckGo"], ["Mullvad/", "Mullvad"],
      ["Tor/", "Tor"], ["Epic/", "Epic"], ["Ghost/", "Ghost"],
      // Dev browsers
      ["Polypane/", "Polypane"], ["Blisk/", "Blisk"],
      ["Responsively/", "Responsively"],
      // Power-user / regional
      ["Vivaldi/", "Vivaldi"], ["YaBrowser/", "Yandex"],
      ["SamsungBrowser/", "Samsung"], ["UCBrowser/", "UC"],
      ["Whale/", "Whale"], ["Puffin/", "Puffin"],
      ["QQBrowser/", "QQ"], ["Sleipnir/", "Sleipnir"],
      ["Maxthon/", "Maxthon"], ["Naver/", "Naver"],
      ["KiwiBrowser/", "Kiwi"], ["Colibri/", "Colibri"],
      ["Orion/", "Orion"], ["Zen/", "Zen"], ["Ladybird/", "Ladybird"],
      ["Neon/", "Opera Neon"],
      ["Min/", "Min"], ["Midori/", "Midori"],
      // Firefox forks
      ["LibreWolf/", "LibreWolf"], ["Waterfox/", "Waterfox"],
      ["PaleMoon/", "Pale Moon"],
    ];

    for (const [token, name] of known) {
      if (ua.includes(token)) return name;
    }

    // Non-Chromium engines
    if (ua.includes("Firefox/")) return "Firefox";
    if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";

    // Smart fallback: extract the last Product/Version token from the UA
    // that isn't a generic engine name. Most browsers append their token last.
    const generic = new Set(["Mozilla", "AppleWebKit", "Chrome", "Safari", "Gecko", "KHTML"]);
    const tokens = ua.match(/(\w[\w\s]*?)\/[\d.]+/g);
    if (tokens) {
      for (let i = tokens.length - 1; i >= 0; i--) {
        const name = tokens[i].split("/")[0].trim();
        if (!generic.has(name)) return name;
      }
    }

    // Generic Chromium
    if (ua.includes("Chrome/")) return "Chrome";

    return "Unknown";
  }

  const BROWSER_NAME = detectBrowser();

  let buf: unknown[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush() {
    if (buf.length === 0) return;
    const batch = buf;
    buf = [];
    timer = null;

    const p = JSON.stringify(batch);
    try {
      if (navigator.sendBeacon) {
        if (navigator.sendBeacon(INGEST_URL, new Blob([p], { type: "application/json" }))) return;
      }
    } catch {}

    try {
      fetch(INGEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: p,
        keepalive: true,
        credentials: "omit",
        mode: "cors",
      }).catch(() => {});
    } catch {}
  }

  function send(data: unknown) {
    buf.push(data);
    if (buf.length >= 10) {
      if (timer) { clearTimeout(timer); timer = null; }
      flush();
    } else if (!timer) {
      timer = setTimeout(flush, 100);
    }
  }

  function netEntry(url: string, method: string, start: number, status: number, failed: boolean, kind: string, extra?: Record<string, unknown>) {
    const e: Record<string, unknown> = { type: "network", url, method, status, duration: Date.now() - start, timestamp: start, failed, source: "browser", kind, browser: BROWSER_NAME };
    if (extra) for (const k in extra) e[k] = extra[k];
    return e;
  }

  // Console interception
  for (const level of ["log", "warn", "error", "debug", "info"] as const) {
    const orig = console[level];
    console[level] = function (...args: unknown[]) {
      send({ type: "console", level, args: args.map(a => safeSerialize(a)), timestamp: Date.now(), source: "browser", browser: BROWSER_NAME });
      return orig.apply(console, args);
    };
  }

  // Error interception
  window.addEventListener("error", (ev) => {
    send({ type: "error", message: ev.message, stack: ev.error?.stack || null, timestamp: Date.now(), source: "browser", url: location.href, browser: BROWSER_NAME });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const r = ev.reason;
    send({ type: "error", message: r instanceof Error ? r.message : String(r), stack: r instanceof Error ? r.stack : null, timestamp: Date.now(), source: "browser", url: location.href, browser: BROWSER_NAME });
  });

  function extractHeaders(h: HeadersInit | Headers | undefined | null): Record<string, string> | undefined {
    if (!h) return undefined;
    const r: Record<string, string> = {};
    if (h instanceof Headers) h.forEach((v, k) => { r[k] = v; });
    else if (Array.isArray(h)) for (const [k, v] of h) r[k] = v;
    else for (const k of Object.keys(h)) r[k] = (h as Record<string, string>)[k];
    return Object.keys(r).length > 0 ? r : undefined;
  }

  // Fetch interception
  const origFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const m = init?.method?.toUpperCase() || "GET";
    const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const t = Date.now();

    return origFetch.apply(window, [input, init!]).then(
      (res) => {
        const e = netEntry(u, m, t, res.status, !res.ok, "fetch", { requestHeaders: extractHeaders(init?.headers), responseHeaders: extractHeaders(res.headers) });
        if (!res.ok) {
          try {
            res.clone().text().then(txt => { e.responseBody = txt.slice(0, 4096); send(e); }).catch(() => send(e));
            return res;
          } catch {}
        }
        send(e);
        return res;
      },
      (err) => {
        send(netEntry(u, m, t, 0, true, "fetch", { requestHeaders: extractHeaders(init?.headers) }));
        throw err;
      }
    );
  } as typeof fetch;
  Object.assign(window.fetch, origFetch);

  // XMLHttpRequest interception
  const XP = XMLHttpRequest.prototype;
  const origOpen = XP.open;
  const origSend = XP.send;

  XP.open = function (method: string, url: string | URL, ...rest: unknown[]) {
    (this as any)._dm = method.toUpperCase();
    (this as any)._du = typeof url === "string" ? url : url.href;
    return (origOpen as any).apply(this, [method, url, ...rest]);
  };

  XP.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const t = Date.now();
    const m = (this as any)._dm || "GET";
    const u = (this as any)._du || "";

    const emit = (status: number, failed: boolean) => {
      const rh: Record<string, string> = {};
      try {
        const raw = this.getAllResponseHeaders();
        if (raw) for (const ln of raw.trim().split(/[\r\n]+/)) { const i = ln.indexOf(': '); if (i > 0) rh[ln.slice(0, i).toLowerCase()] = ln.slice(i + 2); }
      } catch {}

      const e = netEntry(u, m, t, status, failed, "xhr", { responseHeaders: Object.keys(rh).length > 0 ? rh : undefined });
      if (failed) { try { const b = typeof this.responseText === 'string' ? this.responseText : ''; if (b) e.responseBody = b.slice(0, 4096); } catch {} }
      send(e);
    };

    this.addEventListener("load", function () { emit(this.status, this.status >= 400); });
    this.addEventListener("error", function () { emit(0, true); });
    return origSend.call(this, body);
  };

  // WebSocket interception
  const OrigWS = window.WebSocket;

  function wsEntry(u: string, t: number, status: number, failed: boolean, cid: string, mc: number, rs: number): Record<string, unknown> {
    return netEntry(u, "WS", t, status, failed, "ws", { connectionId: cid, messageCount: mc, wsReadyState: rs });
  }

  const WrappedWS = function (this: WebSocket, url: string | URL, protocols?: string | string[]) {
    const ws = new OrigWS(url, protocols);
    const t = Date.now();
    const u = typeof url === "string" ? url : url.href;
    const cid = Math.random().toString(16).slice(2, 8);
    let mc = 0;

    send(wsEntry(u, t, 0, false, cid, 0, OrigWS.CONNECTING));

    ws.addEventListener("message", () => { mc++; });
    ws.addEventListener("close", (ev) => { send(wsEntry(u, t, ev.code, ev.code !== 1000 && ev.code !== 1001, cid, mc, OrigWS.CLOSED)); });
    ws.addEventListener("error", () => { send(wsEntry(u, t, 0, true, cid, mc, OrigWS.CLOSED)); });

    return ws;
  } as unknown as typeof WebSocket;

  WrappedWS.prototype = OrigWS.prototype;
  WrappedWS.CONNECTING = OrigWS.CONNECTING;
  WrappedWS.OPEN = OrigWS.OPEN;
  WrappedWS.CLOSING = OrigWS.CLOSING;
  WrappedWS.CLOSED = OrigWS.CLOSED;

  (window as any).WebSocket = WrappedWS;

  // Application state capture
  let lastAppHash = "";

  function parseCookies(): Array<{ name: string; value: string }> {
    if (!document.cookie) return [];
    return document.cookie.split("; ").map(c => {
      const i = c.indexOf("=");
      return { name: c.slice(0, i), value: c.slice(i + 1) };
    });
  }

  function storageToRecord(storage: Storage): Record<string, string> {
    const r: Record<string, string> = {};
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k !== null) r[k] = storage.getItem(k) || "";
    }
    return r;
  }

  async function captureAppState() {
    const entry: Record<string, unknown> = {
      type: "app",
      timestamp: Date.now(),
      source: "browser",
      browser: BROWSER_NAME,
    };

    // Cookies
    entry.cookies = parseCookies();

    // localStorage + sessionStorage
    try { entry.localStorage = storageToRecord(localStorage); } catch {}
    try { entry.sessionStorage = storageToRecord(sessionStorage); } catch {}

    // Service workers
    try {
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        entry.serviceWorkers = regs.map(r => ({
          scope: r.scope,
          scriptURL: (r.active || r.installing || r.waiting)?.scriptURL || "",
          state: (r.active || r.installing || r.waiting)?.state || "unknown",
        }));
      }
    } catch {}

    // Cache storage
    try {
      if (typeof caches !== "undefined") {
        const names = await caches.keys();
        const info: Array<{ name: string; entryCount: number }> = [];
        for (const name of names) {
          try {
            const cache = await caches.open(name);
            const keys = await cache.keys();
            info.push({ name, entryCount: keys.length });
          } catch {}
        }
        entry.cacheStorage = info;
      }
    } catch {}

    // Permissions
    try {
      if (navigator.permissions) {
        const names = ["geolocation", "notifications", "camera", "microphone", "clipboard-read", "clipboard-write"];
        const perms: Array<{ name: string; state: string }> = [];
        for (const name of names) {
          try {
            const result = await navigator.permissions.query({ name: name as PermissionName });
            perms.push({ name, state: result.state });
          } catch {}
        }
        entry.permissions = perms;
      }
    } catch {}

    // Storage quota
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        entry.storageEstimate = { usage: est.usage || 0, quota: est.quota || 0 };
      }
    } catch {}

    // Deduplicate: only send if state changed
    const hash = JSON.stringify([entry.cookies, entry.localStorage, entry.sessionStorage, entry.serviceWorkers, entry.cacheStorage, entry.permissions, entry.storageEstimate]);
    if (hash !== lastAppHash) {
      lastAppHash = hash;
      send(entry);
    }
  }

  // Storage method interception for same-tab changes
  let appCaptureScheduled = false;
  function scheduleAppCapture() {
    if (appCaptureScheduled) return;
    appCaptureScheduled = true;
    setTimeout(() => {
      appCaptureScheduled = false;
      captureAppState();
    }, 50);
  }

  const origSetItem = Storage.prototype.setItem;
  const origRemoveItem = Storage.prototype.removeItem;
  const origClear = Storage.prototype.clear;

  Storage.prototype.setItem = function (key: string, value: string) {
    origSetItem.call(this, key, value);
    scheduleAppCapture();
  };
  Storage.prototype.removeItem = function (key: string) {
    origRemoveItem.call(this, key);
    scheduleAppCapture();
  };
  Storage.prototype.clear = function () {
    origClear.call(this);
    scheduleAppCapture();
  };

  // Initial capture after DOM is ready
  if (document.readyState === "complete") {
    captureAppState();
  } else {
    window.addEventListener("load", () => captureAppState());
  }

  // Periodic capture every 10 seconds
  setInterval(() => captureAppState(), 10_000);

  // Capture on storage events
  window.addEventListener("storage", () => captureAppState());

  // Flush remaining entries on page unload
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
})();

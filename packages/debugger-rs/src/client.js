(() => {
  // src/browser/client.ts
  (function() {
    if (window.__DEBUGGER_INITIALIZED__)
      return;
    window.__DEBUGGER_INITIALIZED__ = true;
    const INGEST_URL = window.__DEBUGGER_INGEST_URL__ || "/_/d";
    function safeSerialize(v, d = 0, s) {
      if (d > 3)
        return "[max depth]";
      if (v === null)
        return null;
      if (v === undefined)
        return "[undefined]";
      const t = typeof v;
      if (t === "string" || t === "number" || t === "boolean")
        return v;
      if (t === "bigint")
        return v.toString() + "n";
      if (t === "symbol")
        return v.toString();
      if (t === "function")
        return `[Function: ${v.name || "anonymous"}]`;
      if (t !== "object")
        return String(v);
      const o = v;
      if (!s)
        s = new WeakSet;
      if (s.has(o))
        return "[Circular]";
      s.add(o);
      if (o instanceof Error)
        return { name: o.name, message: o.message, stack: o.stack };
      if (typeof Node !== "undefined" && o instanceof Node)
        return `[${o.tagName || "Node"}]`;
      if (Array.isArray(o))
        return o.map((i) => safeSerialize(i, d + 1, s));
      const r = {};
      try {
        for (const k of Object.keys(o))
          r[k] = safeSerialize(o[k], d + 1, s);
      } catch {
        return "[unserializable]";
      }
      return r;
    }
    function detectBrowser() {
      const ua = navigator.userAgent;
      const n = navigator;
      if (n.brave)
        return "Brave";
      const known = [
        ["Edg/", "Edge"],
        ["OPR/", "Opera"],
        ["Opera/", "Opera"],
        ["Dia/", "Dia"],
        ["Arc/", "Arc"],
        ["Comet/", "Comet"],
        ["Atlas/", "ChatGPT Atlas"],
        ["Mariner/", "Mariner"],
        ["SigmaOS/", "SigmaOS"],
        ["Sidekick/", "Sidekick"],
        ["Wavebox/", "Wavebox"],
        ["Beam/", "Beam"],
        ["Mighty/", "Mighty"],
        ["Island/", "Island"],
        ["Stack/", "Stack"],
        ["Shift/", "Shift"],
        ["Station/", "Station"],
        ["DuckDuckGo/", "DuckDuckGo"],
        ["Mullvad/", "Mullvad"],
        ["Tor/", "Tor"],
        ["Epic/", "Epic"],
        ["Ghost/", "Ghost"],
        ["Polypane/", "Polypane"],
        ["Blisk/", "Blisk"],
        ["Responsively/", "Responsively"],
        ["Vivaldi/", "Vivaldi"],
        ["YaBrowser/", "Yandex"],
        ["SamsungBrowser/", "Samsung"],
        ["UCBrowser/", "UC"],
        ["Whale/", "Whale"],
        ["Puffin/", "Puffin"],
        ["QQBrowser/", "QQ"],
        ["Sleipnir/", "Sleipnir"],
        ["Maxthon/", "Maxthon"],
        ["Naver/", "Naver"],
        ["KiwiBrowser/", "Kiwi"],
        ["Colibri/", "Colibri"],
        ["Orion/", "Orion"],
        ["Zen/", "Zen"],
        ["Ladybird/", "Ladybird"],
        ["Neon/", "Opera Neon"],
        ["Min/", "Min"],
        ["Midori/", "Midori"],
        ["LibreWolf/", "LibreWolf"],
        ["Waterfox/", "Waterfox"],
        ["PaleMoon/", "Pale Moon"]
      ];
      for (const [token, name] of known) {
        if (ua.includes(token))
          return name;
      }
      if (ua.includes("Firefox/"))
        return "Firefox";
      if (ua.includes("Safari/") && !ua.includes("Chrome/"))
        return "Safari";
      const generic = new Set(["Mozilla", "AppleWebKit", "Chrome", "Safari", "Gecko", "KHTML"]);
      const tokens = ua.match(/(\w[\w\s]*?)\/[\d.]+/g);
      if (tokens) {
        for (let i = tokens.length - 1;i >= 0; i--) {
          const name = tokens[i].split("/")[0].trim();
          if (!generic.has(name))
            return name;
        }
      }
      if (ua.includes("Chrome/"))
        return "Chrome";
      return "Unknown";
    }
    const BROWSER_NAME = detectBrowser();
    let buf = [];
    let timer = null;
    function flush() {
      if (buf.length === 0)
        return;
      const batch = buf;
      buf = [];
      timer = null;
      const p = JSON.stringify(batch);
      try {
        if (navigator.sendBeacon) {
          if (navigator.sendBeacon(INGEST_URL, new Blob([p], { type: "application/json" })))
            return;
        }
      } catch {}
      try {
        fetch(INGEST_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: p,
          keepalive: true,
          credentials: "omit",
          mode: "cors"
        }).catch(() => {});
      } catch {}
    }
    function send(data) {
      buf.push(data);
      if (buf.length >= 10) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        flush();
      } else if (!timer) {
        timer = setTimeout(flush, 100);
      }
    }
    function netEntry(url, method, start, status, failed, kind, extra) {
      const e = { type: "network", url, method, status, duration: Date.now() - start, timestamp: start, failed, source: "browser", kind, browser: BROWSER_NAME };
      if (extra)
        for (const k in extra)
          e[k] = extra[k];
      return e;
    }
    for (const level of ["log", "warn", "error", "debug", "info"]) {
      const orig = console[level];
      console[level] = function(...args) {
        send({ type: "console", level, args: args.map((a) => safeSerialize(a)), timestamp: Date.now(), source: "browser", browser: BROWSER_NAME });
        return orig.apply(console, args);
      };
    }
    window.addEventListener("error", (ev) => {
      send({ type: "error", message: ev.message, stack: ev.error?.stack || null, timestamp: Date.now(), source: "browser", url: location.href, browser: BROWSER_NAME });
    });
    window.addEventListener("unhandledrejection", (ev) => {
      const r = ev.reason;
      send({ type: "error", message: r instanceof Error ? r.message : String(r), stack: r instanceof Error ? r.stack : null, timestamp: Date.now(), source: "browser", url: location.href, browser: BROWSER_NAME });
    });
    function extractHeaders(h) {
      if (!h)
        return;
      const r = {};
      if (h instanceof Headers)
        h.forEach((v, k) => {
          r[k] = v;
        });
      else if (Array.isArray(h))
        for (const [k, v] of h)
          r[k] = v;
      else
        for (const k of Object.keys(h))
          r[k] = h[k];
      return Object.keys(r).length > 0 ? r : undefined;
    }
    const origFetch = window.fetch;
    window.fetch = function(input, init) {
      const m = init?.method?.toUpperCase() || "GET";
      const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const t = Date.now();
      return origFetch.apply(window, [input, init]).then((res) => {
        const e = netEntry(u, m, t, res.status, !res.ok, "fetch", { requestHeaders: extractHeaders(init?.headers), responseHeaders: extractHeaders(res.headers) });
        if (!res.ok) {
          try {
            res.clone().text().then((txt) => {
              e.responseBody = txt.slice(0, 4096);
              send(e);
            }).catch(() => send(e));
            return res;
          } catch {}
        }
        send(e);
        return res;
      }, (err) => {
        send(netEntry(u, m, t, 0, true, "fetch", { requestHeaders: extractHeaders(init?.headers) }));
        throw err;
      });
    };
    Object.assign(window.fetch, origFetch);
    const XP = XMLHttpRequest.prototype;
    const origOpen = XP.open;
    const origSend = XP.send;
    XP.open = function(method, url, ...rest) {
      this._dm = method.toUpperCase();
      this._du = typeof url === "string" ? url : url.href;
      return origOpen.apply(this, [method, url, ...rest]);
    };
    XP.send = function(body) {
      const t = Date.now();
      const m = this._dm || "GET";
      const u = this._du || "";
      const emit = (status, failed) => {
        const rh = {};
        try {
          const raw = this.getAllResponseHeaders();
          if (raw)
            for (const ln of raw.trim().split(/[\r\n]+/)) {
              const i = ln.indexOf(": ");
              if (i > 0)
                rh[ln.slice(0, i).toLowerCase()] = ln.slice(i + 2);
            }
        } catch {}
        const e = netEntry(u, m, t, status, failed, "xhr", { responseHeaders: Object.keys(rh).length > 0 ? rh : undefined });
        if (failed) {
          try {
            const b = typeof this.responseText === "string" ? this.responseText : "";
            if (b)
              e.responseBody = b.slice(0, 4096);
          } catch {}
        }
        send(e);
      };
      this.addEventListener("load", function() {
        emit(this.status, this.status >= 400);
      });
      this.addEventListener("error", function() {
        emit(0, true);
      });
      return origSend.call(this, body);
    };
    const OrigWS = window.WebSocket;
    function wsEntry(u, t, status, failed, cid, mc, rs) {
      return netEntry(u, "WS", t, status, failed, "ws", { connectionId: cid, messageCount: mc, wsReadyState: rs });
    }
    const WrappedWS = function(url, protocols) {
      const ws = new OrigWS(url, protocols);
      const t = Date.now();
      const u = typeof url === "string" ? url : url.href;
      const cid = Math.random().toString(16).slice(2, 8);
      let mc = 0;
      send(wsEntry(u, t, 0, false, cid, 0, OrigWS.CONNECTING));
      ws.addEventListener("message", () => {
        mc++;
      });
      ws.addEventListener("close", (ev) => {
        send(wsEntry(u, t, ev.code, ev.code !== 1000 && ev.code !== 1001, cid, mc, OrigWS.CLOSED));
      });
      ws.addEventListener("error", () => {
        send(wsEntry(u, t, 0, true, cid, mc, OrigWS.CLOSED));
      });
      return ws;
    };
    WrappedWS.prototype = OrigWS.prototype;
    WrappedWS.CONNECTING = OrigWS.CONNECTING;
    WrappedWS.OPEN = OrigWS.OPEN;
    WrappedWS.CLOSING = OrigWS.CLOSING;
    WrappedWS.CLOSED = OrigWS.CLOSED;
    window.WebSocket = WrappedWS;
    let lastAppHash = "";
    function parseCookies() {
      if (!document.cookie)
        return [];
      return document.cookie.split("; ").map((c) => {
        const i = c.indexOf("=");
        return { name: c.slice(0, i), value: c.slice(i + 1) };
      });
    }
    function storageToRecord(storage) {
      const r = {};
      for (let i = 0;i < storage.length; i++) {
        const k = storage.key(i);
        if (k !== null)
          r[k] = storage.getItem(k) || "";
      }
      return r;
    }
    async function captureAppState() {
      const entry = {
        type: "app",
        timestamp: Date.now(),
        source: "browser",
        browser: BROWSER_NAME
      };
      entry.cookies = parseCookies();
      try {
        entry.localStorage = storageToRecord(localStorage);
      } catch {}
      try {
        entry.sessionStorage = storageToRecord(sessionStorage);
      } catch {}
      try {
        if (navigator.serviceWorker) {
          const regs = await navigator.serviceWorker.getRegistrations();
          entry.serviceWorkers = regs.map((r) => ({
            scope: r.scope,
            scriptURL: (r.active || r.installing || r.waiting)?.scriptURL || "",
            state: (r.active || r.installing || r.waiting)?.state || "unknown"
          }));
        }
      } catch {}
      try {
        if (typeof caches !== "undefined") {
          const names = await caches.keys();
          const info = [];
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
      try {
        if (navigator.permissions) {
          const names = ["geolocation", "notifications", "camera", "microphone", "clipboard-read", "clipboard-write"];
          const perms = [];
          for (const name of names) {
            try {
              const result = await navigator.permissions.query({ name });
              perms.push({ name, state: result.state });
            } catch {}
          }
          entry.permissions = perms;
        }
      } catch {}
      try {
        if (navigator.storage && navigator.storage.estimate) {
          const est = await navigator.storage.estimate();
          entry.storageEstimate = { usage: est.usage || 0, quota: est.quota || 0 };
        }
      } catch {}
      const hash = JSON.stringify([entry.cookies, entry.localStorage, entry.sessionStorage, entry.serviceWorkers, entry.cacheStorage, entry.permissions, entry.storageEstimate]);
      if (hash !== lastAppHash) {
        lastAppHash = hash;
        send(entry);
      }
    }
    let appCaptureScheduled = false;
    function scheduleAppCapture() {
      if (appCaptureScheduled)
        return;
      appCaptureScheduled = true;
      setTimeout(() => {
        appCaptureScheduled = false;
        captureAppState();
      }, 50);
    }
    const origSetItem = Storage.prototype.setItem;
    const origRemoveItem = Storage.prototype.removeItem;
    const origClear = Storage.prototype.clear;
    Storage.prototype.setItem = function(key, value) {
      origSetItem.call(this, key, value);
      scheduleAppCapture();
    };
    Storage.prototype.removeItem = function(key) {
      origRemoveItem.call(this, key);
      scheduleAppCapture();
    };
    Storage.prototype.clear = function() {
      origClear.call(this);
      scheduleAppCapture();
    };
    if (document.readyState === "complete") {
      captureAppState();
    } else {
      window.addEventListener("load", () => captureAppState());
    }
    setInterval(() => captureAppState(), 1e4);
    window.addEventListener("storage", () => captureAppState());
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden")
        flush();
    });
    window.addEventListener("pagehide", flush);
  })();
})();

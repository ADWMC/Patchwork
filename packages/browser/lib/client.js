// 由 scripts/build-client.mjs 生成，请勿手改。
window.__ModuleLoader__.load({
	id: "@patchwork/browser",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/browser/src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// packages/browser/src/client/controls.jsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime = require("react/jsx-runtime");
var Button = (0, import_react.forwardRef)(function Button2({ title, size = "sm", variant = "ghost", ...props }, ref) {
  const button = ref ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { ref, size, variant, ...props }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { size, variant, ...props });
  return title ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tooltip, { label: title, side: "bottom", portal: true, delayMs: 350, children: button }) : button;
});
var Input = (0, import_react.forwardRef)(function Input2({ className = "", ...props }, ref) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Input, { ref, className: `pw-browser-input ${className}`, ...props });
});
var TextArea = (0, import_react.forwardRef)(function TextArea2({ className = "", ...props }, ref) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { ref, className: `pw-browser-field-textarea ${className}`, ...props });
});
function Toggle({ label, className = "", ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `pw-browser-switch-row ${className}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Switch, { label, ...props })
  ] });
}
function Select({ value, options, onChange, disabled = false, "aria-label": label, className = "" }) {
  const [open, setOpen] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const selected = options.find((option) => String(option.value) === String(value));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_dsh_client_ui_primitives.Menu,
    {
      className: `pw-browser-select ${className}`,
      listClassName: "pw-browser-select-menu",
      compact: true,
      portal: true,
      autoFocus: true,
      open: open && !disabled,
      selectedId: String(value),
      onClose: () => setOpen(false),
      items: options.map((option) => ({ id: String(option.value), label: option.label, disabled: option.disabled })),
      onSelect: (next) => {
        setOpen(false);
        onChange(next);
      },
      anchor: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        Button,
        {
          variant: "outline",
          className: "pw-browser-select-trigger",
          "aria-label": label,
          "aria-haspopup": "menu",
          "aria-expanded": open && !disabled,
          disabled,
          onClick: () => setOpen((previous) => !previous),
          onKeyDown: (event) => {
            if (["ArrowDown", "ArrowUp"].includes(event.key)) {
              event.preventDefault();
              setOpen(true);
            }
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: selected?.label ?? "\u8BF7\u9009\u62E9" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "none", stroke: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m4 6 4 4 4-4" }) })
          ]
        }
      )
    }
  );
}
function Disclosure({ title, open, onToggle, children, className = "", count }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_dsh_client_ui_primitives.DisclosureRow,
    {
      className,
      rowClassName: "pw-browser-disclosure-heading",
      title,
      open,
      onToggle,
      expandable: true,
      expandOnRowClick: true,
      icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "none", stroke: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m5 3 5 5-5 5" }) }),
      keepContentWhenOpen: true,
      collapsedContent: count ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pw-browser-disclosure-count", children: count }) : void 0,
      children
    }
  );
}

// packages/browser/src/client/BrowserWorkspace.jsx
var import_react8 = require("react");

// packages/browser/src/client/BrowserPanel.jsx
var import_react7 = require("react");

// packages/browser/src/client/connection.mjs
function readConnectionMetadata() {
  const rows = [...document.querySelectorAll("script[data-patchwork-browser]")];
  for (const node of rows.reverse()) {
    try {
      const data = JSON.parse(node.textContent);
      if (data.browserPath && data.token) return data;
    } catch {
    }
  }
  return null;
}

// packages/browser/src/client/browser-stream.mjs
async function consumeBrowserStream(response, onFrame, signal) {
  if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream") || !response.body) throw new Error("Browser stream unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      if (pending.length > 12 * 1024 * 1024) throw new Error("Oversized browser stream event");
      let boundary;
      while ((boundary = pending.indexOf("\n\n")) >= 0) {
        const event = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        if (event.includes("event: fallback")) throw new Error("Browser JPEG fallback requested");
        const data = event.split("\n").find((line) => line.startsWith("data: "));
        if (!data) continue;
        const frame = JSON.parse(data.slice(6));
        const { width, height } = frame.viewport ?? {};
        if (!frame.frameId || !frame.tabId || !Number.isInteger(width) || !Number.isInteger(height) || width < 240 || width > 2560 || height < 240 || height > 1800 || typeof frame.image !== "string" || frame.image.length > 11 * 1024 * 1024) throw new Error("Invalid browser stream identity");
        const bytes = Uint8Array.from(atob(frame.image), (character) => character.charCodeAt(0));
        if (!signal.aborted) onFrame({ ...frame, width, height, blob: new Blob([bytes], { type: "image/jpeg" }) });
      }
    }
  } finally {
    await reader.cancel().catch(() => {
    });
    reader.releaseLock();
  }
}
function decodeBrowserFrame(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 5 || buffer.byteLength > 9 * 1024 * 1024) throw new Error("Invalid binary browser frame");
  const length = new DataView(buffer).getUint32(0);
  if (length > 64 * 1024 || length + 4 >= buffer.byteLength) throw new Error("Invalid browser frame header");
  const metadata = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, length)));
  const { width, height } = metadata.viewport ?? {};
  if (!metadata.frameId || !metadata.tabId || !Number.isInteger(width) || !Number.isInteger(height) || width < 240 || width > 2560 || height < 240 || height > 1800) throw new Error("Invalid browser frame identity");
  return { ...metadata, width, height, blob: new Blob([new Uint8Array(buffer, 4 + length)], { type: "image/jpeg" }) };
}
async function consumeBinaryBrowserStream(path, headers, onFrame, signal) {
  const response = await fetch(path + "&view=stream-ticket", { method: "POST", headers, signal, cache: "no-store" });
  if (!response.ok) throw new Error("Browser transport authorization failed");
  const ticket = await response.json();
  if (!ticket.available) throw new Error("Binary browser stream unavailable");
  const url = new URL(ticket.path, location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("sessionId", new URL(path, location.href).searchParams.get("sessionId"));
  if (signal.aborted) return;
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    let timer = setTimeout(() => {
      socket.close();
      reject(new Error("Browser stream connection timed out"));
    }, 6e3);
    const abort = () => {
      clearTimeout(timer);
      socket.close();
      resolve();
    };
    signal.addEventListener("abort", abort, { once: true });
    socket.onopen = () => {
      if (!signal.aborted) socket.send(JSON.stringify({ ticket: ticket.ticket }));
      else abort();
    };
    socket.onmessage = (event) => {
      try {
        clearTimeout(timer);
        timer = null;
        if (!signal.aborted) {
          const frame = decodeBrowserFrame(event.data);
          let acknowledged = false;
          onFrame({ ...frame, ack: () => {
            if (!acknowledged && socket.readyState === WebSocket.OPEN && !signal.aborted) {
              acknowledged = true;
              socket.send(JSON.stringify({ ack: frame.capture.id }));
            }
          } });
        }
      } catch (error) {
        socket.close();
        reject(error);
      }
    };
    socket.onerror = () => {
      socket.close();
      reject(new Error("Binary browser stream disconnected"));
    };
    socket.onclose = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      resolve();
    };
  });
}

// packages/browser/src/client/input-queue.mjs
function createInputQueue({ send, identity, onAck = () => {
}, onError = () => {
}, schedule = (callback) => setTimeout(callback, 8), cancel = clearTimeout }) {
  const inputId = globalThis.crypto.randomUUID();
  let sequence = 0, pending = [], active, running = false, scheduled, closed = false;
  const rejectAll = (error) => {
    for (const item of pending.splice(0)) for (const waiter of item.waiters) waiter.reject(error);
  };
  async function flush() {
    scheduled = null;
    if (closed || running || !pending.length) return;
    running = true;
    const item = active = pending.shift();
    try {
      const current = identity();
      if (!current || item.event.frameId !== current.frameId || item.event.tabId !== current.tabId) throw new Error("\u753B\u9762\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u64CD\u4F5C");
      const event = { ...item.event, focusId: current.focusId };
      const result = await send({ inputId, sequence: ++sequence, events: [event] });
      if (closed) return;
      if (result.failed || result.sequence !== sequence) throw new Error(result.reason ?? "\u8F93\u5165\u786E\u8BA4\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u64CD\u4F5C");
      onAck(result);
      for (const waiter of item.waiters) waiter.resolve(result);
    } catch (error) {
      for (const waiter of item.waiters) waiter.reject(error);
      rejectAll(error);
      if (!closed) onError(error);
    } finally {
      active = null;
      running = false;
      if (!closed && pending.length) scheduled = schedule(flush);
    }
  }
  return {
    push(event) {
      if (closed) return Promise.reject(new Error("Input connection closed"));
      return new Promise((resolve, reject) => {
        if (pending.length >= 64) {
          reject(new Error("\u8F93\u5165\u8FC7\u5FEB\uFF0C\u8BF7\u7B49\u5F85\u5F53\u524D\u64CD\u4F5C\u5B8C\u6210"));
          return;
        }
        const previous = pending.at(-1), same = previous && previous.event.frameId === event.frameId && previous.event.tabId === event.tabId && previous.event.action === event.action;
        let merged = false;
        if (same && event.action === "pointer" && event.phase === "move" && previous.event.phase === "move") {
          previous.event = event;
          merged = true;
        }
        if (same && event.action === "type" && previous.event.value.length + event.value.length <= 2e3) {
          previous.event.value += event.value;
          merged = true;
        }
        if (same && event.action === "scroll" && Math.abs(previous.event.deltaY + event.deltaY) <= 2e3 && Math.abs((previous.event.deltaX ?? 0) + (event.deltaX ?? 0)) <= 2e3) {
          previous.event.deltaY += event.deltaY;
          previous.event.deltaX = (previous.event.deltaX ?? 0) + (event.deltaX ?? 0);
          merged = true;
        }
        if (merged) previous.waiters.push({ resolve, reject });
        else pending.push({ event: { ...event }, waiters: [{ resolve, reject }] });
        if (!running && !scheduled) scheduled = schedule(flush);
      });
    },
    close() {
      closed = true;
      cancel(scheduled);
      const error = new Error("Input connection closed");
      if (active) for (const waiter of active.waiters) waiter.reject(error);
      rejectAll(error);
    },
    get pending() {
      return pending.length + Number(running);
    }
  };
}

// packages/browser/src/client/BrowserFrame.jsx
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var BrowserFrame = (0, import_react2.memo)((0, import_react2.forwardRef)(function BrowserFrame2({ onLoaded, onPointer }, ref) {
  const element = (0, import_react2.useRef)(null), state = (0, import_react2.useRef)({ current: null, pending: null, loading: false, url: null, disposed: false });
  const callbacks = (0, import_react2.useRef)({ onLoaded, onPointer });
  callbacks.current = { onLoaded, onPointer };
  function show(frame) {
    const s = state.current;
    if (!element.current || s.disposed) {
      s.pending = frame;
      return;
    }
    if (frame.capture?.id && s.current?.capture?.id === frame.capture.id) return;
    if (s.loading) {
      s.pending = frame;
      return;
    }
    s.loading = true;
    s.current = frame;
    const old = s.url;
    s.url = URL.createObjectURL(frame.blob);
    element.current.width = frame.width;
    element.current.height = frame.height;
    element.current.src = s.url;
    if (old) URL.revokeObjectURL(old);
  }
  (0, import_react2.useImperativeHandle)(ref, () => ({ show, element: () => element.current, clear() {
    const s = state.current;
    s.pending = null;
    s.current = null;
    s.loading = false;
    element.current?.removeAttribute("src");
    if (s.url) URL.revokeObjectURL(s.url);
    s.url = null;
  } }), []);
  const attach = (0, import_react2.useCallback)((node) => {
    element.current = node;
    const s = state.current;
    s.disposed = !node;
    if (!node) {
      if (s.url) URL.revokeObjectURL(s.url);
      s.url = null;
      s.loading = false;
      s.current = null;
      s.pending = null;
    } else if (s.pending) {
      const next = s.pending;
      s.pending = null;
      show(next);
    }
  }, []);
  const loaded = () => {
    const s = state.current;
    s.loading = false;
    if (s.current) {
      callbacks.current.onLoaded(s.current);
      s.current.ack?.();
    }
    if (s.pending) {
      const next = s.pending;
      s.pending = null;
      show(next);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "img",
    {
      ref: attach,
      alt: "\u5F53\u524D\u4F1A\u8BDD\u6D4F\u89C8\u5668\u9875\u9762",
      draggable: "false",
      onLoad: loaded,
      onError: () => {
        state.current.current?.ack?.();
        state.current.loading = false;
        if (state.current.pending) {
          const next = state.current.pending;
          state.current.pending = null;
          show(next);
        }
      },
      onPointerDown: (event) => callbacks.current.onPointer(event, "down"),
      onPointerMove: (event) => callbacks.current.onPointer(event, "move"),
      onPointerUp: (event) => callbacks.current.onPointer(event, "up"),
      onPointerCancel: (event) => callbacks.current.onPointer(event, "cancel"),
      onContextMenu: (event) => event.preventDefault()
    }
  );
}));

// packages/browser/src/client/BrowserResources.jsx
var import_react3 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var labels = { "user-control": "\u4F60\u6B63\u5728\u63A5\u7BA1", busy: "\u6709\u64CD\u4F5C\u6392\u961F", recording: "\u6B63\u5728\u5F55\u50CF", "download-armed": "\u4E0B\u8F7D\u6388\u6743\u6709\u6548", transfer: "\u6B63\u5728\u4F20\u8F93", viewer: "\u6B63\u5728\u67E5\u770B" };
var states = { dormant: "\u672A\u542F\u52A8", starting: "\u542F\u52A8\u4E2D", active: "\u8FD0\u884C\u4E2D", hibernated: "\u5DF2\u56DE\u6536", ended: "\u5DF2\u7ED3\u675F" };
function BrowserResources({ state, busy, act }) {
  const [open, setOpen] = (0, import_react3.useState)(true);
  const resources = state.resources;
  if (!resources?.host) return null;
  const { host, memory } = resources;
  const memoryText = memory?.status === "measured" ? `${memory.privateWorkingSetMiB} MiB \u79C1\u6709\u9A7B\u7559` : memory?.status === "not-running" ? "\u672A\u8FD0\u884C" : "\u672A\u6D4B\u91CF";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Disclosure, { className: "pw-browser-resources", title: "\u8D44\u6E90\u7BA1\u7406", count: `${states[resources.state] ?? "\u672A\u77E5"} \xB7 ${memoryText}`, open, onToggle: () => setOpen((previous) => !previous), children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("dl", { className: "pw-facts", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dt", { children: "\u5F53\u524D\u6D4F\u89C8\u5668" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("dd", { children: [
          states[resources.state] ?? "\u672A\u77E5",
          " \xB7 ",
          state.tabs.length,
          "/",
          resources.maxTabs,
          " \u4E2A\u6807\u7B7E"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dt", { children: "\u5F53\u524D\u91C7\u6837" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("dd", { children: [
          memoryText,
          memory?.status === "measured" && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("small", { children: [
            " \xB7 ",
            new Date(memory.measuredAtMs).toLocaleTimeString(),
            "\uFF0C\u975E\u5B9E\u65F6"
          ] }),
          memory?.status === "unsupported" && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("small", { children: [
            " \xB7 ",
            memory.reason
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dt", { children: "\u5B9E\u4F8B\u5E76\u53D1" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("dd", { children: [
          host.running,
          "/",
          host.maxInstances,
          " \u4E2A\u6D4F\u89C8\u5668"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dt", { children: "\u8F6F\u5185\u5B58\u76EE\u6807" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("dd", { children: [
          host.memoryTargetMiB,
          " MiB \xB7 ",
          host.measured,
          "/",
          host.running,
          " \u4E2A\u6709\u8FD1\u671F\u91C7\u6837",
          host.measured > 0 ? ` \xB7 \u5DF2\u6D4B\u5408\u8BA1 ${host.privateWorkingSetMiB} MiB` : ""
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dt", { children: "\u81EA\u52A8\u56DE\u6536" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("dd", { children: [
          resources.autoReclaim ? `\u7A7A\u95F2 ${Math.round(resources.idleTimeoutMs / 6e4 * 10) / 10} \u5206\u949F\u540E` : "\u5173\u95ED",
          resources.protection?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("small", { children: [
            " \xB7 \u4FDD\u62A4\u4E2D\uFF1A",
            resources.protection.filter((key) => key !== "busy").map((key) => labels[key]).join("\u3001") || "\u64CD\u4F5C\u4E2D"
          ] })
        ] })
      ] })
    ] }),
    host.pressure === "high" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { role: "status", children: "\u8FD1\u671F\u91C7\u6837\u5DF2\u8D85\u8FC7\u8F6F\u76EE\u6807\uFF0C\u8BF7\u56DE\u6536\u95F2\u7F6E\u6D4F\u89C8\u5668\uFF1B\u53D7\u4FDD\u62A4\u9875\u9762\u4E0D\u4F1A\u88AB\u5F3A\u5236\u5173\u95ED\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "pw-browser-inspect-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { type: "button", disabled: busy || resources.state !== "active", onClick: () => act("measureResources"), children: "\u91C7\u6837\u5185\u5B58" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { type: "button", disabled: busy || resources.state !== "active" || state.recording, onClick: () => act("hibernate"), children: "\u56DE\u6536\u5F53\u524D\u6D4F\u89C8\u5668" }),
      state.recoverableTabs > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(Button, { type: "button", disabled: busy, onClick: () => act("recoverTabs"), children: [
        "\u6062\u590D ",
        state.recoverableTabs,
        " \u4E2A\u6807\u7B7E"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Toggle, { label: "\u5141\u8BB8\u672C\u4F1A\u8BDD\u7A7A\u95F2\u6216\u5BB9\u91CF\u4E0D\u8DB3\u65F6\u81EA\u52A8\u56DE\u6536", checked: resources.autoReclaim, disabled: busy, onChange: (value) => act("resourceMode", { autoReclaim: value }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "pw-muted", children: "\u56DE\u6536\u4FDD\u7559\u7F51\u5740\uFF0C\u672A\u63D0\u4EA4\u8868\u5355\u4E0D\u4FDD\u5B58\u3002\u63A5\u7BA1\u3001\u67E5\u770B\u3001\u5F55\u50CF\u548C\u4F20\u8F93\u671F\u95F4\u4E0D\u81EA\u52A8\u56DE\u6536\u3002\u5185\u5B58\u76EE\u6807\u4E0D\u662F\u7CFB\u7EDF\u786C\u4E0A\u9650\uFF1B\u672A\u91C7\u6837\u90E8\u5206\u6309\u672A\u77E5\u5904\u7406\u3002" })
  ] });
}

// packages/browser/src/client/BrowserChrome.jsx
var import_react4 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
var paths = {
  globe: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: "12", cy: "12", r: "9" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z" })
  ] }),
  back: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "m13 5-7 7 7 7M6 12h15" }),
  forward: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "m11 5 7 7-7 7M18 12H3" }),
  refresh: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M20 7v5h-5M4 17v-5h5" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" })
  ] }),
  close: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "m6 6 12 12M18 6 6 18" }),
  plus: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M12 4v16M4 12h16" }),
  fit: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" }),
  more: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: "5", cy: "12", r: "1" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: "12", cy: "12", r: "1" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("circle", { cx: "19", cy: "12", r: "1" })
  ] }),
  annotate: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M8 3H4v4m12-4h4v4M4 15v5h4m12-8-8 8-1-5 7-7 2 4Z" }),
  fingerprint: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_jsx_runtime4.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M4 10a8 8 0 0 1 16 0M7 19c2-3 1-6 1-9a4 4 0 0 1 8 0c0 5 0 7 2 10M12 9c-1 4 1 9-2 13M4 14c0 3-1 4-1 5M20 14v3M15 21l-1-4" }) })
};
function Icon({ name }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { className: "pw-browser-icon", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: paths[name] });
}
function BrowserChrome({ state, busy, address, setAddress, act, navigate, fit, annotating, onAnnotate, onManage, onInspect, onResources, onTextEntry, onDisable, disabling, zoom, expanded, onZoom, onExpand, onCopy, onCancelNavigation }) {
  const [menuOpen, setMenuOpen] = (0, import_react4.useState)(false);
  const tabsRef = (0, import_react4.useRef)(null);
  (0, import_react4.useEffect)(() => {
    const selected = tabsRef.current?.querySelector('[aria-selected="true"]');
    selected?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [state.selectedTabId]);
  const menuItems = [
    { type: "label", id: "scope", text: "\u5F53\u524D\u4F1A\u8BDD" },
    { id: "environment", label: "\u73AF\u5883\u4E0E\u6307\u7EB9" },
    { id: "resources", label: "\u8D44\u6E90\u7BA1\u7406" },
    { id: "inspect", label: "\u68C0\u67E5\u4E0E\u8BB0\u5F55" },
    { id: "text", label: "\u8F93\u5165\u6587\u5B57\uFF08\u652F\u6301\u4E2D\u6587\uFF09", disabled: !state.active },
    { id: "copy", label: "\u590D\u5236\u7F51\u9875\u9009\u4E2D\u6587\u5B57", disabled: !state.active || state.control !== "user" },
    { type: "separator", id: "display-separator" },
    { id: "zoom-fit", label: "\u753B\u9762\u9002\u5E94\u5BBD\u5EA6", disabled: !state.active },
    { id: "zoom-100", label: "\u753B\u9762\u539F\u59CB\u5C3A\u5BF8 100%", disabled: !state.active },
    { id: "zoom-150", label: "\u653E\u5927\u753B\u9762 150%", disabled: !state.active },
    { id: "expand", label: expanded ? "\u6536\u8D77\u6D4F\u89C8\u5668" : "\u5C55\u5F00\u6D4F\u89C8\u5668" },
    { type: "separator", id: "separator" },
    { id: "close", label: "\u5173\u95ED\u6D4F\u89C8\u5668\u5185\u6838", disabled: busy || !(state.active || state.resources?.state === "active") },
    ...onDisable ? [{ id: "disable", label: "\u505C\u7528\u5E76\u5173\u95ED", disabled: busy || disabling }] : []
  ];
  function choose(id) {
    setMenuOpen(false);
    const callbacks = { environment: onManage, resources: onResources, inspect: onInspect, text: onTextEntry, copy: onCopy, close: () => act("close"), disable: onDisable, "zoom-fit": () => onZoom?.(0), "zoom-100": () => onZoom?.(1), "zoom-150": () => onZoom?.(1.5), expand: onExpand };
    callbacks[id]?.();
  }
  function tabKeys(event) {
    if (busy || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const index = state.tabs.findIndex((tab2) => tab2.id === state.selectedTabId);
    const next = event.key === "Home" ? 0 : event.key === "End" ? state.tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + state.tabs.length) % state.tabs.length;
    const tab = state.tabs[next];
    if (!tab) return;
    event.preventDefault();
    tabsRef.current.querySelectorAll('[role="tab"]')[next]?.focus();
    void act(tab.state === "suspended" ? "resumeTab" : "selectTab", { tabId: tab.id });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-browser-chrome", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-browser-tabbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { ref: tabsRef, role: "tablist", "aria-label": "\u6D4F\u89C8\u5668\u6807\u7B7E\u9875", onKeyDown: tabKeys, children: state.tabs.length ? state.tabs.map((tab) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-browser-tab", "data-selected": tab.id === state.selectedTabId, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Button, { type: "button", role: "tab", "aria-selected": tab.id === state.selectedTabId, tabIndex: tab.id === state.selectedTabId ? 0 : -1, title: tab.url, disabled: busy, onClick: () => act(tab.state === "suspended" ? "resumeTab" : "selectTab", { tabId: tab.id }), children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: "globe" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
            tab.state === "suspended" ? "\u4F11\u7720 \xB7 " : "",
            tab.title || "\u65B0\u6807\u7B7E\u9875"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { type: "button", className: "pw-browser-tab-close", "aria-label": `\u5173\u95ED\u6807\u7B7E ${tab.title || "\u65B0\u6807\u7B7E\u9875"}`, disabled: busy, onClick: () => act("closeTab", { tabId: tab.id }), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: "close" }) })
      ] }, tab.id)) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-browser-tab pw-browser-tab-placeholder", "data-selected": "true", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: "globe" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "\u65B0\u6807\u7B7E\u9875" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { type: "button", className: "pw-browser-new-tab", title: "\u65B0\u5EFA\u6807\u7B7E\u9875", "aria-label": "\u65B0\u5EFA\u6807\u7B7E\u9875", disabled: busy || state.tabs.length >= (state.resources?.maxTabs ?? 8), onClick: () => act("newTab"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: "plus" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Button, { type: "button", className: "pw-browser-identity", title: "\u73AF\u5883\u4E0E\u6307\u7EB9", "aria-label": "\u73AF\u5883\u4E0E\u6307\u7EB9", onClick: onManage, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: "fingerprint" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "\u6307\u7EB9" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-browser-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-browser-navigation", role: "group", "aria-label": "\u9875\u9762\u5BFC\u822A", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { type: "button", title: "\u540E\u9000", "aria-label": "\u540E\u9000", disabled: !state.active || busy, onClick: () => act("back"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: "back" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { type: "button", title: "\u524D\u8FDB", "aria-label": "\u524D\u8FDB", disabled: !state.active || busy, onClick: () => act("forward"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: "forward" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "pw-browser-navigation-divider" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { type: "button", title: busy || state.loading ? "\u505C\u6B62\u52A0\u8F7D" : "\u5237\u65B0", "aria-label": busy || state.loading ? "\u505C\u6B62\u52A0\u8F7D" : "\u5237\u65B0\u9875\u9762", disabled: !state.active, onClick: () => busy || state.loading ? onCancelNavigation?.() : act("reload"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: busy || state.loading ? "close" : "refresh" }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Button, { type: "button", className: "pw-browser-annotate", "aria-label": "\u6807\u6CE8\u9875\u9762", "aria-pressed": annotating, title: "\u50CF\u68C0\u67E5\u5143\u7D20\u4E00\u6837\u60AC\u505C\u9AD8\u4EAE\uFF0C\u70B9\u51FB\u540E\u6807\u6CE8\uFF1B\u6309\u4F4F Space \u4E34\u65F6\u64CD\u4F5C\u7F51\u9875", disabled: !state.active || busy, onClick: onAnnotate, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: "annotate" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "\u6807\u6CE8" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("form", { className: "pw-browser-address", onSubmit: (event) => {
        event.preventDefault();
        event.currentTarget.querySelector("input")?.blur();
        void navigate();
      }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Input, { "data-pw-browser-address": "true", "aria-label": "\u6D4F\u89C8\u5668\u5730\u5740", placeholder: "\u8F93\u5165\u7F51\u5740", value: address, onChange: (event) => setAddress(event.target.value), onFocus: (event) => event.currentTarget.select(), spellCheck: "false", autoCapitalize: "none", autoCorrect: "off", autoComplete: "off", inputMode: "url" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { type: "button", className: "pw-browser-fit", title: expanded ? "\u6536\u8D77\u6D4F\u89C8\u5668" : "\u5C55\u5F00\u6D4F\u89C8\u5668", "aria-label": expanded ? "\u6536\u8D77\u6D4F\u89C8\u5668" : "\u5C55\u5F00\u6D4F\u89C8\u5668", onClick: onExpand, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: "fit" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        import_dsh_client_ui_primitives.Menu,
        {
          open: menuOpen,
          onClose: () => setMenuOpen(false),
          onSelect: choose,
          items: menuItems,
          compact: true,
          autoFocus: true,
          portal: true,
          align: "end",
          className: "pw-browser-menu-anchor",
          listClassName: "pw-browser-host-menu",
          anchor: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { type: "button", className: "pw-browser-menu-trigger", title: "\u6D4F\u89C8\u5668\u83DC\u5355", "aria-label": "\u6D4F\u89C8\u5668\u83DC\u5355", "aria-haspopup": "menu", "aria-expanded": menuOpen, onClick: () => setMenuOpen((value) => !value), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: "more" }) })
        }
      )
    ] })
  ] });
}

// packages/browser/src/client/BrowserAnnotations.jsx
var import_react5 = require("react");

// packages/browser/src/client/element-inspector.mjs
function createElementInspector({ request, onChange, delay = 65 }) {
  let timer, pending, flight, serial = 0, disposed = false;
  async function run() {
    timer = void 0;
    if (disposed || flight || !pending) return;
    const point = pending, version = serial, controller = new AbortController();
    pending = null;
    flight = controller;
    try {
      const result = await request(point, controller.signal);
      if (!disposed && version === serial && !controller.signal.aborted) onChange(result?.inspection ? { ...result.inspection, point } : null);
    } catch {
      if (!disposed && version === serial) onChange(null);
    } finally {
      if (flight === controller) flight = null;
      if (!disposed && pending && !timer) timer = setTimeout(run, delay);
    }
  }
  function clear() {
    serial++;
    pending = null;
    clearTimeout(timer);
    timer = void 0;
    flight?.abort();
    onChange(null);
  }
  return {
    inspect(point) {
      if (disposed) return;
      serial++;
      pending = point;
      if (!timer && !flight) timer = setTimeout(run, delay);
    },
    clear,
    dispose() {
      disposed = true;
      clear();
    }
  };
}

// packages/browser/src/client/BrowserAnnotations.jsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function AnnotationOverlay({ enabled, passthrough, frame, items, onPick, onInspect }) {
  const [drag, setDrag] = (0, import_react5.useState)(null);
  const [hover, setHover] = (0, import_react5.useState)(null);
  const start = (0, import_react5.useRef)(null);
  const selected = (0, import_react5.useRef)(null), picker = (0, import_react5.useRef)(null), inspect = (0, import_react5.useRef)(onInspect);
  inspect.current = onInspect;
  (0, import_react5.useEffect)(() => {
    if (!enabled || passthrough) {
      setHover(null);
      return;
    }
    const next = createElementInspector({ request: (point2, signal) => inspect.current?.(point2, signal), onChange: setHover });
    picker.current = next;
    return () => {
      next.dispose();
      if (picker.current === next) picker.current = null;
    };
  }, [enabled, passthrough, frame.frameId, frame.tabId]);
  const point = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: Math.floor(Math.max(0, Math.min(frame.width - 1, (event.clientX - box.left) * frame.width / box.width))), y: Math.floor(Math.max(0, Math.min(frame.height - 1, (event.clientY - box.top) * frame.height / box.height))) };
  };
  function down(event) {
    if (!enabled || passthrough || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = point(event);
    selected.current = hover;
    picker.current?.clear();
  }
  function move(event) {
    if (!enabled || passthrough) return;
    const end = point(event);
    if (!start.current) {
      picker.current?.inspect(end);
      return;
    }
    if (Math.abs(end.x - start.current.x) < 6 && Math.abs(end.y - start.current.y) < 6) return;
    setDrag({ x: Math.min(start.current.x, end.x), y: Math.min(start.current.y, end.y), width: Math.max(1, Math.abs(end.x - start.current.x)), height: Math.max(1, Math.abs(end.y - start.current.y)) });
  }
  function up(event) {
    if (!start.current) return;
    event.preventDefault();
    event.stopPropagation();
    const end = point(event), first = start.current;
    start.current = null;
    setDrag(null);
    if (passthrough) return;
    const region = Math.abs(end.x - first.x) >= 6 || Math.abs(end.y - first.y) >= 6;
    const box = region ? { x: Math.min(first.x, end.x), y: Math.min(first.y, end.y), width: Math.max(1, Math.abs(end.x - first.x)), height: Math.max(1, Math.abs(end.y - first.y)) } : { x: end.x, y: end.y, width: 1, height: 1 };
    const targetId = !region && selected.current?.point.x === end.x && selected.current?.point.y === end.y ? selected.current.targetId : void 0;
    selected.current = null;
    void onPick({ kind: region ? "region" : "element", box, ...targetId ? { targetId } : {} });
  }
  (0, import_react5.useEffect)(() => {
    start.current = null;
    setDrag(null);
  }, [frame.frameId, enabled, passthrough]);
  const style = (box) => ({ left: `${box.x / frame.width * 100}%`, top: `${box.y / frame.height * 100}%`, width: `${box.width / frame.width * 100}%`, height: `${box.height / frame.height * 100}%` });
  const tooltipAbove = hover && hover.box.y > 42;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "pw-browser-annotation-layer", "data-active": enabled && !passthrough, role: "region", "aria-label": "\u9875\u9762\u6807\u6CE8\u5C42", tabIndex: enabled ? 0 : -1, onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerLeave: () => picker.current?.clear(), onPointerCancel: () => {
    start.current = null;
    selected.current = null;
    setDrag(null);
    picker.current?.clear();
  }, onClick: (event) => event.stopPropagation(), children: [
    items.map((item, index) => !item.stale && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "pw-browser-annotation-box", style: style(item.box), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: index + 1 }) }, item.id)),
    drag && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "pw-browser-annotation-box", "data-dragging": "true", style: style(drag) }),
    hover && enabled && !passthrough && !drag && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "pw-browser-element-highlight", "aria-hidden": "true", style: style(hover.box), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { top: `${hover.padding.top / hover.box.height * 100}%`, right: `${hover.padding.right / hover.box.width * 100}%`, bottom: `${hover.padding.bottom / hover.box.height * 100}%`, left: `${hover.padding.left / hover.box.width * 100}%` } }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "pw-browser-element-label", role: "tooltip", "aria-label": "\u68C0\u67E5\u7684\u9875\u9762\u5143\u7D20", "data-above": tooltipAbove, style: { left: `${Math.min(hover.box.x / frame.width * 100, 65)}%`, maxWidth: `calc(${100 - Math.min(hover.box.x / frame.width * 100, 65)}% - 4px)`, top: `${(tooltipAbove ? hover.box.y : hover.box.y + Math.min(hover.box.height, 38)) / frame.height * 100}%` }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("code", { children: hover.selector }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
          hover.size.width,
          " \xD7 ",
          hover.size.height
        ] }),
        hover.frameBoundary && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("small", { children: "iframe \u8FB9\u754C" })
      ] })
    ] })
  ] });
}
function AnnotationEditor({ items, busy, act, onSend, onContinue }) {
  const [notes, setNotes] = (0, import_react5.useState)({}), [message, setMessage] = (0, import_react5.useState)(""), [sending, setSending] = (0, import_react5.useState)(false);
  const [open, setOpen] = (0, import_react5.useState)(true);
  const [pendingDelivery, setPendingDelivery] = (0, import_react5.useState)(null);
  const active = (0, import_react5.useRef)(true), editor = (0, import_react5.useRef)(null), previousIds = (0, import_react5.useRef)(/* @__PURE__ */ new Set());
  const itemIds = items.map((item) => item.id).join(",");
  (0, import_react5.useEffect)(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  (0, import_react5.useEffect)(() => {
    if (itemIds) setOpen(true);
    setMessage("");
  }, [itemIds]);
  (0, import_react5.useEffect)(() => {
    const added = items.filter((item) => !item.stale && !item.submitted && !previousIds.current.has(item.id));
    previousIds.current = new Set(items.map((item) => item.id));
    if (added.length) {
      const index = items.indexOf(added.at(-1));
      const frame = requestAnimationFrame(() => editor.current?.querySelectorAll("textarea")[index]?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(frame);
    }
  }, [itemIds]);
  (0, import_react5.useEffect)(() => {
    setNotes((previous) => Object.fromEntries(Object.entries(previous).filter(([id]) => itemIds.split(",").includes(id))));
  }, [itemIds]);
  (0, import_react5.useEffect)(() => {
    setPendingDelivery((previous) => previous?.ids.some((id) => !items.some((item) => item.id === id && !item.stale)) ? null : previous);
  }, [items]);
  if (!items.length) return null;
  const drafts = items.filter((item) => !item.stale && !item.submitted);
  const note = (item) => notes[item.id] ?? item.note;
  async function submit(send) {
    setSending(true);
    setMessage("");
    try {
      let delivery = pendingDelivery;
      if (!delivery) {
        const entries = drafts.map((item) => ({ id: item.id, note: note(item) }));
        const result = await act("submitAnnotations", { entries });
        if (!result) return;
        const feedback = result.annotations.filter((item) => entries.some((entry) => entry.id === item.id));
        delivery = { ids: feedback.map((item) => item.id), text: `\u8BF7\u6839\u636E\u8FD9\u4E9B\u6D4F\u89C8\u5668\u6807\u6CE8\u5904\u7406\u5F53\u524D\u9875\u9762\u3002\u5148\u7528 patchwork_browser \u7684 annotations \u8BFB\u53D6\u8BF4\u660E\uFF0C\u6309\u9700\u8981\u7528 annotationId \u67E5\u770B\u533A\u57DF\u622A\u56FE\uFF0C\u518D\u6838\u5BF9\u5F53\u524D\u9875\u9762\u3002
${JSON.stringify(feedback.map(({ id, note: note2 }) => ({ id, note: note2 })))}` };
      }
      if (send) {
        if (active.current) setPendingDelivery(delivery);
        await onSend(delivery.text);
        if (active.current) setPendingDelivery(null);
      }
      if (active.current) setMessage(send ? "\u5DF2\u53D1\u9001\u5230\u5F53\u524D\u4F1A\u8BDD\uFF1B\u6D4F\u89C8\u5668\u4FDD\u6301\u7528\u6237\u63A5\u7BA1\uFF0C\u53EF\u5728\u5E95\u680F\u6062\u590D Agent\u3002" : "\u5DF2\u63D0\u4EA4\uFF0C\u5F53\u524D Agent \u53EF\u8BFB\u53D6\u8FD9\u4E9B\u6807\u6CE8\u3002");
    } catch (error) {
      if (active.current) setMessage(`\u53D1\u9001\u5931\u8D25\uFF0C\u5DF2\u63D0\u4EA4\u7684\u6807\u6CE8\u4ECD\u4FDD\u7559\uFF1A${error.message}`);
    } finally {
      if (active.current) setSending(false);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { ref: editor, className: "pw-browser-feedback", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Disclosure, { title: "\u9875\u9762\u6807\u6CE8", count: `${items.length} / 8`, open, onToggle: () => setOpen((previous) => !previous), children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("ol", { children: items.map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("li", { "data-stale": item.stale, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("strong", { children: [
          index + 1,
          ". ",
          item.target?.name || (item.kind === "element" ? item.target?.tag : "\u9009\u5B9A\u533A\u57DF")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: item.stale ? "\u5DF2\u8FC7\u671F" : item.submitted ? "\u5DF2\u63D0\u4EA4" : "\u8349\u7A3F" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Button, { type: "button", "aria-label": `\u79FB\u9664\u6807\u6CE8 ${index + 1}`, disabled: busy || sending, onClick: () => act("removeAnnotation", { annotationId: item.id }), children: "\u79FB\u9664" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TextArea, { "aria-label": `\u6807\u6CE8 ${index + 1} \u7684\u8BF4\u660E`, rows: 2, maxLength: 600, placeholder: "\u8FD9\u91CC\u9700\u8981\u6539\u6210\u4EC0\u4E48\uFF1F", disabled: item.stale || item.submitted || sending, value: note(item), onChange: (event) => setNotes((previous) => ({ ...previous, [item.id]: event.target.value })) })
    ] }, item.id)) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "pw-browser-feedback-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Button, { type: "button", disabled: busy || sending || (pendingDelivery ? pendingDelivery.ids.some((id) => !items.some((item) => item.id === id && !item.stale)) : !drafts.length || drafts.some((item) => !note(item)?.trim())), onClick: () => submit(Boolean(onSend)), children: sending ? "\u6B63\u5728\u63D0\u4EA4\u2026" : pendingDelivery ? "\u91CD\u8BD5\u53D1\u9001" : onSend ? "\u53D1\u7ED9\u5F53\u524D Agent" : "\u63D0\u4EA4\u6807\u6CE8" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Button, { type: "button", disabled: busy || sending, onClick: onContinue, children: "\u7EE7\u7EED\u6807\u6CE8" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("small", { children: "\u9009\u533A\u622A\u56FE\u4E0E\u8BF4\u660E\u4EC5\u63D0\u4F9B\u7ED9\u5F53\u524D\u5DF2\u6388\u6743\u4F1A\u8BDD\u3002" })
    ] }),
    message && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { role: "status", children: message })
  ] }) });
}

// packages/browser/src/client/BrowserEnvironments.jsx
var import_react6 = require("react");
var import_jsx_runtime6 = require("react/jsx-runtime");
var MODES = { native: "\u539F\u751F\u73AF\u5883", device: "\u8BBE\u5907\u53C2\u6570\u6A21\u677F", fingerprint: "JS \u6307\u7EB9\uFF08\u5B9E\u9A8C\uFF09" };
var modeLabel = (profile) => profile?.fingerprintKind === "native-engine" || profile?.backend === "aliasmode" ? "\u539F\u751F\u5185\u6838\u6307\u7EB9\uFF08\u5B9E\u9A8C\uFF09" : MODES[profile?.mode] ?? "\u539F\u751F\u73AF\u5883";
function BrowserEnvironments({ state, busy, act, Form }) {
  const [editing, setEditing] = (0, import_react6.useState)(null), [rotation, setRotation] = (0, import_react6.useState)(null), [notice, setNotice] = (0, import_react6.useState)("");
  const current = state.profiles.find((profile) => profile.id === state.profileId);
  const full = state.profiles.length >= 9;
  const mismatch = (profile) => profile.mode === "fingerprint" && state.engineVersion && (profile.backend ?? "chromium") === (current?.backend ?? "chromium") && profile.fingerprintBrowserMajor !== Number(state.engineVersion.split(".")[0]);
  const unavailable = (profile) => profile.backend === "aliasmode" && state.nativeBackend?.installed === false;
  async function use(profileId) {
    const result = await act("useProfile", { profileId });
    if (result) {
      setNotice("\u5DF2\u5207\u6362\u73AF\u5883\u3002\u65E7\u6807\u7B7E\u9875\u5DF2\u5173\u95ED\uFF0C\u65B0\u9875\u9762\u4F7F\u7528\u6B64\u73AF\u5883\u3002");
      setEditing(null);
      setRotation(null);
    }
  }
  async function regenerate() {
    const result = await act("regenerateProfile", { profileId: rotation.id, revision: rotation.revision });
    if (result) {
      setRotation(null);
      setNotice("\u5DF2\u751F\u6210\u65B0\u7684\u72EC\u7ACB\u73AF\u5883\u3002\u70B9\u51FB\u65B0\u73AF\u5883\u7684\u201C\u4F7F\u7528\u201D\u624D\u4F1A\u5207\u6362\uFF1B\u5F53\u524D\u9875\u9762\u4FDD\u6301\u539F\u73AF\u5883\u3002");
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "pw-browser-environment", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: "\u5F53\u524D\u73AF\u5883" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Select, { "aria-label": "\u6D4F\u89C8\u5668\u73AF\u5883", value: state.profileId, disabled: busy, onChange: use, options: state.profiles.map((profile) => ({ value: profile.id, label: profile.name, disabled: mismatch(profile) || unavailable(profile) })) })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: "pw-browser-profiles", "aria-label": "\u73AF\u5883\u4E0E\u6307\u7EB9\u7BA1\u7406", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { children: [
        "\u5F53\u524D\uFF1A",
        modeLabel(current),
        " \xB7 ",
        state.engineVersion ? `\u5185\u6838 ${state.engineVersion}` : "\u5185\u6838\u5C1A\u672A\u542F\u52A8",
        current?.fingerprintId ? ` \xB7 ${current.mode === "fingerprint" ? "\u6307\u7EB9" : "\u8BBE\u5907\u53C2\u6570"} ID ${current.fingerprintId}` : " \xB7 \u4FDD\u7559\u771F\u5B9E\u8BBE\u5907\u8EAB\u4EFD"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u5207\u6362\u73AF\u5883\u4F1A\u5173\u95ED\u5F53\u524D\u6807\u7B7E\u9875\u3002\u66F4\u6362\u6307\u7EB9\u5148\u751F\u6210\u72EC\u7ACB\u65B0\u73AF\u5883\uFF0C\u4E0D\u590D\u5236\u65E7\u767B\u5F55\uFF1B\u70B9\u51FB\u201C\u4F7F\u7528\u201D\u540E\u624D\u751F\u6548\u3002\u8BBE\u5907\u53C2\u6570\u6A21\u677F\u53EA\u8C03\u6574\u5C4F\u5E55\u3001\u50CF\u7D20\u6BD4\u7B49\u8BBE\u7F6E\uFF0C\u4E0D\u7B49\u4E8E\u66F4\u6362 CPU\u3001GPU \u6216 Canvas \u6307\u7EB9\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { role: "status", children: [
        "AliasMode \u53EF\u9009\u5185\u6838\uFF1A",
        state.nativeBackend?.installed ? `\u5DF2\u5B89\u88C5 ${state.nativeBackend.version ?? ""}` : "\u672A\u5B89\u88C5\uFF0C\u9700\u5728\u6B64\u5B9E\u4F8B\u72EC\u7ACB\u5B89\u88C5\u540E\u4F7F\u7528",
        "\u3002\u539F\u751F\u6307\u7EB9\u5207\u6362\u4F1A\u91CD\u542F\u672C\u4F1A\u8BDD\u5185\u6838\uFF0C\u672A\u63D0\u4EA4\u8868\u5355\u4E0D\u4FDD\u7559\u3002"
      ] }),
      state.nativeBackend?.installed === false && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { className: "pw-muted", children: [
        "\u5B89\u88C5\u547D\u4EE4\uFF1A",
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("code", { children: "patchwork-browser-components install aliasmode --home <\u9694\u79BB\u5B9E\u4F8B\u76EE\u5F55>" }),
        "\uFF08\u4EC5 Windows x64\uFF0C\u4E0D\u968F\u4E3B\u5305\u4E0B\u8F7D\uFF09"
      ] }),
      state.profiles.filter((profile) => profile.id !== "native").map((profile) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-browser-profile-row", role: "group", "aria-label": `\u73AF\u5883 ${profile.name}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { children: [
          profile.name,
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("small", { children: [
            modeLabel(profile),
            " \xB7 ",
            profile.persistStorage ? "\u4FDD\u5B58\u767B\u5F55\u72B6\u6001" : "\u4E34\u65F6\u5B58\u50A8"
          ] }),
          profile.fingerprintId && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("small", { children: [
            profile.mode === "fingerprint" ? "\u6307\u7EB9" : "\u8BBE\u5907\u53C2\u6570",
            " ID\uFF1A",
            profile.fingerprintId
          ] }),
          profile.mode === "fingerprint" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("small", { children: profile.backend === "aliasmode" ? unavailable(profile) ? "\u65E0\u6CD5\u542F\u7528\uFF1A\u8BF7\u5148\u5B89\u88C5\u53EF\u9009\u5185\u6838" : `${profile.engineRelease} \xB7 \u542F\u7528\u65F6\u6309\u8EAB\u4EFD\u91CD\u542F` : mismatch(profile) ? `\u65E0\u6CD5\u542F\u7528\uFF1A\u6837\u672C Chromium ${profile.fingerprintBrowserMajor ?? "\u672A\u77E5"} \u4E0E\u5F53\u524D\u5185\u6838\u4E0D\u5339\u914D` : `\u6837\u672C Chromium ${profile.fingerprintBrowserMajor ?? "\u672A\u77E5"} \xB7 \u542F\u7528\u524D\u6838\u5BF9\u5185\u6838` })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { type: "button", disabled: busy || profile.id === state.profileId || mismatch(profile) || unavailable(profile), onClick: () => use(profile.id), children: profile.id === state.profileId ? "\u4F7F\u7528\u4E2D" : "\u4F7F\u7528" }),
        profile.mode !== "native" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { type: "button", disabled: busy || full, onClick: () => {
          setRotation({ ...profile, revision: state.revision });
          setEditing(null);
          setNotice("");
        }, children: profile.mode === "fingerprint" ? "\u66F4\u6362\u6307\u7EB9" : "\u66F4\u6362\u8BBE\u5907\u53C2\u6570" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { type: "button", disabled: busy || profile.id === state.profileId, onClick: () => {
          setEditing(profile);
          setRotation(null);
          setNotice("");
        }, children: "\u7F16\u8F91" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { type: "button", disabled: busy, onClick: () => act("clearStorage", { profileId: profile.id }), children: "\u6E05\u9664\u767B\u5F55" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { type: "button", disabled: busy || profile.id === state.profileId, onClick: () => act("deleteProfile", { profileId: profile.id, revision: state.revision }), children: "\u5220\u9664" })
      ] }, profile.id)),
      rotation && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-browser-identity-confirm", role: "group", "aria-label": "\u786E\u8BA4\u66F4\u6362\u73AF\u5883", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("strong", { children: [
          rotation.mode === "fingerprint" ? "\u91CD\u65B0\u751F\u6210\u6307\u7EB9" : "\u91CD\u65B0\u751F\u6210\u8BBE\u5907\u53C2\u6570",
          "\uFF1A",
          rotation.name
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u521B\u5EFA\u65B0\u73AF\u5883\uFF0C\u4FDD\u7559\u539F\u73AF\u5883\u4E0E\u5F53\u524D\u9875\u9762\u3002\u65B0\u73AF\u5883\u4E0D\u7EE7\u627F Cookie\u3001localStorage \u6216 IndexedDB\uFF0C\u4EE3\u7406\u548C\u8BED\u8A00\u7B49\u914D\u7F6E\u6CBF\u7528\u3002\u751F\u6210\u6210\u529F\u4E0D\u4EE3\u8868\u5DF2\u901A\u8FC7\u7AD9\u70B9\u68C0\u6D4B\uFF1B\u539F\u751F\u8EAB\u4EFD\u5728\u70B9\u51FB\u201C\u4F7F\u7528\u201D\u5E76\u91CD\u542F\u5185\u6838\u540E\u751F\u6548\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { type: "button", disabled: busy || full, onClick: regenerate, children: "\u751F\u6210\u65B0\u73AF\u5883" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { type: "button", disabled: busy, onClick: () => setRotation(null), children: "\u53D6\u6D88\u66F4\u6362" })
        ] })
      ] }),
      editing ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Form, { initial: editing, busy, onCancel: () => setEditing(null), onSave: async (profile) => {
        const result = await act(editing.id ? "updateProfile" : "createProfile", { profileId: editing.id, profile, revision: state.revision });
        if (result) {
          setEditing(null);
          setNotice("\u73AF\u5883\u5DF2\u4FDD\u5B58\uFF0C\u70B9\u51FB\u201C\u4F7F\u7528\u201D\u540E\u751F\u6548\u3002");
        }
      } }, editing.id ?? editing.mode ?? "new") : /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { type: "button", disabled: busy || full, onClick: () => {
          setEditing({ mode: "device" });
          setRotation(null);
        }, children: "\u65B0\u589E\u8BBE\u5907\u73AF\u5883" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { type: "button", disabled: busy || full, onClick: () => {
          setEditing({ name: "\u539F\u751F\u6307\u7EB9\u73AF\u5883", mode: "fingerprint", backend: "aliasmode" });
          setRotation(null);
        }, children: "\u65B0\u589E\u539F\u751F\u6307\u7EB9" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { type: "button", disabled: busy || full, onClick: () => {
          setEditing({ mode: "fingerprint" });
          setRotation(null);
        }, children: "\u65B0\u589E JS \u6307\u7EB9" })
      ] }),
      full && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u5DF2\u8FBE 8 \u4E2A\u81EA\u5B9A\u4E49\u73AF\u5883\u4E0A\u9650\uFF0C\u5148\u5220\u9664\u4E0D\u518D\u4F7F\u7528\u7684\u73AF\u5883\u3002" }),
      notice && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { role: "status", children: notice })
    ] })
  ] });
}

// packages/browser/src/client/BrowserPanel.jsx
var import_jsx_runtime7 = require("react/jsx-runtime");
var EMPTY = { active: false, url: "", viewport: null, tabs: [], profiles: [], profileId: "native", control: "agent", revision: 0 };
var MODES2 = { native: "\u539F\u751F\u73AF\u5883", device: "\u8BBE\u5907\u6A21\u677F", fingerprint: "\u6307\u7EB9\u73AF\u5883\uFF08\u5B9E\u9A8C\uFF09" };
function EnvironmentForm({ initial, busy, onSave, onCancel }) {
  const [draft, setDraft] = (0, import_react7.useState)(() => ({ name: "\u65B0\u73AF\u5883", mode: "device", locale: "zh-CN", timezoneId: "Asia/Shanghai", colorScheme: "light", viewport: { width: 1280, height: 800 }, screen: { width: 1920, height: 1080 }, deviceScaleFactor: 1, persistStorage: false, proxy: null, ...initial }));
  const set = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }));
  function submit(event) {
    event.preventDefault();
    const { name, mode, locale, timezoneId, colorScheme, viewport, screen, deviceScaleFactor, persistStorage, proxy } = draft;
    void onSave({ name, mode, backend: draft.backend ?? "chromium", locale, timezoneId, colorScheme, viewport, screen, deviceScaleFactor, persistStorage, proxy });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("form", { className: "pw-browser-profile-form", noValidate: true, onSubmit: submit, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-browser-form-grid", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
        "\u73AF\u5883\u540D\u79F0",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Input, { "aria-label": "\u73AF\u5883\u540D\u79F0", required: true, maxLength: 60, value: draft.name, onChange: (event) => set("name", event.target.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
        "\u6D4F\u89C8\u5668\u5185\u6838",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Select, { "aria-label": "\u73AF\u5883\u5185\u6838", disabled: Boolean(initial.id), value: draft.backend ?? "chromium", onChange: (value) => setDraft((previous) => ({ ...previous, backend: value, ...value === "aliasmode" ? { mode: "fingerprint" } : {} })), options: [{ value: "chromium", label: "\u7CFB\u7EDF Chromium" }, { value: "chromium-portable", label: "\u4FBF\u643A Chromium \xB7 \u9700\u72EC\u7ACB\u5B89\u88C5" }, { value: "camoufox", label: "Camoufox \xB7 \u9700\u72EC\u7ACB\u5B89\u88C5" }, { value: "aliasmode", label: "AliasMode \u539F\u751F\u6307\u7EB9 \xB7 Windows x64" }] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
        "\u8EAB\u4EFD\u6A21\u5F0F",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Select, { "aria-label": "\u8EAB\u4EFD\u6A21\u5F0F", disabled: Boolean(initial.id) || draft.backend === "aliasmode", value: draft.mode, onChange: (value) => set("mode", value), options: Object.entries(MODES2).map(([value, label]) => ({ value, label })) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
        "\u8BED\u8A00",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Input, { "aria-label": "\u73AF\u5883\u8BED\u8A00", required: true, value: draft.locale, onChange: (event) => set("locale", event.target.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
        "\u65F6\u533A",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Input, { "aria-label": "\u73AF\u5883\u65F6\u533A", required: true, value: draft.timezoneId, onChange: (event) => set("timezoneId", event.target.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
        "\u5916\u89C2",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Select, { "aria-label": "\u73AF\u5883\u5916\u89C2", value: draft.colorScheme, onChange: (value) => set("colorScheme", value), options: [{ value: "light", label: "\u6D45\u8272" }, { value: "dark", label: "\u6DF1\u8272" }, { value: "no-preference", label: "\u65E0\u504F\u597D" }] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
        "\u50CF\u7D20\u6BD4",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Input, { "aria-label": "\u73AF\u5883\u50CF\u7D20\u6BD4", type: "number", min: "1", max: "3", step: "0.25", value: draft.deviceScaleFactor, onChange: (event) => set("deviceScaleFactor", Number(event.target.value)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
        "\u89C6\u53E3\u5BBD",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Input, { "aria-label": "\u73AF\u5883\u89C6\u53E3\u5BBD", type: "number", required: true, min: "240", max: "2560", value: draft.viewport.width, onChange: (event) => set("viewport", { ...draft.viewport, width: Number(event.target.value) }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
        "\u89C6\u53E3\u9AD8",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Input, { "aria-label": "\u73AF\u5883\u89C6\u53E3\u9AD8", type: "number", required: true, min: "240", max: "1800", value: draft.viewport.height, onChange: (event) => set("viewport", { ...draft.viewport, height: Number(event.target.value) }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
        "\u5C4F\u5E55\u5BBD",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Input, { "aria-label": "\u73AF\u5883\u5C4F\u5E55\u5BBD", type: "number", required: true, min: "240", max: "2560", value: draft.screen.width, onChange: (event) => set("screen", { ...draft.screen, width: Number(event.target.value) }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
        "\u5C4F\u5E55\u9AD8",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Input, { "aria-label": "\u73AF\u5883\u5C4F\u5E55\u9AD8", type: "number", required: true, min: "240", max: "1800", value: draft.screen.height, onChange: (event) => set("screen", { ...draft.screen, height: Number(event.target.value) }) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
      "\u4EE3\u7406\u5730\u5740",
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Input, { "aria-label": "\u73AF\u5883\u4EE3\u7406\u5730\u5740", placeholder: "http://host:port \u6216 socks5://host:port", value: draft.proxy?.server ?? "", onChange: (event) => set("proxy", event.target.value ? { ...draft.proxy, server: event.target.value } : null) })
    ] }),
    draft.proxy && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-browser-form-grid", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
        "\u7528\u6237\u540D\u73AF\u5883\u53D8\u91CF",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Input, { "aria-label": "\u4EE3\u7406\u7528\u6237\u540D\u73AF\u5883\u53D8\u91CF", value: draft.proxy.usernameEnv ?? "", onChange: (event) => set("proxy", { ...draft.proxy, usernameEnv: event.target.value }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
        "\u5BC6\u7801\u73AF\u5883\u53D8\u91CF",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Input, { "aria-label": "\u4EE3\u7406\u5BC6\u7801\u73AF\u5883\u53D8\u91CF", value: draft.proxy.passwordEnv ?? "", onChange: (event) => set("proxy", { ...draft.proxy, passwordEnv: event.target.value }) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Toggle, { label: "\u4FDD\u5B58\u6B64\u4F1A\u8BDD\u7684\u767B\u5F55\u72B6\u6001", checked: draft.persistStorage, disabled: busy, onChange: (value) => set("persistStorage", value) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { children: [
      "\u767B\u5F55\u72B6\u6001\u9ED8\u8BA4\u4E0D\u4FDD\u5B58\u3002\u542F\u7528\u540E\u4F7F\u7528 AES-GCM \u52A0\u5BC6\uFF1BWindows \u7531\u5F53\u524D\u7CFB\u7EDF\u7528\u6237\u7684 DPAPI \u4FDD\u62A4\u5BC6\u94A5\uFF0C\u5176\u4ED6\u7CFB\u7EDF\u9700\u914D\u7F6E\u72EC\u7ACB\u5B58\u50A8\u5BC6\u94A5\u3002",
      draft.backend === "aliasmode" ? "\u539F\u751F\u6307\u7EB9\u4F7F\u7528\u56FA\u5B9A\u8EAB\u4EFD\u79CD\u5B50\uFF0C\u9700\u5148\u72EC\u7ACB\u5B89\u88C5\u5185\u6838\uFF1B\u5207\u6362\u65F6\u91CD\u542F\uFF0C\u4E0D\u53E0\u52A0 JS \u6CE8\u5165\u3002" : "JS \u6307\u7EB9\u4EC5\u9002\u7528\u4E8E\u517C\u5BB9 Chromium \u6837\u672C\uFF0CCamoufox \u6682\u4E0D\u652F\u6301\u6B64\u6A21\u5F0F\u3002",
      "\u4ECD\u9700\u8FD0\u884C\u73AF\u5883\u81EA\u68C0\u3002"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { type: "submit", variant: "primary", disabled: busy, children: "\u4FDD\u5B58\u73AF\u5883" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { type: "button", disabled: busy, onClick: onCancel, children: "\u53D6\u6D88" })
    ] })
  ] });
}
function BrowserPanel({ sessionId, enabled = true, onDisable, disabling = false, sendAnnotations }) {
  const [state, setState] = (0, import_react7.useState)(EMPTY);
  const [address, setAddress] = (0, import_react7.useState)("");
  const [frame, setFrame] = (0, import_react7.useState)(null);
  const [error, setError] = (0, import_react7.useState)("");
  const [connectionError, setConnectionError] = (0, import_react7.useState)("");
  const [busy, setBusy] = (0, import_react7.useState)(false);
  const [manage, setManage] = (0, import_react7.useState)(false);
  const [resources, setResources] = (0, import_react7.useState)(false);
  const [textEntry, setTextEntry] = (0, import_react7.useState)(false);
  const [text, setText] = (0, import_react7.useState)("");
  const [inspect, setInspect] = (0, import_react7.useState)(false);
  const [transfer, setTransfer] = (0, import_react7.useState)(false);
  const [uploadPath, setUploadPath] = (0, import_react7.useState)("");
  const [uploadSelector, setUploadSelector] = (0, import_react7.useState)("input[type=file]");
  const [transport, setTransport] = (0, import_react7.useState)("JPEG");
  const [zoom, setZoom] = (0, import_react7.useState)(0), [expanded, setExpanded] = (0, import_react7.useState)(false);
  const [annotating, setAnnotating] = (0, import_react7.useState)(false), [passthrough, setPassthrough] = (0, import_react7.useState)(false);
  const shortcuts = (0, import_react7.useRef)(null);
  const actionQueue = (0, import_react7.useRef)(Promise.resolve());
  const pending = (0, import_react7.useRef)(0);
  const latestFrame = (0, import_react7.useRef)(null);
  const loadedFrame = (0, import_react7.useRef)(null);
  const frameRef = (0, import_react7.useRef)(null);
  const panelRef = (0, import_react7.useRef)(null);
  const surfaceRef = (0, import_react7.useRef)(null);
  const wheelInput = (0, import_react7.useRef)(null);
  const api = (0, import_react7.useRef)(null);
  const remoteFocus = (0, import_react7.useRef)(null);
  const focusRevision = (0, import_react7.useRef)(-1);
  const inputProxy = (0, import_react7.useRef)(null), composing = (0, import_react7.useRef)(false), dragging = (0, import_react7.useRef)(false), lastPointer = (0, import_react7.useRef)(null);
  const heldModifiers = (0, import_react7.useRef)(/* @__PURE__ */ new Set());
  const endpoint = readConnectionMetadata();
  const browserPath = endpoint?.browserPath;
  const token = endpoint?.token;
  (0, import_react7.useEffect)(() => {
    if (!browserPath || !sessionId || !enabled) return;
    const controller = new AbortController();
    const path = browserPath + "?sessionId=" + encodeURIComponent(sessionId);
    const headers = { "x-patchwork-token": token };
    let timer;
    let streamController, streamRunning = false, streamLive = false, retryStreamAt = 0, streamAttempt = 0;
    let refreshTail = Promise.resolve();
    setState(EMPTY);
    setFrame(null);
    setAddress("");
    setError("");
    function clearFrame() {
      latestFrame.current = null;
      frameRef.current?.clear();
      loadedFrame.current = null;
      heldModifiers.current.clear();
      setFrame(null);
      remoteFocus.current = null;
    }
    function showFrame(next) {
      const previous = latestFrame.current;
      latestFrame.current = next;
      frameRef.current?.show(next);
      if (previous?.frameId !== next.frameId || previous?.tabId !== next.tabId || previous?.width !== next.width || previous?.height !== next.height) setFrame({ frameId: next.frameId, tabId: next.tabId, epoch: next.epoch, width: next.width, height: next.height });
    }
    function stopStream() {
      streamAttempt++;
      streamController?.abort();
      streamController = null;
      streamRunning = false;
      streamLive = false;
      retryStreamAt = 0;
      setTransport("JPEG");
    }
    function connectStream() {
      if (streamRunning || document.hidden || controller.signal.aborted || Date.now() < retryStreamAt) return;
      streamRunning = true;
      const stream = new AbortController();
      streamController = stream;
      const attempt = ++streamAttempt;
      void (async () => {
        try {
          const receive = (next) => {
            if (controller.signal.aborted || stream.signal.aborted || document.hidden || attempt !== streamAttempt) return;
            streamLive = true;
            showFrame(next);
          };
          try {
            setTransport("\u8FDE\u63A5\u4E2D");
            await consumeBinaryBrowserStream(path, headers, (next) => {
              setTransport("\u5B9E\u65F6");
              receive(next);
            }, stream.signal);
          } catch {
            if (stream.signal.aborted || controller.signal.aborted) return;
          }
          if (!stream.signal.aborted && !controller.signal.aborted) {
            const response = await fetch(path + "&view=stream", { headers, signal: stream.signal, cache: "no-store" });
            await consumeBrowserStream(response, (next) => {
              setTransport("\u5B9E\u65F6 \xB7 \u517C\u5BB9");
              receive(next);
            }, stream.signal);
          }
        } catch {
        } finally {
          if (attempt === streamAttempt) {
            streamRunning = false;
            streamLive = false;
            retryStreamAt = Date.now() + 2500;
            if (!controller.signal.aborted) setTransport("JPEG");
          }
        }
      })();
    }
    async function refresh() {
      if (controller.signal.aborted || document.hidden) return;
      const response = await fetch(path, { headers, signal: controller.signal, cache: "no-store" });
      if (!response.ok) {
        stopStream();
        clearFrame();
        if (response.status === 403) setState(EMPTY);
        throw new Error(response.status === 403 ? "\u5F53\u524D\u4F1A\u8BDD\u5C1A\u672A\u6388\u6743\u6D4F\u89C8\u5668" : `\u6D4F\u89C8\u5668\u72B6\u6001\u8BFB\u53D6\u5931\u8D25 (${response.status})`);
      }
      const next = await response.json();
      if (controller.signal.aborted) return;
      if (latestFrame.current?.epoch !== void 0 && latestFrame.current.epoch > next.epoch) return;
      setState(next);
      if ((next.focusRevision ?? 0) >= focusRevision.current) {
        remoteFocus.current = next.focusId;
        focusRevision.current = next.focusRevision ?? 0;
      }
      if (latestFrame.current?.epoch !== void 0 && latestFrame.current.epoch !== next.epoch) {
        stopStream();
        clearFrame();
      }
      setAddress((previous) => document.activeElement?.dataset?.pwBrowserAddress ? previous : next.url === "about:blank" ? "" : next.url);
      if (!next.active) {
        stopStream();
        clearFrame();
        return;
      }
      connectStream();
      if (streamLive) return;
      const responseFrame = await fetch(path + "&view=frame", { headers, signal: controller.signal, cache: "no-store" });
      if (responseFrame.status === 204) {
        clearFrame();
        return;
      }
      if (!responseFrame.ok) {
        clearFrame();
        throw new Error(`\u6D4F\u89C8\u5668\u753B\u9762\u8BFB\u53D6\u5931\u8D25 (${responseFrame.status})`);
      }
      const [width, height] = (responseFrame.headers.get("x-patchwork-viewport") ?? "").split(",").map(Number);
      const tabId = responseFrame.headers.get("x-patchwork-tab-id");
      const frameId = responseFrame.headers.get("x-patchwork-frame-id");
      if (!width || !height || !tabId || !frameId) throw new Error("\u6D4F\u89C8\u5668\u753B\u9762\u8EAB\u4EFD\u7F3A\u5931");
      const blob = await responseFrame.blob();
      if (controller.signal.aborted) return;
      showFrame({ blob, width, height, tabId, frameId, epoch: Number(responseFrame.headers.get("x-patchwork-epoch") ?? next.epoch), focusId: responseFrame.headers.get("x-patchwork-focus-id") });
    }
    const queuedRefresh = () => {
      refreshTail = refreshTail.then(refresh, refresh);
      return refreshTail;
    };
    const connection = { path, headers, signal: controller.signal, refresh: queuedRefresh };
    connection.input = createInputQueue({
      identity: () => loadedFrame.current && { ...loadedFrame.current, focusId: remoteFocus.current },
      send: async (envelope) => {
        const response = await fetch(path + "&view=input", { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(envelope), signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.reason ?? "\u6D4F\u89C8\u5668\u8F93\u5165\u5931\u8D25");
        return result;
      },
      onAck: (result) => {
        if (controller.signal.aborted) return;
        remoteFocus.current = result.focusId;
        focusRevision.current = result.focusRevision ?? focusRevision.current;
        setState((previous) => previous.control === "user" ? previous : { ...previous, control: "user" });
      },
      onError: (caught) => {
        if (!controller.signal.aborted) {
          setError(caught.message);
          void queuedRefresh().catch(() => {
          });
        }
      }
    });
    api.current = connection;
    async function poll() {
      try {
        await queuedRefresh();
        if (!controller.signal.aborted) setConnectionError("");
      } catch (caught) {
        if (!controller.signal.aborted) setConnectionError(caught.message);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, document.hidden ? 5e3 : 2e3);
      }
    }
    void poll();
    const blur = () => {
      inputProxy.current?.blur();
    };
    const visibility = () => {
      if (document.hidden) {
        blur();
        stopStream();
        clearFrame();
      } else {
        clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    return () => {
      controller.abort();
      connection.input.close();
      stopStream();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      clearTimeout(timer);
      if (api.current === connection) api.current = null;
      latestFrame.current = null;
      frameRef.current?.clear();
      focusRevision.current = -1;
      loadedFrame.current = null;
    };
  }, [sessionId, browserPath, token, enabled]);
  (0, import_react7.useEffect)(() => {
    if (frame && latestFrame.current) frameRef.current?.show(latestFrame.current);
  }, [frame?.frameId, frame?.tabId]);
  function fittedViewport() {
    const box = surfaceRef.current?.getBoundingClientRect();
    return { width: Math.max(240, Math.min(2560, Math.round(box?.width ?? 800))), height: Math.max(240, Math.min(1800, Math.round(box?.height ?? 600))) };
  }
  async function toggleAnnotations() {
    if (annotating) {
      setAnnotating(false);
      setPassthrough(false);
      return;
    }
    if (state.control !== "user" && !await act("control", { control: "user" })) return;
    setAnnotating(true);
  }
  shortcuts.current = { annotating, toggleAnnotations, act, state };
  (0, import_react7.useEffect)(() => {
    if (state.control !== "user" || !state.active) {
      setAnnotating(false);
      setPassthrough(false);
    }
  }, [state.control, state.active]);
  (0, import_react7.useEffect)(() => {
    const panel = panelRef.current;
    const keydown = (event) => {
      const current = shortcuts.current;
      if (event.isComposing) return;
      if (event.key === "Escape" && !current.annotating) {
        setExpanded(false);
        return;
      }
      const editing = event.target.closest?.("input,textarea,[contenteditable=true]");
      if (current.annotating && event.code === "Space" && !editing) {
        event.preventDefault();
        event.stopPropagation();
        setPassthrough(true);
        return;
      }
      if (current.annotating && event.key === "Escape" && !editing) {
        event.preventDefault();
        event.stopPropagation();
        setAnnotating(false);
        setPassthrough(false);
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (!["l", "t", "w", "r"].includes(key)) return;
      event.preventDefault();
      event.stopPropagation();
      if (key === "l") panel.querySelector("[data-pw-browser-address]")?.focus();
      else if (key === "t") void current.act("newTab");
      else if (key === "w" && current.state.selectedTabId) void current.act("closeTab", { tabId: current.state.selectedTabId });
      else if (key === "r" && current.state.active) void current.act("reload");
    };
    const release = (event) => {
      if (!event || event.code === "Space") setPassthrough(false);
    };
    panel?.addEventListener("keydown", keydown, true);
    window.addEventListener("keyup", release);
    window.addEventListener("blur", release);
    return () => {
      panel?.removeEventListener("keydown", keydown, true);
      window.removeEventListener("keyup", release);
      window.removeEventListener("blur", release);
    };
  }, []);
  function act(action, fields = {}) {
    const connection = api.current;
    if (!connection) return Promise.resolve(null);
    pending.current++;
    setBusy(true);
    const run = async () => {
      try {
        if (connection.signal.aborted) return null;
        const response = await fetch(connection.path, { method: "POST", headers: { ...connection.headers, "content-type": "application/json" }, body: JSON.stringify({ action, ...fields }), signal: connection.signal });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.reason ?? "\u6D4F\u89C8\u5668\u64CD\u4F5C\u5931\u8D25");
        if (connection.signal.aborted) return null;
        remoteFocus.current = result.focusId;
        setState(result);
        setError("");
        await connection.refresh();
        return result;
      } catch (caught) {
        if (!connection.signal.aborted) setError(caught.message);
        return null;
      } finally {
        if (--pending.current === 0 && !connection.signal.aborted) setBusy(false);
      }
    };
    actionQueue.current = actionQueue.current.then(run, run);
    return actionQueue.current;
  }
  function input(action, fields) {
    const shown = loadedFrame.current;
    if (!shown || shown.frameId !== latestFrame.current?.frameId || shown.tabId !== latestFrame.current?.tabId) return Promise.resolve(null);
    return api.current?.input.push({ action, ...fields, frameId: shown.frameId, tabId: shown.tabId }).catch(() => null) ?? Promise.resolve(null);
  }
  async function inspectElement(point, signal) {
    const connection = api.current, shown = loadedFrame.current;
    if (!connection || connection.signal.aborted || !shown || shown.frameId !== frame?.frameId || shown.tabId !== state.selectedTabId || state.control !== "user") return null;
    const response = await fetch(connection.path, { method: "POST", headers: { ...connection.headers, "content-type": "application/json" }, body: JSON.stringify({ action: "inspectElement", box: { ...point, width: 1, height: 1 }, frameId: shown.frameId, tabId: shown.tabId }), signal });
    if (!response.ok || connection !== api.current || connection.signal.aborted) return null;
    const result = await response.json();
    return result.ok && result.frameId === loadedFrame.current?.frameId && result.tabId === loadedFrame.current?.tabId ? result : null;
  }
  function onPointer(event, phase) {
    const shown = loadedFrame.current;
    if (!shown) return;
    if (phase === "cancel") {
      dragging.current = false;
      void input("releaseInput", {});
      return;
    }
    if (phase === "move" && !dragging.current && state.control !== "user") return;
    if (phase === "down") {
      event.preventDefault();
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      inputProxy.current?.focus({ preventScroll: true });
    }
    const box = event.currentTarget.getBoundingClientRect();
    const point = { x: Math.max(0, Math.min(shown.width - 1, Math.floor((event.clientX - box.left) * shown.width / box.width))), y: Math.max(0, Math.min(shown.height - 1, Math.floor((event.clientY - box.top) * shown.height / box.height))) };
    lastPointer.current = point;
    void input("pointer", { ...point, phase, button: ["left", "middle", "right"][event.button] ?? "left" });
    if (phase === "up") {
      dragging.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }
  function onKeyDown(event) {
    if (!state.active || event.isComposing || event.key === "Process" || event.keyCode === 229) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v" || event.shiftKey && event.key === "Insert") return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
      event.preventDefault();
      void copySelection();
      return;
    }
    if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
      if (!heldModifiers.current.has(event.key)) {
        heldModifiers.current.add(event.key);
        void input("keyState", { value: event.key, phase: "down" });
      }
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) return;
    event.preventDefault();
    {
      const modifiers = [event.ctrlKey && "Control", event.altKey && "Alt", event.metaKey && "Meta", event.shiftKey && "Shift"].filter(Boolean);
      input("key", { value: [...modifiers, event.key].join("+") });
    }
  }
  async function copySelection() {
    const connection = api.current;
    if (!connection || connection.signal.aborted) return;
    try {
      const response = await fetch(connection.path, { method: "POST", headers: { ...connection.headers, "content-type": "application/json" }, body: JSON.stringify({ action: "readSelection" }), signal: connection.signal });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.reason ?? "\u8BFB\u53D6\u9009\u4E2D\u6587\u5B57\u5931\u8D25");
      if (connection.signal.aborted) return;
      if (result.text) await navigator.clipboard.writeText(result.text);
    } catch (caught) {
      if (!connection.signal.aborted) setError(caught.message);
    }
  }
  async function cancelNavigation() {
    const connection = api.current;
    if (!connection || connection.signal.aborted) return;
    try {
      await fetch(connection.path + "&view=cancel", { method: "POST", headers: { ...connection.headers, "content-type": "application/json" }, body: "{}", signal: connection.signal });
      await connection.refresh();
    } catch (caught) {
      if (!connection.signal.aborted) setError(caught.message);
    }
  }
  const currentProfile = state.profiles.find((profile) => profile.id === state.profileId);
  const displayed = frame && frame.tabId === state.selectedTabId;
  wheelInput.current = (deltaX, deltaY) => annotating && !passthrough ? null : input("scroll", { deltaX: Math.max(-2e3, Math.min(2e3, deltaX)), deltaY: Math.max(-2e3, Math.min(2e3, deltaY)) });
  (0, import_react7.useEffect)(() => {
    const surface = surfaceRef.current;
    if (!displayed || !surface) return;
    const wheel = (event) => {
      if (event.ctrlKey) return;
      event.preventDefault();
      const shown = loadedFrame.current, image = frameRef.current?.element?.();
      if (shown && image) {
        const box = image.getBoundingClientRect();
        const x = Math.max(0, Math.min(shown.width - 1, Math.floor((event.clientX - box.left) * shown.width / box.width)));
        const y = Math.max(0, Math.min(shown.height - 1, Math.floor((event.clientY - box.top) * shown.height / box.height)));
        void input("pointer", { x, y, phase: "move", button: "left" });
      }
      const unit = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? surface.clientHeight : 1;
      void wheelInput.current(event.deltaX * unit, event.deltaY * unit);
    };
    surface.addEventListener("wheel", wheel, { passive: false });
    return () => surface.removeEventListener("wheel", wheel);
  }, [displayed]);
  if (!enabled) return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "pw-browser-empty", children: "\u5F53\u524D\u4F1A\u8BDD\u7684\u6D4F\u89C8\u5668\u5C1A\u672A\u542F\u7528\u3002" });
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: `pw-browser${expanded ? " pw-browser-expanded" : ""}`, ref: panelRef, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      BrowserChrome,
      {
        state,
        busy,
        address,
        setAddress,
        act,
        zoom,
        expanded,
        onZoom: setZoom,
        onExpand: () => setExpanded((value) => !value),
        onCopy: copySelection,
        onCancelNavigation: cancelNavigation,
        annotating,
        onAnnotate: toggleAnnotations,
        navigate: async () => {
          if (state.control !== "user" && !await act("control", { control: "user" })) return;
          await act("navigate", { url: address, ...(currentProfile?.mode ?? "native") === "native" ? fittedViewport() : {} });
        },
        fit: async () => {
          if (state.control !== "user" && !await act("control", { control: "user" })) return;
          await act("resize", fittedViewport());
        },
        onManage: () => {
          setManage((value) => !value);
          setInspect(false);
          setResources(false);
        },
        onInspect: () => {
          setInspect((value) => !value);
          setManage(false);
          setResources(false);
        },
        onResources: () => {
          setResources((value) => !value);
          setManage(false);
          setInspect(false);
        },
        onTextEntry: () => setTextEntry((value) => !value),
        onDisable,
        disabling
      }
    ),
    manage && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(BrowserEnvironments, { state, busy, act, Form: EnvironmentForm }),
    inspect && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-browser-inspect", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-browser-inspect-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { type: "button", disabled: busy || state.recording, onClick: () => act("health"), children: "\u8FD0\u884C\u73AF\u5883\u81EA\u68C0" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { type: "button", disabled: busy, onClick: () => act("exportTrace"), children: "\u5BFC\u51FA\u64CD\u4F5C\u8BB0\u5F55" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { type: "button", disabled: busy || !state.active, onClick: () => act("exportScreenshot"), children: "\u4FDD\u5B58\u622A\u56FE" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { type: "button", disabled: busy || !state.recording && (!state.recorder?.installed || !state.active), onClick: () => act(state.recording ? "stopRecording" : "startRecording"), children: state.recording ? "\u505C\u6B62\u5E76\u4EA4\u4ED8\u5F55\u50CF" : "\u5F00\u542F\u5F55\u50CF" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { type: "button", "aria-expanded": transfer, onClick: () => setTransfer((value) => !value), children: "\u6587\u4EF6\u4F20\u8F93" }),
        state.active && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { type: "button", disabled: busy, onClick: () => act("suspendTab", { tabId: state.selectedTabId }), children: "\u4F11\u7720\u5F53\u524D\u6807\u7B7E" }),
        state.recoverableTabs > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Button, { type: "button", disabled: busy, onClick: () => act("recoverTabs"), children: [
          "\u6062\u590D ",
          state.recoverableTabs,
          " \u4E2A\u6807\u7B7E"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { children: [
        state.capabilities?.family ?? "chromium",
        " \xB7 \u9A71\u52A8 ",
        state.capabilities?.driverVersion ?? "\u2014",
        " \xB7 \u767B\u5F55\u52A0\u5BC6 ",
        state.capabilities?.storageEncryption ?? "\u2014"
      ] }),
      state.backend && !state.backend.installed && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { role: "status", children: "\u5F53\u524D\u5185\u6838\u5C1A\u672A\u5B89\u88C5\uFF1A\u6309\u6D4F\u89C8\u5668\u5347\u7EA7\u6587\u6863\u914D\u7F6E\u72EC\u7ACB\u540E\u7AEF\u3002" }),
      !state.recorder?.installed && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { children: "\u5F55\u50CF\u9700\u5728\u76EE\u6807 DSH_HOME \u663E\u5F0F\u8FD0\u884C patchwork-browser-components install recorder --home \u76EE\u6807DSH_HOME\u3002\u5F55\u50CF\u53EF\u80FD\u5305\u542B\u767B\u5F55\u4FE1\u606F\uFF0C\u4EC5\u5728\u4F60\u542F\u7528\u540E\u8BB0\u5F55\u3002" }),
      state.recording && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { role: "status", children: "\u6B63\u5728\u4EE5\u6700\u9AD8 4 \u5E27/\u79D2\u91C7\u6837\u5F53\u524D\u6807\u7B7E\uFF1B\u5FD9\u788C\u6216\u80CC\u538B\u65F6\u4F1A\u8DF3\u5E27\u3002\u505C\u6B62\u540E\u5C06\u6709\u6548 WebM \u6587\u4EF6\u5199\u5165\u5F53\u524D\u5DE5\u4F5C\u533A\u3002" }),
      state.recordingState?.state === "failed" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { role: "alert", children: "\u5F55\u50CF\u7F16\u7801\u5931\u8D25\uFF0C\u8BF7\u505C\u6B62\u5F55\u5236\u540E\u68C0\u67E5\u72EC\u7ACB\u5F55\u50CF\u4F9D\u8D56\u3002\u5931\u8D25\u6587\u4EF6\u4E0D\u4F1A\u4F5C\u4E3A\u4EA4\u4ED8\u4EA7\u7269\u3002" }),
      state.recordingState?.state === "limit-reached" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { role: "status", children: "\u5F55\u50CF\u5DF2\u5230 15 \u5206\u949F\u4E0A\u9650\uFF0C\u70B9\u51FB\u505C\u6B62\u4EE5\u4FDD\u5B58\u5DF2\u5F55\u5236\u5185\u5BB9\u3002" }),
      state.health && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-browser-health", "aria-label": "\u73AF\u5883\u81EA\u68C0\u7ED3\u679C", children: [
        [["configuration", "\u914D\u7F6E"], ["iframe", "\u540C\u6E90 iframe"], ["worker", "Worker"], ["network", "\u672C\u5730\u8BF7\u6C42\u5934"], ["clientHints", "Client Hints"], ["rendering", "Canvas"]].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { children: [
          label,
          "\uFF1A",
          { match: "\u4E00\u81F4", mismatch: "\u4E0D\u4E00\u81F4", unknown: "\u5F85\u786E\u8BA4" }[state.health[id]?.status] ?? "\u672A\u6D4B"
        ] }, id)),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { children: "\u51FA\u53E3 IP\u3001TLS\u3001WebRTC\u3001\u8DE8\u57DF iframe \u4E0E Worker \u79BB\u5C4F Canvas \u672A\u9A8C\u8BC1\uFF1B\u4E0D\u4F5C\u4E3A\u533F\u540D\u6027\u8BC1\u660E\u3002" })
      ] }),
      state.lastReceipt && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { role: "status", children: [
        "\u6700\u8FD1\u64CD\u4F5C\uFF1A",
        state.lastReceipt.action,
        " \xB7 ",
        state.lastReceipt.outcome,
        state.lastReceipt.noProgress ? " \xB7 \u91CD\u590D\u64CD\u4F5C\u6CA1\u6709\u8FDB\u5C55\uFF0C\u8BF7\u6539\u53D8\u65B9\u6CD5" : ""
      ] }),
      transfer && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-browser-transfer", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
          "\u5DE5\u4F5C\u533A\u6587\u4EF6\u8DEF\u5F84",
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Input, { "aria-label": "\u4E0A\u4F20\u6587\u4EF6\u8DEF\u5F84", value: uploadPath, onChange: (event) => setUploadPath(event.target.value) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
          "\u6587\u4EF6\u8F93\u5165\u6846\u9009\u62E9\u5668",
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Input, { "aria-label": "\u4E0A\u4F20\u76EE\u6807\u9009\u62E9\u5668", value: uploadSelector, onChange: (event) => setUploadSelector(event.target.value) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { type: "button", disabled: busy || !state.active || !uploadPath, onClick: () => act("upload", { path: uploadPath, selector: uploadSelector }), children: "\u4E0A\u4F20\u5230\u9875\u9762" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { type: "button", disabled: busy || !state.active, onClick: () => act("armDownload"), children: "\u5141\u8BB8\u4E0B\u4E00\u6B21\u4E0B\u8F7D\uFF0860 \u79D2\uFF09" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { children: "\u4EC5\u5F53\u524D\u4F1A\u8BDD\u4F7F\u7528\uFF1B\u4E0B\u8F7D\u5199\u5165\u5DE5\u4F5C\u533A\uFF0C\u672A\u6388\u6743\u7684\u4E0B\u8F7D\u4F1A\u53D6\u6D88\u3002\u5355\u6587\u4EF6\u4EA4\u4ED8\u4E0A\u9650 50 MiB\u3002" })
      ] }),
      state.artifacts?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("ul", { className: "pw-browser-artifacts", "aria-label": "\u5DF2\u4EA4\u4ED8\u6587\u4EF6", children: state.artifacts.map((item) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("li", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("strong", { children: item.name }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { children: [
          item.bytes.toLocaleString(),
          " \u5B57\u8282"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("code", { children: item.path })
      ] }, item.id)) })
    ] }),
    resources && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(BrowserResources, { state, busy, act }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(AnnotationEditor, { items: state.annotations ?? [], busy, act, onSend: sendAnnotations ? async (text2) => {
      if (!api.current || api.current.signal.aborted) throw new Error("\u4F1A\u8BDD\u5DF2\u5207\u6362");
      await sendAnnotations(text2);
    } : void 0, onContinue: () => setAnnotating(true) }),
    textEntry && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("form", { className: "pw-browser-text-input", onSubmit: async (event) => {
      event.preventDefault();
      if (text && await input("type", { value: text })) setText("");
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Input, { "aria-label": "\u53D1\u9001\u5230\u9875\u9762\u7684\u6587\u5B57", placeholder: "\u5148\u70B9\u9875\u9762\u8F93\u5165\u6846\uFF0C\u518D\u5728\u8FD9\u91CC\u8F93\u5165\u6587\u5B57", maxLength: 2e3, value: text, onChange: (event) => setText(event.target.value) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { type: "submit", disabled: busy || !text, children: "\u53D1\u9001" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { type: "button", disabled: busy, onClick: () => input("key", { value: "Enter" }), children: "\u56DE\u8F66" })
    ] }),
    (error || connectionError) && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "pw-browser-error", role: "alert", children: error || connectionError }),
    annotating && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "pw-browser-annotation-tip", role: "status", children: passthrough ? "\u6B63\u5728\u64CD\u4F5C\u7F51\u9875\uFF0C\u677E\u5F00 Space \u7EE7\u7EED\u68C0\u67E5" : "\u60AC\u505C\u68C0\u67E5\u5143\u7D20\uFF0C\u70B9\u51FB\u9009\u4E2D\u540E\u5199\u8BF4\u660E\uFF1B\u62D6\u52A8\u53EF\u6846\u9009\u533A\u57DF\u3002Space \u4E34\u65F6\u64CD\u4F5C\uFF0CEsc \u9000\u51FA\u3002" }),
    displayed ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "pw-browser-surface", ref: surfaceRef, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-browser-page", style: zoom ? { width: frame.width * zoom } : void 0, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(BrowserFrame, { ref: frameRef, onLoaded: (next) => {
        loadedFrame.current = next;
      }, onPointer }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "textarea",
        {
          ref: inputProxy,
          className: "pw-browser-input-proxy",
          "aria-label": "\u7F51\u9875\u952E\u76D8\u8F93\u5165",
          autoComplete: "off",
          autoCorrect: "off",
          spellCheck: false,
          onKeyDown,
          onKeyUp: (event) => {
            if (heldModifiers.current.delete(event.key)) void input("keyState", { value: event.key, phase: "up" });
          },
          onChange: (event) => {
            if (!composing.current && event.target.value) {
              void input("type", { value: event.target.value.slice(0, 2e3) });
              event.target.value = "";
            }
          },
          onCompositionStart: () => {
            composing.current = true;
          },
          onCompositionEnd: (event) => {
            composing.current = false;
            if (event.data) void input("type", { value: event.data.slice(0, 2e3) });
            event.currentTarget.value = "";
          },
          onPaste: (event) => {
            event.preventDefault();
            void input("type", { value: event.clipboardData.getData("text").slice(0, 2e3) });
          },
          onBlur: () => {
            dragging.current = false;
            heldModifiers.current.clear();
            void input("releaseInput", {});
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(AnnotationOverlay, { enabled: annotating, passthrough, frame, items: state.annotations ?? [], onInspect: inspectElement, onPick: (selection) => {
        setAnnotating(false);
        setPassthrough(false);
        return input("pickAnnotation", selection);
      } })
    ] }) }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "pw-browser-empty", ref: surfaceRef, children: state.active ? "\u6B63\u5728\u8BFB\u53D6\u753B\u9762\u2026" : "\u8F93\u5165\u5730\u5740\u6253\u5F00\u9875\u9762\uFF0C\u6216\u8BA9 Agent \u5F00\u59CB\u6D4F\u89C8\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-browser-status", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives.Tooltip, { label: `${currentProfile?.name ?? "\u4E34\u65F6\u73AF\u5883"} \xB7 ${transport}${displayed ? ` \xB7 ${frame.width} \xD7 ${frame.height}` : ""}`, side: "top", portal: true, delayMs: 350, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { children: [
        state.control === "user" ? "\u4F60\u5728\u64CD\u4F5C \xB7 Agent \u5199\u64CD\u4F5C\u5DF2\u6682\u505C" : "\u5F53\u524D\u4F1A\u8BDD \xB7 Agent \u53EF\u64CD\u4F5C",
        state.recording ? " \xB7 \u6B63\u5728\u5F55\u50CF" : ""
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { type: "button", disabled: busy, onClick: () => act("control", { control: state.control === "user" ? "agent" : "user" }), children: state.control === "user" ? "\u6062\u590D Agent" : "\u63A5\u7BA1\u6D4F\u89C8\u5668" })
    ] })
  ] });
}

// packages/browser/src/client/BrowserWorkspace.jsx
var import_jsx_runtime8 = require("react/jsx-runtime");
function BrowserTitle() {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: "\u6D4F\u89C8\u5668" });
}
function BrowserWorkspace({ sessionId, sessionStore, useTabInfo, sendAnnotations }) {
  const preset = (0, import_react8.useSyncExternalStore)(
    sessionStore.subscribe,
    () => sessionStore.getSnapshot().byId[sessionId]?.projectionValues?.agentPreset ?? "",
    () => ""
  );
  const { tab } = useTabInfo();
  if (!tab.visible) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "pw-panel pw-browser-workspace", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "pw-panel-inner", children: sessionId ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(SessionWorkspace, { sessionId, sendAnnotations }, `${sessionId}:${preset}`) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "pw-browser-permission", children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("strong", { children: "\u9009\u62E9\u4E00\u4E2A\u4F1A\u8BDD" }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { children: "\u9009\u4E2D\u4F1A\u8BDD\u540E\u6253\u5F00\u72EC\u7ACB\u6D4F\u89C8\u5668\u3002" })
  ] }) }) });
}
function SessionWorkspace({ sessionId, sendAnnotations }) {
  const [access, setAccess] = (0, import_react8.useState)(null), [error, setError] = (0, import_react8.useState)(""), [busy, setBusy] = (0, import_react8.useState)(false);
  const active = (0, import_react8.useRef)(false), request = (0, import_react8.useRef)(null);
  const metadata = readConnectionMetadata();
  const path = metadata && `${metadata.browserPath}?sessionId=${encodeURIComponent(sessionId)}&view=access`;
  const token = metadata?.token;
  (0, import_react8.useEffect)(() => {
    active.current = true;
    const abort = new AbortController();
    let timer;
    const refresh = async () => {
      try {
        if (!path) throw new Error("\u6D4F\u89C8\u5668\u8FDE\u63A5\u4E0D\u53EF\u7528\uFF0C\u8BF7\u91CD\u65B0\u52A0\u8F7D\u9875\u9762\u3002");
        const response = await fetch(path, { headers: { "x-patchwork-token": token }, signal: abort.signal, cache: "no-store" });
        if (!response.ok) throw new Error("\u65E0\u6CD5\u8BFB\u53D6\u5F53\u524D\u4F1A\u8BDD\u7684\u6D4F\u89C8\u5668\u6743\u9650\u3002");
        const next = await response.json();
        if (!abort.signal.aborted) {
          setAccess(next);
          setError("");
        }
      } catch (error2) {
        if (!abort.signal.aborted) {
          setAccess(null);
          setError(error2.message);
        }
      } finally {
        if (!abort.signal.aborted) timer = setTimeout(refresh, 1500);
      }
    };
    void refresh();
    return () => {
      active.current = false;
      abort.abort();
      request.current?.abort();
      clearTimeout(timer);
    };
  }, [path, token]);
  async function change(enabled) {
    setBusy(true);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(path, { method: "POST", signal: controller.signal, headers: { "content-type": "application/json", "x-patchwork-token": token }, body: JSON.stringify({ action: enabled ? "enable" : "disable", preset: access.preset, accessId: access.accessId }) });
      const next = await response.json();
      if (!response.ok) throw new Error(next.reason || "\u6D4F\u89C8\u5668\u6743\u9650\u4FEE\u6539\u5931\u8D25\u3002");
      if (active.current) setAccess(next);
    } catch (error2) {
      if (active.current) setError(error2.message);
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
    !access?.enabled && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("header", { className: "pw-header", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "pw-scope", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("strong", { children: "\u6D4F\u89C8\u5668" }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: "\u5F53\u524D\u4F1A\u8BDD" })
    ] }) }),
    error && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { role: "alert", className: "pw-browser-error", children: error }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "pw-scroll", children: access?.enabled ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(BrowserPanel, { sessionId, onDisable: () => change(false), disabling: busy, sendAnnotations: sendAnnotations ? async (text) => {
      const response = await fetch(path, { headers: { "x-patchwork-token": token }, cache: "no-store" });
      const current = await response.json();
      if (!active.current || !response.ok || !current.enabled || current.accessId !== access.accessId || current.preset !== access.preset) throw new Error("\u6D4F\u89C8\u5668\u6388\u6743\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u5F53\u524D\u4F1A\u8BDD");
      await sendAnnotations(text);
    } : void 0 }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "pw-browser-permission", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("strong", { children: access ? "\u4E3A\u5F53\u524D\u4F1A\u8BDD\u542F\u7528\u6D4F\u89C8\u5668" : "\u6B63\u5728\u8FDE\u63A5\u6D4F\u89C8\u5668\u670D\u52A1" }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { children: "\u542F\u7528\u540E\uFF0C\u5F53\u524D\u6A21\u5F0F\u7684 Agent \u53EF\u4F7F\u7528\u6D4F\u89C8\u5668\u5DE5\u5177\u3002\u9875\u9762\u3001\u767B\u5F55\u72B6\u6001\u4E0E\u5176\u4ED6\u4F1A\u8BDD\u72EC\u7ACB\uFF0C\u5207\u6362\u6A21\u5F0F\u540E\u9700\u91CD\u65B0\u6388\u6743\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { type: "button", disabled: !access || busy || access.closing, onClick: () => change(true), children: access?.closing ? "\u6B63\u5728\u5173\u95ED\u6D4F\u89C8\u5668\u2026" : busy ? "\u6B63\u5728\u542F\u7528\u2026" : "\u542F\u7528\u5F53\u524D\u4F1A\u8BDD\u6D4F\u89C8\u5668" })
    ] }) })
  ] });
}

// packages/browser/src/client/styles.mjs
var BROWSER_CSS = String.raw`
.pw-panel {
  container: patchwork / inline-size;
  height:100%; min-height:0; min-width:0; overflow:hidden;
  color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-base);
  font:13px/1.65 var(--dsw-font-family);
  --pw-line:var(--dsw-alias-border-l3);
  --pw-soft:var(--dsw-alias-bg-module-platform,var(--dsw-alias-bg-layer-1));
  --pw-muted:var(--dsw-alias-label-tertiary);
  --pw-secondary:var(--dsw-alias-label-secondary);
  --pw-accent:var(--dsw-alias-link);
  --pw-surface:var(--dsw-alias-settings-card-fill,var(--dsw-alias-bg-layer-1));
  --pw-card-line:var(--dsw-alias-settings-card-stroke,var(--pw-line));
  --pw-radius:var(--dsw-radius-xl);
}
.pw-panel *, .pw-panel *::before, .pw-panel *::after { box-sizing:border-box }
.pw-panel-inner { height:100%; min-height:0; display:flex; flex-direction:column; max-width:1200px; margin:0 auto }
.pw-panel h2,.pw-panel h3,.pw-panel p { margin:0 }
.pw-panel h2 { font-size:18px; font-weight:500; line-height:1.55; overflow-wrap:anywhere }
.pw-panel h3 { font-size:13px; font-weight:600; line-height:1.65 }
.pw-panel button,.pw-panel input,.pw-panel select { font-family:inherit }
.pw-panel button { cursor:pointer }
.pw-panel button:disabled { cursor:default }
.pw-panel :is(button,input,select,summary):focus-visible { outline:2px solid var(--pw-accent); outline-offset:3px }
.pw-panel :is(code,pre,.pw-mono) { font-family:var(--ds-font-family-code),monospace; font-variant-numeric:tabular-nums }
.pw-icon { width:16px; height:16px; flex:none; vertical-align:middle }
.pw-header { flex:none; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:16px 20px 12px }
.pw-scope { display:flex; gap:9px; align-items:center; min-width:0; font-size:12px; color:var(--pw-secondary) }
.pw-scope>span { color:var(--pw-muted) }
.pw-scope>strong { font-size:15px; font-weight:600; letter-spacing:-.2px; color:var(--dsw-alias-label-primary) }
.pw-header-actions { display:flex; align-items:center; gap:7px; flex:none }
.pw-page-browser { padding:14px 20px 18px; height:100%; min-height:0 }
.pw-browser { display:flex; flex-direction:column; height:100%; min-height:0; min-width:0; background:var(--dsw-alias-bg-base); overflow:hidden; flex:1 }
.pw-browser>:not(.pw-browser-surface):not(.pw-browser-empty):not(.pw-browser-profiles) { flex:none }
.pw-browser-chrome { position:relative; z-index:2; background:var(--pw-soft); border-bottom:1px solid var(--pw-line) }
.pw-browser-icon { display:block; width:18px; height:18px; flex:none }
.pw-browser-environment { display:flex; align-items:center; gap:8px; padding:10px; border-bottom:1px solid var(--pw-line); flex-wrap:wrap }
.pw-browser-profiles { flex:0 1 auto; padding:12px; border-bottom:1px solid var(--pw-line); max-height:50vh; overflow:auto }
.pw-browser-profiles p,.pw-browser-profile-form p { font-size:11px; color:var(--pw-muted); line-height:1.8; margin:0 0 10px }
.pw-browser-profile-row { display:flex; align-items:center; gap:6px; padding:8px 0; border-bottom:1px solid var(--pw-line); margin-bottom:8px; font-size:12px }
.pw-browser-profile-row>span { min-width:0; flex:1; overflow-wrap:anywhere }
.pw-browser-profile-row small { display:block; font-size:10px; color:var(--pw-muted); margin-top:4px }
.pw-browser-profile-form { display:grid; gap:10px; margin-top:12px }
.pw-browser-profile-form label { display:grid; gap:5px; color:var(--pw-secondary); font-size:11px }
.pw-browser-form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px }
.pw-browser-tabbar { display:flex; align-items:center; gap:7px; min-height:54px; padding:8px 12px; border-bottom:1px solid var(--pw-line) }
.pw-browser-tabbar [role=tablist] { display:flex; flex:0 1 auto; min-width:0; max-width:calc(100% - 39px); overflow-x:auto; scrollbar-width:none; gap:5px }
.pw-browser-tabbar [role=tablist]::-webkit-scrollbar { display:none }
.pw-browser-tabbar button { display:flex; align-items:center; justify-content:center; background:transparent; color:var(--pw-secondary); border:0; padding:0; font-size:12px }
.pw-browser-tab { display:flex; align-items:center; width:260px; min-width:140px; height:36px; border:1px solid transparent; border-radius:var(--dsw-radius-md); flex:none; color:var(--pw-secondary) }
.pw-browser-tab[data-selected=true] { background:var(--pw-surface); border-color:var(--pw-card-line); color:var(--dsw-alias-label-primary) }
.pw-browser-tab [role=tab] { justify-content:flex-start; gap:8px; min-width:0; height:100%; padding:0 0 0 12px; flex:1; color:inherit; text-align:left; font-size:13px }
.pw-browser-tab [role=tab] span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.pw-browser-tab .pw-browser-tab-close { width:28px; height:28px; margin:0 4px; border-radius:var(--dsw-radius-sm); flex:none }
.pw-browser-tab-close .pw-browser-icon { width:14px; height:14px }
.pw-browser-tab-placeholder { gap:8px; padding:0 12px; font-size:12px }
.pw-browser-tabbar .pw-browser-new-tab { width:32px; height:32px; border-radius:var(--dsw-radius-sm); flex:none }
.pw-browser-tabbar .pw-browser-identity { width:auto; height:32px; gap:5px; padding:0 9px; margin-left:auto; border:1px solid var(--pw-line); border-radius:var(--dsw-radius-lg); flex:none; font-size:11px }
.pw-browser-profile-row { flex-wrap:wrap }
.pw-browser-profile-row>span { flex-basis:140px }
.pw-browser-identity-confirm { margin:10px 0; padding:10px; border:1px solid var(--pw-line); border-radius:var(--dsw-radius-sm); display:grid; gap:8px }
.pw-browser-identity-confirm>div { display:flex; flex-wrap:wrap; gap:8px }
.pw-browser-tabbar button:hover:not(:disabled) { background:var(--pw-line) }
.pw-browser-tabbar [role=tab]:hover:not(:disabled) { background:transparent }
.pw-browser-toolbar { display:flex; align-items:center; gap:8px; min-height:54px; padding:9px 12px }
.pw-browser-toolbar button { display:grid; place-items:center; flex:none; width:32px; height:32px; padding:0; border:0; border-radius:50%; corner-shape:round; background:transparent; color:var(--pw-secondary) }
.pw-browser-toolbar button:hover:not(:disabled),.pw-browser-toolbar button[aria-expanded=true] { background:var(--pw-line); color:var(--dsw-alias-label-primary) }
.pw-browser-toolbar button:disabled,.pw-browser-tabbar button:disabled { opacity:.4 }
.pw-browser-toolbar .pw-browser-annotate { display:flex; gap:6px; width:auto; padding:0 12px; border-radius:var(--dsw-radius-xl); font-size:12px; background:var(--dsw-alias-bg-base) }
.pw-browser-toolbar .pw-browser-annotate[aria-pressed=true] { color:var(--pw-accent); background:var(--pw-surface); box-shadow:inset 0 0 0 1px var(--pw-accent) }
.pw-browser-annotation-tip { padding:7px 12px; color:var(--pw-secondary); background:var(--pw-soft); font-size:11px; border-bottom:1px solid var(--pw-line) }
.pw-browser-page { position:relative; width:100%; line-height:0 }
.pw-browser-expanded { position:fixed; inset:12px; z-index:2000; height:auto; border:1px solid var(--pw-line); border-radius:var(--dsw-radius-xl); box-shadow:var(--dsw-elevation-prominent) }
.pw-browser .pw-browser-input-proxy { position:absolute; left:0; top:0; width:1px; height:1px; padding:0; border:0; opacity:0; resize:none; pointer-events:none }
.pw-browser-page>img { touch-action:none }
.pw-browser-annotation-layer { position:absolute; inset:0; pointer-events:none; z-index:1; line-height:normal }
.pw-browser-annotation-layer[data-active=true] { pointer-events:auto; cursor:crosshair; touch-action:none }
.pw-browser-annotation-box { position:absolute; border:2px solid var(--pw-accent); background:color-mix(in srgb,var(--pw-accent) 10%,transparent); pointer-events:none }
.pw-browser-annotation-box[data-dragging=true] { border-style:dashed }
.pw-browser-element-highlight { position:absolute; outline:1px solid var(--dsw-alias-state-business-primary); background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 24%,transparent); pointer-events:none; overflow:hidden }
.pw-browser-element-highlight>div { position:absolute; background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 28%,transparent) }
.pw-browser-element-label { position:absolute; z-index:2; max-width:calc(100% - 8px); display:flex; flex-wrap:wrap; gap:3px 8px; padding:5px 7px; border-radius:var(--dsw-radius-sm); color:var(--dsw-static-neutral-bluish-00); background:var(--dsw-alias-tooltip-bg); box-shadow:var(--dsw-elevation-prominent); font:11px/16px var(--dsw-font-family); pointer-events:none; transform:translateY(4px) }
.pw-browser-element-label[data-above=true] { transform:translateY(calc(-100% - 4px)) }
.pw-browser-element-label code { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; font:inherit; color:inherit }
.pw-browser-element-label span,.pw-browser-element-label small { color:inherit; opacity:.8; font-size:10px }
.pw-browser-annotation-box>span { position:absolute; left:-2px; top:-2px; min-width:20px; padding:1px 5px; color:var(--dsw-alias-bg-base); background:var(--pw-accent); border-radius:0 0 var(--dsw-radius-xs) 0; font:11px/16px var(--dsw-font-family) }
.pw-browser .pw-browser-feedback { flex:0 1 auto; min-height:36px; max-height:36vh; overflow:auto; padding:0 12px; background:var(--dsw-alias-bg-base); border-bottom:1px solid var(--pw-line); font-size:12px }
.pw-browser-feedback ol { margin:0; padding:0; list-style:none }
.pw-browser-feedback li { padding:8px 0; border-top:1px solid var(--pw-line) }
.pw-browser-feedback li>div { display:flex; align-items:center; gap:8px; margin-bottom:6px }
.pw-browser-feedback strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; font-weight:500; min-width:0; flex:1 }
.pw-browser-feedback li>div>span { color:var(--pw-muted); font-size:10px; flex:none }
.pw-browser-feedback-actions { display:flex; gap:7px; flex-wrap:wrap; padding:7px 0 10px }
.pw-browser-feedback-actions small { flex-basis:100%; color:var(--pw-muted); font-size:10px }
.pw-browser-feedback>p { font-size:11px; padding-bottom:10px; overflow-wrap:anywhere }
.pw-browser-navigation { display:flex; align-items:center; flex:none; gap:1px; border-radius:var(--dsw-radius-xl); padding:0 3px; background:var(--dsw-alias-bg-base) }
.pw-browser-navigation-divider { height:16px; border-left:1px solid var(--pw-line); margin:0 2px }
.pw-browser-address { flex:1; min-width:0; margin:0; border:1px solid transparent; border-radius:var(--dsw-radius-panel); background:var(--dsw-alias-bg-base) }
.pw-browser-address:focus-within { border-color:var(--pw-accent) }
.pw-browser-address input { display:block; width:100%; min-width:0; height:34px; border:0; border-radius:inherit; background:transparent; color:var(--dsw-alias-label-primary); padding:0 14px; font-size:13px; text-align:center; text-overflow:ellipsis; outline:none }
.pw-browser-address input:focus { text-align:left }
.pw-browser-address input:focus-visible { outline:none }
.pw-browser-text-input { display:flex; align-items:center; gap:6px; padding:8px 10px; border-bottom:1px solid var(--pw-line) }
.pw-browser-surface { flex:1; min-height:0; overflow:auto; background:var(--pw-soft); overscroll-behavior:contain }
.pw-browser-surface img { display:block; width:100%; height:auto; cursor:default; user-select:none }
.pw-browser-empty { flex:1; min-height:240px; display:grid; place-items:center; padding:24px; color:var(--pw-muted); text-align:center; font-size:12px }
.pw-browser-error { padding:8px 12px; color:var(--dsw-alias-state-error-primary); border-bottom:1px solid var(--pw-line); font-size:12px }
.pw-browser-status { display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:34px; padding:5px 12px; border-top:1px solid var(--pw-line); color:var(--pw-secondary); font-size:11px }
.pw-browser-status>span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.pw-browser .pw-browser-inspect { flex:0 1 auto; min-height:70px; max-height:42vh; overflow:auto; padding:10px 12px; border-bottom:1px solid var(--pw-line); font-size:11px; color:var(--pw-secondary); line-height:1.7 }
.pw-browser-inspect-actions { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px }
.pw-browser .pw-browser-resources { flex:0 1 auto; overflow:auto; max-height:44vh; border-bottom:1px solid var(--pw-line); padding:0 12px; font-size:11px; line-height:1.7; color:var(--pw-secondary) }
.pw-browser-resources .pw-facts { margin:0 0 10px }
.pw-browser-resources p { margin:8px 0 10px }
.pw-browser-health { display:flex; flex-wrap:wrap; gap:4px 12px; margin-block:8px }
.pw-browser-health p { flex-basis:100%; color:var(--pw-muted) }
.pw-browser-transfer { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px }
.pw-browser-transfer label { display:grid; min-width:0; gap:4px }
.pw-browser-transfer p { grid-column:1/-1 }
.pw-browser-artifacts { list-style:none; padding:0; margin:10px 0 0 }
.pw-browser-artifacts li { display:flex; flex-wrap:wrap; gap:4px 10px; padding:7px 0; border-top:1px solid var(--pw-line) }
.pw-browser-artifacts code { flex-basis:100%; overflow-wrap:anywhere; font-size:10px; user-select:text }
.pw-browser-workspace .pw-scroll { flex:1; min-height:0; display:flex; overflow:hidden; }
.pw-browser-workspace .pw-panel-inner { max-width:none; margin:0 }
.pw-browser-permission { display:flex; flex-direction:column; align-items:flex-start; gap:12px; padding:24px; color:var(--pw-secondary); }
.pw-actions { display:flex; gap:8px; flex-wrap:wrap; }
.pw-browser .pw-browser-input { min-width:0; width:100%; flex-shrink:1; font-family:var(--dsw-font-family) }
.pw-browser .pw-browser-input input { font-family:inherit; width:100%; appearance:textfield }
.pw-browser .pw-browser-input input::-webkit-inner-spin-button,.pw-browser .pw-browser-input input::-webkit-outer-spin-button { appearance:none; margin:0 }
.pw-browser-address .pw-browser-input { height:34px; border:0; background:transparent; border-radius:inherit; padding:0 }
.pw-browser-profile-form .pw-browser-input { height:34px }
.pw-browser-select { width:100%; min-width:0 }
.pw-browser .pw-browser-select-trigger { width:100%; min-width:0; justify-content:space-between; text-align:left; height:34px; font-family:inherit }
.pw-browser-select-trigger>span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.pw-browser-select-trigger>svg { flex:none }
.pw-browser-select-menu,.pw-browser-host-menu { max-width:calc(100vw - 24px); font-family:var(--dsw-font-family) }
.pw-browser-select-menu button { font-family:inherit }
.pw-browser-environment>label { display:flex; gap:8px; align-items:center; min-width:0; width:100%; font-size:12px }
.pw-browser-environment>label>span:first-child { flex:none; white-space:nowrap }
.pw-browser-environment .pw-browser-select { max-width:280px }
.pw-browser-switch-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding-block:6px; color:var(--dsw-alias-label-secondary); font-size:12px }
.pw-browser-switch-row>span { min-width:0; flex:1 }
.pw-browser-disclosure-heading { min-height:38px; font:12px/1.5 var(--dsw-font-family); color:var(--dsw-alias-label-primary) }
.pw-browser-disclosure-count { margin-left:auto; color:var(--dsw-alias-label-tertiary); font-size:11px }
.pw-browser .pw-browser-field-textarea { display:block; width:100%; resize:vertical; appearance:none; max-height:110px; min-height:64px; padding:8px 10px; border:.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-md); font:12px/1.5 var(--dsw-font-family); color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-1) }
.pw-browser-field-textarea::placeholder { color:var(--dsw-alias-label-dimmed) }
.pw-browser-field-textarea:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:2px }
.pw-browser-text-input .pw-browser-input { flex:1 }
.pw-browser-transfer .pw-browser-input { width:100% }
.pw-facts { display:grid; gap:6px; }
.pw-facts div { display:flex; justify-content:space-between; gap:12px; }
@container patchwork (max-width:420px) {
  .pw-browser-tabbar { padding:7px 8px; min-height:48px }
  .pw-browser-tab { width:210px; height:34px }
  .pw-browser-toolbar { padding:8px; gap:5px; min-height:48px }
  .pw-browser-toolbar button { width:28px; height:28px }
  .pw-browser-toolbar .pw-browser-annotate { width:28px; padding:0; justify-content:center; flex:none }
  .pw-browser-annotate>span { display:none }
  .pw-browser-navigation { padding:0 2px; gap:0 }
  .pw-browser-navigation-divider { margin:0 1px }
  .pw-browser-address input { height:32px; padding:0 9px; font-size:12px }
  .pw-browser-tab [role=tab] { font-size:12px }
  .pw-browser-status { padding-inline:8px }
}
`;

// packages/browser/src/client/annotation-send.mjs
function annotationSender(ctx, sessionId) {
  if (!sessionId) return void 0;
  const scoped = ctx.sessions.scope?.(sessionId);
  const conversation = scoped?.get?.("conversation");
  if (typeof conversation?.send !== "function") return void 0;
  return (text) => conversation.send(text);
}

// packages/browser/src/client/index.jsx
var inject = ["slots", "sidebarRightTabs", "sessions"];
function apply(ctx) {
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = "@patchwork/browser";
    style.textContent = BROWSER_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, "browser: host theme styles");
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: "patchwork-browser",
    kind: "patchwork-browser",
    title: () => "\u6D4F\u89C8\u5668",
    guide: [{ id: "patchwork-browser", order: 51, title: () => "\u6D4F\u89C8\u5668", description: () => "\u6253\u5F00\u5F53\u524D\u4F1A\u8BDD\u7684\u72EC\u7ACB\u6D4F\u89C8\u5668" }]
  }), "browser: sidebar entry");
  ctx.effect(() => ctx.slots.inject(
    "sidebar.right.pane.tab",
    () => ctx.slots.register({ name: "sidebar.right.pane.tab", key: "patchwork-browser", inject: (sessionId) => {
      const sendAnnotations = annotationSender(ctx, sessionId);
      return { sessionId, sessionStore: ctx.sessions.list, ...sendAnnotations ? { sendAnnotations } : {} };
    } }, BrowserWorkspace)
  ), "browser: sidebar body");
  ctx.effect(() => ctx.slots.inject(
    "sidebar.right.pane.tab.title",
    () => ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: "patchwork-browser" }, BrowserTitle)
  ), "browser: sidebar title");
}

		return module.exports;
	},
});

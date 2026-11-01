// 由 scripts/build-client.mjs 生成，请勿手改。
window.__ModuleLoader__.load({
	id: "@patchwork/coding-agent",
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

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/PatchworkPanel.jsx
var import_react14 = require("react");
var import_dsh_client_ui_primitives14 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/use-patchwork-state.mjs
var import_react = require("react");
function readConnectionMetadata() {
  const rows = [...document.querySelectorAll("script[data-patchwork-stats]")];
  for (const node of rows.reverse()) {
    try {
      const data = JSON.parse(node.textContent);
      if (data.statePath && data.token) return data;
    } catch {
    }
  }
  return null;
}
function usePatchworkState(sessionId) {
  const [snapshot, setSnapshot] = (0, import_react.useState)(null);
  const [connection, setConnection] = (0, import_react.useState)("loading");
  const [error, setError] = (0, import_react.useState)("");
  const [refreshKey, refresh] = (0, import_react.useState)(0);
  const version = (0, import_react.useRef)(0);
  const active = (0, import_react.useRef)(false);
  const exportController = (0, import_react.useRef)(null);
  const saveController = (0, import_react.useRef)(null);
  const mutations = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  (0, import_react.useEffect)(() => {
    active.current = true;
    return () => {
      active.current = false;
      exportController.current?.abort();
      saveController.current?.abort();
      for (const controller of mutations.current) controller.abort();
      mutations.current.clear();
    };
  }, [sessionId]);
  (0, import_react.useEffect)(() => {
    const metadata = readConnectionMetadata();
    let stopped = false;
    let timer;
    const controller = new AbortController();
    setError("");
    if (!sessionId || !metadata) {
      setConnection("unavailable");
      return () => {
        controller.abort();
      };
    }
    setConnection("loading");
    async function read() {
      const current = version.current;
      try {
        const response = await fetch(metadata.statePath + "?sessionId=" + encodeURIComponent(sessionId), {
          headers: { "x-patchwork-token": metadata.token },
          signal: controller.signal,
          cache: "no-store"
        });
        if (response.status === 403) {
          if (!stopped) {
            setSnapshot(null);
            setConnection("unavailable");
            setError("\u8BF7\u5148\u5207\u6362\u5230 Patchwork Agent");
          }
          return;
        }
        if (!response.ok) throw new Error("\u8BFB\u53D6\u5931\u8D25\uFF08HTTP " + response.status + "\uFF09");
        const data = await response.json();
        if (!data.ok || data.sessionId !== sessionId) throw new Error("\u4F1A\u8BDD\u72B6\u6001\u54CD\u5E94\u4E0D\u5339\u914D");
        if (!stopped && current === version.current) {
          setSnapshot(data);
          setConnection("connected");
          setError("");
        }
      } catch (e) {
        if (!stopped) {
          setConnection("offline");
          setError(e.message);
        }
      } finally {
        if (!stopped) timer = setTimeout(read, 2e3);
      }
    }
    void read();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [sessionId, refreshKey]);
  async function save(patch, revision) {
    const metadata = readConnectionMetadata();
    if (!active.current || !metadata || !sessionId || connection !== "connected") throw new Error("\u8BF7\u5148\u5207\u6362\u5230 Patchwork Agent \u5E76\u8FDE\u63A5\u72B6\u6001\u901A\u9053");
    saveController.current?.abort();
    const controller = new AbortController();
    saveController.current = controller;
    version.current++;
    const response = await fetch(metadata.writePath + "?sessionId=" + encodeURIComponent(sessionId), {
      method: "POST",
      headers: { "content-type": "application/json", "x-patchwork-token": metadata.token, "x-patchwork-revision": revision },
      body: JSON.stringify(patch),
      signal: controller.signal
    });
    const payload = await response.json();
    if (!active.current || controller.signal.aborted) throw new Error("\u4F1A\u8BDD\u5DF2\u5207\u6362\uFF0C\u4FDD\u5B58\u7ED3\u679C\u4E0D\u518D\u5E94\u7528\u4E8E\u6B64\u9762\u677F");
    if (!response.ok) {
      if (response.status === 403) {
        setSnapshot(null);
        setConnection("unavailable");
      }
      const e = new Error(payload.reason ?? "\u4FDD\u5B58\u5931\u8D25");
      e.conflict = response.status === 409 ? payload : null;
      throw e;
    }
    setSnapshot((previous) => previous && { ...previous, config: payload.config, revision: payload.revision });
    return payload;
  }
  async function exportLogs() {
    const metadata = readConnectionMetadata();
    if (!active.current || !metadata?.logsPath || connection !== "connected") throw new Error("logs-unavailable");
    exportController.current?.abort();
    const controller = new AbortController();
    exportController.current = controller;
    const response = await fetch(metadata.logsPath + "?sessionId=" + encodeURIComponent(sessionId), {
      headers: { "x-patchwork-token": metadata.token },
      signal: controller.signal,
      cache: "no-store"
    });
    const data = await response.json();
    if (!active.current || controller.signal.aborted || !response.ok || !data.ok) throw new Error("logs-forbidden-or-unavailable");
    return data;
  }
  const memoryQuery = (0, import_react.useCallback)(async (params = {}, signal) => {
    const metadata = readConnectionMetadata();
    if (!active.current || !metadata?.memoryPath || !sessionId) throw new Error("memory-unavailable");
    const controller = new AbortController();
    mutations.current.add(controller);
    try {
      const query = new URLSearchParams({ sessionId, ...params });
      const response = await fetch(metadata.memoryPath + "?" + query, { headers: { "x-patchwork-token": metadata.token }, signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal, cache: "no-store" });
      const value = await response.json();
      if (!active.current || controller.signal.aborted) throw new Error("session-changed");
      if (!response.ok || !value.ok) throw new Error(value.failureCode ?? value.reason ?? "memory-unavailable");
      return value;
    } finally {
      mutations.current.delete(controller);
    }
  }, [sessionId]);
  async function memoryAction(action, id, expectedRevision, fields = {}) {
    return mutate("memoryPath", { action, id, expectedRevision, ...fields });
  }
  async function mutate(path, body) {
    const metadata = readConnectionMetadata();
    if (!active.current || !metadata?.[path] || !sessionId || connection !== "connected") throw new Error("management-unavailable");
    const controller = new AbortController();
    mutations.current.add(controller);
    try {
      const response = await fetch(metadata[path] + "?sessionId=" + encodeURIComponent(sessionId), {
        method: "POST",
        headers: { "content-type": "application/json", "x-patchwork-token": metadata.token },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const data = await response.json();
      if (!active.current || controller.signal.aborted) throw new Error("session-changed");
      if (!response.ok || !data.ok) {
        const error2 = new Error(data.failureCode ?? data.reason ?? "management-action-failed");
        error2.conflict = response.status === 409 ? data : null;
        throw error2;
      }
      refresh((x) => x + 1);
      return data;
    } finally {
      mutations.current.delete(controller);
    }
  }
  async function improvementAction(action, candidateId, expectedRevision) {
    return mutate("improvementPath", { action, candidateId, incidentId: action === "propose" ? candidateId : void 0, expectedRevision });
  }
  const superagentAction = (body) => mutate("superagentPath", body);
  return { snapshot, connection, error, save, exportLogs, memoryAction, memoryQuery, improvementAction, superagentAction, refresh: () => refresh((x) => x + 1) };
}

// src/client/SuperagentPanel.jsx
var import_react5 = require("react");
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/controls.jsx
var import_react2 = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime = require("react/jsx-runtime");
function Select({ value, options: options2, onChange, disabled = false, "aria-label": label }) {
  const [open, setOpen] = (0, import_react2.useState)(false);
  (0, import_react2.useEffect)(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_dsh_client_ui_primitives.Menu,
    {
      compact: true,
      portal: true,
      autoFocus: true,
      open: open && !disabled,
      selectedId: String(value),
      onClose: () => setOpen(false),
      items: options2.map((option) => ({ id: String(option.value), label: option.label })),
      onSelect: (value2) => {
        setOpen(false);
        onChange(value2);
      },
      anchor: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { size: "sm", variant: "outline", "aria-label": label, "aria-haspopup": "menu", "aria-expanded": open && !disabled, disabled, onClick: () => setOpen((previous) => !previous), onKeyDown: (event) => {
        if (["ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          setOpen(true);
        }
      }, children: options2.find((option) => String(option.value) === String(value))?.label ?? "\u8BF7\u9009\u62E9" })
    }
  );
}
function Disclosure({ title: title2, children, initialOpen = false }) {
  const [open, setOpen] = (0, import_react2.useState)(initialOpen);
  const icon = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m6 4 4 4-4 4", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.DisclosureRow, { className: "pw-technical", icon, title: title2, open, onToggle: () => setOpen((value) => !value), expandable: true, expandOnRowClick: true, keepContentWhenOpen: true, children });
}

// src/client/panel-elements.jsx
var import_react3 = require("react");

// src/client/panel-icons.mjs
var icons = {
  "search": [
    [
      "path",
      {
        "d": "M221.09 64a157.09 157.09 0 1 0 157.09 157.09A157.1 157.1 0 0 0 221.09 64z",
        "fill": "none",
        "stroke": "currentColor",
        "strokeMiterlimit": "10",
        "strokeWidth": "32"
      }
    ],
    [
      "path",
      {
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeMiterlimit": "10",
        "strokeWidth": "32",
        "d": "M338.29 338.29L448 448"
      }
    ]
  ],
  "chevron": [
    [
      "path",
      {
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "48",
        "d": "M184 112l144 144l-144 144"
      }
    ]
  ],
  "check": [
    [
      "path",
      {
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32",
        "d": "M416 128L192 384l-96-96"
      }
    ]
  ],
  "circle": [
    [
      "circle",
      {
        "cx": "256",
        "cy": "256",
        "r": "192",
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32"
      }
    ]
  ],
  "refresh": [
    [
      "path",
      {
        "d": "M320 146s24.36-12-64-12a160 160 0 1 0 160 160",
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeMiterlimit": "10",
        "strokeWidth": "32"
      }
    ],
    [
      "path",
      {
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32",
        "d": "M256 58l80 80l-80 80"
      }
    ]
  ],
  "file": [
    [
      "path",
      {
        "d": "M416 221.25V416a48 48 0 0 1-48 48H144a48 48 0 0 1-48-48V96a48 48 0 0 1 48-48h98.75a32 32 0 0 1 22.62 9.37l141.26 141.26a32 32 0 0 1 9.37 22.62z",
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinejoin": "round",
        "strokeWidth": "32"
      }
    ],
    [
      "path",
      {
        "d": "M256 56v120a32 32 0 0 0 32 32h120",
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32"
      }
    ],
    [
      "path",
      {
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32",
        "d": "M176 288h160"
      }
    ],
    [
      "path",
      {
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32",
        "d": "M176 368h160"
      }
    ]
  ],
  "external": [
    [
      "path",
      {
        "d": "M384 224v184a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V168a40 40 0 0 1 40-40h167.48",
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32"
      }
    ],
    [
      "path",
      {
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32",
        "d": "M336 64h112v112"
      }
    ],
    [
      "path",
      {
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32",
        "d": "M224 288L440 72"
      }
    ]
  ],
  "lock": [
    [
      "path",
      {
        "d": "M336 208v-95a80 80 0 0 0-160 0v95",
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32"
      }
    ],
    [
      "rect",
      {
        "x": "96",
        "y": "208",
        "width": "320",
        "height": "272",
        "rx": "48",
        "ry": "48",
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32"
      }
    ]
  ],
  "download": [
    [
      "path",
      {
        "d": "M336 176h40a40 40 0 0 1 40 40v208a40 40 0 0 1-40 40H136a40 40 0 0 1-40-40V216a40 40 0 0 1 40-40h40",
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32"
      }
    ],
    [
      "path",
      {
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32",
        "d": "M176 272l80 80l80-80"
      }
    ],
    [
      "path",
      {
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32",
        "d": "M256 48v288"
      }
    ]
  ],
  "activity": [
    [
      "path",
      {
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32",
        "d": "M48 320h64l64-256l64 384l64-224l32 96h64"
      }
    ],
    [
      "circle",
      {
        "cx": "432",
        "cy": "320",
        "r": "32",
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32"
      }
    ]
  ],
  "shield": [
    [
      "path",
      {
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32",
        "d": "M336 176L225.2 304L176 255.8"
      }
    ],
    [
      "path",
      {
        "d": "M463.1 112.37C373.68 96.33 336.71 84.45 256 48c-80.71 36.45-117.68 48.33-207.1 64.37C32.7 369.13 240.58 457.79 256 464c15.42-6.21 223.3-94.87 207.1-351.63z",
        "fill": "none",
        "stroke": "currentColor",
        "strokeLinecap": "round",
        "strokeLinejoin": "round",
        "strokeWidth": "32"
      }
    ]
  ]
};

// src/client/panel-elements.jsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function PanelIcon({ name, className = "", ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { className: `pw-icon ${className}`, width: "16", height: "16", viewBox: "0 0 512 512", fill: "currentColor", stroke: "none", "aria-hidden": "true", ...props, children: (icons[name] ?? icons.activity).map(([tag, attributes], index) => (0, import_react3.createElement)(tag, { ...attributes, key: index })) });
}
function EmptyState({ title: title2, children, icon = "activity" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pw-empty", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PanelIcon, { name: icon }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { children: title2 }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children })
  ] });
}
function SectionHeading({ title: title2, description, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pw-section-heading", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { children: title2 }),
      description && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: description })
    ] }),
    children
  ] });
}
function TechnicalDetails({ children, title: title2 = "\u6280\u672F\u5B57\u6BB5", open }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Disclosure, { title: title2, initialOpen: open, children });
}

// src/client/workspace-elements.jsx
var import_react4 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime3 = require("react/jsx-runtime");
function SearchField({ label, value, onChange, placeholder = "\u641C\u7D22", ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "pw-search", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PanelIcon, { name: "search" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives.Input, { type: "search", "aria-label": label, value, onChange: (event) => onChange(event.target.value), placeholder, ...props })
  ] });
}
function Facets({ label, value, onChange, items }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "pw-facets", role: "group", "aria-label": label, children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_dsh_client_ui_primitives2.Button, { size: "sm", variant: "ghost", "aria-pressed": value === item.value, onClick: () => onChange(item.value), children: [
    item.label,
    item.count != null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "pw-facet-count", children: item.count })
  ] }, item.value)) });
}
function SummaryStrip({ label, items }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dl", { className: "pw-summary-strip", "aria-label": label, children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dt", { children: item.label }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dd", { "data-tone": item.tone, children: item.value ?? "\u672A\u6D4B\u91CF" })
  ] }, item.label)) });
}
function CopyButton({ value, label = "\u590D\u5236" }) {
  const [message, setMessage] = (0, import_react4.useState)("");
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "pw-copy-action", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives2.Button, { size: "sm", variant: "ghost", onClick: async () => {
      try {
        await navigator.clipboard.writeText(value);
        setMessage("\u5DF2\u590D\u5236");
      } catch {
        setMessage("\u590D\u5236\u4E0D\u53EF\u7528\uFF0C\u8BF7\u624B\u52A8\u9009\u62E9\u6587\u672C");
      }
    }, children: label }),
    message && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { role: "status", className: "pw-muted", children: message })
  ] });
}
function RecordStatus({ children, tone: tone2 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "pw-record-status", "data-tone": tone2, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "pw-dot", "data-tone": tone2 }),
    children
  ] });
}

// src/client/workspace-model.mjs
var textMatches = (query, ...values) => !query.trim() || values.flat(Infinity).filter((value) => value != null).join(" ").toLowerCase().includes(query.trim().toLowerCase());
function workspaceSummary(data) {
  const requirements = data.task?.requirements ?? [], jobs = data.superagent?.jobs ?? [], events = data.events ?? [];
  const required = requirements.filter((item) => item.required);
  return {
    requirements: required.length,
    passed: required.filter((item) => ["passed", "accepted"].includes(item.status)).length,
    review: jobs.filter((item) => item.status === "review").length,
    running: jobs.filter((item) => ["starting", "running"].includes(item.status)).length,
    blocked: jobs.filter((item) => ["failed", "blocked", "waiting"].includes(item.status)).length,
    failures: events.filter((item) => item.outcome === "failed").length,
    candidates: (data.improvements?.candidates ?? []).filter((item) => !item.applied && !["revoked", "rejected"].includes(item.decision)).length,
    tokens: Number.isFinite(data.context?.tokens) && data.context.tokens >= 0 ? data.context.tokens : null,
    window: Number.isFinite(data.context?.window) && data.context.window > 0 ? data.context.window : null
  };
}
var queueBucket = (status) => ["failed", "blocked", "waiting"].includes(status) ? "attention" : ["starting", "running"].includes(status) ? "running" : status === "review" ? "review" : ["done", "cancelled"].includes(status) ? "finished" : "queued";
var improvementBucket = (candidate) => candidate.applied ? "applied" : ["revoked", "rejected"].includes(candidate.decision) ? candidate.decision : "pending";
function evidenceGroups(items) {
  const groups2 = /* @__PURE__ */ new Map();
  for (const item of items) {
    const id = item.rootCallId ?? item.id;
    if (!groups2.has(id)) groups2.set(id, []);
    groups2.get(id).push(item);
  }
  return [...groups2].map(([id, entries]) => ({ id, entries }));
}
function safePublicLink(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

// src/client/SuperagentPanel.jsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var labels = { queued: "\u6392\u961F", starting: "\u542F\u52A8\u4E2D", running: "\u6267\u884C\u4E2D", waiting: "\u7B49\u5F85\u8F93\u5165", review: "\u7B49\u5F85\u590D\u6838", blocked: "\u963B\u585E", failed: "\u5931\u8D25", cancelled: "\u53D6\u6D88", done: "\u5B8C\u6210", active: "\u8FD0\u884C\u4E2D", paused: "\u6682\u505C", completed: "\u5168\u90E8\u5B8C\u6210", idle: "\u7A7A\u95F2" };
var buckets = [["all", "\u5168\u90E8"], ["attention", "\u9700\u5904\u7406"], ["review", "\u5F85\u590D\u6838"], ["running", "\u6267\u884C\u4E2D"], ["queued", "\u6392\u961F"], ["finished", "\u5DF2\u7ED3\u675F"]];
function SuperagentPanel({ data, superagentAction }) {
  const [busy, setBusy] = (0, import_react5.useState)(false), [message, setMessage] = (0, import_react5.useState)(""), [confirm, setConfirm] = (0, import_react5.useState)(null);
  const [query, setQuery] = (0, import_react5.useState)(""), [filter, setFilter] = (0, import_react5.useState)("all"), [mode, setMode] = (0, import_react5.useState)("all"), [selectedId, setSelectedId] = (0, import_react5.useState)(null);
  const detailRef = (0, import_react5.useRef)(null), queue = data.superagent, jobs = queue?.jobs ?? [];
  const visible = jobs.filter((job) => (filter === "all" || queueBucket(job.status) === filter) && (mode === "all" || job.mode === mode) && textMatches(query, job.title, job.id, job.dependencies, job.childId, job.recovery));
  const selected = visible.find((job) => job.id === selectedId) ?? visible[0];
  (0, import_react5.useEffect)(() => {
    if (selectedId) detailRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);
  async function act(action, job, accept, baseRevision = queue.revision) {
    setBusy(true);
    setMessage("");
    try {
      await superagentAction({ action, id: job?.id, baseRevision, accept, evidenceVersion: job?.evidence?.version });
      setConfirm(null);
      setMessage("\u5DF2\u66F4\u65B0\u961F\u5217\u3002");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-page-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h2", { children: "\u4E3B\u63A7\u961F\u5217" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: "\u5148\u770B\u9700\u8981\u5904\u7406\u7684\u6267\u884C\u5668\uFF0C\u518D\u6838\u5BF9\u4F9D\u8D56\u548C\u9A8C\u6536\u3002\u6A21\u578B\u7ED3\u675F\u56DE\u5408\u4E0D\u4EE3\u8868\u7ED3\u679C\u901A\u8FC7\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SummaryStrip, { label: "\u961F\u5217\u7EDF\u8BA1", items: [{ label: "\u6267\u884C\u4E2D", value: jobs.filter((job) => queueBucket(job.status) === "running").length }, { label: "\u5F85\u590D\u6838", value: jobs.filter((job) => job.status === "review").length }, { label: "\u9700\u5904\u7406", value: jobs.filter((job) => queueBucket(job.status) === "attention").length }, { label: "\u5B8C\u6210", value: jobs.filter((job) => job.status === "done").length }] }),
    !jobs.length ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(EmptyState, { title: "\u5C1A\u672A\u5B89\u6392\u6267\u884C\u5668", children: "\u9700\u8981\u62C6\u5206\u4EFB\u52A1\u65F6\uFF0CAgent \u53EF\u901A\u8FC7 patchwork_superagent \u767B\u8BB0\u961F\u5217\u3002" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("section", { className: "pw-card pw-queue-control", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-heading-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(RecordStatus, { tone: queue.status === "paused" ? "warn" : void 0, children: labels[queue.status] ?? queue.status }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: "pw-live-note", children: [
            "\u5E76\u53D1 ",
            queue.concurrency,
            " \xB7 r",
            queue.revision,
            " \xB7 ",
            queue.persistence === "native" ? "\u4F1A\u8BDD\u6301\u4E45\u8BB0\u5F55" : queue.persistence ?? "\u8FD0\u884C\u5FEB\u7167"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-actions", children: [
          queue.status === "active" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "outline", disabled: busy, onClick: () => act("pause"), children: "\u6682\u505C" }),
          queue.status === "paused" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "outline", disabled: busy, onClick: () => act("resume"), children: "\u7EE7\u7EED\u961F\u5217" }),
          !["completed", "cancelled"].includes(queue.status) && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "ghost", disabled: busy, onClick: () => setConfirm({ action: "cancel", revision: queue.revision }), children: "\u53D6\u6D88\u961F\u5217" })
        ] })
      ] }) }),
      confirm && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "pw-card pw-memory-confirm", "aria-label": "\u786E\u8BA4\u961F\u5217\u64CD\u4F5C", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { children: confirm.action === "cancel" ? "\u53D6\u6D88\u5F53\u524D\u961F\u5217\uFF1F" : "\u91CD\u65B0\u6267\u884C\u6B64\u4EFB\u52A1\uFF1F" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: confirm.action === "cancel" ? "\u5C06\u505C\u6B62\u5F53\u524D\u4F1A\u8BDD\u961F\u5217\u3002\u5DF2\u751F\u6210\u7684\u6587\u4EF6\u4E0D\u4F1A\u81EA\u52A8\u56DE\u6EDA\u3002" : "\u91CD\u8BD5\u4F1A\u542F\u52A8\u65B0\u6267\u884C\u5668\uFF0C\u53EF\u80FD\u518D\u6B21\u4FEE\u6539\u6587\u4EF6\uFF1B\u5148\u68C0\u67E5\u65E7\u4EA7\u7269\u548C\u4F9D\u8D56\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "primary", disabled: busy, onClick: () => act(confirm.action, confirm.job, void 0, confirm.revision), children: "\u786E\u8BA4\u961F\u5217\u64CD\u4F5C" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "ghost", onClick: () => setConfirm(null), children: "\u8FD4\u56DE\u67E5\u770B" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SearchField, { label: "\u641C\u7D22\u6267\u884C\u5668", value: query, onChange: setQuery, placeholder: "\u641C\u7D22\u4EFB\u52A1\u3001\u6267\u884C\u5668 ID \u6216\u4F9D\u8D56" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Facets, { label: "\u961F\u5217\u72B6\u6001\u7B5B\u9009", value: filter, onChange: setFilter, items: buckets.map(([value, label]) => ({ value, label, count: value === "all" ? jobs.length : jobs.filter((job) => queueBucket(job.status) === value).length })) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-heading-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "pw-muted", children: [
          visible.length,
          " / ",
          jobs.length,
          " \u4E2A\u4EFB\u52A1"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Select, { "aria-label": "\u6267\u884C\u5668\u8BFB\u5199\u6A21\u5F0F", value: mode, onChange: setMode, options: [{ value: "all", label: "\u5168\u90E8\u6A21\u5F0F" }, { value: "read", label: "\u53EA\u8BFB\u4EFB\u52A1" }, { value: "write", label: "\u5199\u5165\u4EFB\u52A1" }] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-master-detail", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("section", { className: "pw-record-list", "aria-label": "\u6267\u884C\u5668\u5217\u8868", children: visible.length ? visible.map((job) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { type: "button", className: "pw-record-row", "aria-label": `\u67E5\u770B\u6267\u884C\u5668 ${job.title}`, "aria-pressed": selected?.id === job.id, onClick: () => setSelectedId(job.id), children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "pw-record-title", children: job.title }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "pw-record-subtitle", children: [
            job.mode === "write" ? "\u5199\u5165" : "\u53EA\u8BFB",
            " \xB7 \u5C1D\u8BD5 ",
            job.attempt,
            "/3"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(RecordStatus, { tone: ["failed", "blocked"].includes(job.status) ? "warn" : job.status === "done" ? "success" : void 0, children: labels[job.status] ?? job.status })
        ] }, job.id)) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(EmptyState, { title: "\u6CA1\u6709\u5339\u914D\u7684\u6267\u884C\u5668", children: "\u8C03\u6574\u641C\u7D22\u6761\u4EF6\u6216\u72B6\u6001\u7B5B\u9009\u3002" }) }),
        selected && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("article", { ref: detailRef, className: "pw-detail-pane", "aria-label": "\u6267\u884C\u5668\u8BE6\u60C5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SectionHeading, { title: selected.title, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CopyButton, { label: "\u590D\u5236\u4EFB\u52A1 ID", value: selected.id }) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-inline-facts", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(RecordStatus, { children: labels[selected.status] ?? selected.status }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: selected.mode === "write" ? "\u5199\u5165\u4EFB\u52A1 \xB7 \u672C\u6A21\u5757\u4E32\u884C" : "\u53EA\u8BFB\u4EFB\u52A1" })
          ] }),
          selected.recovery && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "pw-warning", children: selected.recovery }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "pw-detail-section", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { children: "\u4F9D\u8D56\u5173\u7CFB" }),
            selected.dependencies.length ? selected.dependencies.map((id) => {
              const dependency = jobs.find((job) => job.id === id);
              return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "pw-knowledge-row", onClick: () => {
                setFilter("all");
                setMode("all");
                setQuery("");
                setSelectedId(id);
              }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: dependency?.title ?? id }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("small", { children: [
                  labels[dependency?.status] ?? "\u4F9D\u8D56\u4E0D\u53EF\u7528",
                  dependency?.status !== "done" ? " \xB7 \u5C1A\u672A\u653E\u884C\u6B64\u4EFB\u52A1" : ""
                ] })
              ] }) }, id);
            }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "pw-muted", children: "\u65E0\u524D\u7F6E\u4EFB\u52A1\u3002" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("dl", { className: "pw-facts", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { children: "\u6267\u884C\u5668" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dd", { children: selected.childId ?? "\u5C1A\u672A\u5206\u914D" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { children: "\u767B\u8BB0\u68C0\u67E5" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dd", { children: selected.evidence?.verified ? "\u673A\u5668\u9A8C\u6536\u901A\u8FC7" : "\u672A\u5168\u90E8\u901A\u8FC7" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { children: "\u8BED\u4E49\u63A5\u7EB3" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dd", { children: selected.disposition?.accepted ? "\u7528\u6237\u5DF2\u786E\u8BA4\u5F53\u524D\u7248\u672C" : "\u672A\u786E\u8BA4" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { children: "\u91CD\u8BD5\u6B21\u6570" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("dd", { children: [
                selected.attempt,
                " / 3"
              ] })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(TechnicalDetails, { title: "\u6267\u884C\u4E0E\u9A8C\u6536", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: selected.result?.summary ?? "\u5C1A\u65E0\u7ED3\u679C\u6458\u8981\u3002" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { className: "pw-task-path", children: selected.evidence?.version ?? "\u5C1A\u65E0\u8BC1\u636E\u7248\u672C" }),
            (selected.evidence?.artifacts ?? []).map((artifact, index) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { className: "pw-task-path", children: typeof artifact === "string" ? artifact : artifact.path ?? artifact.id }, index))
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-actions pw-detail-actions", children: [
            selected.status === "review" && selected.evidence?.reviewable && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "primary", disabled: busy, onClick: () => act("review", selected, true), children: "\u63A5\u7EB3\u5F53\u524D\u7ED3\u679C" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "outline", disabled: busy, onClick: () => act("review", selected, false), children: "\u9000\u56DE\u4FEE\u6539" })
            ] }),
            ["failed", "blocked", "waiting", "review"].includes(selected.status) && selected.attempt < 3 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "outline", disabled: busy, onClick: () => setConfirm({ action: "retry", job: selected, revision: queue.revision }), children: "\u91CD\u8BD5" })
          ] })
        ] })
      ] })
    ] }),
    message && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "pw-live-note", role: "status", children: message })
  ] });
}

// src/config/fields.mjs
var SETTING_FIELDS = [
  ["actionFusion", "boolean", true, "\u63A5\u7EED\u6267\u884C", "mechanism"],
  ["observationPack", "boolean", false, "\u5927\u8F93\u51FA\u5F52\u6863", "mechanism"],
  ["evidencePreservingReducer", "boolean", false, "\u8BC1\u636E\u7EA6\u7B80", "mechanism"],
  ["onlineContextCompact", "boolean", false, "\u4E0A\u4E0B\u6587\u538B\u7F29", "mechanism"],
  ["cacheWriteReadRatio", "number", 12.5, "\u7F13\u5B58\u5199\u5165 / \u8BFB\u53D6\u6210\u672C\u6BD4", "mechanism", 0],
  ["reducerProvider", "string", "", "\u7EA6\u7B80 Provider\uFF08\u7559\u7A7A\u4F7F\u7528\u5BBF\u4E3B\u9ED8\u8BA4\uFF09", "reducer"],
  ["reducerModel", "string", "", "\u7EA6\u7B80\u6A21\u578B\uFF08\u7559\u7A7A\u4F7F\u7528\u5BBF\u4E3B\u9ED8\u8BA4\uFF09", "reducer"],
  ["reducerMaxTokens", "integer", 2048, "\u7EA6\u7B80\u8F93\u51FA token \u4E0A\u9650", "reducer", 256, 8192],
  ["nativeSearch", "boolean", true, "\u65E0\u5BC6\u94A5\u641C\u7D22", "retrieval"],
  ["nativeSearchProviders", "providers", ["bing-html", "brave-html", "duckduckgo-html"], "\u641C\u7D22\u6765\u6E90\uFF08\u9017\u53F7\u5206\u9694\uFF09", "retrieval"],
  ["nativeSearchMaxResults", "integer", 8, "\u6BCF\u6B21\u641C\u7D22\u7ED3\u679C\u4E0A\u9650", "retrieval", 1, 12],
  ["nativeSearchTimeoutMs", "integer", 15e3, "\u641C\u7D22\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09", "retrieval", 1e3, 3e4],
  ["nativeFetch", "boolean", true, "\u516C\u5F00\u7F51\u9875\u6293\u53D6", "retrieval"],
  ["nativeFetchAllowedHosts", "hosts", [], "\u5141\u8BB8\u4E3B\u673A\uFF08\u9017\u53F7\u5206\u9694\uFF1B\u7A7A\u8868\u793A\u516C\u5F00\u4E3B\u673A\uFF09", "retrieval"],
  ["nativeFetchTimeoutMs", "integer", 15e3, "\u6293\u53D6\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09", "retrieval", 1e3, 3e4],
  ["nativeFetchMaxBytes", "integer", 2e6, "\u6293\u53D6\u5B57\u8282\u4E0A\u9650", "retrieval", 1024, 2e6],
  ["nativeFetchMaxChars", "integer", 6e3, "\u6458\u5F55\u5B57\u7B26\u4E0A\u9650", "retrieval", 256, 12e3],
  ["nativeFetchRobots", "boolean", true, "\u9075\u5B88 robots.txt", "retrieval"],
  ["skillsEnabled", "boolean", true, "\u542F\u7528\u6280\u80FD", "skills"],
  ["skillsMode", "enum", "core", "\u6280\u80FD\u52A0\u8F7D\u8303\u56F4", "skills", ["core", "expanded"]],
  ["evidenceGate", "boolean", true, "\u8BC1\u636E\u95E8", "skills"],
  ["taskPolicyMode", "enum", "structured", "\u4EFB\u52A1\u7B56\u7565", "skills", ["structured", "strict"]],
  ["memoryEnabled", "boolean", true, "\u663E\u5F0F\u8BB0\u5FC6\u5DE5\u5177", "memory"]
].map(([key, type, defaultValue, label, group, min, max]) => ({ key, type, defaultValue, label, group, ...type === "enum" ? { choices: min } : { min, max } }));
function validateSettings(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "body-not-an-object" };
  const value = {};
  for (const [key, item] of Object.entries(raw)) {
    const field = SETTING_FIELDS.find((field2) => field2.key === key);
    if (!field) return { ok: false, reason: `unknown-key:${key}` };
    let valid = false;
    if (field.type === "boolean") valid = typeof item === "boolean";
    else if (["integer", "number"].includes(field.type)) valid = typeof item === "number" && Number.isFinite(item) && item >= field.min && (field.max === void 0 || item <= field.max) && (field.type !== "integer" || Number.isInteger(item));
    else if (field.type === "enum") valid = field.choices.includes(item);
    else if (field.type === "string") valid = typeof item === "string" && item.length <= 160 && !/[\r\n\0]/.test(item);
    else if (field.type === "providers") valid = Array.isArray(item) && item.length > 0 && item.length <= 3 && new Set(item).size === item.length && item.every((v) => ["bing-html", "brave-html", "duckduckgo-html"].includes(v));
    else if (field.type === "hosts") valid = Array.isArray(item) && item.length <= 64 && item.every((v) => typeof v === "string" && v.length <= 253 && /^(?:\*\.)?[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(v));
    if (!valid) return { ok: false, reason: field.type === "boolean" ? `${key}-must-be-boolean` : field.type === "number" ? `${key}-must-be-a-finite-non-negative-number` : `${key}-invalid-${field.type}` };
    value[key] = item;
  }
  return { ok: true, value };
}

// src/client/LogPanel.jsx
var import_react6 = require("react");
var import_dsh_client_ui_primitives4 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/log-presentation.mjs
var mechanismLabels = { runtime: "\u8FD0\u884C\u65F6", af: "AF", op: "OP", epr: "EPR", occ: "OCC", search: "\u68C0\u7D22", fetch: "\u6293\u53D6", memory: "\u8BB0\u5FC6", improvement: "\u6539\u8FDB", browser: "\u6D4F\u89C8\u5668" };
var levelLabels = { info: "\u4FE1\u606F", warn: "\u8B66\u544A", error: "\u9519\u8BEF" };
var reasonLabels = {
  "browser-completed": "\u6D4F\u89C8\u5668\u64CD\u4F5C\u7ED3\u675F\uFF0C\u4EFB\u52A1\u7ED3\u679C\u4EE5\u52A8\u4F5C\u540E\u9A8C\u4E3A\u51C6",
  "browser-failed": "\u6D4F\u89C8\u5668\u64CD\u4F5C\u5931\u8D25\u6216\u540E\u9A8C\u4E0D\u4E00\u81F4",
  "browser-no-progress": "\u91CD\u590D\u64CD\u4F5C\u672A\u53D6\u5F97\u8FDB\u5C55",
  "command-succeeded": "\u547D\u4EE4\u6267\u884C\u6210\u529F",
  "command-failed": "\u547D\u4EE4\u8FD4\u56DE\u975E\u96F6\u9000\u51FA\u7801",
  "command-unverified": "\u5C1A\u672A\u6838\u9A8C\u6267\u884C\u7ED3\u679C",
  "target-changed": "\u76EE\u6807\u5DE5\u5177\u5DF2\u53D8\u5316",
  "no-shell": "\u5F53\u524D\u7EC4\u5408\u6CA1\u6709\u53EF\u7528\u7684 Shell",
  "no-tools": "\u5DE5\u5177\u670D\u52A1\u4E0D\u53EF\u7528",
  "packed": "\u539F\u6587\u5DF2\u5F52\u6863\uFF0C\u53EF\u6309\u53E5\u67C4\u53EC\u56DE",
  "recalled": "\u5DF2\u8BFB\u53D6\u5F52\u6863\u4E2D\u7684\u539F\u6587\u7247\u6BB5",
  "retained": "\u5DF2\u4FDD\u7559\u53EF\u6838\u5BF9\u7684\u5173\u952E\u5F15\u7528",
  "likely-secret": "\u68C0\u6D4B\u5230\u53EF\u80FD\u7684\u51ED\u636E\uFF0C\u4FDD\u7559\u539F\u59CB\u7ED3\u679C",
  "plan-boundary": "\u8BA1\u5212\u6B65\u9AA4\u5B8C\u6210\uFF0C\u8FDB\u5165\u8BC4\u4F30\u8FB9\u754C",
  "plan-complete": "\u8BA1\u5212\u5DF2\u5B8C\u6210",
  "non-positive-saving": "\u9884\u4F30\u8282\u7701\u4E0D\u8DB3\uFF0C\u4FDD\u6301\u5F53\u524D\u4E0A\u4E0B\u6587",
  "horizon-unavailable": "\u4EFB\u52A1\u89C6\u754C\u4E0D\u8DB3\uFF0C\u6682\u4E0D\u538B\u7F29",
  "deferred-breakeven": "\u5C1A\u672A\u8FBE\u5230\u538B\u7F29\u76C8\u4E8F\u5E73\u8861\u70B9",
  "deferred-debt": "\u7B49\u5F85\u5DF2\u6709\u538B\u7F29\u6210\u672C\u56DE\u6536",
  "window-pressure": "\u4E0A\u4E0B\u6587\u63A5\u8FD1\u7A97\u53E3\u4E0A\u9650",
  "economic": "\u9884\u8BA1\u53EF\u56DE\u6536\u538B\u7F29\u6210\u672C",
  "economic-first": "\u9996\u6B21\u538B\u7F29\u9884\u8BA1\u53EF\u8282\u7701\u6210\u672C",
  "compact-noop": "\u6B64\u6B21\u538B\u7F29\u6CA1\u6709\u4EA7\u751F\u53D8\u66F4",
  "compacted": "\u4E0A\u4E0B\u6587\u5DF2\u538B\u7F29",
  "continuation": "\u538B\u7F29\u540E\u7EE7\u7EED\u4EFB\u52A1",
  "scope-changed": "Agent \u5DF2\u5207\u6362",
  "agent-scope-changed": "Agent \u5DF2\u5207\u6362",
  "no-results": "\u6CA1\u6709\u627E\u5230\u7ED3\u679C",
  "provider-partial": "\u90E8\u5206 provider \u53EF\u7528",
  "all-providers-failed": "\u6240\u6709 provider \u5747\u5931\u8D25",
  "fetch-started": "\u5F00\u59CB\u6293\u53D6\u516C\u5F00\u9875\u9762",
  "fetch-completed": "\u516C\u5F00\u9875\u9762\u6293\u53D6\u5B8C\u6210",
  "invalid-url": "\u5730\u5740\u65E0\u6548",
  "invalid-option": "\u6293\u53D6\u53C2\u6570\u65E0\u6548",
  "ssrf-blocked": "\u5730\u5740\u89E3\u6790\u5230\u672C\u673A\u6216\u4FDD\u7559\u7F51\u7EDC",
  "host-not-allowed": "\u57DF\u540D\u4E0D\u5728\u5141\u8BB8\u8303\u56F4",
  "dns-failed": "\u57DF\u540D\u89E3\u6790\u5931\u8D25",
  "robots-denied": "robots.txt \u7981\u6B62\u6293\u53D6",
  "robots-unavailable": "\u65E0\u6CD5\u786E\u8BA4 robots.txt",
  "response-too-large": "\u54CD\u5E94\u8D85\u8FC7\u5927\u5C0F\u4E0A\u9650",
  "unsupported-content-type": "\u5185\u5BB9\u7C7B\u578B\u4E0D\u53D7\u652F\u6301",
  "empty-content": "\u9875\u9762\u6CA1\u6709\u53EF\u8BFB\u6587\u672C",
  "transport-error": "\u7F51\u7EDC\u4F20\u8F93\u5931\u8D25",
  "http-error": "\u9875\u9762\u8FD4\u56DE HTTP \u9519\u8BEF",
  "memory-started": "\u5F00\u59CB\u8BB0\u5FC6\u64CD\u4F5C",
  "memory-completed": "\u8BB0\u5FC6\u64CD\u4F5C\u5B8C\u6210",
  "memory-failed": "\u8BB0\u5FC6\u64CD\u4F5C\u5931\u8D25",
  "improvement-started": "\u5F00\u59CB\u8BB0\u5F55\u6539\u8FDB",
  "improvement-completed": "\u6539\u8FDB\u8BB0\u5F55\u5B8C\u6210",
  "improvement-failed": "\u6539\u8FDB\u8BB0\u5F55\u5931\u8D25",
  "state-update-failed": "\u72B6\u6001\u5199\u5165\u5931\u8D25\uFF0C\u4E3B\u4EFB\u52A1\u7EE7\u7EED",
  "evaluation-failed": "\u8BC4\u4F30\u5931\u8D25\uFF0C\u672C\u6B21\u4E0D\u538B\u7F29",
  "compact-failed": "\u538B\u7F29\u5931\u8D25\uFF0C\u4FDD\u7559\u539F\u59CB\u4E0A\u4E0B\u6587",
  "archive-failed": "\u539F\u6587\u5F52\u6863\u5931\u8D25",
  "recall-failed": "\u539F\u6587\u53EC\u56DE\u5931\u8D25",
  "enabled": "\u673A\u5236\u5DF2\u542F\u7528"
};
var eventTitles = {
  browser: { success: "\u6D4F\u89C8\u5668\u64CD\u4F5C\u8BB0\u5F55", failure: "\u6D4F\u89C8\u5668\u64CD\u4F5C\u672A\u901A\u8FC7" },
  runtime: { loaded: "\u8FD0\u884C\u65F6\u5DF2\u5C31\u7EEA", decision: "\u8FD0\u884C\u65F6\u68C0\u67E5", failure: "\u8FD0\u884C\u65F6\u5F02\u5E38" },
  search: { start: "\u5F00\u59CB\u68C0\u7D22", success: "\u68C0\u7D22\u5B8C\u6210", failure: "\u68C0\u7D22\u5931\u8D25" },
  fetch: { start: "\u5F00\u59CB\u6293\u53D6\u516C\u5F00\u9875\u9762", success: "\u9875\u9762\u6293\u53D6\u5B8C\u6210", failure: "\u9875\u9762\u6293\u53D6\u5931\u8D25" },
  memory: { start: "\u5F00\u59CB\u8BB0\u5FC6\u64CD\u4F5C", success: "\u8BB0\u5FC6\u64CD\u4F5C\u5B8C\u6210", failure: "\u8BB0\u5FC6\u64CD\u4F5C\u5931\u8D25" },
  improvement: { start: "\u5F00\u59CB\u8BB0\u5F55\u6539\u8FDB", success: "\u6539\u8FDB\u8BB0\u5F55\u5B8C\u6210", failure: "\u6539\u8FDB\u8BB0\u5F55\u5931\u8D25", decision: "\u6539\u8FDB\u51B3\u5B9A\u5DF2\u8BB0\u5F55", rollback: "\u6539\u8FDB\u5DF2\u56DE\u6EDA" },
  af: { start: "\u5F00\u59CB\u63A5\u7EED\u6267\u884C", success: "\u63A5\u7EED\u6267\u884C\u5B8C\u6210", failure: "\u63A5\u7EED\u6267\u884C\u5931\u8D25", skipped: "\u5DF2\u8DF3\u8FC7\u63A5\u7EED\u6267\u884C", inactive: "\u63A5\u7EED\u6267\u884C\u4E0D\u53EF\u7528" },
  op: { packed: "\u5927\u8F93\u51FA\u5DF2\u5F52\u6863", recall: "\u539F\u6587\u7247\u6BB5\u5DF2\u53EC\u56DE", failure: "\u5F52\u6863\u5904\u7406\u5F02\u5E38" },
  epr: { decision: "\u8BC1\u636E\u7EA6\u7B80\u8BC4\u4F30", failure: "\u8BC1\u636E\u7EA6\u7B80\u5F02\u5E38" },
  occ: { boundary: "\u5230\u8FBE\u8BA1\u5212\u8FB9\u754C", decision: "\u4E0A\u4E0B\u6587\u538B\u7F29\u8BC4\u4F30", start: "\u5F00\u59CB\u538B\u7F29\u4E0A\u4E0B\u6587", success: "\u4E0A\u4E0B\u6587\u538B\u7F29\u5B8C\u6210", noop: "\u4E0A\u4E0B\u6587\u4FDD\u6301\u4E0D\u53D8", failure: "\u4E0A\u4E0B\u6587\u538B\u7F29\u5F02\u5E38", continued: "\u4EFB\u52A1\u7EE7\u7EED\u6267\u884C", skipped: "\u5DF2\u8DF3\u8FC7\u4E0A\u4E0B\u6587\u538B\u7F29" }
};
function logTitle(entry) {
  if (entry.mechanism === "epr" && entry.reason === "retained") return "\u5173\u952E\u8BC1\u636E\u5DF2\u4FDD\u7559";
  return eventTitles[entry.mechanism]?.[entry.event] ?? "\u673A\u5236\u8FD0\u884C\u8BB0\u5F55";
}
var logReason = (entry) => reasonLabels[entry.reason] ?? "\u67E5\u770B\u8BE6\u60C5\u4E86\u89E3\u672C\u6B21\u673A\u5236\u51B3\u7B56";
var logTone = (entry) => entry.level === "error" ? "error" : entry.level === "warn" ? "warn" : entry.event === "success" ? "success" : void 0;
var logTime = (value) => new Date(value).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
function formatBytes(value) {
  if (!Number.isFinite(value)) return null;
  return value >= 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(1)} MB` : value >= 1024 ? `${(value / 1024).toFixed(1)} KB` : `${value} B`;
}
function formatElapsed(value) {
  return Number.isFinite(value) ? value >= 1e3 ? `${(value / 1e3).toFixed(2)} \u79D2` : `${value} ms` : null;
}
function logFacts(entry) {
  const fields = [
    ["\u6267\u884C\u7ED3\u679C", Number.isInteger(entry.exitCode) ? `\u9000\u51FA\u7801 ${entry.exitCode}` : null],
    ["\u8017\u65F6", formatElapsed(entry.elapsedMs)],
    ["\u539F\u6587\u5927\u5C0F", formatBytes(entry.sourceBytes)],
    ["\u7ED3\u679C\u5927\u5C0F", formatBytes(entry.resultBytes)],
    ["\u4FDD\u7559\u5F15\u7528", Number.isFinite(entry.evidenceItems) ? `${entry.evidenceItems} \u6761` : null],
    ["\u5904\u7406\u65B9\u5F0F", entry.routeKind === "local" ? "\u672C\u5730\u63D0\u53D6" : entry.routeKind === "model" ? "\u6A21\u578B\u7EA6\u7B80" : null],
    ["\u538B\u7F29\u524D tokens", entry.contextTokens],
    ["\u538B\u7F29\u540E tokens", entry.afterTokens],
    ["\u4F30\u8BA1\u8282\u7701 tokens", entry.estimatedSaving],
    ["\u5B9E\u9645\u8282\u7701 tokens", entry.measuredSaving],
    ["\u4FDD\u7559 tokens", entry.keepRecentTokens],
    ["\u5269\u4F59\u6B65\u9AA4", entry.remaining],
    ["\u7D2F\u8BA1\u8BF7\u6C42", entry.requests],
    ["\u538B\u7F29\u503A\u52A1 tokens", entry.carriedDebtTokens],
    ["\u539F\u6587\u884C\u6570", entry.lines],
    ["\u5206\u9875\u504F\u79FB", entry.offset],
    ["\u4E0B\u9875\u504F\u79FB", entry.nextOffset],
    ["\u7ED3\u679C\u6570", entry.resultCount],
    ["\u53EF\u7528 provider", entry.providerCount],
    ["\u5931\u8D25 provider", entry.failedProviderCount],
    ["\u8F93\u5165 tokens", entry.usage?.inputTokens],
    ["\u8F93\u51FA tokens", entry.usage?.outputTokens],
    ["\u7F13\u5B58\u8BFB\u53D6 tokens", entry.usage?.cacheReadTokens],
    ["\u7F13\u5B58\u5199\u5165 tokens", entry.usage?.cacheWriteTokens]
  ];
  return fields.filter(([, value]) => value !== void 0 && value !== null);
}
function matchesLog(entry, { mechanism = "all", level = "all", query = "" } = {}) {
  return (mechanism === "all" || entry.mechanism === mechanism) && (level === "all" || entry.level === level) && (!query.trim() || [logTitle(entry), logReason(entry), entry.reason, entry.event, entry.mechanism, entry.callIdHash, entry.rootCallIdHash, entry.commandHash, entry.source, entry.handle, entry.errorCode].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
}

// src/client/LogPanel.jsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function LogDetail({ entry }) {
  const facts = logFacts(entry);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: "pw-log-detail", "aria-label": "\u6240\u9009\u65E5\u5FD7\u8BE6\u60C5", id: "pw-log-detail", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { children: logTitle(entry) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { className: "pw-muted", children: [
      mechanismLabels[entry.mechanism] ?? entry.mechanism,
      " \xB7 ",
      levelLabels[entry.level] ?? entry.level,
      " \xB7 ",
      logTime(entry.at)
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "pw-log-reason", children: logReason(entry) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CopyButton, { label: "\u590D\u5236\u65E5\u5FD7\u5143\u6570\u636E", value: JSON.stringify(entry, null, 2) }),
    facts.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dl", { className: "pw-facts", children: facts.map(([label, value]) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dt", { children: label }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dd", { className: "pw-mono", children: value })
    ] }, label)) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(TechnicalDetails, { title: "\u5173\u8054\u6307\u7EB9\u4E0E\u539F\u59CB\u5143\u6570\u636E", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("dl", { className: "pw-facts", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dt", { children: "\u5BBF\u4E3B\u5E8F\u53F7" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dd", { children: entry.seq == null ? "\u5185\u5B58\u8BB0\u5F55" : entry.seq })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dt", { children: "\u539F\u56E0\u7801" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dd", { children: entry.reason })
        ] }),
        Object.entries({ callIdHash: "\u8C03\u7528\u6307\u7EB9", rootCallIdHash: "\u6839\u8C03\u7528\u6307\u7EB9", commandHash: "\u547D\u4EE4\u6307\u7EB9", source: "\u539F\u6587 SHA256", handle: "\u5F52\u6863\u53E5\u67C4" }).filter(([key]) => entry[key]).map(([key, label]) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dt", { children: label }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dd", { children: entry[key] })
        ] }, key))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("pre", { children: JSON.stringify(entry, null, 2) })
    ] })
  ] });
}
function LogPanel({ diagnostics, exportLogs, connected }) {
  const [mechanism, setMechanism] = (0, import_react6.useState)("all");
  const [level, setLevel] = (0, import_react6.useState)("all");
  const [query, setQuery] = (0, import_react6.useState)("");
  const [selectedId, setSelectedId] = (0, import_react6.useState)(null);
  const [message, setMessage] = (0, import_react6.useState)("");
  const [exporting, setExporting] = (0, import_react6.useState)(false);
  const [frozen, setFrozen] = (0, import_react6.useState)(null), [order, setOrder] = (0, import_react6.useState)("newest");
  const entries = [...frozen ?? diagnostics?.entries ?? []].sort((a, b) => (String(b.at).localeCompare(String(a.at)) || (b.seq ?? 0) - (a.seq ?? 0)) * (order === "newest" ? 1 : -1));
  const occurrences = /* @__PURE__ */ new Map();
  const visible = entries.map((entry) => {
    const identity = entry.seq != null ? `seq-${entry.seq}` : JSON.stringify(entry);
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    return { entry, id: identity + "-" + occurrence };
  }).filter(({ entry }) => matchesLog(entry, { mechanism, level, query }));
  const selected = visible.find((row) => row.id === selectedId) ?? visible[0];
  const persistence = diagnostics?.persistence;
  const native = persistence === "native";
  async function download() {
    setExporting(true);
    setMessage("");
    try {
      const data = await exportLogs();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "patchwork-diagnostics.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1e3);
      setMessage("\u5DF2\u5BFC\u51FA\u5F53\u524D\u4F1A\u8BDD\u7684\u8BCA\u65AD\u5143\u6570\u636E\u3002");
    } catch {
      setMessage("\u5BFC\u51FA\u5931\u8D25\u6216\u6388\u6743\u5DF2\u64A4\u9500\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002");
    } finally {
      setExporting(false);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "pw-page-heading pw-heading-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h2", { children: "\u8FD0\u884C\u65E5\u5FD7" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: "\u67E5\u770B\u673A\u5236\u51B3\u7B56\uFF0C\u5B9A\u4F4D\u6267\u884C\u4E2D\u7684\u95EE\u9898\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives4.Button, { size: "sm", variant: "outline", icon: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(PanelIcon, { name: "download" }), "aria-label": "\u5BFC\u51FA\u8BCA\u65AD\u5143\u6570\u636E", disabled: !connected || exporting, onClick: download, children: exporting ? "\u5BFC\u51FA\u4E2D\u2026" : "\u5BFC\u51FA" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SummaryStrip, { label: "\u65E5\u5FD7\u9884\u89C8\u7EDF\u8BA1", items: [{ label: "\u5F53\u524D\u9884\u89C8", value: entries.length }, { label: "\u9519\u8BEF", value: entries.filter((item) => item.level === "error").length }, { label: "\u8B66\u544A", value: entries.filter((item) => item.level === "warn").length }] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: "pw-card pw-log-controls", "aria-label": "\u65E5\u5FD7\u7B5B\u9009", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "pw-search", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(PanelIcon, { name: "search" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives.Input, { type: "search", "aria-label": "\u641C\u7D22\u65E5\u5FD7", placeholder: "\u641C\u7D22\u4E8B\u4EF6\u3001\u539F\u56E0\u6216\u6307\u7EB9", value: query, onChange: (event) => setQuery(event.target.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "pw-toolbar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Select, { "aria-label": "\u65E5\u5FD7\u7EA7\u522B", value: level, onChange: setLevel, options: [{ value: "all", label: "\u5168\u90E8\u7EA7\u522B" }, ...Object.entries(levelLabels).map(([value, label]) => ({ value, label }))] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Select, { "aria-label": "\u65E5\u5FD7\u673A\u5236", value: mechanism, onChange: setMechanism, options: [{ value: "all", label: "\u5168\u90E8\u673A\u5236" }, ...Object.entries(mechanismLabels).map(([value, label]) => ({ value, label }))] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Select, { "aria-label": "\u65E5\u5FD7\u6392\u5E8F", value: order, onChange: setOrder, options: [{ value: "newest", label: "\u6700\u65B0\u5728\u524D" }, { value: "oldest", label: "\u6700\u65E9\u5728\u524D" }] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives4.Button, { size: "sm", variant: "ghost", "aria-pressed": Boolean(frozen), onClick: () => setFrozen(frozen ? null : entries), children: frozen ? "\u7EE7\u7EED\u5B9E\u65F6\u9884\u89C8" : "\u6682\u505C\u5B9E\u65F6\u9884\u89C8" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Facets, { label: "\u65E5\u5FD7\u5FEB\u6377\u7EA7\u522B", value: level, onChange: setLevel, items: [{ value: "all", label: "\u5168\u90E8" }, { value: "error", label: "\u9519\u8BEF" }, { value: "warn", label: "\u8B66\u544A" }] }),
    frozen && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "pw-live-note", role: "status", children: "\u5217\u8868\u5DF2\u51BB\u7ED3\uFF0C\u540E\u53F0\u7EE7\u7EED\u8BB0\u5F55\u3002\u5BFC\u51FA\u4ECD\u8BFB\u53D6\u670D\u52A1\u7AEF\u5F53\u524D\u9884\u89C8\uFF0C\u4E0D\u53D7\u51BB\u7ED3\u4E0E\u7B5B\u9009\u5F71\u54CD\u3002" }),
    selected?.entry.rootCallIdHash && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives4.Button, { size: "sm", variant: "ghost", onClick: () => {
      setMechanism("all");
      setLevel("all");
      setQuery(selected.entry.rootCallIdHash);
    }, children: "\u53EA\u770B\u6240\u9009\u6839\u8C03\u7528" }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "pw-master-detail pw-log-workbench", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: "pw-card", "aria-label": "\u65E5\u5FD7\u5217\u8868", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "pw-list-meta", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            visible.length,
            " \u6761\u8BB0\u5F55",
            visible.length !== entries.length ? ` / \u5171 ${entries.length} \u6761` : ""
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "pw-storage", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "pw-dot", "data-tone": native ? "success" : "warn" }),
            native ? "\u5DF2\u5199\u5165\u4F1A\u8BDD" : persistence === "failed" ? "\u5199\u5165\u5931\u8D25 \xB7 \u5185\u5B58\u4FDD\u7559" : "\u4EC5\u672C\u6B21\u8FD0\u884C"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "pw-log-list", "aria-label": "\u65E5\u5FD7\u8BB0\u5F55", children: visible.length ? visible.map(({ entry, id }) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", className: "pw-log-row", "aria-pressed": selected.id === id, "aria-controls": "pw-log-detail", onClick: () => setSelectedId(id), children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("time", { dateTime: entry.at, children: logTime(entry.at) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "pw-log-level", "data-tone": logTone(entry), children: String(entry.level ?? "\u672A\u77E5").toUpperCase() }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: logTitle(entry) })
        ] }, id)) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyState, { title: entries.length ? "\u6CA1\u6709\u5339\u914D\u7684\u8BB0\u5F55" : "\u8FD8\u6CA1\u6709\u8FD0\u884C\u8BB0\u5F55", children: entries.length ? "\u8BD5\u8BD5\u5176\u4ED6\u673A\u5236\u3001\u7EA7\u522B\u6216\u641C\u7D22\u5173\u952E\u8BCD\u3002" : "\u6267\u884C\u4EFB\u52A1\u540E\uFF0C\u673A\u5236\u51B3\u7B56\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002" }) })
      ] }),
      selected && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(LogDetail, { entry: selected.entry })
    ] }),
    message && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "pw-live-note", role: "status", children: message }),
    diagnostics?.failures > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { className: "pw-warning", role: "status", children: [
      "\u539F\u751F\u5199\u5165\u5931\u8D25 ",
      diagnostics.failures,
      " \u6B21\uFF0C\u672A\u5199\u5165\u7684\u8BB0\u5F55\u4EC5\u4FDD\u7559\u5728\u672C\u6B21\u8FD0\u884C\u4E2D\u3002"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(TechnicalDetails, { title: "\u8BB0\u5F55\u8303\u56F4\u4E0E\u9690\u79C1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { children: [
        "\u6700\u591A\u663E\u793A\u6700\u8FD1 ",
        diagnostics?.limit ?? 200,
        " \u6761\u3002\u9996\u6B21\u6062\u590D\u68C0\u67E5\u5C3E\u90E8 ",
        diagnostics?.historyScanLimit ?? 5e3,
        " \u4E2A\u5BBF\u4E3B\u4E8B\u4EF6\uFF0C\u8F83\u65E9\u8BB0\u5F55\u53EF\u80FD\u4E0D\u51FA\u73B0\u5728\u6B64\u5217\u8868\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { children: [
        native ? "\u8BCA\u65AD\u4FDD\u5B58\u4E8E DSH \u539F\u751F\u4F1A\u8BDD\u3002" : persistence === "failed" ? "\u539F\u751F\u5199\u5165\u5931\u8D25\uFF0C\u76EE\u524D\u4F7F\u7528\u6709\u754C\u5185\u5B58\u8BB0\u5F55\u3002" : "\u5F53\u524D\u5BBF\u4E3B\u672A\u63D0\u4F9B\u53EF\u7528\u7684\u539F\u751F\u63D2\u4EF6\u8BB0\u5F55\uFF0C\u91CD\u542F\u540E\u5185\u5B58\u8BB0\u5F55\u4E0D\u53EF\u6062\u590D\u3002",
        "\u5BFC\u51FA\u8303\u56F4\u4E0E\u9884\u89C8\u4E00\u81F4\uFF0C\u4E0D\u53D7\u5F53\u524D\u7B5B\u9009\u5F71\u54CD\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: "\u53EA\u8BB0\u5F55\u767D\u540D\u5355\u5143\u6570\u636E\uFF1B\u547D\u4EE4\u4E0E\u8C03\u7528 ID \u4F7F\u7528 SHA256 \u6307\u7EB9\u3002\u4E0D\u5305\u542B\u63D0\u793A\u8BCD\u6216\u539F\u6587\u8BC1\u636E\uFF0C\u5B8C\u6574\u539F\u6587\u4ECD\u7531\u8BC1\u636E\u5F52\u6863\u4FDD\u7559\u3002" })
    ] })
  ] });
}

// src/client/WorkspacePanels.jsx
var import_dsh_client_ui_primitives13 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/ImprovementPanel.jsx
var import_react7 = require("react");
var import_dsh_client_ui_primitives5 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime6 = require("react/jsx-runtime");
var decisionLabels = { proposed: "\u5F85\u9A8C\u8BC1", trial: "\u8BD5\u7528\u4E2D", enabled: "\u5DF2\u786E\u8BA4", revoked: "\u5DF2\u56DE\u6EDA" };
var latencyText = (value) => Number.isFinite(value) && value >= 0 ? Math.round(value) : "\u672A\u77E5";
function ImprovementPanel({ data, improvementAction }) {
  const [busy, setBusy] = (0, import_react7.useState)(null), [message, setMessage] = (0, import_react7.useState)("");
  const [query, setQuery] = (0, import_react7.useState)(""), [filter, setFilter] = (0, import_react7.useState)("all");
  const state = data.improvements ?? { candidates: [], incidents: [], experiments: [] };
  const fullReview = state.policy?.reviewDetail === "full";
  const visible = state.candidates.filter((candidate) => (filter === "all" || improvementBucket(candidate) === filter) && textMatches(query, candidate.trigger, candidate.hypothesis, candidate.patch?.setting, candidate.id));
  async function act(action, id) {
    setBusy(id);
    setMessage("");
    try {
      await improvementAction(action, id, state.revision);
      setMessage(action === "experiment" ? "\u9694\u79BB\u5951\u7EA6\u5B9E\u9A8C\u7ED3\u675F\uFF0C\u67E5\u770B\u8BC1\u636E\u4E0E\u51C6\u5165\u7ED3\u679C\u3002" : action === "rollback" ? "\u5F53\u524D\u4F1A\u8BDD\u7B56\u7565\u5DF2\u56DE\u6EDA\u3002" : action === "propose" ? "\u5DF2\u751F\u6210\u5F85\u5BA1\u5019\u9009\uFF1B\u5C1A\u672A\u6539\u53D8\u8FD0\u884C\u884C\u4E3A\u3002" : "\u7B56\u7565\u5DF2\u5E94\u7528\u4E8E\u5F53\u524D\u4F1A\u8BDD\uFF0C\u5176\u4ED6\u4F1A\u8BDD\u4FDD\u6301\u539F\u72B6\u6001\u3002");
    } catch (error) {
      setMessage(`\u672A\u5B8C\u6210\uFF1A${error.message}\u3002\u5237\u65B0\u6838\u5BF9\u7248\u672C\u540E\u91CD\u8BD5\u3002`);
    } finally {
      setBusy(null);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-page-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { children: "\u6539\u8FDB\u5BA1\u67E5" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u5B9E\u9645\u5931\u8D25\u6216\u7EA0\u6B63 \u2192 \u5019\u9009 \u2192 \u9694\u79BB\u5B9E\u9A8C \u2192 \u4F60\u786E\u8BA4 \u2192 \u5F53\u524D\u4F1A\u8BDD\u5E94\u7528\uFF1B\u968F\u65F6\u56DE\u6EDA\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SummaryStrip, { label: "\u6539\u8FDB\u7EDF\u8BA1", items: [{ label: "\u5B9E\u9645\u95EE\u9898", value: state.incidents.length }, { label: "\u5F85\u5BA1\u5019\u9009", value: state.candidates.filter((item) => improvementBucket(item) === "pending").length }, { label: "\u5F53\u524D\u751F\u6548", value: state.candidates.filter((item) => item.applied).length }, { label: "\u5DF2\u56DE\u6EDA", value: state.candidates.filter((item) => item.decision === "revoked").length }] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SearchField, { label: "\u641C\u7D22\u6539\u8FDB\u5019\u9009", value: query, onChange: setQuery, placeholder: "\u641C\u7D22\u95EE\u9898\u3001\u5047\u8BBE\u6216\u7B56\u7565\u8BBE\u7F6E" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Facets, { label: "\u6539\u8FDB\u72B6\u6001\u7B5B\u9009", value: filter, onChange: setFilter, items: [{ value: "all", label: "\u5168\u90E8" }, { value: "pending", label: "\u5F85\u5BA1" }, { value: "applied", label: "\u751F\u6548\u4E2D" }, { value: "revoked", label: "\u5DF2\u56DE\u6EDA" }] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "pw-live-note", children: fullReview ? "\u8BF7\u6838\u5BF9\u6765\u6E90\u3001\u7248\u672C\u3001\u5B9E\u9A8C\u5DEE\u5F02\u3001\u9000\u5316\u4E0E\u526F\u4F5C\u7528\uFF0C\u518D\u51B3\u5B9A\u662F\u5426\u5E94\u7528\uFF1B\u53EF\u968F\u65F6\u56DE\u6EDA\u3002" : "\u6838\u5BF9\u8BC1\u636E\u540E\u786E\u8BA4\uFF0C\u5FC5\u8981\u65F6\u56DE\u6EDA\u3002" }),
    visible.length ? visible.map((candidate) => {
      const experiment = [...state.experiments].reverse().find((item) => item.candidateId === candidate.id);
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("article", { className: "pw-candidate", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-heading-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { children: candidate.trigger }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(RecordStatus, { tone: candidate.applied ? "success" : void 0, children: candidate.applied ? "\u5F53\u524D\u751F\u6548" : decisionLabels[candidate.decision] ?? candidate.decision })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "pw-body-copy", children: candidate.hypothesis }),
        candidate.patch && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-policy-diff", "aria-label": "\u53D7\u9650\u7B56\u7565\u6539\u52A8", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: candidate.patch.setting }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { children: [
              "\u5F53\u524D ",
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("code", { children: JSON.stringify(state.policy?.[candidate.patch.setting]) ?? "\u672A\u77E5" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { children: [
              "\u5019\u9009 ",
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("code", { children: JSON.stringify(candidate.patch.value) })
            ] })
          ] })
        ] }),
        experiment && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SummaryStrip, { label: "\u9694\u79BB\u5951\u7EA6\u5BF9\u6BD4", items: [{ label: "\u57FA\u7EBF\u6B63\u786E\u6027", value: experiment.baseline?.correctness }, { label: "\u5019\u9009\u6B63\u786E\u6027", value: experiment.candidate?.correctness }, { label: "\u51C6\u5165", value: experiment.eligibleForReview ? "\u53EF\u5BA1\u6838" : "\u672A\u901A\u8FC7" }] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("dl", { className: "pw-facts", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u6539\u52A8" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dd", { children: candidate.patch ? `${candidate.patch.setting} = ${JSON.stringify(candidate.patch.value)}` : "\u5C1A\u672A\u63D0\u4F9B\u53EF\u6267\u884C\u7684\u53D7\u9650\u7B56\u7565" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u8303\u56F4" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dd", { children: "\u5F53\u524D\u4F1A\u8BDD\uFF1B\u5207\u6362 Agent \u6216\u91CD\u542F\u540E\u987B\u91CD\u65B0\u786E\u8BA4" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u56DE\u6EDA\u76EE\u6807" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dd", { children: "\u64A4\u9500\u6B64\u5019\u9009\uFF0C\u6062\u590D\u6B64\u524D\u4F1A\u8BDD\u7B56\u7565" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(TechnicalDetails, { open: fullReview, title: "\u6765\u6E90\u4E0E\u5B9E\u9A8C\u8BE6\u60C5", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: candidate.changeScope }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { children: [
            "\u6765\u6E90\uFF1A",
            candidate.sourceReceiptIds.join("\u3001")
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { children: [
            "\u5019\u9009 ",
            candidate.id
          ] }),
          candidate.incidentIds.map((id) => {
            const item = state.incidents.find((item2) => item2.id === id);
            return item ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { children: [
              item.kind,
              " \xB7 ",
              item.trigger,
              " \xB7 ",
              item.action
            ] }, id) : /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { children: [
              "\u6765\u6E90\u4E0D\u53EF\u7528\uFF1A",
              id
            ] }, id);
          }),
          experiment ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: experiment.claim }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("dl", { className: "pw-facts", children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u57FA\u7EBF / \u5019\u9009" }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("dd", { children: [
                  experiment.baseline?.correctness,
                  " / ",
                  experiment.candidate?.correctness
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u8FD0\u884C\u65F6\u95F4" }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("dd", { children: [
                  latencyText(experiment.baseline?.latency),
                  " / ",
                  latencyText(experiment.candidate?.latency),
                  " ms\uFF08\u975E\u6A21\u578B\u5EF6\u8FDF\uFF09"
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u8C03\u4F18 / \u7559\u51FA" }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("dd", { children: [
                  experiment.sets.tuning.join("\u3001"),
                  " / ",
                  experiment.sets.heldOut.join("\u3001")
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u9000\u5316" }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dd", { children: experiment.regressions.join("\u3001") || "\u5951\u7EA6\u68C0\u67E5\u672A\u53D1\u73B0" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u526F\u4F5C\u7528" }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dd", { children: experiment.sideEffects.join("\u3001") || "\u672A\u63D0\u4F9B\u8BC4\u4F30" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u51C6\u5165" }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dd", { children: experiment.eligibleForReview ? "\u53EF\u4F9B\u7528\u6237\u5BA1\u67E5" : experiment.eligibilityReasons.join("\u3001") || "\u672A\u901A\u8FC7" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u8BC1\u636E" }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("dd", { className: "pw-task-path", children: [
                  experiment.evidenceRef,
                  /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("br", {}),
                  experiment.evidenceHash
                ] })
              ] })
            ] })
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u5C1A\u672A\u6267\u884C\u9694\u79BB\u5B9E\u9A8C\u3002" })
        ] }, fullReview ? "full" : "compact"),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-actions", children: [
          !candidate.applied && candidate.patch && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives5.Button, { size: "sm", variant: "outline", disabled: busy !== null, onClick: () => act("experiment", candidate.id), children: "\u8FD0\u884C\u9694\u79BB\u5B9E\u9A8C" }),
          experiment?.eligibleForReview && !candidate.applied && candidate.decision !== "revoked" && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives5.Button, { size: "sm", variant: "outline", disabled: busy !== null, onClick: () => act("trial", candidate.id), children: "\u786E\u8BA4\u8BD5\u7528" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives5.Button, { size: "sm", variant: "primary", disabled: busy !== null, onClick: () => act("approve", candidate.id), children: "\u786E\u8BA4\u5E94\u7528" })
          ] }),
          candidate.applied && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives5.Button, { size: "sm", variant: "outline", disabled: busy !== null, onClick: () => act("rollback", candidate.id), children: "\u56DE\u6EDA\u6B64\u6539\u52A8" })
        ] })
      ] }, candidate.id);
    }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(EmptyState, { title: state.candidates.length ? "\u6CA1\u6709\u5339\u914D\u7684\u6539\u8FDB\u5019\u9009" : "\u8FD8\u6CA1\u6709\u6539\u8FDB\u5019\u9009", icon: "file", children: state.candidates.length ? "\u8C03\u6574\u641C\u7D22\u4E0E\u72B6\u6001\u7B5B\u9009\u3002" : "\u4ECE\u4E0B\u65B9\u771F\u5B9E\u95EE\u9898\u751F\u6210\u5019\u9009\uFF0C\u6216\u7531 Agent \u63D0\u51FA\u53D7\u9650\u7B56\u7565\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: "pw-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SectionHeading, { title: "\u5B9E\u9645\u95EE\u9898", description: "\u4EC5\u542B\u672C\u4F1A\u8BDD\u6709\u771F\u5B9E\u6765\u6E90\u7684\u5931\u8D25\u548C\u7EA0\u6B63\u3002" }),
      state.incidents.filter((item) => textMatches(query, item.trigger, item.kind, item.action)).map((item) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("article", { className: "pw-candidate", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { children: item.trigger }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { className: "pw-live-note", children: [
          item.kind,
          " \xB7 ",
          new Date(item.observedAt).toLocaleString()
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "pw-body-copy", children: item.action }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(TechnicalDetails, { title: "\u6765\u6E90\u56DE\u6267", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("code", { className: "pw-task-path", children: item.sourceReceiptIds.join("\n") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { children: [
            "\u72B6\u6001\uFF1A",
            item.status,
            " \xB7 \u9690\u79C1\uFF1A",
            item.privacyClass
          ] })
        ] }),
        !state.candidates.some((candidate) => candidate.incidentIds.includes(item.id)) && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives5.Button, { size: "sm", variant: "outline", disabled: busy !== null, onClick: () => act("propose", item.id), children: "\u63D0\u51FA\u4EA4\u4ED8\u590D\u6838\u63D0\u9192" })
      ] }, item.id)),
      !state.incidents.length && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "pw-muted", children: "\u5F53\u524D\u5C1A\u65E0\u771F\u5B9E\u95EE\u9898\u8BB0\u5F55\uFF0C\u4E0D\u4F1A\u4E3A\u4E86\u586B\u5145\u754C\u9762\u751F\u6210\u5019\u9009\u3002" })
    ] }),
    busy && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { role: "status", children: "\u6B63\u5728\u5904\u7406\u2026" }),
    message && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "pw-live-note", role: "status", children: message }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "pw-live-note", children: "\u53D7\u9650\u7B56\u7565\u5B9E\u9A8C\u9A8C\u8BC1\u6267\u884C\u5951\u7EA6\u4E0E\u9694\u79BB\uFF0C\u4E0D\u4EE3\u8868\u771F\u6A21\u578B\u8D28\u91CF\u63D0\u5347\uFF1B\u81EA\u7531\u6587\u672C\u89C4\u5219\u4E0D\u80FD\u76F4\u63A5\u6267\u884C\u3002" })
  ] });
}

// src/client/MemoryPanel.jsx
var import_react8 = require("react");
var import_dsh_client_ui_primitives6 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime7 = require("react/jsx-runtime");
var scopeLabels = { "session-private": "\u672C\u4F1A\u8BDD\u79C1\u6709", "project-shared": "\u5F53\u524D\u9879\u76EE\u5171\u4EAB", all: "\u672C\u4F1A\u8BDD\u4E0E\u5F53\u524D\u9879\u76EE" };
var statusLabels = { all: "\u5168\u90E8\u72B6\u6001", proposed: "\u5F85\u786E\u8BA4", active: "\u5DF2\u786E\u8BA4", superseded: "\u5386\u53F2\u7248\u672C", revoked: "\u5DF2\u9057\u5FD8" };
var validityLabels = { all: "\u5168\u90E8\u6709\u6548\u6027", fresh: "\u5DF2\u6838\u5B9E", stale: "\u6682\u505C\u53EC\u56DE", conflicted: "\u5B58\u5728\u51B2\u7A81", expired: "\u5DF2\u8FC7\u671F", unsupported: "\u5C1A\u672A\u9A8C\u8BC1" };
var recallLabel = (record) => record.status === "active" ? record.validity === "fresh" ? "\u53EF\u6309\u9700\u53EC\u56DE" : validityLabels[record.validity] : "\u4E0D\u53C2\u4E0E\u53EC\u56DE";
var sourceLabels = { "model-proposed": "Agent \u63D0\u8BAE", "user-authored": "\u7528\u6237\u65B0\u589E", "user-revised": "\u7528\u6237\u4FEE\u8BA2" };
var actionLabels = { proposed: "\u521B\u5EFA\u63D0\u6848", "revised-proposal": "\u63D0\u4EA4\u4FEE\u8BA2", confirmed: "\u7528\u6237\u786E\u8BA4", superseded: "\u88AB\u65B0\u7248\u672C\u66FF\u4EE3", forgotten: "\u9057\u5FD8", "validity-changed": "\u66F4\u65B0\u53EC\u56DE\u72B6\u6001" };
var errorLabels = {
  MEMORY_REVISION_CONFLICT: "\u8BB0\u5F55\u5DF2\u88AB\u5176\u4ED6\u9875\u9762\u6216\u8FDB\u7A0B\u4FEE\u6539\u3002\u8349\u7A3F\u5DF2\u4FDD\u7559\uFF0C\u8BF7\u5237\u65B0\u5E76\u6838\u5BF9\u6700\u65B0\u7248\u672C\uFF0C\u518D\u91CD\u65B0\u6253\u5F00\u7F16\u8F91\u3002",
  MEMORY_BASE_CHANGED: "\u4FEE\u8BA2\u6240\u4F9D\u636E\u7684\u7248\u672C\u5DF2\u53D8\u5316\u6216\u88AB\u9057\u5FD8\uFF0C\u8BF7\u91CD\u65B0\u6838\u5BF9\u540E\u521B\u5EFA\u63D0\u6848\u3002",
  MEMORY_SENSITIVE_VALUE: "\u5185\u5BB9\u53EF\u80FD\u5305\u542B\u5BC6\u94A5\u3001\u5BC6\u7801\u6216\u8BA4\u8BC1\u4FE1\u606F\uFF0C\u5DF2\u62D2\u7EDD\u4FDD\u5B58\u3002",
  MEMORY_NAMESPACE_QUOTA: "\u6B64\u8303\u56F4\u7684\u4FDD\u5B58\u7248\u672C\u5DF2\u8FBE\u5230 200 \u6761\u3002\u8BF7\u5148\u9057\u5FD8\u4E0D\u518D\u9700\u8981\u7684\u63D0\u6848\u6216\u5386\u53F2\u7248\u672C\u3002",
  MEMORY_INVALID_RECORD: "\u8BF7\u586B\u5199\u6807\u9898\u4E0E\u5185\u5BB9\uFF0C\u5E76\u68C0\u67E5\u5B57\u6BB5\u957F\u5EA6\u3002",
  MEMORY_SCOPE_REVOKED: "\u5F53\u524D\u4F1A\u8BDD\u6388\u6743\u5DF2\u53D8\u5316\uFF0C\u64CD\u4F5C\u5DF2\u53D6\u6D88\u3002",
  MEMORY_NOT_FOUND: "\u8BB0\u5F55\u5DF2\u53D8\u5316\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u53EF\u8BBF\u95EE\u8303\u56F4\uFF0C\u8BF7\u5237\u65B0\u3002",
  MEMORY_DATABASE_INVALID: "\u8BB0\u5FC6\u6587\u4EF6\u635F\u574F\uFF0C\u5DF2\u505C\u6B62\u5199\u5165\uFF1B\u8BF7\u4FDD\u7559\u539F\u6587\u4EF6\uFF0C\u505C\u7528\u5199\u5165\u540E\u6838\u5BF9\u5907\u4EFD\u6062\u590D\u3002",
  MEMORY_READ_DENIED: "\u8BB0\u5FC6\u6587\u4EF6\u8BFB\u53D6\u88AB\u62D2\u7EDD\uFF0C\u8BF7\u68C0\u67E5\u6587\u4EF6\u6743\u9650\uFF1B\u4E0D\u4F1A\u521B\u5EFA\u7A7A\u5E93\u8986\u76D6\u539F\u6587\u4EF6\u3002"
};
var options = (labels3) => Object.entries(labels3).map(([value, label]) => ({ value, label }));
var time = (value) => value ? new Date(value).toLocaleString() : "\u5C1A\u65E0\u8BB0\u5F55";
var messageFor = (error) => errorLabels[error.message] ?? "\u8BB0\u5FC6\u7BA1\u7406\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002";
function MemoryPanel({ data, memoryAction, memoryQuery, onCurrent }) {
  const [query, setQuery] = (0, import_react8.useState)(""), [scope, setScope] = (0, import_react8.useState)("session-private");
  const [status, setStatus] = (0, import_react8.useState)("all"), [validity, setValidity] = (0, import_react8.useState)("all");
  const [offset, setOffset] = (0, import_react8.useState)(0), [selectedId, selectDetail] = (0, import_react8.useState)(null);
  const [selected, setSelected] = (0, import_react8.useState)([]), [snapshot, setSnapshot] = (0, import_react8.useState)(null);
  const [refresh, setRefresh] = (0, import_react8.useState)(0), [loading, setLoading] = (0, import_react8.useState)(true);
  const [busy, setBusy] = (0, import_react8.useState)(false), [message, setMessage] = (0, import_react8.useState)("");
  const [readError, setReadError] = (0, import_react8.useState)(""), [editor, setEditor] = (0, import_react8.useState)(null), [confirmation, setConfirmation] = (0, import_react8.useState)(null);
  const detailRef = (0, import_react8.useRef)(null);
  (0, import_react8.useEffect)(() => {
    const cancellation = new AbortController();
    let timer;
    setLoading(true);
    setReadError("");
    async function read() {
      try {
        const next = await memoryQuery({ query, scope, status, validity, offset: String(offset), limit: "20", ...selectedId ? { id: selectedId } : {} }, cancellation.signal);
        if (!cancellation.signal.aborted) {
          if (offset > 0 && offset >= next.entryCount) {
            setOffset(Math.max(0, Math.floor((next.entryCount - 1) / 20) * 20));
            return;
          }
          setSnapshot(next);
          setReadError("");
          setLoading(false);
          setSelected((previous) => previous.filter((id) => next.entries.some((entry) => entry.id === id && entry.status !== "revoked")));
        }
      } catch (error) {
        if (!cancellation.signal.aborted) {
          setReadError(messageFor(error));
          setLoading(false);
        }
      } finally {
        if (!cancellation.signal.aborted) timer = setTimeout(read, 5e3);
      }
    }
    timer = setTimeout(read, query ? 180 : 0);
    return () => {
      cancellation.abort();
      clearTimeout(timer);
    };
  }, [memoryQuery, query, scope, status, validity, offset, selectedId, refresh, data.memory?.revision]);
  function filter(update) {
    update();
    setOffset(0);
    setSelected([]);
    selectDetail(null);
    setSnapshot(null);
    setConfirmation(null);
  }
  const entries = snapshot?.entries ?? [], record = snapshot?.record;
  (0, import_react8.useEffect)(() => {
    if (record?.id) detailRef.current?.scrollIntoView({ block: "start" });
  }, [record?.id]);
  const disabled = busy || loading || Boolean(readError);
  async function act(action, id, fields = {}, revision = snapshot?.revision) {
    setBusy(true);
    setMessage("");
    try {
      await memoryAction(action, id, revision, fields);
      setConfirmation(null);
      setEditor(null);
      setSelected([]);
      setRefresh((value) => value + 1);
      setMessage(action === "propose" || action === "revise" ? "\u5DF2\u4FDD\u5B58\u4E3A\u5F85\u786E\u8BA4\u63D0\u6848\uFF0C\u5C1A\u672A\u6539\u53D8\u53EC\u56DE\u5185\u5BB9\u3002" : action.startsWith("forget") ? "\u5DF2\u505C\u6B62\u53EC\u56DE\uFF0C\u4FDD\u7559\u5386\u53F2\u548C\u64A4\u9500\u8BB0\u5F55\uFF1B\u8FD9\u4E0D\u662F\u78C1\u76D8\u5185\u5BB9\u64E6\u9664\u3002" : action === "validity" ? "\u53EC\u56DE\u72B6\u6001\u5DF2\u66F4\u65B0\u3002" : "\u5DF2\u786E\u8BA4\u5F53\u524D\u7248\u672C\u3002");
      return true;
    } catch (error) {
      setMessage(messageFor(error));
      return false;
    } finally {
      setBusy(false);
    }
  }
  function request(action, entry, fields = {}) {
    if (action === "confirm" && entry.visibility === "session-private" && !entry.activationImpact?.length) return void act(action, entry.id);
    setConfirmation({ action, id: entry.id, fields, revision: snapshot.revision, names: [entry.key], shared: entry.visibility === "project-shared", replacements: entry.activationImpact });
  }
  function openEditor(entry, copy = false) {
    setConfirmation(null);
    setMessage("");
    setEditor({ id: copy ? null : entry?.id, revision: snapshot.revision, key: entry?.key ?? "", value: entry?.value ?? "", conditions: entry?.conditions ?? "", kind: entry?.kind ?? "fact", visibility: copy || !entry ? "session-private" : entry.visibility });
  }
  function exportSelected() {
    const records = entries.filter((entry) => selected.includes(entry.id));
    const blob = new Blob([JSON.stringify({ schema: "patchwork-memory-export-v1", exportedAt: (/* @__PURE__ */ new Date()).toISOString(), scope, records }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url;
    link.download = "patchwork-memory-" + Date.now() + ".json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
    setMessage(`\u5DF2\u5BFC\u51FA\u6240\u9009 ${records.length} \u6761\u8BB0\u5F55\u5230\u672C\u5730\u6587\u4EF6\uFF0C\u672A\u53D1\u9001\u7ED9\u6A21\u578B\u3002`);
  }
  const validDraft = editor && editor.key.trim() && editor.key.length <= 256 && editor.value.trim() && editor.value.length <= 4e3 && editor.conditions.length <= 512 && editor.kind.trim() && editor.kind.length <= 64;
  const saveDraft = () => {
    if (validDraft && !disabled) void act(editor.id ? "revise" : "propose", editor.id, { record: { key: editor.key, value: editor.value, kind: editor.kind, conditions: editor.conditions, visibility: editor.visibility } }, editor.revision);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-page-heading pw-heading-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h2", { children: "\u8BB0\u5FC6\u7BA1\u7406" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { children: "\u7BA1\u7406\u4FDD\u5B58\u5185\u5BB9\u3001\u9002\u7528\u6761\u4EF6\u4E0E\u53EC\u56DE\u72B6\u6001\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "outline", disabled, onClick: () => openEditor(), children: "\u65B0\u589E\u8BB0\u5FC6" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "pw-live-note", children: "\u81EA\u52A8\u6CE8\u5165\u5DF2\u5173\u95ED\u3002\u53EA\u5728 Agent \u663E\u5F0F\u53EC\u56DE\u65F6\u8BFB\u53D6\uFF0C\u5355\u6B21\u6700\u591A 5 \u6761\uFF1B\u6B64\u7BA1\u7406\u9875\u4E0D\u4F1A\u4F5C\u4E3A\u6A21\u578B\u4E0A\u4E0B\u6587\u53D1\u9001\u3002" }),
    snapshot && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(SummaryStrip, { label: "\u6240\u9009\u8303\u56F4\u8BB0\u5FC6\u7EDF\u8BA1", items: [{ label: "\u5F85\u786E\u8BA4", value: snapshot.counts.proposed }, { label: "\u5DF2\u786E\u8BA4", value: snapshot.counts.active }, { label: "\u5386\u53F2", value: snapshot.counts.superseded }, { label: "\u5DF2\u9057\u5FD8", value: snapshot.counts.revoked }] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("section", { className: "pw-card pw-memory-controls", "aria-label": "\u8BB0\u5FC6\u7B5B\u9009", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-search", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(PanelIcon, { name: "search" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives.Input, { type: "search", "aria-label": "\u641C\u7D22\u8BB0\u5FC6", placeholder: "\u641C\u7D22\u6807\u9898\u3001\u5185\u5BB9\u6216\u9002\u7528\u6761\u4EF6", maxLength: 256, value: query, onChange: (event) => filter(() => setQuery(event.target.value)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-toolbar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Select, { "aria-label": "\u8BB0\u5FC6\u8303\u56F4", value: scope, options: options(scopeLabels), onChange: (value) => filter(() => setScope(value)) }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Select, { "aria-label": "\u8BB0\u5FC6\u72B6\u6001\u7B5B\u9009", value: status, options: options(statusLabels), onChange: (value) => filter(() => setStatus(value)) }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Select, { "aria-label": "\u8BB0\u5FC6\u6709\u6548\u6027\u7B5B\u9009", value: validity, options: options(validityLabels), onChange: (value) => filter(() => setValidity(value)) }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "ghost", disabled: busy, onClick: () => setRefresh((value) => value + 1), children: "\u5237\u65B0\u8BB0\u5F55" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Facets, { label: "\u8BB0\u5FC6\u5FEB\u6377\u72B6\u6001", value: status, onChange: (value) => filter(() => setStatus(value)), items: ["all", "proposed", "active", "superseded", "revoked"].map((value) => ({ value, label: statusLabels[value] })) }),
      snapshot?.quotas.map((quota) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { className: "pw-muted", children: [
        scopeLabels[quota.visibility],
        "\uFF1A",
        quota.used,
        " / ",
        quota.limit,
        " \u4E2A\u4FDD\u5B58\u7248\u672C\uFF08\u542B\u5F85\u786E\u8BA4\u4E0E\u5386\u53F2\uFF09"
      ] }, quota.visibility)),
      scope !== "session-private" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "pw-live-note", children: "\u9879\u76EE\u5171\u4EAB\u6309\u5DE5\u4F5C\u76EE\u5F55\u9694\u79BB\u3002\u5176\u4ED6 Patchwork \u4F1A\u8BDD\u987B\u663E\u5F0F\u5305\u542B\u9879\u76EE\u8BB0\u5FC6\u624D\u80FD\u53EC\u56DE\uFF1B\u6B64\u5904\u7684\u786E\u8BA4\u3001\u6682\u505C\u6216\u9057\u5FD8\u4F1A\u5F71\u54CD\u8BE5\u5171\u4EAB\u8BB0\u5F55\u3002" })
    ] }),
    (readError || data.memory?.failureCode) && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { role: "alert", className: "pw-error", children: readError || errorLabels[data.memory.failureCode] || data.memory.failureCode }),
    message && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "pw-live-note", role: "status", children: message }),
    editor && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("section", { className: "pw-card pw-memory-editor", "aria-label": editor.id ? "\u4FEE\u8BA2\u8BB0\u5FC6" : "\u65B0\u5EFA\u8BB0\u5FC6", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h3", { children: editor.id ? "\u4FEE\u8BA2\u4E3A\u65B0\u7248\u672C" : "\u65B0\u5EFA\u8BB0\u5FC6\u63D0\u6848" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "pw-live-note", children: "\u4FDD\u5B58\u4E0D\u4F1A\u7ACB\u5373\u751F\u6548\u3002\u4FEE\u8BA2\u786E\u8BA4\u524D\uFF0C\u539F\u7248\u672C\u7EE7\u7EED\u6309\u5F53\u524D\u72B6\u6001\u53EC\u56DE\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
        "\u8BB0\u5FC6\u6807\u9898",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives.Input, { "aria-label": "\u8BB0\u5FC6\u6807\u9898", maxLength: 256, value: editor.key, onChange: (event) => setEditor({ ...editor, key: event.target.value }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "pw-field-label", children: "\u8BB0\u5FC6\u5185\u5BB9" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.InlineEditor, { label: "\u8BB0\u5FC6\u5185\u5BB9", className: "pw-memory-textarea", value: editor.value, onChange: (value) => setEditor({ ...editor, value }), onSave: saveDraft, onCancel: () => setEditor(null) }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { className: "pw-muted", children: [
          editor.value.length,
          " / 4000 \u5B57\u7B26 \xB7 Shift+Enter \u6362\u884C"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
        "\u9002\u7528\u6761\u4EF6",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives.Input, { "aria-label": "\u8BB0\u5FC6\u9002\u7528\u6761\u4EF6", maxLength: 512, placeholder: "\u4F8B\u5982\uFF1A\u4EC5\u4FEE\u6539\u5F53\u524D\u4ED3\u5E93\u7684\u524D\u7AEF\u65F6", value: editor.conditions, onChange: (event) => setEditor({ ...editor, conditions: event.target.value }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { children: [
        "\u7C7B\u578B",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives.Input, { "aria-label": "\u8BB0\u5FC6\u7C7B\u578B", maxLength: 64, value: editor.kind, onChange: (event) => setEditor({ ...editor, kind: event.target.value }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "pw-muted", children: "\u4FDD\u5B58\u8303\u56F4" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Select, { "aria-label": "\u65B0\u8BB0\u5FC6\u4FDD\u5B58\u8303\u56F4", disabled: Boolean(editor.id) || busy, value: editor.visibility, options: options({ "session-private": scopeLabels["session-private"], "project-shared": scopeLabels["project-shared"] }), onChange: (visibility) => setEditor({ ...editor, visibility }) })
      ] }),
      editor.visibility === "project-shared" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "pw-warning", children: "\u786E\u8BA4\u540E\u53EF\u88AB\u540C\u9879\u76EE\u7684\u5176\u4ED6\u5DF2\u6388\u6743 Patchwork \u4F1A\u8BDD\u663E\u5F0F\u53EC\u56DE\u3002\u4E0D\u4F1A\u81EA\u52A8\u6CE8\u5165\u4EFB\u4F55\u4F1A\u8BDD\u3002" }),
      editor.id && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "pw-muted", children: "\u4FEE\u8BA2\u4FDD\u7559\u539F\u4F5C\u7528\u57DF\uFF1B\u9700\u8981\u5171\u4EAB\u6216\u8F6C\u4E3A\u79C1\u6709\u65F6\uFF0C\u8BF7\u4ECE\u8BE6\u60C5\u521B\u5EFA\u72EC\u7ACB\u63D0\u6848\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "primary", disabled: disabled || !validDraft, onClick: saveDraft, children: "\u4FDD\u5B58\u63D0\u6848" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "ghost", disabled: busy, onClick: () => setEditor(null), children: "\u53D6\u6D88\u7F16\u8F91" })
      ] })
    ] }),
    confirmation && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("section", { className: "pw-card pw-memory-confirm", "aria-label": "\u786E\u8BA4\u8BB0\u5FC6\u64CD\u4F5C", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h3", { children: confirmation.action === "confirm" ? confirmation.shared ? "\u786E\u8BA4\u5171\u4EAB\u8BB0\u5FC6" : "\u786E\u8BA4\u8BB0\u5FC6\u7248\u672C" : confirmation.action === "validity" ? "\u786E\u8BA4\u53EC\u56DE\u72B6\u6001\u53D8\u66F4" : `\u786E\u8BA4\u9057\u5FD8 ${confirmation.names.length} \u6761\u8BB0\u5FC6` }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("ul", { children: confirmation.names.map((name, index) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("li", { children: name }, index)) }),
      confirmation.replacements?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { children: [
        "\u786E\u8BA4\u540E\u5C06\u66FF\u6362\uFF1A",
        confirmation.replacements.map((item) => `${item.key}\uFF08\u5185\u5BB9 v${item.contentVersion}\uFF09`).join("\u3001"),
        "\u3002\u539F\u5185\u5BB9\u4FDD\u7559\u4E3A\u5386\u53F2\uFF0C\u4E0D\u518D\u53EC\u56DE\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { children: [
        confirmation.action.startsWith("forget") ? "\u5C06\u505C\u6B62\u53EC\u56DE\u5E76\u64A4\u9500\u65E7\u5F15\u7528\uFF0C\u4FDD\u7559\u5185\u5BB9\u5386\u53F2\u548C\u64A4\u9500\u8BB0\u5F55\uFF1B\u4E0D\u4F1A\u64E6\u9664\u78C1\u76D8\u6216\u5907\u4EFD\u3002" : confirmation.action === "validity" ? confirmation.fields.validity === "fresh" ? "\u6062\u590D\u4E3A\u53EF\u6309\u9700\u53EC\u56DE\uFF1B\u8BF7\u5148\u6838\u5BF9\u5185\u5BB9\u4ECD\u7136\u9002\u7528\u3002" : "\u505C\u6B62\u53EC\u56DE\u4F46\u4FDD\u7559\u5185\u5BB9\uFF0C\u53EF\u7A0D\u540E\u91CD\u65B0\u6838\u5B9E\u6062\u590D\u3002" : "\u6B64\u64CD\u4F5C\u4F7F\u5F53\u524D\u63D0\u6848\u6210\u4E3A\u5DF2\u786E\u8BA4\u7248\u672C\u3002",
        confirmation.shared ? " \u5176\u4E2D\u5305\u542B\u9879\u76EE\u5171\u4EAB\u8BB0\u5F55\uFF0C\u4F1A\u5F71\u54CD\u540C\u9879\u76EE\u663E\u5F0F\u8BFB\u53D6\u8BE5\u8BB0\u5F55\u7684\u4F1A\u8BDD\u3002" : " \u4EC5\u5F71\u54CD\u672C\u4F1A\u8BDD\u79C1\u6709\u8BB0\u5F55\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "primary", disabled, onClick: () => act(confirmation.action, confirmation.id, confirmation.fields, confirmation.revision), children: "\u786E\u8BA4\u64CD\u4F5C" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "ghost", disabled: busy, onClick: () => setConfirmation(null), children: "\u53D6\u6D88\u64CD\u4F5C" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-memory-bulk", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "pw-muted", children: [
        "\u5DF2\u9009 ",
        selected.length,
        " \u6761"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "ghost", disabled: disabled || !entries.length, onClick: () => setSelected(selected.length ? [] : entries.filter((entry) => entry.status !== "revoked").map((entry) => entry.id)), children: selected.length ? "\u53D6\u6D88\u9009\u62E9" : "\u9009\u62E9\u672C\u9875" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "outline", disabled: disabled || !selected.length, onClick: exportSelected, children: "\u5BFC\u51FA\u6240\u9009" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "ghost", disabled: disabled || !selected.length, onClick: () => {
          const items = entries.filter((entry) => selected.includes(entry.id));
          setConfirmation({ action: "forget-many", fields: { ids: items.map((entry) => entry.id) }, revision: snapshot.revision, names: items.map((entry) => entry.key), shared: items.some((entry) => entry.visibility === "project-shared") });
        }, children: "\u9057\u5FD8\u6240\u9009" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-memory-list", "aria-busy": loading, children: [
      entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("article", { className: "pw-card pw-memory-item", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-heading-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h3", { children: entry.key }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { className: "pw-muted", children: [
              scopeLabels[entry.visibility],
              " \xB7 ",
              statusLabels[entry.status],
              " \xB7 ",
              recallLabel(entry),
              " \xB7 \u5185\u5BB9 v",
              entry.contentVersion ?? 1
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "ghost", "aria-label": `\u9009\u62E9\u8BB0\u5FC6\uFF1A${entry.key}`, "aria-pressed": selected.includes(entry.id), disabled: disabled || entry.status === "revoked", onClick: () => setSelected((previous) => previous.includes(entry.id) ? previous.filter((id) => id !== entry.id) : [...previous, entry.id]), children: selected.includes(entry.id) ? "\u5DF2\u9009" : "\u9009\u62E9" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { className: "pw-memory-preview", children: [
          entry.value?.slice(0, 160),
          entry.value?.length > 160 ? "\u2026" : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "outline", disabled: busy, onClick: () => {
            selectDetail(entry.id);
            setConfirmation(null);
          }, children: "\u67E5\u770B\u8BE6\u60C5" }),
          entry.status === "proposed" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "outline", disabled, onClick: () => request("confirm", entry), children: "\u786E\u8BA4" }),
          entry.status === "active" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "ghost", disabled, onClick: () => request("validity", entry, { validity: entry.validity === "fresh" ? "stale" : "fresh" }), children: entry.validity === "fresh" ? "\u6682\u505C\u53EC\u56DE" : "\u6062\u590D\u53EC\u56DE" }),
          entry.status !== "revoked" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "ghost", disabled, onClick: () => request("forget", entry), children: entry.status === "proposed" ? "\u4E22\u5F03" : "\u5FD8\u8BB0" })
        ] })
      ] }, entry.id)),
      !entries.length && !loading && !readError && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(EmptyState, { title: query || status !== "all" || validity !== "all" ? "\u6CA1\u6709\u5339\u914D\u7684\u8BB0\u5FC6" : "\u5F53\u524D\u8303\u56F4\u8FD8\u6CA1\u6709\u8BB0\u5FC6", icon: "lock", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { children: "\u53EF\u624B\u52A8\u65B0\u589E\u63D0\u6848\uFF0C\u6216\u8BA9\u5F53\u524D Patchwork Agent \u63D0\u8BAE\u8BB0\u5FC6\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "outline", onClick: onCurrent, children: "\u67E5\u770B\u672C\u6B21\u8BC1\u636E" })
      ] })
    ] }),
    snapshot && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-memory-pagination", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "ghost", disabled: disabled || offset === 0, onClick: () => {
        setOffset(Math.max(0, offset - 20));
        setSelected([]);
        selectDetail(null);
      }, children: "\u4E0A\u4E00\u9875" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "pw-muted", children: [
        snapshot.entryCount ? `${offset + 1}\u2013${Math.min(offset + entries.length, snapshot.entryCount)}` : "0",
        " / ",
        snapshot.entryCount
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "ghost", disabled: disabled || !snapshot.hasMore, onClick: () => {
        setOffset(offset + 20);
        setSelected([]);
        selectDetail(null);
      }, children: "\u4E0B\u4E00\u9875" })
    ] }),
    record && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("section", { ref: detailRef, className: "pw-card pw-memory-detail", "aria-label": "\u8BB0\u5FC6\u8BE6\u60C5", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-heading-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h3", { children: "\u8BB0\u5FC6\u8BE6\u60C5" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "ghost", onClick: () => selectDetail(null), children: "\u6536\u8D77\u8BE6\u60C5" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("h3", { children: record.key }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "pw-memory-body", children: record.value }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("dl", { className: "pw-facts", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dt", { children: "\u9002\u7528\u6761\u4EF6" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dd", { children: record.conditions || "\u672A\u9650\u5B9A\uFF1B\u53EC\u56DE\u540E\u4ECD\u9700\u6838\u5BF9\u5F53\u524D\u4EFB\u52A1" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dt", { children: "\u7C7B\u578B / \u8303\u56F4" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("dd", { children: [
            record.kind,
            " \xB7 ",
            scopeLabels[record.visibility]
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dt", { children: "\u72B6\u6001 / \u6709\u6548\u6027" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("dd", { children: [
            statusLabels[record.status],
            " \xB7 ",
            validityLabels[record.validity]
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dt", { children: "\u53EC\u56DE\u8D44\u683C" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dd", { children: recallLabel(record) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dt", { children: "\u89C2\u5BDF / \u786E\u8BA4" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("dd", { children: [
            time(record.observedAt),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("br", {}),
            time(record.verifiedAt)
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dt", { children: "\u8BB0\u5F55 ID / \u7248\u672C" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("dd", { children: [
            record.id,
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("br", {}),
            "\u5185\u5BB9 v",
            record.contentVersion ?? 1,
            " \xB7 \u8BB0\u5F55 r",
            record.revision
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-actions", children: [
        ["active", "proposed"].includes(record.status) && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "outline", disabled, onClick: () => openEditor(record), children: "\u4FEE\u8BA2\u8BB0\u5FC6" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "outline", disabled, onClick: () => openEditor(record, true), children: "\u4EE5\u6B64\u5185\u5BB9\u65B0\u5EFA\u63D0\u6848" }),
        record.status === "active" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Select, { "aria-label": "\u8BBE\u7F6E\u8BB0\u5FC6\u6709\u6548\u6027", value: record.validity, options: options({ fresh: validityLabels.fresh, stale: validityLabels.stale, conflicted: validityLabels.conflicted, expired: validityLabels.expired }), disabled, onChange: (value) => request("validity", record, { validity: value }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(TechnicalDetails, { title: "\u6765\u6E90\u4E0E\u64CD\u4F5C\u8BB0\u5F55", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("ul", { children: record.sources?.map((source, index) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("li", { children: [
          sourceLabels[source.kind] ?? source.kind,
          " \xB7 \u4F1A\u8BDD ",
          source.sessionId
        ] }, index)) }),
        record.changes?.map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { children: [
          actionLabels[item.action] ?? item.action,
          " \xB7 r",
          item.revision,
          " \xB7 ",
          time(item.at),
          item.validity ? ` \xB7 ${validityLabels[item.validity]}` : ""
        ] }, index)),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "pw-muted", children: "\u6700\u591A\u4FDD\u7559\u6700\u8FD1 20 \u6B21\u72B6\u6001\u64CD\u4F5C\uFF1B\u6B63\u6587\u4FEE\u8BA2\u53E6\u5B58\u4E3A\u7248\u672C\uFF0C\u4E0D\u539F\u5730\u8986\u76D6\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(TechnicalDetails, { title: "\u5185\u5BB9\u7248\u672C\u5386\u53F2", children: [
        snapshot.history?.map((item) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-memory-history-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { children: [
            "\u5185\u5BB9 v",
            item.contentVersion ?? 1,
            " \xB7 r",
            item.revision,
            " \xB7 ",
            item.key,
            " \xB7 ",
            statusLabels[item.status]
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives6.Button, { size: "sm", variant: "ghost", disabled: busy || item.id === record.id, onClick: () => selectDetail(item.id), children: "\u67E5\u770B\u6B64\u7248\u672C" })
        ] }, item.id)),
        snapshot.historyHasMore && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { children: "\u4EC5\u663E\u793A\u6700\u8FD1 50 \u4E2A\u5173\u8054\u7248\u672C\uFF0C\u66F4\u65E9\u7248\u672C\u53EF\u901A\u8FC7\u641C\u7D22\u548C\u7FFB\u9875\u67E5\u627E\u3002" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(TechnicalDetails, { title: "\u5B58\u50A8\u4E0E\u6062\u590D", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { children: [
        "\u6570\u636E\u5E93\u7248\u672C ",
        snapshot?.revision ?? "\u672A\u77E5",
        " \xB7 \u64A4\u9500 epoch ",
        snapshot?.namespaceEpoch ?? "\u672A\u77E5",
        "\u3002\u635F\u574F\u65F6\u505C\u6B62\u5199\u5165\u5E76\u4FDD\u7559\u539F\u6587\u4EF6\uFF1B\u505C\u7528\u6240\u6709\u5199\u8FDB\u7A0B\u540E\uFF0C\u6838\u5BF9 memory.json.bak \u518D\u79BB\u7EBF\u6062\u590D\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { children: "\u9057\u5FD8\u662F\u903B\u8F91\u64A4\u9500\uFF0C\u5386\u53F2\u5185\u5BB9\u4FDD\u7559\u7528\u4E8E\u5BA1\u67E5\u3002\u8BB0\u5FC6\u4E0D\u4F1A\u6388\u4E88\u5DE5\u5177\u3001\u76EE\u5F55\u3001\u4ED8\u8D39\u6216\u53D1\u5E03\u6743\u9650\u3002" })
    ] })
  ] });
}

// src/client/ToolEvidencePanel.jsx
var import_react9 = require("react");
var import_dsh_client_ui_primitives7 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/EvidenceList.jsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var outcomes = { completed: "\u5DE5\u5177\u5B8C\u6210", failed: "\u6267\u884C\u5931\u8D25", skipped: "\u5DF2\u8DF3\u8FC7", unverified: "\u5F85\u6838\u9A8C" };
function EvidenceList({ items }) {
  if (!items.length) return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(EmptyState, { title: "\u6682\u65E0\u5DE5\u5177\u8BC1\u636E", children: "\u4EFB\u52A1\u4E2D\u7684\u5DE5\u5177\u7ED3\u679C\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\uFF0C\u4EC5\u4FDD\u7559\u5F53\u524D\u4F1A\u8BDD\u7684\u9884\u89C8\u3002" });
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "pw-list", children: items.map((event) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("details", { className: "pw-event", children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("summary", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "pw-dot", "data-tone": event.outcome === "failed" ? "error" : event.outcome === "completed" ? "success" : "warn" }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "pw-event-main", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "pw-event-title pw-summary-copy", children: event.command ?? event.path ?? event.tool }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "pw-event-subtitle", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "pw-mono", children: event.tool }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: outcomes[event.outcome] ?? "\u672A\u77E5\u7ED3\u679C" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: Number.isInteger(event.exitCode) ? `exit ${event.exitCode}` : "\u9000\u51FA\u7801\u672A\u91C7\u96C6" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("time", { className: "pw-event-time", dateTime: event.at, children: logTime(event.at) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PanelIcon, { name: "chevron", className: "pw-event-chevron" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "pw-event-body", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("dl", { className: "pw-facts", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("dt", { children: "\u5DE5\u5177\u7ED3\u679C" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("dd", { children: outcomes[event.outcome] ?? "\u672A\u77E5\u7ED3\u679C" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("dt", { children: "\u539F\u59CB\u8F93\u51FA" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("dd", { className: "pw-mono", children: formatBytes(event.bytes) })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("pre", { children: [
        event.text || "\u65E0\u6587\u672C\u8F93\u51FA",
        event.truncated ? "\n[\u9884\u89C8\u5DF2\u622A\u65AD\uFF1B\u5B8C\u6574\u5185\u5BB9\u89C1 DSH \u4F1A\u8BDD\u8BB0\u5F55]" : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(TechnicalDetails, { title: "\u8C03\u7528\u5173\u8054", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("dl", { className: "pw-facts", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("dt", { children: "\u8C03\u7528 ID" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("dd", { children: event.id })
        ] }),
        event.rootCallId && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("dt", { children: "\u6839\u8C03\u7528 ID" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("dd", { children: event.rootCallId })
        ] }),
        event.callIdHash && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("dt", { children: "\u8C03\u7528\u6307\u7EB9" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("dd", { children: event.callIdHash })
        ] })
      ] }) })
    ] })
  ] }, event.id)) });
}

// src/client/ToolEvidencePanel.jsx
var import_jsx_runtime9 = require("react/jsx-runtime");
var outcomes2 = [["all", "\u5168\u90E8"], ["failed", "\u5931\u8D25"], ["unverified", "\u5F85\u6838\u9A8C"], ["completed", "\u5DF2\u5B8C\u6210"], ["skipped", "\u5DF2\u8DF3\u8FC7"]];
function ToolEvidencePanel({ events }) {
  const [query, setQuery] = (0, import_react9.useState)(""), [outcome, setOutcome] = (0, import_react9.useState)("all"), [tool, setTool] = (0, import_react9.useState)("all"), [grouped, setGrouped] = (0, import_react9.useState)(false);
  const tools = [...new Set(events.map((event) => event.tool).filter(Boolean))];
  const visible = events.filter((event) => (outcome === "all" || event.outcome === outcome) && (tool === "all" || event.tool === tool) && textMatches(query, event.command, event.path, event.tool, event.id, event.rootCallId, event.text));
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("section", { className: "pw-section", "aria-label": "\u5DE5\u5177\u8BC1\u636E\u7BA1\u7406", children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(SectionHeading, { title: "\u5DE5\u5177\u8BC1\u636E", description: "\u6309\u7ED3\u679C\u5B9A\u4F4D\u95EE\u9898\uFF0C\u6309\u6839\u8C03\u7528\u4E32\u8D77\u76F8\u5173\u64CD\u4F5C\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(SummaryStrip, { label: "\u5DE5\u5177\u8BC1\u636E\u7EDF\u8BA1", items: [{ label: "\u5F53\u524D\u9884\u89C8", value: events.length }, { label: "\u5931\u8D25", value: events.filter((item) => item.outcome === "failed").length }, { label: "\u5F85\u6838\u9A8C", value: events.filter((item) => item.outcome === "unverified").length }] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(SearchField, { label: "\u641C\u7D22\u5DE5\u5177\u8BC1\u636E", value: query, onChange: setQuery, placeholder: "\u641C\u7D22\u547D\u4EE4\u3001\u8DEF\u5F84\u3001\u5DE5\u5177\u6216\u56DE\u6267" }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Facets, { label: "\u5DE5\u5177\u7ED3\u679C\u7B5B\u9009", value: outcome, onChange: setOutcome, items: outcomes2.map(([value, label]) => ({ value, label, count: value === "all" ? events.length : events.filter((event) => event.outcome === value).length })) }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "pw-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Select, { "aria-label": "\u5DE5\u5177\u7C7B\u522B\u7B5B\u9009", value: tool, onChange: setTool, options: [{ value: "all", label: "\u5168\u90E8\u5DE5\u5177" }, ...tools.map((tool2) => ({ value: tool2, label: tool2 }))] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_dsh_client_ui_primitives7.Button, { size: "sm", variant: "ghost", "aria-pressed": grouped, onClick: () => setGrouped((value) => !value), children: "\u6309\u6839\u8C03\u7528\u5206\u7EC4" }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "pw-muted", children: [
        "\u663E\u793A ",
        visible.length,
        " \u6761"
      ] })
    ] }),
    visible.length ? grouped ? evidenceGroups(visible).map((group) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "pw-evidence-group", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "pw-list-meta", children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("code", { children: group.id }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { children: [
          group.entries.length,
          " \u6761"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(EvidenceList, { items: group.entries })
    ] }, group.id)) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(EvidenceList, { items: visible }) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(EmptyState, { title: events.length ? "\u6CA1\u6709\u5339\u914D\u7684\u5DE5\u5177\u8BC1\u636E" : "\u6682\u65E0\u5DE5\u5177\u8BC1\u636E", children: "\u8C03\u6574\u7B5B\u9009\uFF0C\u6216\u5728\u5F53\u524D\u4F1A\u8BDD\u6267\u884C\u4EFB\u52A1\u540E\u67E5\u770B\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "pw-live-note", children: "\u6700\u591A\u9884\u89C8\u672C\u6B21\u8FD0\u884C\u7684 100 \u6761\u8BB0\u5F55\uFF1B\u7B5B\u9009\u4EC5\u8986\u76D6\u5F53\u524D\u9884\u89C8\u3002\u66F4\u65E9\u7ED3\u679C\u8BF7\u67E5\u770B DSH \u4F1A\u8BDD\u8BB0\u5F55\u3002" })
  ] });
}

// src/client/TaskEvidence.jsx
var import_react10 = require("react");
var import_dsh_client_ui_primitives8 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime10 = require("react/jsx-runtime");
var labels2 = {
  "in-progress": "\u8FDB\u884C\u4E2D",
  ready: "\u767B\u8BB0\u9A8C\u6536\u901A\u8FC7",
  partial: "\u90E8\u5206\u9A8C\u6536",
  blocked: "\u5DF2\u963B\u585E",
  cancelled: "\u5DF2\u53D6\u6D88",
  superseded: "\u5DF2\u66FF\u4EE3",
  pending: "\u5F85\u68C0\u67E5",
  passed: "\u901A\u8FC7",
  accepted: "\u7528\u6237\u5DF2\u63A5\u7EB3",
  failed: "\u5931\u8D25",
  unknown: "\u672A\u77E5",
  stale: "\u5DF2\u8FC7\u671F",
  skipped: "\u5DF2\u8DF3\u8FC7",
  analysis: "\u5206\u6790",
  plan: "\u65B9\u6848",
  implement: "\u5B9E\u65BD",
  verify: "\u9A8C\u8BC1",
  unassessed: "\u5C1A\u672A\u8BC4\u4F30",
  stated: "\u6A21\u578B\u5DF2\u9648\u8FF0",
  "needs-clarification": "\u5F85\u6F84\u6E05"
};
var phases = ["analysis", "plan", "implement", "verify"];
var tone = (status) => ["ready", "passed"].includes(status) ? "success" : ["failed", "blocked", "stale"].includes(status) ? "warn" : void 0;
function TaskEvidence({ task, expanded = false, onEvidence, reviewAction }) {
  const [message, setMessage] = (0, import_react10.useState)("");
  const [busy, setBusy] = (0, import_react10.useState)(false);
  const [filter, setFilter] = (0, import_react10.useState)("all"), [kind, setKind] = (0, import_react10.useState)("all");
  if (!task?.title) return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(EmptyState, { title: "\u5C1A\u672A\u767B\u8BB0\u5F53\u524D\u4EFB\u52A1", icon: "file", children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { children: "Agent \u767B\u8BB0\u4EFB\u52A1\u540E\uFF0C\u8FD9\u91CC\u4F1A\u663E\u793A\u9636\u6BB5\u4E0E\u9A8C\u6536\u4F9D\u636E\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { children: "\u5DE5\u5177\u6267\u884C\u6210\u529F\u4E0D\u4F1A\u81EA\u52A8\u6807\u8BB0\u4EFB\u52A1\u5B8C\u6210\u3002" })
  ] });
  const requirements = task.requirements ?? [];
  const pending = requirements.filter((r) => r.required && !["passed", "accepted"].includes(r.status)).length;
  const visible = expanded ? requirements.filter((item) => (kind === "all" || item.kind === kind) && (filter === "all" || filter === "pending" && !["passed", "accepted"].includes(item.status) || filter === "passed" && ["passed", "accepted"].includes(item.status) || filter === "stale" && item.status === "stale")) : requirements;
  async function review(id, accept) {
    setBusy(true);
    try {
      await reviewAction({ action: "task-review", id, accept, baseRevision: task.revision });
      setMessage(accept ? "\u5DF2\u63A5\u7EB3\u5F53\u524D\u4EA7\u7269\u7248\u672C\uFF1B\u540E\u7EED\u53D8\u66F4\u4F1A\u4F7F\u63A5\u7EB3\u5931\u6548\u3002" : "\u5DF2\u64A4\u56DE\u63A5\u7EB3\uFF0C\u7B49\u5F85\u590D\u6838\u3002");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function copy(path) {
    try {
      await navigator.clipboard.writeText(path);
      setMessage("\u5DF2\u590D\u5236\u5B8C\u6574\u8DEF\u5F84");
    } catch {
      setMessage("\u590D\u5236\u5931\u8D25\uFF0C\u53EF\u9009\u62E9\u5B8C\u6574\u8DEF\u5F84\u624B\u52A8\u590D\u5236");
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "pw-task", children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "pw-card pw-task-core", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "pw-task-summary", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "pw-task-heading", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "pw-eyebrow", children: "\u5F53\u524D\u4EFB\u52A1" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("h2", { children: task.title }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("p", { className: "pw-task-state", "data-tone": tone(task.status), children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "pw-dot", "data-tone": tone(task.status) }),
            labels2[task.status] ?? "\u672A\u77E5\u72B6\u6001"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("ol", { className: "pw-stage-line", "aria-label": "\u767B\u8BB0\u4EFB\u52A1\u9636\u6BB5", children: phases.map((phase) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("li", { "aria-current": task.phase === phase ? "step" : void 0, children: labels2[phase] }, phase)) }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("p", { className: "pw-muted", children: [
          pending ? `\u4ECD\u6709 ${pending} \u9879\u5FC5\u9700\u9A8C\u6536\u672A\u901A\u8FC7\u3002` : requirements.some((r) => r.required) ? "\u5DF2\u767B\u8BB0\u7684\u5FC5\u9700\u9A8C\u6536\u5747\u901A\u8FC7\u3002" : "\u5C1A\u672A\u5B9A\u4E49\u5FC5\u9700\u9A8C\u6536\u3002",
          "\u9636\u6BB5\u7531 Agent \u9648\u8FF0\u3002"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("section", { className: "pw-section", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(SectionHeading, { title: "\u9A8C\u6536\u4F9D\u636E", children: onEvidence && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_dsh_client_ui_primitives8.Button, { size: "sm", variant: "ghost", onClick: onEvidence, children: [
          "\u67E5\u770B\u5168\u90E8 ",
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(PanelIcon, { name: "chevron" })
        ] }) }),
        expanded && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(SummaryStrip, { label: "\u4EFB\u52A1\u9A8C\u6536\u7EDF\u8BA1", items: [{ label: "\u9A8C\u6536\u9879", value: requirements.length }, { label: "\u5FC5\u9700\u5F85\u9A8C", value: pending }, { label: "\u4EA7\u7269", value: (task.artifacts ?? []).filter((item) => item.status !== "superseded").length }] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Facets, { label: "\u9A8C\u6536\u72B6\u6001\u7B5B\u9009", value: filter, onChange: setFilter, items: [{ value: "all", label: "\u5168\u90E8" }, { value: "pending", label: "\u5F85\u5904\u7406" }, { value: "passed", label: "\u5DF2\u901A\u8FC7" }, { value: "stale", label: "\u5DF2\u8FC7\u671F" }] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Select, { "aria-label": "\u9A8C\u6536\u7C7B\u578B\u7B5B\u9009", value: kind, onChange: setKind, options: [{ value: "all", label: "\u5168\u90E8\u7C7B\u578B" }, { value: "command", label: "\u5B9E\u9645\u5DE5\u5177\u6267\u884C" }, { value: "artifact", label: "\u4EA7\u7269\u7ED3\u6784" }, { value: "semantic", label: "\u8BED\u4E49\u8BC4\u5BA1" }] })
        ] }),
        visible.length ? visible.map((r) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "pw-check-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(PanelIcon, { name: r.status === "passed" ? "check" : "circle", className: r.status === "passed" ? "pw-success" : "pw-muted" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "pw-copy", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("strong", { children: [
              r.label,
              r.required ? "" : "\uFF08\u53EF\u9009\uFF09"
            ] }),
            expanded && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("small", { children: [
                r.kind === "semantic" ? "\u8BED\u4E49\u8BC4\u5BA1\uFF0C\u6A21\u578B\u5224\u65AD\u4E0D\u81EA\u52A8\u653E\u884C" : r.kind === "artifact" ? "\u4EC5\u7ED3\u6784\u68C0\u67E5" : "\u5B9E\u9645\u5DE5\u5177\u6267\u884C",
                " \xB7 \u8986\u76D6 ",
                r.coverage.filter((unit) => r.evidence.some((e) => e.unit === unit && e.outcome === "passed")).length,
                "/",
                r.coverage.length
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("small", { children: r.coverage.map((unit) => `${unit}: ${labels2[r.evidence.find((e) => e.unit === unit)?.outcome] ?? "\u672A\u8986\u76D6"}`).join(" \xB7 ") }),
              r.evidence.map((e) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("code", { className: "pw-task-path pw-muted", children: [
                e.tool,
                " \xB7 ",
                e.callId,
                e.tool === "artifact-check" ? " \xB7 \u6587\u4EF6\u7ED3\u6784\u56DE\u6267" : ` \xB7 exit ${e.exitCode ?? "\u672A\u77E5"}`
              ] }, e.id))
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "pw-status", "data-tone": tone(r.status), children: labels2[r.status] ?? "\u672A\u77E5" }),
          expanded && reviewAction && r.kind === "semantic" && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_dsh_client_ui_primitives8.Button, { size: "sm", variant: "outline", disabled: busy, onClick: () => review(r.id, r.status !== "accepted"), children: r.status === "accepted" ? "\u64A4\u56DE\u63A5\u7EB3" : "\u63A5\u7EB3\u5F53\u524D\u7248\u672C" })
        ] }, r.id)) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "pw-muted", children: requirements.length ? "\u6CA1\u6709\u5339\u914D\u7684\u9A8C\u6536\u9879\u3002" : "\u672A\u5B9A\u4E49\u5FC5\u9700\u9A8C\u6536\uFF0C\u4E0D\u80FD\u805A\u5408\u4E3A\u901A\u8FC7\u3002" }),
        !expanded && pending > 0 && onEvidence && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_dsh_client_ui_primitives8.Button, { className: "pw-task-cta", size: "sm", variant: "primary", onClick: onEvidence, children: [
          "\u67E5\u770B\u5F85\u9A8C\u9879\u76EE ",
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(PanelIcon, { name: "chevron" })
        ] })
      ] })
    ] }),
    expanded && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
      (task.artifacts ?? []).some((a) => a.status !== "superseded") && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("section", { className: "pw-section", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(SectionHeading, { title: "\u4EFB\u52A1\u4EA7\u7269" }),
        task.artifacts.filter((a) => a.status !== "superseded").map((a) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "pw-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "pw-copy", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("strong", { children: [
              a.id,
              a.status === "changed" ? " \xB7 \u5DF2\u53D8\u66F4\uFF0C\u5F85\u91CD\u9A8C" : ""
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("code", { className: "pw-task-path", children: a.path }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("small", { children: [
              "\u7248\u672C ",
              a.version.slice(0, 8),
              a.supersedes ? ` \xB7 \u66FF\u4EE3 ${a.supersedes}` : ""
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_dsh_client_ui_primitives8.Button, { size: "sm", variant: "ghost", onClick: () => copy(a.path), "aria-label": `\u590D\u5236 ${a.id} \u5B8C\u6574\u8DEF\u5F84`, children: "\u590D\u5236\u8DEF\u5F84" })
        ] }, a.id)),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "pw-live-note", role: "status", children: message })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(TechnicalDetails, { title: "\u4EFB\u52A1\u8303\u56F4\u4E0E\u6765\u6E90", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("dl", { className: "pw-facts", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("dt", { children: "\u4EFB\u52A1\u7248\u672C" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("dd", { children: task.revision })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("dt", { children: "\u7406\u89E3\u72B6\u6001" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("dd", { children: labels2[task.understandingStatus] ?? "\u672A\u77E5" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("dt", { children: "\u5DE5\u4F5C\u533A" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("dd", { children: task.workspace ?? "\u672A\u786E\u8BA4" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("dt", { children: "\u53C2\u8003\u5BF9\u8C61" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("dd", { children: task.references?.length ? task.references.map((path) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("code", { className: "pw-task-path", children: path }, path)) : "\u672A\u767B\u8BB0" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("dt", { children: "\u72EC\u7ACB\u5B9E\u4F8B" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("dd", { children: task.instance ? `${task.instance.id} \xB7 ${task.instance.endpoint}\uFF08\u58F0\u660E\uFF0C\u672A\u8BC1\u660E\u6267\u884C\u7ED1\u5B9A\uFF09` : "\u672A\u767B\u8BB0\u72EC\u7ACB\u5B9E\u4F8B" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("dt", { children: "\u8BB0\u5F55" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("dd", { children: task.persistence === "native" ? "\u5BBF\u4E3B\u539F\u751F\u8BB0\u5F55" : task.persistence === "failed" ? "\u5931\u8D25\uFF0C\u4EFB\u52A1\u5DF2\u963B\u585E" : "\u5F53\u524D\u5185\u5B58\uFF0C\u539F\u751F\u8BB0\u5F55\u4E0D\u53EF\u7528" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("dt", { children: "\u6765\u6E90" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("dd", { children: task.source?.kind === "observed-user-kind" ? "\u5DF2\u89C2\u5BDF user \u7C7B\u578B\uFF0C\u4E0D\u8BC1\u660E\u4EBA\u7C7B\u6388\u6743" : task.source?.kind ?? "\u672A\u77E5" })
          ] })
        ] }),
        task.lastCorrection && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("p", { children: [
          "\u6700\u8FD1\u7EA0\u6B63 r",
          task.lastCorrection.revision,
          " \xB7 ",
          task.lastCorrection.affected.join("\u3001") || "\u65E0\u5173\u8054\u9A8C\u6536"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { children: "\u7B56\u7565\u68C0\u67E5\u8986\u76D6\u5DF2\u77E5\u7ED3\u6784\u5316\u5199\u5165\uFF1B\u666E\u901A shell \u4E0D\u662F\u5F3A\u9694\u79BB\u3002\u9636\u6BB5\u4E0D\u7B49\u4E8E\u4EBA\u7C7B\u6388\u6743\uFF1B\u72B6\u6001\u53EA\u53CD\u6620\u5DF2\u767B\u8BB0\u68C0\u67E5\uFF0C\u672A\u8986\u76D6\u9700\u6C42\u4E0E\u4E3B\u89C2\u8D28\u91CF\u987B\u53E6\u884C\u8BF4\u660E\u3002" })
      ] })
    ] })
  ] });
}

// src/client/RetrievalPanel.jsx
var import_react11 = require("react");
var import_dsh_client_ui_primitives9 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime11 = require("react/jsx-runtime");
var statusLabels2 = { retrieved: "\u5DF2\u68C0\u7D22", partial: "\u90E8\u5206\u6210\u529F", failed: "\u5931\u8D25", admitted: "\u5DF2\u51C6\u5165", sent: "\u5DF2\u53D1\u9001", cited: "\u5DF2\u5F15\u7528", verified: "\u5B57\u6BB5\u4E00\u81F4", rejected: "\u5DF2\u62D2\u7EDD" };
var healthLabels = { healthy: "\u6B63\u5E38", zero_result: "\u96F6\u7ED3\u679C", parser_drift: "\u89E3\u6790\u6F02\u79FB", blocked: "\u88AB\u963B\u65AD", transport_error: "\u4F20\u8F93\u5931\u8D25" };
function SourceLink({ value, children }) {
  const href = safePublicLink(value);
  return href ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("a", { href, target: "_blank", rel: "noreferrer", children: children ?? value }) : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: children ?? value ?? "\u65E0\u53EF\u7528\u6765\u6E90\u94FE\u63A5" });
}
function RetrievalPanel({ data }) {
  const [query, setQuery] = (0, import_react11.useState)(""), [view, setView] = (0, import_react11.useState)("sources"), [provider, setProvider] = (0, import_react11.useState)("all"), [selectedId, setSelectedId] = (0, import_react11.useState)(null);
  const [sourcePage, setSourcePage] = (0, import_react11.useState)(0);
  const ref = (0, import_react11.useRef)(null), entries = data.retrieval?.entries ?? [], evidence = data.retrieval?.evidence ?? [];
  const sources = entries.flatMap((entry) => (entry.sources ?? []).map((source, index) => ({ ...source, id: `${entry.operationId}:${entry.seq ?? ""}:${index}`, entry })));
  const providers = [...new Set(entries.map((entry) => entry.provider).filter(Boolean))];
  const matches = (entry, ...text) => (provider === "all" || entry?.provider === provider) && textMatches(query, ...text);
  const visible = sources.filter((source) => matches(source.entry, source.title, source.url, source.snippet, source.entry.provider));
  const lastPage = Math.max(0, Math.ceil(visible.length / 30) - 1), page = Math.min(sourcePage, lastPage), pageSources = visible.slice(page * 30, (page + 1) * 30);
  const selected = pageSources.find((item) => item.id === selectedId) ?? pageSources[0];
  const visibleRecords = entries.filter((entry) => matches(entry, entry.operationId, entry.provider, entry.failureCode, entry.status));
  const related = selected ? evidence.filter((item) => item.source === selected.url) : [];
  const visibleEvidence = evidence.filter((item) => (provider === "all" || sources.some((source) => source.url === item.source && source.entry.provider === provider)) && textMatches(query, item.title, item.source, item.excerptPreview, item.citation?.claim, item.id));
  (0, import_react11.useEffect)(() => {
    if (selectedId) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);
  (0, import_react11.useEffect)(() => {
    setSourcePage(0);
    setSelectedId(null);
  }, [query, provider]);
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "pw-page-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("h2", { children: "\u68C0\u7D22\u5DE5\u4F5C\u53F0" }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { children: "\u4ECE\u6765\u6E90\u67E5\u770B\u6458\u5F55\u4E0E\u5F15\u7528\uFF0C\u4ECE\u5931\u8D25\u8BB0\u5F55\u5224\u65AD\u641C\u7D22\u901A\u9053\u662F\u5426\u53EF\u7528\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(SummaryStrip, { label: "\u68C0\u7D22\u7EDF\u8BA1", items: [{ label: "\u68C0\u7D22\u8BB0\u5F55", value: entries.length }, { label: "\u6765\u6E90\u6761\u76EE", value: sources.length }, { label: "\u5DF2\u8BFB\u6458\u5F55", value: evidence.filter((item) => ["sent", "cited", "verified"].includes(item.status)).length }, { label: "\u5931\u8D25\u8BB0\u5F55", value: entries.filter((item) => ["failed", "partial"].includes(item.status)).length }] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(SearchField, { label: "\u641C\u7D22\u68C0\u7D22\u8BC1\u636E", value: query, onChange: setQuery, placeholder: "\u641C\u7D22\u6765\u6E90\u3001\u6458\u5F55\u6216\u5F15\u7528\u4E3B\u5F20" }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "pw-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Select, { "aria-label": "\u68C0\u7D22\u6765\u6E90\u7B5B\u9009", value: provider, onChange: setProvider, options: [{ value: "all", label: "\u5168\u90E8 Provider" }, ...providers.map((value) => ({ value, label: value }))] }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "pw-muted", children: data.retrieval?.persistence === "native" ? "\u5DF2\u5199\u5165\u4F1A\u8BDD" : "\u5F53\u524D\u8FD0\u884C\u5FEB\u7167" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Facets, { label: "\u68C0\u7D22\u89C6\u56FE", value: view, onChange: setView, items: [{ value: "sources", label: "\u6765\u6E90", count: visible.length }, { value: "evidence", label: "\u6458\u5F55\u4E0E\u5F15\u7528", count: visibleEvidence.length }, { value: "records", label: "\u68C0\u7D22\u8BB0\u5F55", count: entries.filter((entry) => matches(entry, entry.operationId, entry.provider, entry.failureCode, entry.status)).length }] }),
    view === "sources" && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "pw-master-detail", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("section", { className: "pw-record-list", "aria-label": "\u68C0\u7D22\u6765\u6E90\u5217\u8868", children: visible.length ? pageSources.map((source) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("button", { type: "button", className: "pw-record-row", "aria-label": `\u67E5\u770B\u6765\u6E90 ${source.title}`, "aria-pressed": selected?.id === source.id, onClick: () => setSelectedId(source.id), children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "pw-record-title", children: source.title }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "pw-record-subtitle", children: [
          safePublicLink(source.url) ? new URL(source.url).hostname : "\u94FE\u63A5\u4E0D\u53EF\u7528",
          " \xB7 ",
          source.entry.provider ?? "\u672A\u77E5 Provider"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "pw-record-subtitle", children: source.snippet?.slice(0, 90) ?? "\u65E0\u641C\u7D22\u6458\u8981" })
      ] }, source.id)) : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(EmptyState, { title: sources.length ? "\u6CA1\u6709\u5339\u914D\u7684\u6765\u6E90" : "\u8FD8\u6CA1\u6709\u68C0\u7D22\u6765\u6E90", children: "\u6267\u884C Patchwork \u641C\u7D22\u540E\u5728\u6B64\u67E5\u770B\u3002\u641C\u7D22\u6458\u8981\u4E0D\u7B49\u4E8E\u5DF2\u8BFB\u53D6\u9875\u9762\u3002" }) }),
      selected && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("article", { ref, className: "pw-detail-pane", "aria-label": "\u6765\u6E90\u8BE6\u60C5", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(SectionHeading, { title: selected.title }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "pw-source-url", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(SourceLink, { value: selected.url }) }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "pw-inline-facts", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(RecordStatus, { children: statusLabels2[selected.entry.status] ?? selected.entry.status }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: "\u5916\u90E8\u4E0D\u53EF\u4FE1\u6570\u636E" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("h3", { children: "\u641C\u7D22\u6458\u8981" }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "pw-body-copy", children: selected.snippet ?? "\u672A\u8FD4\u56DE\u6458\u8981\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "pw-live-note", children: "\u8FD9\u662F\u641C\u7D22\u6458\u8981\uFF0C\u4E0D\u662F\u7F51\u9875\u5168\u6587\uFF1B\u53EA\u6709\u8BFB\u53D6\u5E76\u5B9E\u9645\u53D1\u9001\u7684\u6458\u5F55\u624D\u80FD\u7528\u4E8E\u5F15\u7528\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "pw-actions", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(CopyButton, { label: "\u590D\u5236\u6765\u6E90\u94FE\u63A5", value: selected.url }) }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("section", { className: "pw-detail-section", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("h3", { children: "\u5173\u8054\u6458\u5F55" }),
          related.length ? related.map((item) => /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(EvidenceDetail, { item }, item.id)) : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "pw-muted", children: "\u5F53\u524D\u6CA1\u6709\u7ED1\u5B9A\u8BE5\u6765\u6E90\u7684\u6458\u5F55\u8BC1\u636E\u3002" })
        ] })
      ] })
    ] }),
    view === "evidence" && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("section", { className: "pw-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(SectionHeading, { title: "\u6458\u5F55\u8BC1\u636E\u751F\u547D\u5468\u671F" }),
      visibleEvidence.length ? visibleEvidence.map((item) => /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(EvidenceDetail, { item }, item.id)) : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(EmptyState, { title: "\u6CA1\u6709\u5339\u914D\u7684\u6458\u5F55", children: "\u7F51\u9875\u8BFB\u53D6\u540E\u624D\u80FD\u5F62\u6210\u6458\u5F55\uFF1B\u4E0D\u628A\u641C\u7D22\u547D\u4E2D\u8BA1\u4E3A\u5DF2\u9A8C\u8BC1\u4E8B\u5B9E\u3002" })
    ] }),
    view === "records" && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("section", { className: "pw-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(SectionHeading, { title: "\u68C0\u7D22\u8BB0\u5F55" }),
      visibleRecords.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("article", { className: "pw-detail-section", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "pw-heading-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("h3", { children: entry.provider ?? "Patchwork \u68C0\u7D22" }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(RecordStatus, { tone: entry.status === "failed" ? "warn" : void 0, children: statusLabels2[entry.status] ?? entry.status })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { className: "pw-muted", children: [
          entry.type === "fetch" ? "\u6293\u53D6" : "\u641C\u7D22",
          " \xB7 ",
          entry.resultCount ?? "\u672A\u77E5",
          " \u6761\u7ED3\u679C \xB7 ",
          entry.elapsedMs ?? "\u672A\u77E5",
          " ms"
        ] }),
        entry.failureCode && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "pw-warning", children: entry.failureCode }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(TechnicalDetails, { title: "Provider \u72B6\u6001\u4E0E\u5143\u6570\u636E", children: [
          entry.providerHealth?.map((item) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "pw-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "pw-copy", children: item.provider }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { children: [
              healthLabels[item.status] ?? item.status,
              " \xB7 ",
              item.resultCount ?? "\u672A\u77E5",
              " \u6761"
            ] })
          ] }, item.provider)),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("code", { className: "pw-task-path", children: entry.operationId }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { children: [
            "\u8303\u56F4\uFF1A",
            entry.scope
          ] }),
          entry.queryFingerprint && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("code", { className: "pw-task-path", children: entry.queryFingerprint })
        ] })
      ] }, entry.operationId + (entry.seq ?? ""))),
      !visibleRecords.length && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(EmptyState, { title: entries.length ? "\u6CA1\u6709\u5339\u914D\u7684\u68C0\u7D22\u8BB0\u5F55" : "\u8FD8\u6CA1\u6709\u68C0\u7D22\u8BB0\u5F55", children: "\u8C03\u6574\u7B5B\u9009\uFF0C\u6216\u6267\u884C\u641C\u7D22\u4E0E\u516C\u5F00\u7F51\u9875\u6293\u53D6\u540E\u67E5\u770B\u3002" })
    ] }),
    view === "sources" && visible.length > 30 && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "pw-toolbar", "aria-label": "\u6765\u6E90\u5206\u9875", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_dsh_client_ui_primitives9.Button, { size: "sm", variant: "outline", disabled: page === 0, onClick: () => {
        setSourcePage(page - 1);
        setSelectedId(null);
      }, children: "\u4E0A\u4E00\u9875\u6765\u6E90" }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "pw-muted", children: [
        page * 30 + 1,
        "\u2013",
        Math.min((page + 1) * 30, visible.length),
        " / ",
        visible.length
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_dsh_client_ui_primitives9.Button, { size: "sm", variant: "outline", disabled: page >= lastPage, onClick: () => {
        setSourcePage(page + 1);
        setSelectedId(null);
      }, children: "\u4E0B\u4E00\u9875\u6765\u6E90" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { className: "pw-live-note", children: [
      "\u5B57\u6BB5\u4E00\u81F4\u6027\u68C0\u67E5\u4E0D\u4FDD\u8BC1\u5916\u90E8\u4E8B\u5B9E\u771F\u5B9E\uFF1B\u6765\u6E90\u4E0D\u4F1A\u81EA\u52A8\u8FDB\u5165\u957F\u671F\u8BB0\u5FC6\u3001\u89C4\u5219\u6216\u6743\u9650\u3002\u5F53\u524D\u9884\u89C8\u6700\u591A ",
      data.retrieval?.limit ?? 100,
      " \u6761\u68C0\u7D22\u8BB0\u5F55\u3002"
    ] })
  ] });
}
function EvidenceDetail({ item }) {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("article", { className: "pw-detail-section", children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("h3", { children: item.title }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "pw-inline-facts", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(RecordStatus, { children: statusLabels2[item.status] ?? item.status }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: { supported: "\u5B57\u6BB5\u4E00\u81F4", conflict: "\u6765\u6E90\u51B2\u7A81", unknown: "\u7ED3\u8BBA\u672A\u77E5" }[item.verification?.result] ?? "\u5C1A\u672A\u4EA4\u53C9\u6838\u9A8C" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("ol", { className: "pw-lifecycle", "aria-label": "\u6458\u5F55\u72B6\u6001\u5386\u7A0B", children: (item.timeline ?? []).map((event, index) => /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("li", { children: statusLabels2[event.status] ?? event.status }, index)) }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(TechnicalDetails, { title: "\u6458\u5F55\u4E0E\u5F15\u7528\u7ED1\u5B9A", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "pw-body-copy", children: item.excerptPreview }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "pw-source-url", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(SourceLink, { value: item.source }) }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("code", { className: "pw-task-path", children: [
        item.id,
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("br", {}),
        item.excerptHash
      ] }),
      item.citation && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { children: [
          "\u4E3B\u5F20\uFF1A",
          item.citation.claim
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("blockquote", { children: item.citation.quote })
      ] }),
      item.verification && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { children: [
        item.verification.method,
        " \xB7 ",
        item.verification.note
      ] })
    ] })
  ] });
}

// src/client/OperationalPanels.jsx
var import_react12 = require("react");
var import_dsh_client_ui_primitives10 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime12 = require("react/jsx-runtime");
var mechanisms = [
  { key: "actionFusion", code: "AF", name: "\u63A5\u7EED\u6267\u884C", description: "\u628A\u6587\u4EF6\u7F16\u8F91\u548C\u5FC5\u8981\u6821\u9A8C\u63A5\u6210\u4E00\u6B21\u53D7\u63A7\u64CD\u4F5C\u3002", boundary: "\u53EA\u6709\u5DE5\u5177\u5951\u7EA6\u66B4\u9732 then_run \u624D\u80FD\u786E\u8BA4\u5DF2\u6CE8\u518C\uFF1B\u4E0D\u628A\u5DE5\u5177\u6210\u529F\u5F53\u6210\u4EFB\u52A1\u901A\u8FC7\u3002", log: "af" },
  { key: "observationPack", code: "OP", name: "\u5927\u8F93\u51FA\u5F52\u6863", description: "\u4FDD\u5B58\u5B8C\u6574\u539F\u6587\uFF0C\u6309\u9700\u8BFB\u53D6\u5C11\u91CF\u7247\u6BB5\u3002", boundary: "\u5F52\u6863\u6307\u9488\u4E0D\u662F\u5185\u5BB9\u672C\u8EAB\uFF1B\u8C03\u7528\u53EC\u56DE\u5DE5\u5177\u540E\u624D\u5F97\u5230\u5BF9\u5E94\u539F\u6587\u3002", log: "op" },
  { key: "evidencePreservingReducer", code: "EPR", name: "\u8BC1\u636E\u7EA6\u7B80", description: "\u4FDD\u7559\u53EF\u6838\u5BF9\u5F15\u7528\uFF0C\u7F29\u77ED\u8F83\u957F\u7684\u5DE5\u5177\u89C2\u5BDF\u3002", boundary: "\u9ED8\u8BA4\u5173\u95ED\uFF0C\u654F\u611F\u8F93\u51FA\u62D2\u7EDD\u5916\u53D1\uFF1B\u4E0D\u80FD\u7528\u7F29\u77ED\u5B57\u6570\u5192\u5145\u8D28\u91CF\u63D0\u5347\u3002", log: "epr" },
  { key: "onlineContextCompact", code: "OCC", name: "\u4E0A\u4E0B\u6587\u538B\u7F29", description: "\u5728\u8BA1\u5212\u8FB9\u754C\u8BC4\u4F30\u662F\u5426\u9700\u8981\u6574\u7406\u4E0A\u4E0B\u6587\u3002", boundary: "\u914D\u7F6E\u5F00\u542F\u4E0D\u4EE3\u8868\u5B9E\u9645\u6267\u884C\uFF1B\u67E5\u770B\u51B3\u7B56\u65E5\u5FD7\u786E\u8BA4\u538B\u7F29\u524D\u540E\u72B6\u6001\u3002", log: "occ" }
];
var skillLabels = { "anti-slop": "\u53BB\u6A21\u677F\u5316\u590D\u6838", architecture: "\u67B6\u6784\u8BBE\u8BA1", collaborator: "\u534F\u4F5C", evidence: "\u8BC1\u636E\u6838\u5BF9", patchwork: "\u5DE5\u4F5C\u6D41\u7A0B", standards: "\u5DE5\u7A0B\u6807\u51C6", "web-ui": "\u754C\u9762\u8BBE\u8BA1", debugging: "\u6545\u969C\u6392\u67E5", "code-review": "\u4EE3\u7801\u5BA1\u67E5", retrieval: "\u4FE1\u606F\u68C0\u7D22", documentation: "\u6587\u6863\u7EF4\u62A4", memory: "\u8BB0\u5FC6\u7BA1\u7406", improvement: "\u53D7\u63A7\u6539\u8FDB" };
function MechanismStatus({ item, data }) {
  const loaded = data.loadedConfig?.[item.key], active = data.mechanisms?.[item.key]?.active;
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "pw-status", "data-tone": active === true ? "success" : void 0, children: loaded === false ? "\u672A\u52A0\u8F7D" : loaded !== true ? "\u672A\u77E5" : active === true ? "\u5DF2\u6CE8\u518C" : active === false ? "\u672A\u6CE8\u518C" : "\u5DF2\u52A0\u8F7D" });
}
function OverviewPanel({ data, pending, navigate }) {
  const summary = workspaceSummary(data), events = data.events ?? [];
  const attention = [
    summary.review > 0 && { label: `${summary.review} \u4E2A\u6267\u884C\u5668\u7ED3\u679C\u7B49\u5F85\u590D\u6838`, detail: "\u5148\u67E5\u770B\u5F53\u524D\u4EA7\u7269\u4E0E\u8BC1\u636E\uFF0C\u518D\u51B3\u5B9A\u662F\u5426\u63A5\u7EB3\u3002", tab: "queue" },
    summary.blocked > 0 && { label: `${summary.blocked} \u4E2A\u6267\u884C\u5668\u9700\u8981\u5904\u7406`, detail: "\u67E5\u770B\u963B\u585E\u539F\u56E0\u3001\u4F9D\u8D56\u4E0E\u91CD\u8BD5\u6B21\u6570\u3002", tab: "queue" },
    summary.failures > 0 && { label: `${summary.failures} \u6761\u5931\u8D25\u5DE5\u5177\u56DE\u6267`, detail: "\u5B9A\u4F4D\u6700\u8FD1\u5931\u8D25\uFF1B\u6570\u5B57\u4EC5\u8986\u76D6\u5F53\u524D\u9884\u89C8\u3002", tab: "evidence", view: "current" },
    summary.candidates > 0 && { label: `${summary.candidates} \u6761\u6539\u8FDB\u5019\u9009\u5F85\u5BA1`, detail: "\u68C0\u67E5\u6765\u6E90\u3001\u5B9E\u9A8C\u5DEE\u5F02\u4E0E\u5F71\u54CD\u8303\u56F4\u3002", tab: "evidence", view: "improvements" },
    pending > 0 && { label: `${pending} \u9879\u914D\u7F6E\u7B49\u5F85\u91CD\u65B0\u52A0\u8F7D`, detail: "\u67E5\u770B\u5DF2\u4FDD\u5B58\u503C\u4E0E\u5F53\u524D\u5B9E\u9645\u52A0\u8F7D\u503C\u7684\u5DEE\u5F02\u3002", tab: "settings" }
  ].filter(Boolean);
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "pw-page-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("h2", { children: "\u5DE5\u4F5C\u6982\u89C8" }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("p", { children: [
        data.task?.workspace ?? "\u5F53\u524D Patchwork \u4F1A\u8BDD",
        " "
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(SummaryStrip, { label: "\u5F53\u524D\u5DE5\u4F5C\u7EDF\u8BA1", items: [{ label: "\u5FC5\u9700\u9A8C\u6536", value: summary.requirements ? `${summary.passed} / ${summary.requirements}` : "\u672A\u5B9A\u4E49" }, { label: "\u6267\u884C\u4E2D", value: summary.running }, { label: "\u5F85\u590D\u6838", value: summary.review }, { label: "\u5DE5\u5177\u5931\u8D25", value: summary.failures, tone: summary.failures ? "warn" : void 0 }] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("section", { className: "pw-section", "aria-label": "\u5F85\u5904\u7406\u4E8B\u9879", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(SectionHeading, { title: "\u5F85\u5904\u7406", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "pw-muted", children: attention.length ? `${attention.length} \u7C7B` : "\u6682\u65E0\u5F85\u5904\u7406" }) }),
      attention.length ? attention.map((item) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("button", { type: "button", className: "pw-knowledge-row", onClick: () => navigate(item.tab, item.view), children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("strong", { children: item.label }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("small", { children: item.detail })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(PanelIcon, { name: "chevron" })
      ] }, item.label)) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { className: "pw-muted", children: "\u5F53\u524D\u5FEB\u7167\u6CA1\u6709\u5F85\u5904\u7406\u4E8B\u9879\uFF1B\u4EFB\u52A1\u5B8C\u6210\u4ECD\u4EE5\u5B9E\u9645\u9A8C\u6536\u4E3A\u51C6\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(TaskEvidence, { task: data.task, onEvidence: () => navigate("evidence", "current") }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("section", { className: "pw-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(SectionHeading, { title: "\u6700\u8FD1\u5DE5\u5177\u6D3B\u52A8", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_dsh_client_ui_primitives10.Button, { size: "sm", variant: "ghost", onClick: () => navigate("evidence", "current"), children: [
        "\u67E5\u770B\u8BC1\u636E ",
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(PanelIcon, { name: "chevron" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(EvidenceList, { items: events.slice(0, 3) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("section", { className: "pw-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(SectionHeading, { title: "\u4E0A\u4E0B\u6587\u4E0E\u80FD\u529B", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_dsh_client_ui_primitives10.Button, { size: "sm", variant: "ghost", onClick: () => navigate("mechanisms"), children: "\u67E5\u770B\u673A\u5236\u4E0E\u6280\u80FD" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "pw-context-value", children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("strong", { children: [
          summary.tokens == null ? "\u672A\u6D4B\u91CF" : summary.tokens.toLocaleString(),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("small", { children: " tokens" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "pw-muted", children: [
          "\u7A97\u53E3 ",
          summary.window == null ? "\u672A\u77E5" : summary.window.toLocaleString()
        ] })
      ] }),
      summary.tokens != null && summary.window != null && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "pw-meter", role: "meter", "aria-label": "\u5F53\u524D\u4E0A\u4E0B\u6587\u5360\u7528", "aria-valuemin": 0, "aria-valuemax": summary.window, "aria-valuenow": Math.min(summary.tokens, summary.window), children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { style: { width: `${Math.min(100, summary.tokens / summary.window * 100)}%` } }) }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { className: "pw-live-note", children: "\u4EC5\u663E\u793A\u5BBF\u4E3B\u5B9E\u9645\u8BA1\u91CF\uFF1B\u8BB0\u5FC6\u6309\u9700\u8BFB\u53D6\uFF0C\u7BA1\u7406\u9875\u6B63\u6587\u4E0D\u4F1A\u81EA\u52A8\u6CE8\u5165\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "pw-quick-links", "aria-label": "\u5DE5\u4F5C\u533A\u5FEB\u6377\u5165\u53E3", children: [["\u8BB0\u5FC6\u7BA1\u7406", "evidence", "memory"], ["\u68C0\u7D22\u6765\u6E90", "evidence", "retrieval"], ["\u8FD0\u884C\u65E5\u5FD7", "logs"], ["\u914D\u7F6E", "settings"]].map(([label, tab, view]) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_dsh_client_ui_primitives10.Button, { size: "sm", variant: "outline", onClick: () => navigate(tab, view), children: label }, label)) })
  ] });
}
function MechanismsPanel({ data }) {
  const [query, setQuery] = (0, import_react12.useState)(""), [view, setView] = (0, import_react12.useState)("all");
  const names = data.skills?.names ?? [];
  const rows = mechanisms.filter((item) => textMatches(query, item.name, item.code, item.description));
  const visibleNames = names.filter((name) => textMatches(query, name, skillLabels[name]));
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_jsx_runtime12.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "pw-page-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("h2", { children: "\u673A\u5236\u4E0E\u6280\u80FD" }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { children: "\u67E5\u770B\u5B9E\u9645\u52A0\u8F7D\u72B6\u6001\u3001\u6700\u8FD1\u51B3\u7B56\uFF0C\u4EE5\u53CA\u672C\u4F1A\u8BDD\u53EF\u6309\u9700\u8BFB\u53D6\u7684\u6280\u80FD\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(SummaryStrip, { label: "\u80FD\u529B\u7EDF\u8BA1", items: [{ label: "\u673A\u5236\u5DF2\u52A0\u8F7D", value: mechanisms.filter((item) => data.loadedConfig?.[item.key] === true).length }, { label: "\u5DF2\u6CE8\u518C\u6280\u80FD", value: names.length }, { label: "\u6B63\u6587\u52A0\u8F7D", value: "\u6309\u9700" }] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(SearchField, { label: "\u641C\u7D22\u673A\u5236\u4E0E\u6280\u80FD", value: query, onChange: setQuery, placeholder: "\u641C\u7D22\u540D\u79F0\u3001\u7528\u9014\u6216\u673A\u5236\u4EE3\u7801" }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Facets, { label: "\u80FD\u529B\u7C7B\u522B", value: view, onChange: setView, items: [{ value: "all", label: "\u5168\u90E8" }, { value: "mechanisms", label: "\u8FD0\u884C\u673A\u5236", count: mechanisms.length }, { value: "skills", label: "\u6280\u80FD\u76EE\u5F55", count: names.length }] }),
    view !== "skills" && rows.map((item) => {
      const latest = (data.diagnostics?.entries ?? []).find((entry) => entry.mechanism === item.log);
      return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("section", { className: "pw-section", children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(SectionHeading, { title: item.name, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(MechanismStatus, { item, data }) }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { className: "pw-body-copy", children: item.description }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "pw-inline-facts", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: item.code }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { children: [
            "\u5DF2\u4FDD\u5B58 ",
            data.config?.[item.key] === true ? "\u5F00\u542F" : "\u5173\u95ED"
          ] }),
          data.config?.[item.key] !== data.loadedConfig?.[item.key] && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "pw-warning", children: "\u7B49\u5F85\u91CD\u8F7D" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { className: "pw-live-note", children: latest ? `\u6700\u8FD1\u8BB0\u5F55\uFF1A${latest.event} \xB7 ${latest.reason}` : "\u5F53\u524D\u9884\u89C8\u6682\u65E0\u8FD0\u884C\u8BB0\u5F55\uFF0C\u5C1A\u4E0D\u80FD\u8BC1\u660E\u6267\u884C\u6216\u6536\u76CA\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(TechnicalDetails, { title: "\u8FD0\u884C\u8FB9\u754C", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { children: item.boundary }) })
      ] }, item.key);
    }),
    view !== "skills" && !rows.length && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(EmptyState, { title: "\u6CA1\u6709\u5339\u914D\u7684\u8FD0\u884C\u673A\u5236", children: "\u8C03\u6574\u641C\u7D22\u6761\u4EF6\u3002" }),
    view !== "mechanisms" && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("section", { className: "pw-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(SectionHeading, { title: "\u672C\u4F1A\u8BDD\u6280\u80FD\u76EE\u5F55", description: `${data.skills?.mode === "expanded" ? "\u6269\u5C55" : "\u6838\u5FC3"}\u76EE\u5F55 \xB7 \u5DF2\u6CE8\u518C\u4E0D\u7B49\u4E8E\u6A21\u578B\u5DF2\u7ECF\u9605\u8BFB` }),
      visibleNames.map((name) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "pw-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "pw-copy", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("strong", { children: skillLabels[name] ?? name }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("small", { children: name })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "pw-status", children: "\u6309\u9700\u8BFB\u53D6" })
      ] }, name)),
      !visibleNames.length && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(EmptyState, { title: names.length ? "\u6CA1\u6709\u5339\u914D\u7684\u6280\u80FD" : "\u5F53\u524D\u6CA1\u6709\u6CE8\u518C\u7684\u6280\u80FD", children: names.length ? "\u8C03\u6574\u641C\u7D22\u6761\u4EF6\u3002" : "\u6838\u5BF9\u6280\u80FD\u5F00\u5173\u3001\u52A0\u8F7D\u6A21\u5F0F\u4E0E\u5BBF\u4E3B\u6280\u80FD\u670D\u52A1\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("p", { className: "pw-live-note", children: "\u76EE\u5F55\u6765\u81EA\u5F53\u524D\u5B9E\u4F8B\u7684\u6CE8\u518C\u7ED3\u679C\u3002\u8FD9\u91CC\u67E5\u770B\u4E0D\u4F1A\u5411\u6A21\u578B\u53D1\u9001\u6280\u80FD\u6B63\u6587\u3002" })
    ] })
  ] });
}

// src/client/SettingsPanel.jsx
var import_react13 = require("react");
var import_dsh_client_ui_primitives12 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/SettingsFields.jsx
var import_dsh_client_ui_primitives11 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime13 = require("react/jsx-runtime");
var settingHelp = {
  actionFusion: "\u628A\u6587\u4EF6\u7F16\u8F91\u4E0E\u5FC5\u8981\u6821\u9A8C\u63A5\u6210\u4E00\u6B21\u53D7\u63A7\u64CD\u4F5C\u3002",
  observationPack: "\u4FDD\u5B58\u5B8C\u6574\u539F\u6587\uFF0C\u6309\u9700\u53EC\u56DE\u5C11\u91CF\u7247\u6BB5\u3002",
  evidencePreservingReducer: "\u9ED8\u8BA4\u5173\u95ED\uFF1B\u654F\u611F\u8F93\u51FA\u62D2\u7EDD\u5916\u53D1\u3002\u7EA6\u7B80\u6A21\u578B\u8BBE\u7F6E\u4E0D\u6539\u53D8\u4E3B\u4F1A\u8BDD\u6A21\u578B\u3002",
  onlineContextCompact: "\u5728\u8BA1\u5212\u8FB9\u754C\u8BC4\u4F30\u4E0A\u4E0B\u6587\u538B\u7F29\uFF0C\u662F\u5426\u6267\u884C\u4EE5\u5B9E\u9645\u65E5\u5FD7\u4E3A\u51C6\u3002",
  cacheWriteReadRatio: "\u7528\u4E8E\u6210\u672C\u4F30\u8BA1\uFF0C\u65E0\u5355\u4F4D\uFF1B\u4E0D\u6539\u53D8\u670D\u52A1\u5546\u7684\u5B9E\u9645\u8BA1\u8D39\u3002",
  reducerProvider: "\u4EC5 EPR \u4F7F\u7528\uFF1B\u7559\u7A7A\u6CBF\u7528\u5BBF\u4E3B\uFF0C\u4E0D\u5728\u6B64\u4FDD\u5B58\u670D\u52A1\u5BC6\u94A5\u3002",
  reducerModel: "\u4E3A\u7EA6\u7B80\u6307\u5B9A\u6A21\u578B\uFF1B\u4E0D\u4F1A\u66F4\u6539\u4E3B\u4F1A\u8BDD\u6A21\u578B\u3002",
  reducerMaxTokens: "\u9650\u5236\u7EA6\u7B80\u8F93\u51FA\u957F\u5EA6\uFF0C\u4E0D\u662F\u4E3B\u6A21\u578B\u4E0A\u4E0B\u6587\u7A97\u53E3\u3002",
  nativeSearch: "\u542F\u7528\u65E0\u9700\u670D\u52A1\u5BC6\u94A5\u7684\u516C\u5F00\u9875\u9762\u641C\u7D22\uFF0C\u53EF\u7528\u6027\u53D7\u4E0A\u6E38\u9875\u9762\u5F71\u54CD\u3002",
  nativeSearchProviders: "\u6309\u914D\u7F6E\u987A\u5E8F\u67E5\u8BE2\uFF1B\u53EF\u9009 bing-html\u3001brave-html\u3001duckduckgo-html\u3002",
  nativeSearchMaxResults: "\u6BCF\u6B21\u5DE5\u5177\u8C03\u7528\u8FD4\u56DE\u7684\u7ED3\u679C\u6570\u91CF\u4E0A\u9650\u3002",
  nativeSearchTimeoutMs: "\u641C\u7D22\u603B\u9884\u7B97\uFF0C\u8D85\u8FC7\u9884\u7B97\u8FD4\u56DE\u5B9E\u9645\u5931\u8D25\u72B6\u6001\u3002",
  nativeFetch: "\u542F\u7528\u516C\u5F00\u7F51\u9875\u8BFB\u53D6\uFF0C\u4FDD\u7559\u516C\u7F51\u5730\u5740\u548C\u54CD\u5E94\u5927\u5C0F\u68C0\u67E5\u3002",
  nativeFetchAllowedHosts: "\u53EF\u9650\u5B9A\u4E3B\u673A\uFF1B\u7A7A\u5217\u8868\u4ECD\u53EA\u5141\u8BB8\u7ECF\u68C0\u67E5\u7684\u516C\u7F51\u4E3B\u673A\u3002",
  nativeFetchTimeoutMs: "\u5355\u6B21\u6293\u53D6\u603B\u65F6\u95F4\u9884\u7B97\u3002",
  nativeFetchMaxBytes: "\u9650\u5236\u4E0B\u8F7D\u4F53\u79EF\uFF0C\u907F\u514D\u5927\u54CD\u5E94\u5360\u6EE1\u5185\u5B58\u3002",
  nativeFetchMaxChars: "\u9650\u5236\u8FD4\u56DE\u7ED9\u5F53\u524D\u4EFB\u52A1\u7684\u6458\u5F55\u957F\u5EA6\u3002",
  nativeFetchRobots: "\u542F\u7528\u65F6\u6838\u5BF9\u76EE\u6807\u7AD9\u70B9 robots.txt\u3002",
  skillsEnabled: "\u4E3A Patchwork \u6CE8\u518C\u6280\u80FD\u76EE\u5F55\uFF0C\u6B63\u6587\u4ECD\u7531\u6A21\u578B\u6309\u9700\u8BFB\u53D6\u3002",
  skillsMode: "\u6838\u5FC3\u4E3A 7 \u9879\uFF1B\u6269\u5C55\u6A21\u5F0F\u52A0\u5165\u8C03\u8BD5\u3001\u5BA1\u67E5\u3001\u68C0\u7D22\u3001\u6587\u6863\u3001\u8BB0\u5FC6\u548C\u6539\u8FDB\u3002",
  evidenceGate: "\u4EA4\u4ED8\u524D\u6838\u5BF9\u8BC1\u636E\u4E0E\u8981\u6C42\uFF0C\u4E0D\u80FD\u66FF\u4EE3\u4EBA\u5DE5\u8D28\u91CF\u5224\u65AD\u3002",
  taskPolicyMode: "structured / strict \u63A7\u5236\u5DF2\u77E5\u7ED3\u6784\u5316\u5199\u5165\uFF0C\u4E0D\u662F\u64CD\u4F5C\u7CFB\u7EDF\u6C99\u7BB1\u3002",
  memoryEnabled: "\u542F\u7528\u663E\u5F0F\u8BB0\u5FC6\u5DE5\u5177\uFF1B\u4E0D\u4F1A\u5F00\u542F\u81EA\u52A8\u6CE8\u5165\u6216\u8DE8\u4F1A\u8BDD\u5171\u4EAB\u3002"
};
var groups = [["mechanism", "\u6267\u884C\u4E0E\u4E0A\u4E0B\u6587"], ["reducer", "\u7EA6\u7B80\u6A21\u578B"], ["retrieval", "\u4FE1\u606F\u68C0\u7D22"], ["skills", "\u6280\u80FD\u4E0E\u4EFB\u52A1"], ["memory", "\u8BB0\u5FC6"]];
function SettingsFields({ data, draft, saving, edit, query = "", group: selectedGroup = "all" }) {
  const visible = SETTING_FIELDS.filter((field) => (selectedGroup === "all" || selectedGroup === field.group) && textMatches(query, field.label, field.key, settingHelp[field.key]));
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_jsx_runtime13.Fragment, { children: [
    groups.map(([group, title2]) => {
      const fields = visible.filter((field) => field.group === group);
      return fields.length ? /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("section", { className: "pw-card", children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(SectionHeading, { title: title2 }),
        fields.map((field) => {
          const value = draft[field.key] ?? data.config?.[field.key] ?? field.defaultValue;
          return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "pw-row pw-setting-row", "data-changed": Object.hasOwn(draft, field.key), children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "pw-copy", children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("strong", { children: field.label }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("small", { children: settingHelp[field.key] }),
              field.min !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("small", { children: [
                "\u8303\u56F4 ",
                field.min,
                "\u2014",
                field.max ?? "\u4E0D\u9650"
              ] }),
              JSON.stringify(data.config?.[field.key]) !== JSON.stringify(data.loadedConfig?.[field.key]) && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("small", { className: "pw-warning", children: "\u5DF2\u4FDD\u5B58\u503C\u7B49\u5F85\u91CD\u8F7D" })
            ] }),
            field.type === "boolean" ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_dsh_client_ui_primitives11.Switch, { label: field.label, checked: value, onChange: (next) => edit(field.key, next), disabled: saving }) : field.type === "enum" ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Select, { "aria-label": field.label, value, options: field.choices.map((value2) => ({ value: value2, label: value2 })), onChange: (value2) => edit(field.key, value2), disabled: saving }) : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_dsh_client_ui_primitives.Input, { className: "pw-input", "aria-label": field.label, type: ["integer", "number"].includes(field.type) ? "number" : "text", min: field.min, max: field.max, step: field.type === "integer" ? 1 : void 0, value: Array.isArray(value) ? value.join(", ") : value, disabled: saving, onChange: (event) => {
              const value2 = event.target.value;
              edit(field.key, ["integer", "number"].includes(field.type) ? value2 === "" ? "" : Number(value2) : ["providers", "hosts"].includes(field.type) ? value2.split(",").map((item) => item.trim()).filter(Boolean) : value2);
            } })
          ] }, field.key);
        })
      ] }, group) : null;
    }),
    !visible.length && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(EmptyState, { title: "\u6CA1\u6709\u5339\u914D\u7684\u8BBE\u7F6E", children: "\u8C03\u6574\u5206\u7C7B\u6216\u641C\u7D22\u6761\u4EF6\uFF1B\u9690\u85CF\u5B57\u6BB5\u7684\u8349\u7A3F\u4ECD\u4F1A\u4FDD\u7559\u3002" })
  ] });
}

// src/client/SettingsPanel.jsx
var import_jsx_runtime14 = require("react/jsx-runtime");
var display = (value) => value === void 0 ? "\u672A\u77E5" : Array.isArray(value) ? value.join(", ") || "\u7A7A\u5217\u8868" : typeof value === "boolean" ? value ? "\u5F00\u542F" : "\u5173\u95ED" : String(value) || "\u6CBF\u7528\u5BBF\u4E3B\u9ED8\u8BA4";
function SettingsPanel({ data, draft, saving, invalid, conflict, dirty, message, connected, pending, edit, persist, discard }) {
  const [query, setQuery] = (0, import_react13.useState)(""), [group, setGroup] = (0, import_react13.useState)("all");
  const desired = data.config ?? {}, loaded = data.loadedConfig ?? {};
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(import_jsx_runtime14.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "pw-page-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("h2", { children: "\u8FD0\u884C\u8BBE\u7F6E" }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("p", { children: "\u914D\u7F6E\u4F5C\u7528\u4E8E\u5F53\u524D DSH_HOME \u7684 Patchwork\uFF1B\u4FDD\u5B58\u540E\u91CD\u65B0\u52A0\u8F7D\u751F\u6548\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(SummaryStrip, { label: "\u914D\u7F6E\u72B6\u6001", items: [{ label: "\u53EF\u914D\u7F6E\u9879", value: SETTING_FIELDS.length }, { label: "\u8349\u7A3F\u53D8\u66F4", value: dirty }, { label: "\u7B49\u5F85\u91CD\u8F7D", value: pending }] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(SearchField, { label: "\u641C\u7D22\u8BBE\u7F6E", value: query, onChange: setQuery, placeholder: "\u641C\u7D22\u7528\u9014\u3001\u540D\u79F0\u6216\u914D\u7F6E\u952E" }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Facets, { label: "\u8BBE\u7F6E\u5206\u7C7B", value: group, onChange: setGroup, items: [["all", "\u5168\u90E8"], ["mechanism", "\u6267\u884C"], ["reducer", "\u7EA6\u7B80"], ["retrieval", "\u68C0\u7D22"], ["skills", "\u6280\u80FD"], ["memory", "\u8BB0\u5FC6"]].map(([value, label]) => ({ value, label })) }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(SettingsFields, { data, draft, saving, edit, query, group }),
    dirty > 0 && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("section", { className: "pw-section", "aria-label": "\u5F85\u4FDD\u5B58\u914D\u7F6E\u5DEE\u5F02", children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(SectionHeading, { title: "\u4FDD\u5B58\u524D\u6838\u5BF9", description: "\u8349\u7A3F\u4E0D\u4F1A\u7ACB\u5373\u6539\u53D8\u5F53\u524D\u8FD0\u884C\u673A\u5236\u3002" }),
      Object.keys(draft).map((key) => /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "pw-setting-diff", children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("strong", { children: SETTING_FIELDS.find((field) => field.key === key)?.label ?? key }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { children: [
          "\u5DF2\u4FDD\u5B58\uFF1A",
          display(desired[key])
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { children: [
          "\u8349\u7A3F\uFF1A",
          display(draft[key])
        ] })
      ] }, key))
    ] }),
    pending > 0 && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(TechnicalDetails, { title: "\u5DF2\u4FDD\u5B58\u4E0E\u5B9E\u9645\u52A0\u8F7D\u5DEE\u5F02", children: SETTING_FIELDS.filter((field) => JSON.stringify(desired[field.key]) !== JSON.stringify(loaded[field.key])).map((field) => /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "pw-setting-diff", children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("strong", { children: field.label }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { children: [
        "\u5B9E\u9645\u52A0\u8F7D\uFF1A",
        display(loaded[field.key])
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { children: [
        "\u5DF2\u4FDD\u5B58\uFF1A",
        display(desired[field.key])
      ] })
    ] }, field.key)) }),
    invalid && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("p", { className: "pw-error", role: "alert", children: "\u8BF7\u68C0\u67E5\u6570\u503C\u4E0E\u914D\u7F6E\u683C\u5F0F\uFF0C\u5408\u6CD5\u8303\u56F4\u89C1\u5BF9\u5E94\u5B57\u6BB5\u3002" }),
    conflict && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "pw-note pw-warning", role: "alert", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("p", { children: "\u5176\u4ED6\u9875\u9762\u5DF2\u66F4\u65B0\u914D\u7F6E\uFF0C\u8349\u7A3F\u5DF2\u4FDD\u7559\u3002\u8F7D\u5165\u6700\u65B0\u503C\u4F1A\u6E05\u9664\u672C\u5730\u8349\u7A3F\uFF0C\u8BF7\u5148\u4FDD\u7559\u9700\u8981\u7684\u4FEE\u6539\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(import_dsh_client_ui_primitives12.Button, { size: "sm", variant: "outline", onClick: discard, children: "\u8F7D\u5165\u6700\u65B0\u914D\u7F6E" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "pw-save", children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: "pw-muted", role: "status", children: dirty ? `${dirty} \u9879\u672A\u4FDD\u5B58` : pending ? `${pending} \u9879\u7B49\u5F85\u91CD\u8F7D` : "\u65E0\u672A\u4FDD\u5B58\u66F4\u6539" }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "pw-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(import_dsh_client_ui_primitives12.Button, { size: "sm", variant: "ghost", disabled: !dirty || saving, onClick: discard, children: "\u64A4\u9500\u66F4\u6539" }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(import_dsh_client_ui_primitives12.Button, { size: "sm", variant: "primary", disabled: !dirty || invalid || saving || !connected || Boolean(conflict), onClick: persist, children: saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58\u66F4\u6539" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("p", { className: "pw-live-note", role: "status", "aria-live": "polite", children: message || "\u4FDD\u5B58\u540E\u91CD\u65B0\u52A0\u8F7D\u63D2\u4EF6\u6216\u91CD\u542F\u5B9E\u4F8B\uFF0C\u8BFB\u53D6\u65B0\u914D\u7F6E\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(TechnicalDetails, { title: "\u914D\u7F6E\u8303\u56F4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("p", { children: "\u914D\u7F6E\u8986\u76D6\u4F5C\u7528\u4E8E\u5F53\u524D DSH_HOME \u4E0B\u7684 Patchwork\uFF0C\u4E0D\u662F profile \u6216\u4F1A\u8BDD\u72EC\u7ACB\u914D\u7F6E\u3002\u672A\u4F7F\u7528 Patchwork \u7684 Agent \u4E0D\u53D7\u8FD9\u4E9B\u673A\u5236\u8BBE\u7F6E\u5F71\u54CD\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("p", { children: "\u4E3B\u9898\u548C\u5B57\u4F53\u7531 DSH \u5916\u89C2\u8BBE\u7F6E\u7EDF\u4E00\u63A7\u5236\u3002\u72EC\u7ACB\u6D4F\u89C8\u5668\u73AF\u5883\u4E0E\u8D44\u6E90\u8BBE\u7F6E\u5728\u53EF\u9009\u6D4F\u89C8\u5668\u5305\u5185\u7BA1\u7406\u3002" })
    ] })
  ] });
}

// src/client/WorkspacePanels.jsx
var import_jsx_runtime15 = require("react/jsx-runtime");
var settingsKeys = SETTING_FIELDS.map((field) => field.key);
function EvidencePanel({ data, view, setView, prefix, memoryAction, memoryQuery, improvementAction, superagentAction }) {
  const events = data.events ?? [];
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("nav", { className: "pw-secondary-nav", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_dsh_client_ui_primitives13.SegmentedTabs, { label: "\u8BC1\u636E\u7C7B\u522B", value: view, onChange: setView, items: [
      ["current", "\u672C\u6B21"],
      ["retrieval", "\u68C0\u7D22"],
      ["memory", "\u8BB0\u5FC6"],
      ["improvements", "\u6539\u8FDB"]
    ].map(([value, label]) => ({ value, label, id: prefix + "-evidence-" + value, panelId: prefix + "-evidence-panel" })) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { role: "tabpanel", id: prefix + "-evidence-panel", "aria-labelledby": prefix + "-evidence-" + view, children: [
      view === "current" && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(TaskEvidence, { task: data.task, expanded: true, reviewAction: superagentAction }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolEvidencePanel, { events })
      ] }),
      view === "retrieval" && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(RetrievalPanel, { data }),
      view === "memory" && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(MemoryPanel, { data, onCurrent: () => setView("current"), memoryAction, memoryQuery }),
      view === "improvements" && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ImprovementPanel, { data, improvementAction })
    ] })
  ] });
}

// src/client/PatchworkPanel.jsx
var import_jsx_runtime16 = require("react/jsx-runtime");
var tabs = [["overview", "\u603B\u89C8"], ["queue", "\u4E3B\u63A7"], ["mechanisms", "\u673A\u5236"], ["evidence", "\u8BC1\u636E"], ["logs", "\u65E5\u5FD7"], ["settings", "\u8BBE\u7F6E"]];
var connectionLabels = { loading: "\u8FDE\u63A5\u4E2D", connected: "\u5DF2\u8FDE\u63A5", offline: "\u8FDE\u63A5\u4E2D\u65AD", unavailable: "\u7B49\u5F85\u4F1A\u8BDD" };
function PatchworkTitle() {
  return (0, import_react14.createElement)("span", null, "Patchwork");
}
function PatchworkPanel({ sessionId, sessionStore, useTabInfo }) {
  const allowed = (0, import_react14.useSyncExternalStore)(
    sessionStore.subscribe,
    () => sessionStore.getSnapshot().byId[sessionId]?.projectionValues?.agentPreset === "patchwork",
    () => false
  );
  const { tab } = useTabInfo();
  if (!tab.visible) return null;
  if (!allowed) return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "pw-panel", children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "pw-locked", children: /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(EmptyState, { title: "Patchwork \u5C1A\u672A\u542F\u7528", icon: "lock", children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("p", { children: "\u5728 Agent \u9009\u62E9\u5668\u4E2D\u9009\u62E9 Patchwork\uFF0C\u4F7F\u7528\u4F1A\u8BDD\u9762\u677F\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("p", { children: "\u5DE5\u5177\u3001\u6280\u80FD\u4E0E\u65E5\u5FD7\u53EA\u5BF9 Patchwork \u4F1A\u8BDD\u5F00\u653E\u3002" })
  ] }) }) });
  return (0, import_react14.createElement)(SessionPanel, { key: sessionId ?? "none", sessionId });
}
function SessionPanel({ sessionId }) {
  const { snapshot: data, connection, error, save, refresh, exportLogs, memoryAction, memoryQuery, improvementAction, superagentAction } = usePatchworkState(sessionId);
  const [tab, setTab] = (0, import_react14.useState)("overview");
  const [evidenceView, setEvidenceView] = (0, import_react14.useState)("current");
  const [draft, setDraft] = (0, import_react14.useState)({});
  const [baseRevision, setBaseRevision] = (0, import_react14.useState)(null);
  const [saving, setSaving] = (0, import_react14.useState)(false);
  const [message, setMessage] = (0, import_react14.useState)("");
  const [conflict, setConflict] = (0, import_react14.useState)(null);
  const desired = data?.config ?? {}, loaded = data?.loadedConfig ?? {};
  const dirty = Object.keys(draft).length;
  const pending = settingsKeys.filter((key) => JSON.stringify(desired[key]) !== JSON.stringify(loaded[key])).length;
  const ratio = draft.cacheWriteReadRatio ?? desired.cacheWriteReadRatio ?? 12.5;
  const invalid = !validateSettings(draft).ok || ratio === "" || !Number.isFinite(Number(ratio)) || Number(ratio) < 0;
  const prefix = "pw-" + String(sessionId ?? "none").replace(/[^a-zA-Z0-9-]/g, "");
  function navigate(next, view) {
    setTab(next);
    if (view) setEvidenceView(view);
  }
  function edit(key, value) {
    if (!dirty) setBaseRevision(data?.revision);
    setDraft((previous) => {
      const next = { ...previous };
      if (JSON.stringify(value) === JSON.stringify(desired[key])) delete next[key];
      else next[key] = value;
      return next;
    });
    setMessage("");
  }
  async function persist() {
    setSaving(true);
    setMessage("");
    try {
      await save(draft, baseRevision ?? data.revision);
      setDraft({});
      setConflict(null);
      setBaseRevision(null);
      setMessage("\u5DF2\u4FDD\u5B58\uFF0C\u91CD\u65B0\u52A0\u8F7D\u540E\u8BFB\u53D6\u65B0\u914D\u7F6E\u3002\u73B0\u6709 Agent \u4EE5\u5B9E\u9645\u80FD\u529B\u4E3A\u51C6\u3002");
    } catch (e) {
      setConflict(e.conflict);
      setMessage(e.conflict ? "\u914D\u7F6E\u5DF2\u88AB\u5176\u4ED6\u9875\u9762\u4FEE\u6539\uFF0C\u8349\u7A3F\u5DF2\u4FDD\u7559\u3002" : e.message);
    } finally {
      setSaving(false);
    }
  }
  function discard() {
    setDraft({});
    setConflict(null);
    setBaseRevision(null);
    setMessage("");
    refresh();
  }
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "pw-panel", children: /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "pw-panel-inner", children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("header", { className: "pw-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "pw-scope", title: sessionId, children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("strong", { children: "Patchwork" }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: "\u5F53\u524D\u4F1A\u8BDD" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "pw-header-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("span", { className: "pw-connection", title: data ? `\u66F4\u65B0\u4E8E ${logTime(data.generatedAt)}` : void 0, children: [
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "pw-dot", "data-tone": connection === "connected" ? "success" : connection === "offline" ? "warn" : void 0 }),
          connectionLabels[connection]
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_dsh_client_ui_primitives14.Button, { size: "sm", variant: "ghost", "aria-label": "\u5237\u65B0", title: "\u5237\u65B0\u4F1A\u8BDD\u72B6\u6001", icon: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(PanelIcon, { name: "refresh" }), onClick: refresh, disabled: saving })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("nav", { className: "pw-nav", children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_dsh_client_ui_primitives14.SegmentedTabs, { label: "Patchwork \u9875\u9762", value: tab, onChange: setTab, items: tabs.map(([value, label]) => ({ value, label, id: prefix + "-" + value, panelId: prefix + "-panel" })) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "pw-scroll", children: [
      connection === "offline" && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { role: "status", className: "pw-note pw-warning", children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(PanelIcon, { name: "activity" }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("p", { children: [
          "\u8FDE\u63A5\u4E2D\u65AD\uFF0C\u5F53\u524D\u663E\u793A\u4E0A\u6B21\u5FEB\u7167\u3002\u6062\u590D\u524D\u6682\u505C\u4FDD\u5B58\u4E0E\u5BFC\u51FA\u3002",
          error
        ] })
      ] }),
      connection === "unavailable" && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(EmptyState, { title: "\u7B49\u5F85\u4F1A\u8BDD\u72B6\u6001", children: "\u9009\u4E2D\u6216\u5EFA\u7ACB Patchwork \u4F1A\u8BDD\u540E\uFF0C\u8FD0\u884C\u72B6\u6001\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002" }),
      connection === "loading" && !data && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { "aria-busy": "true", children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(EmptyState, { title: "\u6B63\u5728\u8FDE\u63A5\u4F1A\u8BDD", children: "\u6B63\u5728\u8BFB\u53D6 DSH \u7684\u771F\u5B9E\u8FD0\u884C\u72B6\u6001\u3002" }) }),
      data && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("section", { className: "pw-page pw-page-" + tab, id: prefix + "-panel", role: "tabpanel", "aria-labelledby": prefix + "-" + tab, children: [
        tab === "overview" && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(OverviewPanel, { data, pending, navigate }),
        tab === "queue" && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(SuperagentPanel, { data, superagentAction }),
        tab === "mechanisms" && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(MechanismsPanel, { data }),
        tab === "evidence" && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(EvidencePanel, { data, view: evidenceView, setView: setEvidenceView, prefix, memoryAction, memoryQuery, improvementAction, superagentAction }),
        tab === "logs" && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(LogPanel, { diagnostics: data.diagnostics, exportLogs, connected: connection === "connected" }),
        tab === "settings" && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(SettingsPanel, { ...{ data, draft, saving, invalid, ratio, conflict, dirty, message, pending, prefix, edit, persist, discard }, connected: connection === "connected" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("footer", { className: "pw-footer", children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: "\u4EC5\u9650\u5F53\u524D\u4F1A\u8BDD" }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: data ? `\u66F4\u65B0\u4E8E ${logTime(data.generatedAt)}` : connectionLabels[connection] })
    ] })
  ] }) });
}

// src/client/panel-styles.mjs
var PANEL_CSS = String.raw`
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
  --pw-radius:var(--dsw-radius-xl,20px);
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
.pw-header-actions button { width:28px; height:28px; padding:0; border-radius:var(--dsw-radius-xs,6px) }
.pw-connection { display:inline-flex; align-items:center; gap:6px; font-size:11px; color:var(--pw-muted); white-space:nowrap }
.pw-dot { width:6px; height:6px; border-radius:50%; corner-shape:round; display:inline-block; flex:none; background:var(--pw-muted) }
.pw-panel [data-tone=success],.pw-success { color:var(--dsw-alias-state-success-primary) }
.pw-panel [data-tone=warn],.pw-warning { color:var(--dsw-alias-state-warn-label) }
.pw-panel [data-tone=error],.pw-error { color:var(--dsw-alias-state-error-primary) }
.pw-dot[data-tone=success] { background:var(--dsw-alias-state-success-primary) }
.pw-dot[data-tone=warn] { background:var(--dsw-alias-state-warn-label) }
.pw-dot[data-tone=error] { background:var(--dsw-alias-state-error-primary) }
.pw-nav { flex:none; padding:0 20px 4px }
.pw-panel :is(.pw-nav,.pw-secondary-nav) [role=tablist] { width:100%; min-width:0 }
.pw-panel :is(.pw-nav,.pw-secondary-nav) [role=tab] { min-width:0; padding-inline:6px; font-size:12px; white-space:nowrap }
.pw-scroll { flex:1; min-height:0; min-width:0; overflow:auto; scrollbar-width:thin; scrollbar-color:var(--pw-line) transparent }
.pw-page { padding:18px 20px 24px; overflow-wrap:anywhere; display:flex; flex-direction:column; gap:16px }
.pw-footer { flex:none; height:32px; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:0 20px; font-size:10px; color:var(--pw-muted) }
.pw-eyebrow { color:var(--pw-muted); font-size:11px; margin-bottom:7px!important }
.pw-task-state { display:flex; align-items:center; gap:7px; font-size:12px; margin-top:9px!important; color:var(--pw-secondary) }
.pw-stage-line { display:flex; list-style:none; padding:0; margin:23px 0 13px; max-width:490px; gap:0 }
.pw-stage-line li { flex:1; display:flex; align-items:center; gap:7px; font-size:12px; color:var(--pw-muted) }
.pw-stage-line li::before { content:''; width:6px; height:6px; border-radius:50%; corner-shape:round; background:var(--pw-line); flex:none }
.pw-stage-line li:not(:last-child)::after { content:''; height:1px; background:var(--pw-line); flex:1; margin:0 12px 0 5px }
.pw-stage-line li[aria-current=step] { color:var(--pw-accent) }
.pw-stage-line li[aria-current=step]::before { background:var(--pw-accent); outline:3px solid color-mix(in srgb,var(--pw-accent) 14%,transparent) }
.pw-muted { color:var(--pw-muted); font-size:12px }
.pw-card,.pw-section { padding:18px; border:.5px solid var(--pw-card-line); border-radius:var(--pw-radius); background:var(--pw-surface); min-width:0 }
.pw-section { margin:0 }
.pw-task { display:flex; flex-direction:column; gap:16px; min-width:0 }
.pw-task-summary h2 { font-size:20px; font-weight:500; line-height:1.5 }
.pw-card>.pw-row:last-child,.pw-section>.pw-row:last-child,.pw-section>.pw-check-row:last-child { border-bottom:0; padding-bottom:0 }
.pw-card>.pw-row:first-child { padding-top:0 }
.pw-card .pw-section { border:0; border-radius:0; padding:16px 0 0; background:none }
.pw-task-core>.pw-section { padding-top:16px; margin-top:18px; border-top:.5px solid var(--pw-card-line) }
.pw-card .pw-technical,.pw-section .pw-technical,.pw-candidate .pw-technical,.pw-log-detail .pw-technical { background:none; border:0; border-top:.5px solid var(--pw-card-line); border-radius:0; padding:0; margin-top:16px }
.pw-section-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px }
.pw-section-heading>div { min-width:0 }
.pw-section-heading p,.pw-page-heading p { color:var(--pw-muted); font-size:12px; margin-top:6px }
.pw-section-heading button { color:var(--pw-muted); font-size:11px; padding:3px 0; height:auto; flex:none }
.pw-section-heading button .pw-icon { width:12px; height:12px }
.pw-page-heading { margin-bottom:2px; padding:2px 2px 0 }
.pw-heading-actions { display:flex; align-items:flex-start; justify-content:space-between; gap:12px }
.pw-heading-actions>button { flex:none }
.pw-row,.pw-check-row { display:flex; align-items:center; gap:12px; padding:16px 0; border-bottom:1px solid var(--pw-card-line); min-width:0 }
.pw-check-row { padding:13px 0; gap:10px }
.pw-check-row>.pw-icon { width:15px; height:15px; align-self:flex-start; margin-top:3px }
.pw-copy { flex:1; min-width:0 }
.pw-copy strong,.pw-copy label { display:block; font-weight:500; font-size:13px }
.pw-check-row .pw-copy strong { font-weight:400; font-size:12px }
.pw-copy small { display:block; color:var(--pw-muted); font-size:11px; margin-top:5px; overflow-wrap:anywhere }
.pw-status { font-size:11px; color:var(--pw-muted); flex:none; white-space:nowrap }
.pw-task-cta { margin-top:15px }
.pw-task-path { display:block; font-size:11px; white-space:pre-wrap; overflow-wrap:anywhere; word-break:break-word; max-width:100% }
.pw-knowledge-row { width:100%; display:flex; align-items:center; justify-content:space-between; text-align:left; border:0; border-bottom:1px solid var(--pw-line); background:none; padding:12px 0; color:inherit; gap:14px }
.pw-knowledge-row strong { font-weight:400; font-size:13px }
.pw-knowledge-row small { display:block; color:var(--pw-muted); font-size:11px; margin-top:5px }
.pw-knowledge-row>.pw-icon { width:14px; height:14px; color:var(--pw-muted) }
.pw-compare,.pw-compare-row { display:grid; grid-template-columns:minmax(0,1fr) 60px 60px; gap:12px; align-items:center }
.pw-compare { padding:8px 0; border-bottom:1px solid var(--pw-line); color:var(--pw-muted); font-size:11px }
.pw-compare-row { padding:20px 0; border-bottom:1px solid var(--pw-line); font-size:12px }
.pw-compare-row:last-child { border-bottom:0; padding-bottom:0 }
.pw-mechanism-code { font:10px var(--ds-font-family-code),monospace; color:var(--pw-muted) }
.pw-page-evidence { padding-top:18px }
.pw-page-evidence>div[role=tabpanel] { display:flex; flex-direction:column; gap:16px; min-width:0 }
.pw-secondary-nav { margin-bottom:0 }
.pw-panel .pw-secondary-nav [role=tab] { font-size:12px }
.pw-candidate { border:.5px solid var(--pw-card-line); border-radius:var(--pw-radius); padding:18px; background:var(--pw-surface) }
.pw-section>.pw-candidate { border:0; border-top:.5px solid var(--pw-card-line); border-radius:0; padding:16px 0 0; margin-top:16px; background:none }
.pw-page-evidence article.pw-knowledge-row { padding:18px; border:1px solid var(--pw-card-line); border-radius:var(--pw-radius); background:var(--pw-surface); flex-wrap:wrap }
.pw-candidate>p { margin-top:12px; font-size:12px; color:var(--pw-secondary) }
.pw-input { border:.5px solid var(--pw-line); background:var(--dsw-alias-bg-base); color:inherit; padding:6px 9px; border-radius:var(--dsw-radius-sm,8px); font-size:12px; max-width:100%; min-width:0 }
.pw-ratio { width:84px; flex:none }
.pw-search { display:flex; align-items:center; gap:9px; border:.5px solid var(--pw-line); border-radius:var(--dsw-radius-md,12px); padding:7px 10px; background:var(--dsw-alias-bg-base); min-width:0; width:100% }
.pw-search:focus-within { outline:2px solid color-mix(in srgb,var(--pw-accent) 25%,transparent); border-color:var(--pw-accent) }
.pw-search>.pw-icon { width:14px; height:14px; color:var(--pw-muted) }
.pw-search input { border:0; background:none; color:inherit; min-width:0; width:100%; font-size:12px; line-height:1.65; outline:0!important; padding:0 }
.pw-search input::placeholder { color:var(--pw-muted) }
.pw-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:10px 0 20px }
.pw-memory-controls .pw-toolbar { margin-bottom:12px }
.pw-memory-controls .pw-search > span { flex:1; min-width:0; border:0; background:none; padding:0; box-shadow:none }
.pw-memory-list,.pw-memory-editor,.pw-memory-detail,.pw-memory-confirm { display:flex; flex-direction:column; gap:14px; min-width:0 }
.pw-memory-item>div:first-child { align-items:flex-start }
.pw-memory-item h3,.pw-memory-detail h3 { font-size:13px; font-weight:500; overflow-wrap:anywhere }
.pw-memory-item>.pw-actions { margin-top:14px; flex-wrap:wrap }
.pw-memory-preview { margin-top:10px!important; color:var(--pw-secondary); font-size:12px; white-space:pre-wrap; overflow-wrap:anywhere }
.pw-memory-body { white-space:pre-wrap; overflow-wrap:anywhere; font-size:13px }
.pw-memory-bulk,.pw-memory-pagination { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap }
.pw-memory-bulk>.pw-actions,.pw-memory-editor>.pw-actions,.pw-memory-detail>.pw-actions { flex-wrap:wrap }
.pw-memory-editor label,.pw-field-label { display:flex; flex-direction:column; gap:8px; font-size:12px; color:var(--pw-secondary) }
.pw-memory-editor label>span { width:100% }
.pw-memory-editor .pw-field-label { margin-bottom:8px }
.pw-memory-editor .pw-memory-textarea { width:100%; min-height:100px; max-height:260px; border-radius:var(--dsw-radius-sm,8px); background:var(--dsw-alias-bg-base); border:1px solid var(--pw-line); padding:10px; font-size:13px; color:var(--dsw-alias-label-primary) }
.pw-memory-history-row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 0; font-size:12px }
.pw-memory-history-row>span { min-width:0; overflow-wrap:anywhere }
.pw-memory-confirm p { font-size:12px; color:var(--pw-secondary) }
.pw-log-controls .pw-toolbar { margin-bottom:0 }
.pw-select { padding:4px 8px; font-size:11px }
.pw-list { min-width:0 }
.pw-event { border-bottom:1px solid var(--pw-line) }
.pw-event:last-child { border-bottom:0 }
.pw-event>summary { display:flex; align-items:center; gap:10px; list-style:none; padding:16px 0; cursor:pointer }
.pw-event>summary::-webkit-details-marker,.pw-technical>summary::-webkit-details-marker { display:none }
.pw-event-main { flex:1; min-width:0 }
.pw-event-title { display:block; font-size:12px; overflow-wrap:anywhere }
.pw-summary-copy { overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.pw-event-subtitle { display:flex; flex-wrap:wrap; gap:4px 9px; color:var(--pw-muted); font-size:10px; margin-top:4px }
.pw-event-time { flex:none; font-size:10px; color:var(--pw-muted); font-variant-numeric:tabular-nums }
.pw-event-chevron { width:12px; height:12px; color:var(--pw-muted); transition:transform .12s }
.pw-event[open]>summary>.pw-event-chevron,.pw-technical[open]>summary>.pw-event-chevron { transform:rotate(90deg) }
.pw-event-body { padding:0 0 18px 16px; font-size:12px; min-width:0 }
.pw-panel pre { font-size:11px; line-height:1.8; background:var(--pw-soft); border:1px solid var(--pw-line); padding:12px; border-radius:var(--dsw-radius-sm,8px); white-space:pre-wrap; overflow-wrap:anywhere; max-width:100%; margin:12px 0; color:var(--pw-secondary) }
.pw-facts { margin:15px 0; font-size:11px }
.pw-facts>div { display:grid; grid-template-columns:84px minmax(0,1fr); gap:8px; padding:9px 0; border-bottom:1px solid var(--pw-line) }
.pw-facts dt { color:var(--pw-muted) }
.pw-facts dd { margin:0; overflow-wrap:anywhere; min-width:0 }
.pw-source-list { list-style:none; padding:0; margin:8px 0 0 }
.pw-source-list li { border-bottom:1px solid var(--pw-line); padding:10px 0 }
.pw-source-list a { color:var(--pw-accent); font-size:12px; overflow-wrap:anywhere }
.pw-source-list small { display:block; color:var(--pw-muted); font-size:10px; margin-top:3px; overflow-wrap:anywhere }
.pw-source-list p { color:var(--pw-secondary); font-size:11px; margin-top:5px }
.pw-technical { border:1px solid var(--pw-card-line); border-radius:var(--pw-radius); padding:0 18px; margin-top:0; font-size:11px; color:var(--pw-secondary); background:var(--pw-surface) }
.pw-panel .pw-nav [role=tablist] { overflow-x:auto; scrollbar-width:thin }
.pw-technical>summary { display:flex; align-items:center; gap:8px; padding:15px 0; list-style:none; cursor:pointer; color:var(--pw-muted) }
.pw-technical>p { margin:0 0 12px; font-size:11px; line-height:1.85 }
.pw-list-meta { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; color:var(--pw-muted); font-size:11px; padding-bottom:9px }
.pw-storage { display:flex; align-items:center; gap:5px }
.pw-log-row { display:grid; grid-template-columns:61px 40px minmax(0,1fr); gap:6px; width:100%; border:0; border-bottom:1px solid var(--pw-line); border-left:2px solid transparent; padding:14px 7px; text-align:left; background:none; color:inherit; font-size:11px; align-items:start }
.pw-log-row:hover,.pw-knowledge-row:hover { background:var(--pw-soft) }
.pw-log-row[aria-pressed=true] { border-left-color:var(--pw-accent); background:color-mix(in srgb,var(--pw-accent) 9%,transparent) }
.pw-log-row:last-child { border-bottom:0 }
.pw-log-row time { font:10px/1.8 var(--ds-font-family-code),monospace; color:var(--pw-muted) }
.pw-log-level { font:9px/2 var(--ds-font-family-code),monospace; color:var(--pw-muted) }
.pw-log-row>span:last-child { overflow-wrap:anywhere; min-width:0 }
.pw-log-detail { border:1px solid var(--pw-card-line); border-radius:var(--pw-radius); margin-top:0; padding:20px; background:var(--pw-surface) }
.pw-log-detail>h3 { font-size:15px; font-weight:500 }
.pw-log-detail>.pw-muted { margin-top:6px; font-size:11px }
.pw-log-reason { margin-top:16px!important; font-size:12px; color:var(--pw-secondary) }
.pw-save { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-top:0; padding:14px 16px; border:1px solid var(--pw-card-line); border-radius:var(--pw-radius); background:var(--pw-surface); position:sticky; bottom:0; z-index:1 }
.pw-actions { display:flex; gap:8px; align-items:center }
.pw-live-note { font-size:11px; color:var(--pw-muted); line-height:1.8; margin-top:8px!important }
.pw-note { display:flex; align-items:flex-start; gap:10px; background:var(--pw-surface); border:1px solid var(--pw-card-line); border-radius:var(--pw-radius); padding:16px; margin:0; font-size:12px; flex-wrap:wrap }
.pw-note p { flex:1 }
.pw-note button { flex:none }
.pw-note>div>button { margin-top:10px }
.pw-scroll>.pw-note { margin:16px 24px 0 }
.pw-empty { text-align:center; padding:30px 18px; color:var(--pw-secondary); font-size:12px; background:var(--pw-surface); border:1px solid var(--pw-card-line); border-radius:var(--pw-radius) }
.pw-card .pw-empty,.pw-section .pw-empty { border:0; background:none; padding:20px 4px }
.pw-empty>.pw-icon { width:25px; height:25px; margin-bottom:15px }
.pw-empty>h3 { font-size:14px; font-weight:500; color:var(--dsw-alias-label-primary) }
.pw-empty p { margin-top:8px }
.pw-empty button { margin-top:20px }
.pw-locked { padding:24px; overflow:auto; height:100% }
.pw-summary-strip { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(0,1fr); padding:16px 0; border-top:.5px solid var(--pw-line); border-bottom:.5px solid var(--pw-line); margin:0; min-width:0 }
.pw-summary-strip>div { padding:0 12px; border-right:.5px solid var(--pw-line); min-width:0 }
.pw-summary-strip>div:first-child { padding-left:0 }
.pw-summary-strip>div:last-child { border-right:0; padding-right:0 }
.pw-summary-strip dt { color:var(--pw-muted); font-size:11px; margin-bottom:5px }
.pw-summary-strip dd { margin:0; font-size:20px; font-weight:500; line-height:1.3; font-variant-numeric:tabular-nums; overflow-wrap:anywhere }
.pw-facets { display:flex; gap:4px; flex-wrap:wrap; align-items:center; min-width:0 }
.pw-facets button { font-size:12px; min-height:30px; padding:4px 9px; border-radius:var(--dsw-radius-sm,8px); color:var(--pw-secondary) }
.pw-facets button[aria-pressed=true] { color:var(--dsw-alias-label-primary); background:var(--pw-soft); box-shadow:inset 0 0 0 .5px var(--pw-line) }
.pw-facet-count { color:var(--pw-muted); font-size:11px; margin-left:6px; font-variant-numeric:tabular-nums }
.pw-search > span { flex:1; min-width:0; border:0; background:none; padding:0; box-shadow:none }
.pw-quick-links,.pw-inline-facts { display:flex; align-items:center; gap:8px 14px; flex-wrap:wrap; min-width:0 }
.pw-inline-facts { color:var(--pw-muted); font-size:11px; margin:10px 0 }
.pw-context-value { display:flex; justify-content:space-between; gap:12px; align-items:baseline; flex-wrap:wrap }
.pw-context-value strong { font-size:20px; font-weight:500 }
.pw-context-value strong small { font-size:12px; color:var(--pw-muted); font-weight:400 }
.pw-meter { height:5px; background:var(--pw-line); border-radius:var(--dsw-radius-xs,6px); margin-top:12px; overflow:hidden }
.pw-meter>span { display:block; height:100%; background:var(--pw-accent) }
.pw-master-detail { display:grid; grid-template-columns:minmax(0,1fr); gap:16px; min-width:0; align-items:start }
.pw-record-list { border:.5px solid var(--pw-card-line); border-radius:var(--pw-radius); background:var(--pw-surface); overflow:auto; max-height:340px; min-width:0 }
.pw-record-row { display:flex; flex-direction:column; gap:5px; width:100%; text-align:left; color:inherit; padding:14px 16px; border:0; border-bottom:.5px solid var(--pw-line); border-left:2px solid transparent; background:none; font:inherit; min-width:0 }
.pw-record-row:last-child { border-bottom:0 }
.pw-record-row:hover { background:var(--pw-soft) }
.pw-record-row[aria-pressed=true] { background:var(--pw-soft); border-left-color:var(--pw-accent) }
.pw-record-title { font-size:13px; font-weight:500; overflow-wrap:anywhere }
.pw-record-subtitle { color:var(--pw-muted); font-size:11px; overflow-wrap:anywhere }
.pw-record-status { display:inline-flex; align-items:center; gap:6px; font-size:11px; color:var(--pw-secondary) }
.pw-detail-pane { border:.5px solid var(--pw-card-line); border-radius:var(--pw-radius); background:var(--pw-surface); padding:18px; min-width:0; scroll-margin-top:16px }
.pw-detail-pane .pw-technical { border:0; border-top:.5px solid var(--pw-line); border-radius:0; background:none; padding:0; margin-top:16px }
.pw-detail-section { border-top:.5px solid var(--pw-line); padding-top:16px; margin-top:16px; min-width:0 }
.pw-detail-section>.pw-inline-facts { margin-block:8px }
.pw-detail-actions { margin-top:16px; flex-wrap:wrap }
.pw-queue-control .pw-actions { flex-wrap:wrap; justify-content:flex-end }
.pw-body-copy { color:var(--pw-secondary); font-size:12px; line-height:1.85; margin-top:8px!important; white-space:pre-wrap }
.pw-source-url { font-size:11px; overflow-wrap:anywhere; margin-block:10px!important }
.pw-source-url a { color:var(--pw-accent) }
.pw-copy-action { display:inline-flex; gap:6px; align-items:center; flex-wrap:wrap }
.pw-copy-action>span { font-size:10px }
.pw-lifecycle { display:flex; gap:8px; flex-wrap:wrap; padding:0; margin:12px 0; list-style:none; color:var(--pw-muted); font-size:11px }
.pw-lifecycle li { border-bottom:2px solid var(--pw-line); padding:4px 0 }
.pw-lifecycle li:last-child { color:var(--pw-secondary); border-color:var(--pw-accent) }
.pw-policy-diff { margin:14px 0; padding:12px; border-left:2px solid var(--pw-accent); background:var(--pw-soft); font-size:12px; overflow-wrap:anywhere }
.pw-policy-diff>span { color:var(--pw-muted); font-size:11px }
.pw-policy-diff>div { display:flex; gap:12px; flex-wrap:wrap; margin-top:6px }
.pw-candidate>.pw-summary-strip { margin-block:14px }
.pw-candidate>.pw-summary-strip dd { font-size:16px }
.pw-setting-row { flex-wrap:wrap }
.pw-setting-row .pw-copy { flex:1 1 170px }
.pw-setting-row>.pw-input,.pw-setting-row>span:has(input) { max-width:210px; min-width:100px }
.pw-setting-row[data-changed=true] { box-shadow:inset 2px 0 0 var(--pw-accent); padding-left:12px }
.pw-setting-diff { display:grid; grid-template-columns:minmax(0,1fr); gap:5px; padding:12px 0; border-bottom:.5px solid var(--pw-line); font-size:12px; overflow-wrap:anywhere }
.pw-setting-diff>strong { font-weight:500 }
.pw-setting-diff>span { color:var(--pw-secondary); font-size:11px }
.pw-evidence-group { padding-top:14px; border-top:.5px solid var(--pw-line); margin-top:14px }
.pw-evidence-group .pw-list-meta code { min-width:0; overflow-wrap:anywhere }
.pw-log-list { max-height:420px; overflow:auto; scrollbar-width:thin }
.pw-memory-item { padding:14px 16px }
.pw-memory-preview { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden }
.pw-check-row { flex-wrap:wrap }
.pw-check-row>.pw-copy { flex:1 1 140px }
.pw-toolbar { flex-wrap:wrap }
@container patchwork (min-width:760px) {
  .pw-master-detail { grid-template-columns:minmax(240px,.85fr) minmax(0,1.35fr) }
  .pw-record-list { max-height:580px }
  .pw-detail-pane { position:sticky; top:0 }
  .pw-setting-diff { grid-template-columns:minmax(120px,1fr) minmax(0,1fr) minmax(0,1fr) }
}
@container patchwork (max-width:390px) {
  .pw-header { padding:12px 14px 10px }
  .pw-nav { padding:0 12px 3px }
  .pw-panel .pw-nav [role=tablist] { gap:2px }
  .pw-panel .pw-nav [role=tab] { padding:6px 4px; font-size:12px }
  .pw-page { padding:14px 12px 18px; gap:12px }
.pw-card,.pw-section,.pw-candidate,.pw-log-detail { padding:16px }
  .pw-task,.pw-page-evidence>div[role=tabpanel] { gap:12px }
  .pw-footer { padding:0 16px }
  .pw-scope { gap:6px; font-size:11px }
  .pw-connection { font-size:10px }
  .pw-panel h2 { font-size:18px }
  .pw-stage-line li { font-size:11px }
  .pw-stage-line li:not(:last-child)::after { margin-right:7px }
  .pw-compare,.pw-compare-row { grid-template-columns:minmax(0,1fr) 44px 44px; gap:8px }
  .pw-row { gap:10px }
  .pw-event-time { display:none }
  .pw-log-row { grid-template-columns:53px 34px minmax(0,1fr); padding-inline:5px; gap:4px }
  .pw-log-row time { font-size:9px }
  .pw-save { align-items:flex-start }
  .pw-save>.pw-actions { margin-left:auto }
}
@media (prefers-reduced-motion:reduce) { .pw-event-chevron { transition:none } }
`;

// src/client/index.jsx
var TAB_ID = "patchwork-agent";
var TAB_KIND = "patchwork";
var title = () => "Patchwork";
var inject = ["slots", "sidebarRightTabs", "sessions"];
function apply(ctx) {
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = "@patchwork/coding-agent";
    style.textContent = PANEL_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, "patchwork: token-based panel styles");
  ctx.effect(
    () => ctx.sidebarRightTabs.register({
      id: TAB_ID,
      kind: TAB_KIND,
      // title 是必填字段：标签片上的初始文字。
      title,
      // 没有 guide 条目，这个 page 类型就没有任何入口能被打开——它既不匹配
      // 任何资源地址，也没有按钮。guide 就是那个入口。
      guide: [
        {
          // id 是 guide 条目的稳定标识（注册时按它查重），必须给。
          id: TAB_KIND,
          order: 50,
          title,
          description: () => "\u4EC5\u9650 Patchwork Agent \u7684\u914D\u7F6E\u4E0E\u8FD0\u884C\u8BC1\u636E"
        }
      ]
    }),
    "patchwork: sidebar tab definition"
  );
  ctx.effect(
    () => ctx.slots.inject(
      "sidebar.right.pane.tab",
      () => ctx.slots.register({ name: "sidebar.right.pane.tab", key: TAB_ID, inject: (sessionId) => ({ sessionId, sessionStore: ctx.sessions.list }) }, PatchworkPanel)
    ),
    "patchwork: sidebar tab body"
  );
  ctx.effect(
    () => ctx.slots.inject(
      "sidebar.right.pane.tab.title",
      () => ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: TAB_ID }, PatchworkTitle)
    ),
    "patchwork: sidebar tab title"
  );
}

		return module.exports;
	},
});

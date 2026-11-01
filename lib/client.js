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
var import_react6 = require("react");
var import_dsh_client_ui_primitives4 = require("@deepseek-ai/dsh-client-ui-primitives");

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
  (0, import_react.useEffect)(() => {
    active.current = true;
    return () => {
      active.current = false;
      exportController.current?.abort();
      saveController.current?.abort();
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
  async function memoryAction(action, id, expectedRevision) {
    const metadata = readConnectionMetadata();
    if (!active.current || !metadata?.memoryPath || !sessionId || connection !== "connected") throw new Error("memory-unavailable");
    const response = await fetch(metadata.memoryPath + "?sessionId=" + encodeURIComponent(sessionId), {
      method: "POST",
      headers: { "content-type": "application/json", "x-patchwork-token": metadata.token },
      body: JSON.stringify({ action, id, expectedRevision })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      const error2 = new Error(data.reason ?? "memory-action-failed");
      error2.conflict = response.status === 409 ? data : null;
      throw error2;
    }
    refresh((x) => x + 1);
    return data;
  }
  async function improvementAction(action, candidateId, expectedRevision) {
    const metadata = readConnectionMetadata();
    if (!active.current || !metadata?.improvementPath || !sessionId || connection !== "connected") throw new Error("improvement-unavailable");
    const response = await fetch(metadata.improvementPath + "?sessionId=" + encodeURIComponent(sessionId), {
      method: "POST",
      headers: { "content-type": "application/json", "x-patchwork-token": metadata.token },
      body: JSON.stringify({ action, candidateId, expectedRevision })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      const error2 = new Error(data.reason ?? "improvement-action-failed");
      error2.conflict = response.status === 409 ? data : null;
      throw error2;
    }
    refresh((x) => x + 1);
    return data;
  }
  return { snapshot, connection, error, save, exportLogs, memoryAction, improvementAction, refresh: () => refresh((x) => x + 1) };
}

// src/client/LogPanel.jsx
var import_react3 = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/panel-elements.jsx
var import_react2 = require("react");

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
var import_jsx_runtime = require("react/jsx-runtime");
function PanelIcon({ name, className = "", ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { className: `pw-icon ${className}`, width: "16", height: "16", viewBox: "0 0 512 512", fill: "currentColor", stroke: "none", "aria-hidden": "true", ...props, children: (icons[name] ?? icons.activity).map(([tag, attributes], index) => (0, import_react2.createElement)(tag, { ...attributes, key: index })) });
}
function EmptyState({ title: title2, children, icon = "activity" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pw-empty", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelIcon, { name: icon }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: title2 }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children })
  ] });
}
function SectionHeading({ title: title2, description, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pw-section-heading", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: title2 }),
      description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: description })
    ] }),
    children
  ] });
}
function TechnicalDetails({ children, title: title2 = "\u6280\u672F\u5B57\u6BB5", open }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { className: "pw-technical", open, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelIcon, { name: "chevron", className: "pw-event-chevron" }),
      title2
    ] }),
    children
  ] });
}

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
var import_jsx_runtime2 = require("react/jsx-runtime");
function LogDetail({ entry }) {
  const facts = logFacts(entry);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "pw-log-detail", "aria-label": "\u6240\u9009\u65E5\u5FD7\u8BE6\u60C5", id: "pw-log-detail", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { children: logTitle(entry) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "pw-muted", children: [
      mechanismLabels[entry.mechanism] ?? entry.mechanism,
      " \xB7 ",
      levelLabels[entry.level] ?? entry.level,
      " \xB7 ",
      logTime(entry.at)
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pw-log-reason", children: logReason(entry) }),
    facts.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dl", { className: "pw-facts", children: facts.map(([label, value]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: label }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { className: "pw-mono", children: value })
    ] }, label)) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(TechnicalDetails, { title: "\u5173\u8054\u6307\u7EB9\u4E0E\u539F\u59CB\u5143\u6570\u636E", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("dl", { className: "pw-facts", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: "\u5BBF\u4E3B\u5E8F\u53F7" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { children: entry.seq == null ? "\u5185\u5B58\u8BB0\u5F55" : entry.seq })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: "\u539F\u56E0\u7801" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { children: entry.reason })
        ] }),
        Object.entries({ callIdHash: "\u8C03\u7528\u6307\u7EB9", rootCallIdHash: "\u6839\u8C03\u7528\u6307\u7EB9", commandHash: "\u547D\u4EE4\u6307\u7EB9", source: "\u539F\u6587 SHA256", handle: "\u5F52\u6863\u53E5\u67C4" }).filter(([key]) => entry[key]).map(([key, label]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { children: label }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { children: entry[key] })
        ] }, key))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pre", { children: JSON.stringify(entry, null, 2) })
    ] })
  ] });
}
function LogPanel({ diagnostics, exportLogs, connected }) {
  const [mechanism, setMechanism] = (0, import_react3.useState)("all");
  const [level, setLevel] = (0, import_react3.useState)("all");
  const [query, setQuery] = (0, import_react3.useState)("");
  const [selectedId, setSelectedId] = (0, import_react3.useState)(null);
  const [message, setMessage] = (0, import_react3.useState)("");
  const [exporting, setExporting] = (0, import_react3.useState)(false);
  const entries = diagnostics?.entries ?? [];
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pw-page-heading pw-heading-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: "\u8FD0\u884C\u65E5\u5FD7" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: "\u67E5\u770B\u673A\u5236\u51B3\u7B56\uFF0C\u5B9A\u4F4D\u6267\u884C\u4E2D\u7684\u95EE\u9898\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Button, { size: "sm", variant: "outline", icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PanelIcon, { name: "download" }), "aria-label": "\u5BFC\u51FA\u8BCA\u65AD\u5143\u6570\u636E", disabled: !connected || exporting, onClick: download, children: exporting ? "\u5BFC\u51FA\u4E2D\u2026" : "\u5BFC\u51FA" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "pw-card pw-log-controls", "aria-label": "\u65E5\u5FD7\u7B5B\u9009", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pw-search", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(PanelIcon, { name: "search" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("input", { type: "search", "aria-label": "\u641C\u7D22\u65E5\u5FD7", placeholder: "\u641C\u7D22\u4E8B\u4EF6\u3001\u539F\u56E0\u6216\u6307\u7EB9", value: query, onChange: (event) => setQuery(event.target.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pw-toolbar", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("select", { className: "pw-input pw-select", "aria-label": "\u65E5\u5FD7\u7EA7\u522B", value: level, onChange: (event) => setLevel(event.target.value), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "all", children: "\u5168\u90E8\u7EA7\u522B" }),
          Object.entries(levelLabels).map(([value, label]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value, children: label }, value))
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("select", { className: "pw-input pw-select", "aria-label": "\u65E5\u5FD7\u673A\u5236", value: mechanism, onChange: (event) => setMechanism(event.target.value), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "all", children: "\u5168\u90E8\u673A\u5236" }),
          Object.entries(mechanismLabels).map(([value, label]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value, children: label }, value))
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "pw-card", "aria-label": "\u65E5\u5FD7\u5217\u8868", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pw-list-meta", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
          visible.length,
          " \u6761\u8BB0\u5F55",
          visible.length !== entries.length ? ` / \u5171 ${entries.length} \u6761` : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "pw-storage", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "pw-dot", "data-tone": native ? "success" : "warn" }),
          native ? "\u5DF2\u5199\u5165\u4F1A\u8BDD" : persistence === "failed" ? "\u5199\u5165\u5931\u8D25 \xB7 \u5185\u5B58\u4FDD\u7559" : "\u4EC5\u672C\u6B21\u8FD0\u884C"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "pw-log-list", "aria-label": "\u65E5\u5FD7\u8BB0\u5F55", children: visible.length ? visible.map(({ entry, id }) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "pw-log-row", "aria-pressed": selected.id === id, "aria-controls": "pw-log-detail", onClick: () => setSelectedId(id), children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("time", { dateTime: entry.at, children: logTime(entry.at) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "pw-log-level", "data-tone": logTone(entry), children: String(entry.level ?? "\u672A\u77E5").toUpperCase() }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: logTitle(entry) })
      ] }, id)) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(EmptyState, { title: entries.length ? "\u6CA1\u6709\u5339\u914D\u7684\u8BB0\u5F55" : "\u8FD8\u6CA1\u6709\u8FD0\u884C\u8BB0\u5F55", children: entries.length ? "\u8BD5\u8BD5\u5176\u4ED6\u673A\u5236\u3001\u7EA7\u522B\u6216\u641C\u7D22\u5173\u952E\u8BCD\u3002" : "\u6267\u884C\u4EFB\u52A1\u540E\uFF0C\u673A\u5236\u51B3\u7B56\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002" }) })
    ] }),
    selected && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(LogDetail, { entry: selected.entry }),
    message && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "pw-live-note", role: "status", children: message }),
    diagnostics?.failures > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { className: "pw-warning", role: "status", children: [
      "\u539F\u751F\u5199\u5165\u5931\u8D25 ",
      diagnostics.failures,
      " \u6B21\uFF0C\u672A\u5199\u5165\u7684\u8BB0\u5F55\u4EC5\u4FDD\u7559\u5728\u672C\u6B21\u8FD0\u884C\u4E2D\u3002"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(TechnicalDetails, { title: "\u8BB0\u5F55\u8303\u56F4\u4E0E\u9690\u79C1", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { children: [
        "\u6700\u591A\u663E\u793A\u6700\u8FD1 ",
        diagnostics?.limit ?? 200,
        " \u6761\u3002\u9996\u6B21\u6062\u590D\u68C0\u67E5\u5C3E\u90E8 ",
        diagnostics?.historyScanLimit ?? 5e3,
        " \u4E2A\u5BBF\u4E3B\u4E8B\u4EF6\uFF0C\u8F83\u65E9\u8BB0\u5F55\u53EF\u80FD\u4E0D\u51FA\u73B0\u5728\u6B64\u5217\u8868\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { children: [
        native ? "\u8BCA\u65AD\u4FDD\u5B58\u4E8E DSH \u539F\u751F\u4F1A\u8BDD\u3002" : persistence === "failed" ? "\u539F\u751F\u5199\u5165\u5931\u8D25\uFF0C\u76EE\u524D\u4F7F\u7528\u6709\u754C\u5185\u5B58\u8BB0\u5F55\u3002" : "\u5F53\u524D\u5BBF\u4E3B\u672A\u63D0\u4F9B\u53EF\u7528\u7684\u539F\u751F\u63D2\u4EF6\u8BB0\u5F55\uFF0C\u91CD\u542F\u540E\u5185\u5B58\u8BB0\u5F55\u4E0D\u53EF\u6062\u590D\u3002",
        "\u5BFC\u51FA\u8303\u56F4\u4E0E\u9884\u89C8\u4E00\u81F4\uFF0C\u4E0D\u53D7\u5F53\u524D\u7B5B\u9009\u5F71\u54CD\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: "\u53EA\u8BB0\u5F55\u767D\u540D\u5355\u5143\u6570\u636E\uFF1B\u547D\u4EE4\u4E0E\u8C03\u7528 ID \u4F7F\u7528 SHA256 \u6307\u7EB9\u3002\u4E0D\u5305\u542B\u63D0\u793A\u8BCD\u6216\u539F\u6587\u8BC1\u636E\uFF0C\u5B8C\u6574\u539F\u6587\u4ECD\u7531\u8BC1\u636E\u5F52\u6863\u4FDD\u7559\u3002" })
    ] })
  ] });
}

// src/client/WorkspacePanels.jsx
var import_react5 = require("react");
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/EvidenceList.jsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var outcomes = { completed: "\u5DE5\u5177\u5B8C\u6210", failed: "\u6267\u884C\u5931\u8D25", skipped: "\u5DF2\u8DF3\u8FC7", unverified: "\u5F85\u6838\u9A8C" };
function EvidenceList({ items }) {
  if (!items.length) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(EmptyState, { title: "\u6682\u65E0\u5DE5\u5177\u8BC1\u636E", children: "\u4EFB\u52A1\u4E2D\u7684\u5DE5\u5177\u7ED3\u679C\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\uFF0C\u4EC5\u4FDD\u7559\u5F53\u524D\u4F1A\u8BDD\u7684\u9884\u89C8\u3002" });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "pw-list", children: items.map((event) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("details", { className: "pw-event", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("summary", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "pw-dot", "data-tone": event.outcome === "failed" ? "error" : event.outcome === "completed" ? "success" : "warn" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "pw-event-main", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "pw-event-title pw-summary-copy", children: event.command ?? event.path ?? event.tool }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "pw-event-subtitle", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "pw-mono", children: event.tool }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: outcomes[event.outcome] ?? "\u672A\u77E5\u7ED3\u679C" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: Number.isInteger(event.exitCode) ? `exit ${event.exitCode}` : "\u9000\u51FA\u7801\u672A\u91C7\u96C6" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("time", { className: "pw-event-time", dateTime: event.at, children: logTime(event.at) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PanelIcon, { name: "chevron", className: "pw-event-chevron" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "pw-event-body", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("dl", { className: "pw-facts", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dt", { children: "\u5DE5\u5177\u7ED3\u679C" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dd", { children: outcomes[event.outcome] ?? "\u672A\u77E5\u7ED3\u679C" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dt", { children: "\u539F\u59CB\u8F93\u51FA" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dd", { className: "pw-mono", children: formatBytes(event.bytes) })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("pre", { children: [
        event.text || "\u65E0\u6587\u672C\u8F93\u51FA",
        event.truncated ? "\n[\u9884\u89C8\u5DF2\u622A\u65AD\uFF1B\u5B8C\u6574\u5185\u5BB9\u89C1 DSH \u4F1A\u8BDD\u8BB0\u5F55]" : ""
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TechnicalDetails, { title: "\u8C03\u7528\u5173\u8054", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("dl", { className: "pw-facts", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dt", { children: "\u8C03\u7528 ID" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dd", { children: event.id })
        ] }),
        event.rootCallId && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dt", { children: "\u6839\u8C03\u7528 ID" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dd", { children: event.rootCallId })
        ] }),
        event.callIdHash && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dt", { children: "\u8C03\u7528\u6307\u7EB9" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("dd", { children: event.callIdHash })
        ] })
      ] }) })
    ] })
  ] }, event.id)) });
}

// src/client/TaskEvidence.jsx
var import_react4 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime4 = require("react/jsx-runtime");
var labels = {
  "in-progress": "\u8FDB\u884C\u4E2D",
  ready: "\u767B\u8BB0\u9A8C\u6536\u901A\u8FC7",
  partial: "\u90E8\u5206\u9A8C\u6536",
  blocked: "\u5DF2\u963B\u585E",
  cancelled: "\u5DF2\u53D6\u6D88",
  superseded: "\u5DF2\u66FF\u4EE3",
  pending: "\u5F85\u68C0\u67E5",
  passed: "\u901A\u8FC7",
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
function TaskEvidence({ task, expanded = false, onEvidence }) {
  const [message, setMessage] = (0, import_react4.useState)("");
  if (!task?.title) return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(EmptyState, { title: "\u5C1A\u672A\u767B\u8BB0\u5F53\u524D\u4EFB\u52A1", icon: "file", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: "Agent \u767B\u8BB0\u4EFB\u52A1\u540E\uFF0C\u8FD9\u91CC\u4F1A\u663E\u793A\u9636\u6BB5\u4E0E\u9A8C\u6536\u4F9D\u636E\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: "\u5DE5\u5177\u6267\u884C\u6210\u529F\u4E0D\u4F1A\u81EA\u52A8\u6807\u8BB0\u4EFB\u52A1\u5B8C\u6210\u3002" })
  ] });
  const requirements = task.requirements ?? [];
  const pending = requirements.filter((r) => r.required && r.status !== "passed").length;
  async function copy(path) {
    try {
      await navigator.clipboard.writeText(path);
      setMessage("\u5DF2\u590D\u5236\u5B8C\u6574\u8DEF\u5F84");
    } catch {
      setMessage("\u590D\u5236\u5931\u8D25\uFF0C\u53EF\u9009\u62E9\u5B8C\u6574\u8DEF\u5F84\u624B\u52A8\u590D\u5236");
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-task", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-card pw-task-core", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-task-summary", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-task-heading", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "pw-eyebrow", children: "\u5F53\u524D\u4EFB\u52A1" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h2", { children: task.title }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: "pw-task-state", "data-tone": tone(task.status), children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "pw-dot", "data-tone": tone(task.status) }),
            labels[task.status] ?? "\u672A\u77E5\u72B6\u6001"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("ol", { className: "pw-stage-line", "aria-label": "\u767B\u8BB0\u4EFB\u52A1\u9636\u6BB5", children: phases.map((phase) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("li", { "aria-current": task.phase === phase ? "step" : void 0, children: labels[phase] }, phase)) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: "pw-muted", children: [
          pending ? `\u4ECD\u6709 ${pending} \u9879\u5FC5\u9700\u9A8C\u6536\u672A\u901A\u8FC7\u3002` : requirements.some((r) => r.required) ? "\u5DF2\u767B\u8BB0\u7684\u5FC5\u9700\u9A8C\u6536\u5747\u901A\u8FC7\u3002" : "\u5C1A\u672A\u5B9A\u4E49\u5FC5\u9700\u9A8C\u6536\u3002",
          "\u9636\u6BB5\u7531 Agent \u9648\u8FF0\u3002"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "pw-section", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SectionHeading, { title: "\u9A8C\u6536\u4F9D\u636E", children: onEvidence && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_dsh_client_ui_primitives2.Button, { size: "sm", variant: "ghost", onClick: onEvidence, children: [
          "\u67E5\u770B\u5168\u90E8 ",
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PanelIcon, { name: "chevron" })
        ] }) }),
        requirements.length ? requirements.map((r) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-check-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PanelIcon, { name: r.status === "passed" ? "check" : "circle", className: r.status === "passed" ? "pw-success" : "pw-muted" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-copy", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("strong", { children: [
              r.label,
              r.required ? "" : "\uFF08\u53EF\u9009\uFF09"
            ] }),
            expanded && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("small", { children: [
                r.kind === "semantic" ? "\u8BED\u4E49\u8BC4\u5BA1\uFF0C\u6A21\u578B\u5224\u65AD\u4E0D\u81EA\u52A8\u653E\u884C" : r.kind === "artifact" ? "\u4EC5\u7ED3\u6784\u68C0\u67E5" : "\u5B9E\u9645\u5DE5\u5177\u6267\u884C",
                " \xB7 \u8986\u76D6 ",
                r.coverage.filter((unit) => r.evidence.some((e) => e.unit === unit && e.outcome === "passed")).length,
                "/",
                r.coverage.length
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("small", { children: r.coverage.map((unit) => `${unit}: ${labels[r.evidence.find((e) => e.unit === unit)?.outcome] ?? "\u672A\u8986\u76D6"}`).join(" \xB7 ") }),
              r.evidence.map((e) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("code", { className: "pw-task-path pw-muted", children: [
                e.tool,
                " \xB7 ",
                e.callId,
                e.tool === "artifact-check" ? " \xB7 \u6587\u4EF6\u7ED3\u6784\u56DE\u6267" : ` \xB7 exit ${e.exitCode ?? "\u672A\u77E5"}`
              ] }, e.id))
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "pw-status", "data-tone": tone(r.status), children: labels[r.status] ?? "\u672A\u77E5" })
        ] }, r.id)) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "pw-muted", children: "\u672A\u5B9A\u4E49\u5FC5\u9700\u9A8C\u6536\uFF0C\u4E0D\u80FD\u805A\u5408\u4E3A\u901A\u8FC7\u3002" }),
        !expanded && pending > 0 && onEvidence && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_dsh_client_ui_primitives2.Button, { className: "pw-task-cta", size: "sm", variant: "primary", onClick: onEvidence, children: [
          "\u67E5\u770B\u5F85\u9A8C\u9879\u76EE ",
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(PanelIcon, { name: "chevron" })
        ] })
      ] })
    ] }),
    expanded && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
      (task.artifacts ?? []).some((a) => a.status !== "superseded") && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { className: "pw-section", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SectionHeading, { title: "\u4EFB\u52A1\u4EA7\u7269" }),
        task.artifacts.filter((a) => a.status !== "superseded").map((a) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "pw-copy", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("strong", { children: [
              a.id,
              a.status === "changed" ? " \xB7 \u5DF2\u53D8\u66F4\uFF0C\u5F85\u91CD\u9A8C" : ""
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { className: "pw-task-path", children: a.path }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("small", { children: [
              "\u7248\u672C ",
              a.version.slice(0, 8),
              a.supersedes ? ` \xB7 \u66FF\u4EE3 ${a.supersedes}` : ""
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives2.Button, { size: "sm", variant: "ghost", onClick: () => copy(a.path), "aria-label": `\u590D\u5236 ${a.id} \u5B8C\u6574\u8DEF\u5F84`, children: "\u590D\u5236\u8DEF\u5F84" })
        ] }, a.id)),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "pw-live-note", role: "status", children: message })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(TechnicalDetails, { title: "\u4EFB\u52A1\u8303\u56F4\u4E0E\u6765\u6E90", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("dl", { className: "pw-facts", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { children: "\u4EFB\u52A1\u7248\u672C" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dd", { children: task.revision })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { children: "\u7406\u89E3\u72B6\u6001" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dd", { children: labels[task.understandingStatus] ?? "\u672A\u77E5" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { children: "\u5DE5\u4F5C\u533A" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dd", { children: task.workspace ?? "\u672A\u786E\u8BA4" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { children: "\u53C2\u8003\u5BF9\u8C61" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dd", { children: task.references?.length ? task.references.map((path) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { className: "pw-task-path", children: path }, path)) : "\u672A\u767B\u8BB0" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { children: "\u72EC\u7ACB\u5B9E\u4F8B" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dd", { children: task.instance ? `${task.instance.id} \xB7 ${task.instance.endpoint}\uFF08\u58F0\u660E\uFF0C\u672A\u8BC1\u660E\u6267\u884C\u7ED1\u5B9A\uFF09` : "\u672A\u767B\u8BB0\u72EC\u7ACB\u5B9E\u4F8B" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { children: "\u8BB0\u5F55" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dd", { children: task.persistence === "native" ? "\u5BBF\u4E3B\u539F\u751F\u8BB0\u5F55" : task.persistence === "failed" ? "\u5931\u8D25\uFF0C\u4EFB\u52A1\u5DF2\u963B\u585E" : "\u5F53\u524D\u5185\u5B58\uFF0C\u539F\u751F\u8BB0\u5F55\u4E0D\u53EF\u7528" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { children: "\u6765\u6E90" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dd", { children: task.source?.kind === "observed-user-kind" ? "\u5DF2\u89C2\u5BDF user \u7C7B\u578B\uFF0C\u4E0D\u8BC1\u660E\u4EBA\u7C7B\u6388\u6743" : task.source?.kind ?? "\u672A\u77E5" })
          ] })
        ] }),
        task.lastCorrection && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { children: [
          "\u6700\u8FD1\u7EA0\u6B63 r",
          task.lastCorrection.revision,
          " \xB7 ",
          task.lastCorrection.affected.join("\u3001") || "\u65E0\u5173\u8054\u9A8C\u6536"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: "\u7B56\u7565\u68C0\u67E5\u8986\u76D6\u5DF2\u77E5\u7ED3\u6784\u5316\u5199\u5165\uFF1B\u666E\u901A shell \u4E0D\u662F\u5F3A\u9694\u79BB\u3002\u9636\u6BB5\u4E0D\u7B49\u4E8E\u4EBA\u7C7B\u6388\u6743\uFF1B\u72B6\u6001\u53EA\u53CD\u6620\u5DF2\u767B\u8BB0\u68C0\u67E5\uFF0C\u672A\u8986\u76D6\u9700\u6C42\u4E0E\u4E3B\u89C2\u8D28\u91CF\u987B\u53E6\u884C\u8BF4\u660E\u3002" })
      ] })
    ] })
  ] });
}

// src/client/RetrievalPanel.jsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var statusLabels = { retrieved: "\u5DF2\u68C0\u7D22", partial: "\u90E8\u5206\u6210\u529F", failed: "\u5931\u8D25", admitted: "\u5DF2\u51C6\u5165", sent: "\u5DF2\u53D1\u9001", cited: "\u5DF2\u5F15\u7528", verified: "\u5DF2\u9A8C\u8BC1", rejected: "\u5DF2\u62D2\u7EDD" };
var healthLabels = { healthy: "\u6B63\u5E38", zero_result: "\u96F6\u7ED3\u679C", parser_drift: "\u89E3\u6790\u6F02\u79FB", blocked: "\u88AB\u963B\u65AD", transport_error: "\u4F20\u8F93\u5931\u8D25" };
function RetrievalEntry({ entry }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("article", { className: "pw-candidate", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "pw-eyebrow", children: [
      statusLabels[entry.status] ?? entry.status,
      " \xB7 ",
      entry.type === "fetch" ? "\u6293\u53D6" : "\u641C\u7D22",
      " \xB7 ",
      entry.trust === "external-untrusted" ? "\u5916\u90E8\u4E0D\u53EF\u4FE1\u6570\u636E" : entry.trust
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { children: entry.provider ?? "Patchwork \u68C0\u7D22" }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { children: [
      entry.resultCount ?? 0,
      " \u6761\u7ED3\u679C \xB7 ",
      entry.elapsedMs ?? "\u672A\u77E5",
      " ms",
      entry.failureCode ? ` \xB7 ${entry.failureCode}` : ""
    ] }),
    entry.providerHealth?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TechnicalDetails, { title: "Provider \u72B6\u6001", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dl", { className: "pw-facts", children: entry.providerHealth.map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dt", { children: item.provider }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("dd", { children: [
        healthLabels[item.status] ?? item.status,
        " \xB7 ",
        item.resultCount ?? 0,
        " \u6761"
      ] })
    ] }, item.provider)) }) }),
    entry.sources?.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TechnicalDetails, { title: "\u6765\u6E90", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("ul", { className: "pw-source-list", children: entry.sources.map((source) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("li", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("a", { href: source.url, target: "_blank", rel: "noreferrer", children: source.title }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("small", { children: source.url }),
      source.snippet && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: source.snippet })
    ] }, source.url)) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TechnicalDetails, { title: "\u68C0\u7D22\u5143\u6570\u636E", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("dl", { className: "pw-facts", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dt", { children: "\u64CD\u4F5C ID" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dd", { className: "pw-mono", children: entry.operationId })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dt", { children: "\u8303\u56F4" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dd", { children: entry.scope })
      ] }),
      entry.queryFingerprint && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dt", { children: "\u67E5\u8BE2\u6307\u7EB9" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("dd", { className: "pw-mono", children: entry.queryFingerprint })
      ] })
    ] }) })
  ] });
}
function RetrievalPanel({ data }) {
  const entries = data.retrieval?.entries ?? [];
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "pw-page-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h2", { children: "\u68C0\u7D22\u8BC1\u636E" }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: "\u663E\u793A\u672C\u4F1A\u8BDD\u5B9E\u9645\u68C0\u7D22\u5230\u7684\u6765\u6E90\u548C provider \u72B6\u6001\uFF1B\u7F51\u9875\u5185\u5BB9\u4ECD\u6309\u5916\u90E8\u4E0D\u53EF\u4FE1\u6570\u636E\u5904\u7406\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: "pw-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SectionHeading, { title: "\u68C0\u7D22\u8BB0\u5F55", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "pw-muted", children: [
        entries.length,
        " \u6761 \xB7 ",
        data.retrieval?.persistence === "native" ? "\u5DF2\u5199\u5165\u4F1A\u8BDD" : "\u672C\u6B21\u8FD0\u884C"
      ] }) }),
      entries.length ? entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(RetrievalEntry, { entry }, entry.operationId + (entry.seq ?? ""))) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyState, { title: "\u8FD8\u6CA1\u6709\u68C0\u7D22\u8BB0\u5F55", icon: "search", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: "\u6267\u884C Patchwork \u641C\u7D22\u540E\uFF0C\u6765\u6E90\u548C\u5931\u8D25\u72B6\u6001\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002" }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("p", { className: "pw-live-note", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(PanelIcon, { name: "info" }),
      " \u68C0\u7D22\u7ED3\u679C\u4E0D\u4F1A\u81EA\u52A8\u8FDB\u5165\u957F\u671F\u8BB0\u5FC6\u3001\u89C4\u5219\u6216\u6743\u9650\u3002"
    ] })
  ] });
}

// src/client/WorkspacePanels.jsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var mechanisms = [
  { key: "actionFusion", code: "AF", name: "\u63A5\u7EED\u6267\u884C", description: "\u5199\u5165\u6216\u7F16\u8F91\u540E\u76F4\u63A5\u8FD0\u884C\u6821\u9A8C\u547D\u4EE4\u3002" },
  { key: "observationPack", code: "OP", name: "\u5927\u8F93\u51FA\u5F52\u6863", description: "\u4FDD\u5B58\u5B8C\u6574\u539F\u6587\uFF0C\u6309\u9700\u53EC\u56DE\u7247\u6BB5\u3002" },
  { key: "evidencePreservingReducer", code: "EPR", name: "\u8BC1\u636E\u7EA6\u7B80", description: "\u7F29\u77ED\u8BCA\u65AD\u8F93\u51FA\uFF0C\u4FDD\u7559\u53EF\u6838\u5BF9\u7684\u5F15\u7528\u3002" },
  { key: "onlineContextCompact", code: "OCC", name: "\u4E0A\u4E0B\u6587\u538B\u7F29", description: "\u5728\u8BA1\u5212\u8FB9\u754C\u8BC4\u4F30\u5E76\u6574\u7406\u4E0A\u4E0B\u6587\u3002" }
];
var onOff = (value) => value === true ? "\u5F00\u542F" : value === false ? "\u5173\u95ED" : "\u672A\u77E5";
var fmt = (n) => Number.isFinite(n) ? n.toLocaleString() : "\u672A\u6D4B\u91CF";
var settingsKeys = [...mechanisms.map(({ key }) => key), "cacheWriteReadRatio"];
function MechanismStatus({ item, data }) {
  const loaded = data.loadedConfig?.[item.key];
  const active = data.mechanisms?.[item.key]?.active;
  const label = loaded === false ? "\u672A\u52A0\u8F7D" : loaded !== true ? "\u672A\u77E5" : active === true ? "\u5DF2\u6CE8\u518C" : active === false ? "\u672A\u6CE8\u518C" : "\u5DF2\u52A0\u8F7D";
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "pw-status", "data-tone": active === true ? "success" : void 0, children: label });
}
function OverviewPanel({ data, pending, navigate }) {
  const events = data.events ?? [];
  const improvements = data.improvements ?? { candidates: [], incidents: [] };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TaskEvidence, { task: data.task, onEvidence: () => navigate("evidence", "current") }),
    pending > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-note", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { children: [
        pending,
        " \u9879\u5DF2\u4FDD\u5B58\u914D\u7F6E\u7B49\u5F85\u91CD\u65B0\u52A0\u8F7D\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "ghost", onClick: () => navigate("settings"), children: "\u67E5\u770B\u8BBE\u7F6E" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: "pw-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SectionHeading, { title: "\u5DE5\u5177\u8BB0\u5F55", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "ghost", onClick: () => navigate("evidence", "current"), children: [
        "\u67E5\u770B\u8BC1\u636E ",
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(PanelIcon, { name: "chevron" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(EvidenceList, { items: events.slice(0, 3) })
    ] }),
    improvements.candidates.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: "pw-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SectionHeading, { title: "\u5F85\u5BA1\u6539\u8FDB", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "pw-muted", children: "\u5C1A\u672A\u9A8C\u8BC1" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("button", { className: "pw-knowledge-row", onClick: () => navigate("evidence", "improvements"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: improvements.candidates[0].trigger }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("small", { children: [
            improvements.candidates.length,
            " \u6761\u6539\u8FDB\u5019\u9009 \xB7 \u4EC5\u4F9B\u5BA1\u67E5"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(PanelIcon, { name: "chevron" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(TechnicalDetails, { title: "\u673A\u5236\u4E0E\u8FD0\u884C\u72B6\u6001", children: [
      mechanisms.map((item) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "pw-mechanism-code", children: item.code }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "pw-copy", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: item.name }) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(MechanismStatus, { item, data })
      ] }, item.key)),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { className: "pw-muted", children: [
        "\u5DE5\u5177\u7ED3\u679C ",
        events.length,
        " \u6761 \xB7 \u5931\u8D25 ",
        events.filter((e) => e.outcome === "failed").length,
        " \u6761"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { className: "pw-muted", children: [
        "\u4E0A\u4E0B\u6587 ",
        fmt(data.context?.tokens),
        " tokens \xB7 \u7A97\u53E3 ",
        fmt(data.context?.window)
      ] })
    ] })
  ] });
}
function MechanismsPanel({ data }) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-page-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { children: "\u8FD0\u884C\u673A\u5236" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u533A\u5206\u672C\u6B21\u52A0\u8F7D\u3001\u80FD\u529B\u6CE8\u518C\u4E0E\u5DF2\u4FDD\u5B58\u914D\u7F6E\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-compare", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: "\u673A\u5236" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: "\u5DF2\u52A0\u8F7D" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: "\u5DF2\u4FDD\u5B58" })
      ] }),
      mechanisms.map((item) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-compare-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-copy", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("strong", { children: [
            item.name,
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "pw-mechanism-code", children: item.code })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("small", { children: item.description }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(MechanismStatus, { item, data })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: onOff(data.loadedConfig?.[item.key]) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { "data-tone": data.loadedConfig?.[item.key] !== data.config?.[item.key] ? "warn" : void 0, children: onOff(data.config?.[item.key]) })
      ] }, item.key))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "pw-live-note", children: "\u201C\u5DF2\u52A0\u8F7D\u201D\u8868\u793A\u914D\u7F6E\u5DF2\u8F7D\u5165\uFF0C\u4E0D\u4EE3\u8868\u5DF2\u7ECF\u6267\u884C\u6216\u4EA7\u751F\u6536\u76CA\u3002\u5B9E\u9645\u51B3\u7B56\u8BF7\u67E5\u770B\u65E5\u5FD7\u3002" })
  ] });
}
function EvidencePanel({ data, view, setView, prefix, memoryAction, improvementAction }) {
  const [query, setQuery] = (0, import_react5.useState)("");
  const [improvementBusy, setImprovementBusy] = (0, import_react5.useState)(null);
  const [improvementMessage, setImprovementMessage] = (0, import_react5.useState)("");
  const events = data.events ?? [];
  const candidates = data.task?.candidates ?? [];
  const improvements = data.improvements ?? { incidents: [], candidates: [], experiments: [] };
  async function decide(action, candidate) {
    setImprovementBusy(candidate.id);
    setImprovementMessage("");
    try {
      await improvementAction(action, candidate.id, data.improvements?.revision);
      setImprovementMessage(action === "rollback" ? "\u5DF2\u8BB0\u5F55\u56DE\u6EDA\uFF0C\u8FD0\u884C\u89C4\u5219\u672A\u88AB\u81EA\u52A8\u6539\u5199\u3002" : "\u5DF2\u8BB0\u5F55\u7528\u6237\u51B3\u5B9A\uFF0C\u8FD0\u884C\u89C4\u5219\u4ECD\u9700\u7ECF\u8FC7\u4EE3\u7801\u63A5\u5165\u3002");
    } catch (error) {
      setImprovementMessage(error.message === "improvement-unavailable" ? "\u6539\u8FDB\u7BA1\u7406\u901A\u9053\u4E0D\u53EF\u7528\u3002" : "\u64CD\u4F5C\u5931\u8D25\uFF0C\u53EF\u80FD\u662F\u7248\u672C\u5DF2\u53D8\u5316\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002");
    } finally {
      setImprovementBusy(null);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("nav", { className: "pw-secondary-nav", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives3.SegmentedTabs, { label: "\u8BC1\u636E\u7C7B\u522B", value: view, onChange: setView, items: [
      ["current", "\u672C\u6B21"],
      ["retrieval", "\u68C0\u7D22"],
      ["memory", "\u8BB0\u5FC6"],
      ["improvements", "\u6539\u8FDB"]
    ].map(([value, label]) => ({ value, label, id: prefix + "-evidence-" + value, panelId: prefix + "-evidence-panel" })) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { role: "tabpanel", id: prefix + "-evidence-panel", "aria-labelledby": prefix + "-evidence-" + view, children: [
      view === "current" && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TaskEvidence, { task: data.task, expanded: true }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: "pw-section", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SectionHeading, { title: "\u5DE5\u5177\u8BC1\u636E", description: "\u547D\u4EE4\u3001\u6587\u4EF6\u53D8\u66F4\u4E0E\u5B9E\u9645\u6267\u884C\u7ED3\u679C\u3002" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-search", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(PanelIcon, { name: "search" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { type: "search", "aria-label": "\u641C\u7D22\u5DE5\u5177\u8BC1\u636E", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "\u641C\u7D22\u547D\u4EE4\u3001\u8DEF\u5F84\u6216\u5DE5\u5177" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(EvidenceList, { items: events.filter((e) => [e.command, e.path, e.tool].join(" ").toLowerCase().includes(query.toLowerCase())) }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "pw-live-note", children: "\u6700\u591A\u9884\u89C8\u672C\u6B21\u8FD0\u884C\u7684 100 \u6761\u8BB0\u5F55\u3002\u66F4\u65E9\u7ED3\u679C\u8BF7\u67E5\u770B DSH \u4F1A\u8BDD\u5386\u53F2\u3002" })
        ] })
      ] }),
      view === "retrieval" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(RetrievalPanel, { data }),
      view === "memory" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(MemoryPanel, { data, onCurrent: () => setView("current"), memoryAction }),
      view === "improvements" && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-page-heading", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { children: "\u5F85\u5BA1\u6539\u8FDB" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u5931\u8D25\u4E0E\u7EA0\u6B63\u5148\u5F62\u6210\u53EF\u8FFD\u6EAF\u5019\u9009\uFF0C\u518D\u7ECF\u8FC7\u9694\u79BB\u5B9E\u9A8C\u548C\u7528\u6237\u51B3\u5B9A\uFF1B\u5019\u9009\u4E0D\u4F1A\u81EA\u52A8\u6539\u53D8\u8FD0\u884C\u89C4\u5219\u3002" })
        ] }),
        improvements.candidates.length ? improvements.candidates.map((candidate) => {
          const experiment = improvements.experiments.find((item) => item.candidateId === candidate.id);
          return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("article", { className: "pw-candidate", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "pw-eyebrow", children: [
              "\u5019\u9009 \xB7 ",
              candidate.decision
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { children: candidate.trigger }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: candidate.hypothesis }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TechnicalDetails, { title: "\u5019\u9009\u6765\u6E90", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("dl", { className: "pw-facts", children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u6539\u8FDB\u5BF9\u8C61" }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dd", { children: candidate.object })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u5F71\u54CD\u8303\u56F4" }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dd", { children: candidate.activationScope })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u5B9E\u9A8C\u72B6\u6001" }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dd", { children: experiment?.eligibleForReview ? "\u53EF\u4F9B\u5BA1\u67E5" : "\u672A\u901A\u8FC7\u51C6\u5165" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u5019\u9009 ID" }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dd", { children: candidate.id })
              ] })
            ] }) }),
            experiment?.eligibleForReview && candidate.decision === "proposed" && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-actions", children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "outline", disabled: improvementBusy === candidate.id, onClick: () => decide("trial", candidate), children: "\u8BD5\u7528\u8BB0\u5F55" }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "primary", disabled: improvementBusy === candidate.id, onClick: () => decide("approve", candidate), children: "\u6279\u51C6\u8BB0\u5F55" })
            ] }),
            ["trial", "enabled"].includes(candidate.decision) && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "ghost", disabled: improvementBusy === candidate.id, onClick: () => decide("rollback", candidate), children: "\u56DE\u6EDA\u8BB0\u5F55" })
          ] }, candidate.id);
        }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(EmptyState, { title: "\u8FD8\u6CA1\u6709\u5019\u9009\u7ECF\u9A8C", icon: "file", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u5931\u8D25\u56DE\u6267\u4F1A\u5148\u5F62\u6210 Incident\uFF1B\u9700\u8981\u771F\u5B9E\u6765\u6E90\u624D\u80FD\u63D0\u51FA\u5019\u9009\u3002" }) }),
        improvements.incidents.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { className: "pw-live-note", children: [
          "\u5DF2\u8BB0\u5F55 ",
          improvements.incidents.length,
          " \u4E2A\u95EE\u9898\uFF1B\u5F53\u524D\u6539\u8FDB\u81EA\u52A8\u6FC0\u6D3B\uFF1A\u5173\u95ED\u3002"
        ] }),
        improvementMessage && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "pw-live-note", role: "status", children: improvementMessage }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "pw-live-note", children: "\u6279\u51C6\u3001\u8BD5\u7528\u548C\u56DE\u6EDA\u53EA\u8BB0\u5F55\u7528\u6237\u51B3\u5B9A\uFF0C\u4E0D\u4F1A\u628A\u6A21\u578B\u6587\u672C\u76F4\u63A5\u5347\u7EA7\u4E3A\u89C4\u5219\u3001\u6743\u9650\u6216\u8BB0\u5FC6\u3002" })
      ] })
    ] })
  ] });
}
function MemoryPanel({ data, onCurrent, memoryAction }) {
  const memory = data.memory;
  const entries = memory?.entries ?? [];
  const [busy, setBusy] = (0, import_react5.useState)(null);
  const [message, setMessage] = (0, import_react5.useState)("");
  async function act(action, entry) {
    setBusy(entry.id);
    setMessage("");
    try {
      await memoryAction(action, entry.id, memory.revision);
      setMessage(action === "confirm" ? "\u5DF2\u786E\u8BA4\u8BB0\u5FC6\uFF0C\u6B63\u5728\u5237\u65B0\u72B6\u6001\u3002" : "\u5DF2\u5FD8\u8BB0\u8BE5\u8BB0\u5F55\uFF0C\u6B63\u5728\u5237\u65B0\u72B6\u6001\u3002");
    } catch (error) {
      setMessage(error.message === "memory-unavailable" ? "\u8BB0\u5FC6\u7BA1\u7406\u901A\u9053\u4E0D\u53EF\u7528\u3002" : "\u64CD\u4F5C\u5931\u8D25\uFF0C\u53EF\u80FD\u662F\u7248\u672C\u5DF2\u53D8\u5316\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002");
    } finally {
      setBusy(null);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-page-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { children: "\u8BB0\u5FC6" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u53EA\u5728 Patchwork Agent \u8303\u56F4\u5185\u6309\u9700\u8BFB\u53D6\uFF1B\u4E0D\u4F1A\u81EA\u52A8\u6CE8\u5165\u666E\u901A\u8BF7\u6C42\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-note", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u81EA\u52A8\u6CE8\u5165\uFF1A\u5DF2\u5173\u95ED" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u5019\u9009\u5FC5\u987B\u5148\u7ECF\u8FC7\u660E\u786E\u786E\u8BA4\u624D\u80FD\u6210\u4E3A active\uFF1B\u9879\u76EE\u5171\u4EAB\u4E5F\u9700\u8981\u663E\u5F0F\u786E\u8BA4\u3002\u5F53\u524D\u9875\u9762\u53EA\u663E\u793A\u8FD9\u4E2A\u4F1A\u8BDD\u6709\u6743\u770B\u5230\u7684\u8BB0\u5F55\u3002" })
    ] }),
    entries.length ? entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("article", { className: "pw-knowledge-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-copy", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: entry.key }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("small", { children: [
          entry.visibility,
          " \xB7 ",
          entry.status,
          " \xB7 ",
          entry.validity
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: entry.value })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-actions", children: [
        entry.status === "proposed" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "outline", disabled: busy === entry.id, onClick: () => act("confirm", entry), children: "\u786E\u8BA4" }),
        entry.status === "active" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "ghost", disabled: busy === entry.id, onClick: () => act("forget", entry), children: "\u5FD8\u8BB0" })
      ] })
    ] }, entry.id)) : /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(EmptyState, { title: "\u8FD8\u6CA1\u6709\u8BB0\u5FC6\u8BB0\u5F55", icon: "lock", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u5F53\u524D\u6CA1\u6709\u5DF2\u4FDD\u5B58\u6216\u5F85\u786E\u8BA4\u7684\u8BB0\u5F55\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u672C\u6B21\u4EFB\u52A1\u4F9D\u636E\u4ECD\u53EF\u5728\u201C\u672C\u6B21\u201D\u67E5\u770B\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "outline", onClick: onCurrent, children: "\u67E5\u770B\u672C\u6B21\u8BC1\u636E" })
    ] }),
    message && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "pw-live-note", role: "status", children: message }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(TechnicalDetails, { title: "\u8BB0\u5FC6\u72B6\u6001", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("dl", { className: "pw-facts", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u5B58\u50A8" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dd", { children: memory?.persistence === "file" ? "Patchwork \u672C\u5730\u6587\u4EF6" : "\u672A\u8FDE\u63A5" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u7248\u672C" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dd", { children: memory?.revision ?? 0 })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u547D\u540D\u7A7A\u95F4 epoch" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dd", { children: memory?.namespaceEpoch ?? 0 })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dt", { children: "\u53EF\u89C1\u8BB0\u5F55" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("dd", { children: entries.length })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u5220\u9664\u4F1A\u9012\u589E\u547D\u540D\u7A7A\u95F4 epoch\uFF0C\u5E76\u963B\u6B62\u65E7\u7684\u5F02\u6B65\u5199\u5165\u590D\u6D3B\u3002\u8BB0\u5FC6\u4E0D\u6388\u4E88\u5DE5\u5177\u3001\u76EE\u5F55\u3001\u4ED8\u8D39\u6216\u53D1\u5E03\u6743\u9650\u3002" })
    ] })
  ] });
}
function SettingsPanel({ data, draft, saving, invalid, ratio, conflict, dirty, message, connected, pending, prefix, edit, persist, discard }) {
  const desired = data.config ?? {}, loaded = data.loadedConfig ?? {};
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-page-heading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { children: "\u8FD0\u884C\u8BBE\u7F6E" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u4FDD\u5B58\u540E\u91CD\u65B0\u52A0\u8F7D\uFF0C\u5E94\u7528\u65B0\u7684\u8FD0\u884C\u914D\u7F6E\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: "pw-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SectionHeading, { title: "\u6267\u884C\u4E0E\u4E0A\u4E0B\u6587" }),
      mechanisms.map((item) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-copy", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("strong", { children: [
            item.name,
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "pw-mechanism-code", children: item.code })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("small", { children: [
            item.description,
            desired[item.key] !== loaded[item.key] ? " \xB7 \u7B49\u5F85\u91CD\u8F7D" : ""
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives3.Switch, { label: item.name, checked: draft[item.key] ?? desired[item.key] ?? false, onChange: (value) => edit(item.key, value), disabled: saving })
      ] }, item.key)),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-copy", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { htmlFor: prefix + "-ratio", children: "\u7F13\u5B58\u5199\u5165 / \u8BFB\u53D6\u6210\u672C\u6BD4" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("small", { children: "\u7528\u4E8E\u6210\u672C\u4F30\u8BA1\uFF0C\u65E0\u5355\u4F4D\u3002" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { id: prefix + "-ratio", className: "pw-input pw-ratio", type: "number", min: "0", step: "0.1", value: ratio, disabled: saving, onChange: (e) => edit("cacheWriteReadRatio", e.target.value === "" ? "" : Number(e.target.value)), "aria-invalid": invalid })
      ] })
    ] }),
    invalid && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "pw-error", role: "alert", children: "\u8BF7\u68C0\u67E5\u6570\u503C\uFF1A\u6210\u672C\u6BD4\u4E3A\u975E\u8D1F\u6709\u9650\u6570\uFF0C\u8D44\u6E90\u8BBE\u7F6E\u4E3A\u6240\u793A\u8303\u56F4\u5185\u7684\u6574\u6570\u3002" }),
    conflict && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "pw-note pw-warning", role: "alert", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u5176\u4ED6\u9875\u9762\u5DF2\u66F4\u65B0\u914D\u7F6E\uFF0C\u8349\u7A3F\u5DF2\u4FDD\u7559\u3002\u8F7D\u5165\u6700\u65B0\u503C\u4F1A\u6E05\u9664\u672C\u5730\u8349\u7A3F\uFF0C\u8BF7\u5148\u4FDD\u7559\u9700\u8981\u7684\u4FEE\u6539\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "outline", onClick: discard, children: "\u8F7D\u5165\u6700\u65B0\u914D\u7F6E" })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-save", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "pw-muted", role: "status", children: dirty ? `${dirty} \u9879\u672A\u4FDD\u5B58` : pending ? `${pending} \u9879\u7B49\u5F85\u91CD\u8F7D` : "\u65E0\u672A\u4FDD\u5B58\u66F4\u6539" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pw-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "ghost", disabled: !dirty || saving, onClick: discard, children: "\u64A4\u9500\u66F4\u6539" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives3.Button, { size: "sm", variant: "primary", disabled: !dirty || invalid || saving || !connected || Boolean(conflict), onClick: persist, children: saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58\u66F4\u6539" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "pw-live-note", role: "status", "aria-live": "polite", children: message || "\u4FDD\u5B58\u540E\u91CD\u65B0\u52A0\u8F7D\u63D2\u4EF6\u6216\u91CD\u542F\u5B9E\u4F8B\uFF0C\u8BFB\u53D6\u65B0\u914D\u7F6E\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(TechnicalDetails, { title: "\u914D\u7F6E\u8303\u56F4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u914D\u7F6E\u8986\u76D6\u4F5C\u7528\u4E8E\u5F53\u524D DSH_HOME \u4E0B\u7684 Patchwork\uFF0C\u4E0D\u662F profile \u6216\u4F1A\u8BDD\u72EC\u7ACB\u914D\u7F6E\u3002\u672A\u4F7F\u7528 Patchwork \u7684 Agent \u4E0D\u53D7\u8FD9\u4E9B\u673A\u5236\u8BBE\u7F6E\u5F71\u54CD\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: "\u6B64\u5904\u53EA\u663E\u793A\u5F53\u524D\u4F1A\u8BDD\u80FD\u529B\uFF1B\u4E3B\u9898\u548C\u5B57\u4F53\u7531 DSH \u5916\u89C2\u8BBE\u7F6E\u7EDF\u4E00\u63A7\u5236\u3002" })
    ] })
  ] });
}

// src/client/PatchworkPanel.jsx
var import_jsx_runtime7 = require("react/jsx-runtime");
var tabs = [["overview", "\u603B\u89C8"], ["mechanisms", "\u673A\u5236"], ["evidence", "\u8BC1\u636E"], ["logs", "\u65E5\u5FD7"], ["settings", "\u8BBE\u7F6E"]];
var connectionLabels = { loading: "\u8FDE\u63A5\u4E2D", connected: "\u5DF2\u8FDE\u63A5", offline: "\u8FDE\u63A5\u4E2D\u65AD", unavailable: "\u7B49\u5F85\u4F1A\u8BDD" };
function PatchworkTitle() {
  return (0, import_react6.createElement)("span", null, "Patchwork");
}
function PatchworkPanel({ sessionId, sessionStore, useTabInfo }) {
  const allowed = (0, import_react6.useSyncExternalStore)(
    sessionStore.subscribe,
    () => sessionStore.getSnapshot().byId[sessionId]?.projectionValues?.agentPreset === "patchwork",
    () => false
  );
  const { tab } = useTabInfo();
  if (!tab.visible) return null;
  if (!allowed) return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "pw-panel", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "pw-locked", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(EmptyState, { title: "Patchwork \u5C1A\u672A\u542F\u7528", icon: "lock", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { children: "\u5728 Agent \u9009\u62E9\u5668\u4E2D\u9009\u62E9 Patchwork\uFF0C\u4F7F\u7528\u4F1A\u8BDD\u9762\u677F\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { children: "\u5DE5\u5177\u3001\u6280\u80FD\u4E0E\u65E5\u5FD7\u53EA\u5BF9 Patchwork \u4F1A\u8BDD\u5F00\u653E\u3002" })
  ] }) }) });
  return (0, import_react6.createElement)(SessionPanel, { key: sessionId ?? "none", sessionId });
}
function SessionPanel({ sessionId }) {
  const { snapshot: data, connection, error, save, refresh, exportLogs, memoryAction, improvementAction } = usePatchworkState(sessionId);
  const [tab, setTab] = (0, import_react6.useState)("overview");
  const [evidenceView, setEvidenceView] = (0, import_react6.useState)("current");
  const [draft, setDraft] = (0, import_react6.useState)({});
  const [baseRevision, setBaseRevision] = (0, import_react6.useState)(null);
  const [saving, setSaving] = (0, import_react6.useState)(false);
  const [message, setMessage] = (0, import_react6.useState)("");
  const [conflict, setConflict] = (0, import_react6.useState)(null);
  const desired = data?.config ?? {}, loaded = data?.loadedConfig ?? {};
  const dirty = Object.keys(draft).length;
  const pending = settingsKeys.filter((key) => desired[key] !== loaded[key]).length;
  const ratio = draft.cacheWriteReadRatio ?? desired.cacheWriteReadRatio ?? 12.5;
  const invalid = ratio === "" || !Number.isFinite(Number(ratio)) || Number(ratio) < 0;
  const prefix = "pw-" + String(sessionId ?? "none").replace(/[^a-zA-Z0-9-]/g, "");
  function navigate(next, view) {
    setTab(next);
    if (view) setEvidenceView(view);
  }
  function edit(key, value) {
    if (!dirty) setBaseRevision(data?.revision);
    setDraft((previous) => {
      const next = { ...previous };
      if (value === desired[key]) delete next[key];
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
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "pw-panel", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-panel-inner", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("header", { className: "pw-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-scope", title: sessionId, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("strong", { children: "Patchwork" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: "\u5F53\u524D\u4F1A\u8BDD" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-header-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "pw-connection", title: data ? `\u66F4\u65B0\u4E8E ${logTime(data.generatedAt)}` : void 0, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "pw-dot", "data-tone": connection === "connected" ? "success" : connection === "offline" ? "warn" : void 0 }),
          connectionLabels[connection]
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives4.Button, { size: "sm", variant: "ghost", "aria-label": "\u5237\u65B0", title: "\u5237\u65B0\u4F1A\u8BDD\u72B6\u6001", icon: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(PanelIcon, { name: "refresh" }), onClick: refresh, disabled: saving })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("nav", { className: "pw-nav", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives4.SegmentedTabs, { label: "Patchwork \u9875\u9762", value: tab, onChange: setTab, items: tabs.map(([value, label]) => ({ value, label, id: prefix + "-" + value, panelId: prefix + "-panel" })) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "pw-scroll", children: [
      connection === "offline" && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { role: "status", className: "pw-note pw-warning", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(PanelIcon, { name: "activity" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("p", { children: [
          "\u8FDE\u63A5\u4E2D\u65AD\uFF0C\u5F53\u524D\u663E\u793A\u4E0A\u6B21\u5FEB\u7167\u3002\u6062\u590D\u524D\u6682\u505C\u4FDD\u5B58\u4E0E\u5BFC\u51FA\u3002",
          error
        ] })
      ] }),
      connection === "unavailable" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(EmptyState, { title: "\u7B49\u5F85\u4F1A\u8BDD\u72B6\u6001", children: "\u9009\u4E2D\u6216\u5EFA\u7ACB Patchwork \u4F1A\u8BDD\u540E\uFF0C\u8FD0\u884C\u72B6\u6001\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002" }),
      connection === "loading" && !data && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { "aria-busy": "true", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(EmptyState, { title: "\u6B63\u5728\u8FDE\u63A5\u4F1A\u8BDD", children: "\u6B63\u5728\u8BFB\u53D6 DSH \u7684\u771F\u5B9E\u8FD0\u884C\u72B6\u6001\u3002" }) }),
      data && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("section", { className: "pw-page pw-page-" + tab, id: prefix + "-panel", role: "tabpanel", "aria-labelledby": prefix + "-" + tab, children: [
        tab === "overview" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(OverviewPanel, { data, pending, navigate }),
        tab === "mechanisms" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MechanismsPanel, { data }),
        tab === "evidence" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(EvidencePanel, { data, view: evidenceView, setView: setEvidenceView, prefix, memoryAction, improvementAction }),
        tab === "logs" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(LogPanel, { diagnostics: data.diagnostics, exportLogs, connected: connection === "connected" }),
        tab === "settings" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(SettingsPanel, { ...{ data, draft, saving, invalid, ratio, conflict, dirty, message, pending, prefix, edit, persist, discard }, connected: connection === "connected" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("footer", { className: "pw-footer", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: "\u4EC5\u9650\u5F53\u524D\u4F1A\u8BDD" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: data ? `\u66F4\u65B0\u4E8E ${logTime(data.generatedAt)}` : connectionLabels[connection] })
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
.pw-header-actions button { width:28px; height:28px; padding:0; border-radius:6px }
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
.pw-panel pre { font-size:11px; line-height:1.8; background:var(--pw-soft); border:1px solid var(--pw-line); padding:12px; border-radius:7px; white-space:pre-wrap; overflow-wrap:anywhere; max-width:100%; margin:12px 0; color:var(--pw-secondary) }
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

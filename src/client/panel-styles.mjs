// Scoped to the plugin; appearance and typography follow the DSH host.
export const PANEL_CSS = String.raw`
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
`

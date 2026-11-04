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
.pw-page-heading.pw-heading-actions { flex-wrap:wrap; align-items:flex-start }
.pw-page-heading.pw-heading-actions > .pw-actions { flex:none; flex-wrap:wrap; justify-content:flex-start; max-width:100% }
.pw-page-heading.pw-heading-actions > .pw-actions button { white-space:nowrap; width:auto; min-width:auto }
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
.pw-save { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-top:0; padding:14px 16px; border:1px solid var(--pw-card-line); border-radius:var(--pw-radius); background:var(--pw-surface); position:static }
.pw-tab-label { display:inline-flex; align-items:center; justify-content:center; gap:5px; min-width:0 }
.pw-tab-badge { min-width:16px; height:16px; padding:0 4px; border-radius:8px; background:color-mix(in srgb,var(--pw-accent) 16%,transparent); color:var(--pw-accent); font-size:10px; line-height:16px; font-variant-numeric:tabular-nums }
.pw-mechanism-grid { display:grid; grid-template-columns:minmax(0,1fr); gap:16px; min-width:0 }
.pw-settings-grid { display:grid; grid-template-columns:minmax(0,1fr); gap:16px; min-width:0 }
.pw-memory-workbench { display:grid; grid-template-columns:minmax(0,1fr); gap:16px; min-width:0; align-items:start }
.pw-memory-list-column { min-width:0 }
.pw-memory-recall-row { border-top:.5px solid var(--pw-line); padding:12px 0; min-width:0 }
.pw-memory-recall-row:first-of-type { border-top:0; padding-top:0 }
.pw-improvement-form label { display:flex; flex-direction:column; gap:8px; margin-top:12px; font-size:12px; color:var(--pw-secondary) }
.pw-improvement-form label>.pw-muted { margin-top:0 }
.pw-plan-list { list-style:none; padding:0; margin:0 0 8px; display:flex; flex-direction:column; gap:8px }
.pw-plan-list li { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:9px; align-items:start; padding:9px 0; border-bottom:.5px solid var(--pw-line); font-size:12px }
.pw-plan-list li:last-child { border-bottom:0 }
.pw-plan-list li[data-status=completed] span:nth-child(2) { color:var(--pw-muted); text-decoration:line-through }
.pw-plan-list small { color:var(--pw-muted); font-size:10px; white-space:nowrap }
.pw-archive-head { max-height:96px; overflow:auto; margin:8px 0 0; font-size:10px; line-height:1.6 }
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
  .pw-mechanism-grid { grid-template-columns:repeat(2,minmax(0,1fr)) }
  .pw-settings-grid { grid-template-columns:repeat(2,minmax(0,1fr)) }
  .pw-memory-workbench:has(.pw-memory-detail) { grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr) }
  .pw-memory-workbench>.pw-memory-detail { position:sticky; top:0 }
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
`

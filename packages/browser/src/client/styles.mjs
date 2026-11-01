// Scoped to the plugin; appearance and typography follow the DSH host.
export const BROWSER_CSS = String.raw`
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
.pw-browser-profiles p,.pw-browser-profile-form p { font-size:12px; color:var(--pw-muted); line-height:1.8; margin:0 0 10px }
.pw-browser-profiles h3 { margin:0 0 6px }
.pw-browser-profile-row { display:flex; align-items:center; gap:6px; padding:8px 0; border-bottom:1px solid var(--pw-line); margin-bottom:8px; font-size:12px }
.pw-browser-profile-row>span { min-width:0; flex:1; overflow-wrap:anywhere }
.pw-browser-profile-row small { display:block; font-size:11px; color:var(--pw-muted); margin-top:4px }
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
.pw-browser .pw-browser-resources { flex:0 1 auto; overflow:auto; max-height:44vh; border-bottom:1px solid var(--pw-line); padding:0 12px; font-size:12px; line-height:1.7; color:var(--pw-secondary) }
.pw-browser-resources .pw-facts { margin:0 0 10px }
.pw-browser-resource-summary { display:flex; flex-wrap:wrap; gap:12px 24px; margin:10px 0; padding-bottom:10px; border-bottom:1px solid var(--pw-line) }
.pw-browser-resource-summary dt { color:var(--pw-muted) }
.pw-browser-resource-summary dd { margin:0; font-weight:600; color:var(--dsw-alias-label-primary) }
.pw-browser-management-toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:12px 0 4px }
.pw-browser-management-toolbar > * { flex:1 1 150px; min-width:0 }
.pw-browser-identity-confirm>.pw-browser-environment-diff { display:grid; grid-template-columns:minmax(52px,.7fr) repeat(2,minmax(0,1fr)); gap:6px; margin:10px 0; overflow-wrap:anywhere }
.pw-browser-diff-row { display:contents }
.pw-browser-diff-row > * { padding-block:4px; border-top:1px solid var(--pw-line) }
.pw-browser-protection { padding:8px; background:var(--pw-soft); border-radius:var(--dsw-radius-md) }
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

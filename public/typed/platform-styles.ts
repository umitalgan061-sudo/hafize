const STYLE_ID = 'hafizePlatformStyles';
const CSS = `
.platform-dashboard{position:absolute;z-index:30;top:48px;right:12px;width:min(440px,calc(100vw - 24px));max-height:min(78vh,720px);overflow:auto;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--panel);box-shadow:0 18px 48px rgba(0,0,0,.14);color:var(--text)}
.platform-dashboard[hidden]{display:none}
.platform-dashboard-head{display:flex;align-items:center;gap:8px;justify-content:space-between}.platform-dashboard-head strong{font-size:13px}.platform-dashboard>p{margin:8px 0 12px;color:var(--muted);font-size:11px;line-height:1.5}.platform-dashboard-body{display:flex;flex-direction:column;gap:10px}
.platform-dashboard-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.platform-dashboard-section{padding:9px;border:1px solid var(--line);border-radius:11px;background:var(--card)}.platform-dashboard-section-title{display:block;margin-bottom:6px;font-size:11px}.platform-dashboard-row,.platform-dashboard-feature{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:4px 0}.platform-dashboard-label,.platform-dashboard-feature-id{color:var(--muted);font-size:10px}.platform-dashboard-value,.platform-dashboard-feature-state{max-width:62%;text-align:right;overflow-wrap:anywhere;font-size:10px}.platform-dashboard-capabilities{margin:0;color:var(--muted);font-size:10px;line-height:1.5;overflow-wrap:anywhere}.platform-dashboard-toggle{cursor:pointer}.platform-dashboard-feature-state.ok{color:var(--accent-strong)}.platform-dashboard-feature-state.error{color:var(--danger)}.platform-dashboard-feature-state.busy{color:var(--accent)}.platform-dashboard-feature-state.muted{color:var(--muted)}
@media (max-width:700px){.platform-dashboard{top:44px;right:8px;width:calc(100vw - 16px);max-height:72vh}.platform-dashboard-grid{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.platform-dashboard{scroll-behavior:auto}}
@media (forced-colors:active){.platform-dashboard,.platform-dashboard-section{border-color:CanvasText;background:Canvas;color:CanvasText}}
`;

export function installPlatformStyles(documentRef: Document): void {
  if (!documentRef.head || documentRef.getElementById(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  documentRef.head.append(style);
}

if (typeof document !== 'undefined') installPlatformStyles(document);

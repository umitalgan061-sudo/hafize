// `HafizePromptSmartFillHints` global'i `types/browser.d.ts` içinde bildirilir.
// Node, bu modülü tip sıyırmayla doğrudan yükleyip saf fonksiyonlarını
// sınayabilsin diye kök `window` yerine `globalThis` üzerinden alınır:
// `window` modül yüklenirken Node'da ReferenceError verirdi.
const root = globalThis;
const CARD_ID = 'promptLibraryCard';
const PANEL_ID = 'promptLibrarySmartFill';
const MAX_VALUE = 1000;
const MAX_PREVIEW = 8000;
let observer = null;
let active = false;
function make(doc, tag, text = '', className = '') {
    const node = doc.createElement(tag);
    if (className)
        node.className = className;
    node.textContent = text;
    return node;
}
export function paintSmartFillHints(panel) {
    if (!panel || panel.hidden)
        return;
    panel.querySelectorAll('.prompt-smart-fill-field input').forEach((input) => {
        let hint = input.nextElementSibling;
        if (!hint?.classList.contains('prompt-smart-fill-count')) {
            hint = make(panel.ownerDocument, 'small', '', 'prompt-smart-fill-count');
            input.after(hint);
        }
        const length = Math.min(MAX_VALUE, String(input.value || '').length);
        hint.textContent = `${length}/${MAX_VALUE}`;
        hint.setAttribute('aria-label', `${length} / ${MAX_VALUE} karakter`);
    });
    const preview = panel.querySelector('.prompt-smart-fill-preview');
    if (!preview)
        return;
    let count = panel.querySelector('.prompt-smart-fill-preview-count');
    if (!count) {
        count = make(panel.ownerDocument, 'small', '', 'prompt-smart-fill-preview-count');
        preview.after(count);
    }
    const length = Math.min(MAX_PREVIEW, String(preview.textContent || '').length);
    count.textContent = `${length}/${MAX_PREVIEW} karakter`;
}
function boot() {
    if (active || !root.document)
        return;
    const card = root.document.getElementById(CARD_ID);
    const panel = root.document.getElementById(PANEL_ID);
    if (!card || !panel)
        return;
    active = true;
    const refresh = () => root.requestAnimationFrame?.(() => paintSmartFillHints(panel));
    observer = typeof MutationObserver === 'function' ? new MutationObserver(refresh) : null;
    observer?.observe(panel, { childList: true, subtree: true, characterData: true, attributes: true });
    panel.addEventListener('input', refresh);
    root.addEventListener('beforeunload', () => {
        observer?.disconnect();
        observer = null;
        panel.removeEventListener('input', refresh);
    }, { once: true });
    paintSmartFillHints(panel);
}
root.HafizePromptSmartFillHints = Object.freeze({ mount: boot, paint: paintSmartFillHints });
if (root.document?.readyState === 'loading')
    root.document.addEventListener('DOMContentLoaded', boot, { once: true });
else
    boot();

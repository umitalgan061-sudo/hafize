// Node, bu modülü tip sıyırmayla doğrudan yükleyip saf fonksiyonlarını
// sınayabilsin diye kök `window` yerine `globalThis` üzerinden alınır:
// `window` modül yüklenirken Node'da ReferenceError verirdi.
const root = globalThis;
const STORAGE_KEY = 'hafize.prompt-library.smart-fill.v1';
const CARD_ID = 'promptLibraryCard';
const MAX_VALUE = 1000;
const MAX_VARIABLES = 12;
const MAX_PRESETS = 6;
const MAX_NAME = 60;
const MAX_PREVIEW = 8000;
const core = () => root.HafizePromptLibrary;
const storage = () => {
    try {
        return root.localStorage;
    }
    catch {
        return null;
    }
};
const clamp = (value, limit) => String(value ?? '').slice(0, limit);
function safeParse(raw, fallback) {
    try {
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
function keyForPrompt(promptId) {
    return `${STORAGE_KEY}.${clamp(promptId, 120)}`;
}
export function readPresets(promptId) {
    const store = storage();
    if (!store)
        return [];
    let raw = null;
    try {
        raw = store.getItem(keyForPrompt(promptId));
    }
    catch {
        return [];
    }
    const data = safeParse(raw || '[]', []);
    if (!Array.isArray(data))
        return [];
    return data
        .filter((preset) => typeof preset === 'object' && preset !== null)
        .slice(0, MAX_PRESETS)
        .map((preset) => ({
        id: clamp(preset.id, 120),
        name: clamp(preset.name, MAX_NAME).trim(),
        values: Object.freeze(Object.fromEntries(Object.entries(preset.values && typeof preset.values === 'object' ? preset.values : {})
            .slice(0, MAX_VARIABLES)
            .map(([name, value]) => [clamp(name, 32), clamp(value, MAX_VALUE)])))
    }))
        .filter((preset) => Boolean(preset.name && preset.id));
}
export function writePresets(promptId, presets) {
    const store = storage();
    if (!store)
        return false;
    try {
        store.setItem(keyForPrompt(promptId), JSON.stringify(presets.slice(0, MAX_PRESETS)));
        return true;
    }
    catch {
        return false;
    }
}
export function variableNames(body) {
    const found = core()?.extractVariables?.(body) ?? [];
    return [...new Set(found.map((name) => clamp(name, 32)).filter(Boolean))].slice(0, MAX_VARIABLES);
}
function randomId() {
    return root.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function element(doc, tag, textValue, className) {
    const node = doc.createElement(tag);
    if (className)
        node.className = className;
    if (textValue !== undefined)
        node.textContent = textValue;
    return node;
}
function button(doc, label, className = 'soft-btn') {
    const node = element(doc, 'button', label, className);
    node.type = 'button';
    return node;
}
function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById(CARD_ID);
    if (!documentRef || !card || card.dataset.smartFillReady === 'true')
        return null;
    card.dataset.smartFillReady = 'true';
    const dialog = element(documentRef, 'section', undefined, 'prompt-smart-fill');
    dialog.id = 'promptLibrarySmartFill';
    dialog.hidden = true;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'promptSmartFillTitle');
    dialog.setAttribute('aria-describedby', 'promptSmartFillDescription');
    const shell = element(documentRef, 'div', undefined, 'prompt-smart-fill-shell');
    const head = element(documentRef, 'div', undefined, 'prompt-smart-fill-head');
    const title = element(documentRef, 'strong', 'İstemi doldur', 'prompt-smart-fill-title');
    title.id = 'promptSmartFillTitle';
    const close = button(documentRef, 'Kapat', 'mini-btn');
    close.setAttribute('aria-label', 'İstem doldurma panelini kapat');
    head.append(title, close);
    const description = element(documentRef, 'p', 'Değişken değerlerini gir. Önizlemeyi kontrol ettikten sonra istemi mesaj alanına aktar.');
    description.id = 'promptSmartFillDescription';
    const form = element(documentRef, 'form', undefined, 'prompt-smart-fill-form');
    const fields = element(documentRef, 'div', undefined, 'prompt-smart-fill-fields');
    const presetBar = element(documentRef, 'div', undefined, 'prompt-smart-fill-presets');
    const previewLabel = element(documentRef, 'div', 'Önizleme', 'prompt-smart-fill-preview-label');
    const preview = element(documentRef, 'pre', '', 'prompt-smart-fill-preview');
    preview.setAttribute('aria-live', 'polite');
    const errors = element(documentRef, 'div', '', 'prompt-smart-fill-errors');
    errors.setAttribute('role', 'alert');
    const actions = element(documentRef, 'div', undefined, 'prompt-smart-fill-actions');
    const copy = button(documentRef, 'Önizlemeyi kopyala');
    const cancel = button(documentRef, 'Vazgeç');
    const insert = button(documentRef, 'Mesaja aktar');
    actions.append(copy, cancel, insert);
    form.append(fields, presetBar, previewLabel, preview, errors, actions);
    shell.append(head, description, form);
    dialog.append(shell);
    card.append(dialog);
    let activePrompt = null;
    let activeNames = [];
    let activeInputs = new Map();
    let lastFocus = null;
    const closeDialog = () => {
        dialog.hidden = true;
        fields.replaceChildren();
        presetBar.replaceChildren();
        errors.textContent = '';
        activePrompt = null;
        activeNames = [];
        activeInputs = new Map();
        if (lastFocus instanceof HTMLElement)
            lastFocus.focus();
        lastFocus = null;
    };
    const showError = (message) => {
        errors.textContent = clamp(message, 180);
    };
    const currentValues = () => Object.fromEntries(activeNames.map((name) => [name, clamp(activeInputs.get(name)?.value, MAX_VALUE)]));
    const renderPreview = () => {
        if (!activePrompt)
            return;
        const values = currentValues();
        preview.textContent = core()?.replaceVariables?.(activePrompt.body, values)?.slice(0, MAX_PREVIEW) || activePrompt.body.slice(0, MAX_PREVIEW);
    };
    const persistPresetBar = () => {
        presetBar.replaceChildren();
        if (!activePrompt || !activeNames.length)
            return;
        const select = element(documentRef, 'select', undefined, 'prompt-smart-fill-preset-select');
        select.setAttribute('aria-label', 'Kaydedilmiş değişken seti');
        const empty = element(documentRef, 'option', 'Değişken seti seç…');
        empty.value = '';
        select.append(empty);
        readPresets(activePrompt.id).forEach((preset) => {
            const option = element(documentRef, 'option', preset.name);
            option.value = preset.id;
            select.append(option);
        });
        const save = button(documentRef, 'Seti kaydet', 'mini-btn');
        const clear = button(documentRef, 'Setleri temizle', 'mini-btn');
        presetBar.append(select, save, clear);
        select.addEventListener('change', () => {
            if (!activePrompt)
                return;
            const found = readPresets(activePrompt.id).find((preset) => preset.id === select.value);
            if (!found)
                return;
            activeNames.forEach((name) => {
                const input = activeInputs.get(name);
                if (input)
                    input.value = found.values[name] || '';
            });
            renderPreview();
        });
        save.addEventListener('click', () => {
            if (!activePrompt)
                return;
            const name = rootRef.prompt?.('Değişken seti adı:', '')?.trim?.() || '';
            if (!name)
                return;
            const next = Object.freeze({ id: randomId(), name: clamp(name, MAX_NAME), values: Object.freeze(currentValues()) });
            if (!writePresets(activePrompt.id, [next, ...readPresets(activePrompt.id)]))
                showError('Değişken seti kaydedilemedi.');
            else
                persistPresetBar();
        });
        clear.addEventListener('click', () => {
            if (!activePrompt || !rootRef.confirm?.('Bu istemin kaydedilmiş değişken setleri silinsin mi?'))
                return;
            writePresets(activePrompt.id, []);
            persistPresetBar();
        });
    };
    const recordUse = (promptId) => {
        const api = core();
        const store = storage();
        if (!api?.loadItems || !api.normalizeItem || !api.saveItems || !store)
            return;
        const items = api.loadItems(store);
        const index = items.findIndex((item) => item.id === promptId);
        if (index < 0)
            return;
        const next = items.slice();
        const item = items[index];
        if (!item)
            return;
        const updated = api.normalizeItem({ ...item, useCount: Number(item.useCount) + 1, updatedAt: new Date().toISOString() });
        if (!updated)
            return;
        next[index] = updated;
        if (!api.saveItems(store, next))
            return;
        try {
            const detail = { key: api.STORAGE_KEY ?? null, newValue: JSON.stringify(next), storageArea: store };
            if (typeof rootRef.StorageEvent === 'function')
                rootRef.dispatchEvent(new rootRef.StorageEvent('storage', detail));
        }
        catch { /* persisted state remains valid even when repaint cannot be signalled */ }
    };
    const insertIntoComposer = () => {
        if (!activePrompt)
            return;
        const values = currentValues();
        const missing = activeNames.filter((name) => (values[name] ?? '').trim().length === 0);
        if (missing.length)
            return showError(`Doldurulmamış değişkenler: ${missing.map((name) => `{{${name}}}`).join(', ')}`);
        const text = core()?.replaceVariables?.(activePrompt.body, values)?.slice(0, MAX_PREVIEW) || activePrompt.body.slice(0, MAX_PREVIEW);
        const composer = documentRef.querySelector('#messageInput');
        if (!composer)
            return showError('Mesaj alanı bulunamadı.');
        const promptId = activePrompt.id;
        composer.value = text;
        composer.dispatchEvent(new Event('input', { bubbles: true }));
        composer.focus();
        closeDialog();
        recordUse(promptId);
    };
    const openFor = (prompt) => {
        activePrompt = prompt;
        activeNames = variableNames(prompt.body);
        activeInputs = new Map();
        lastFocus = documentRef.activeElement;
        fields.replaceChildren();
        errors.textContent = '';
        activeNames.forEach((name, index) => {
            const row = element(documentRef, 'label', undefined, 'prompt-smart-fill-field');
            const caption = element(documentRef, 'span', `{{${name}}}`, 'prompt-smart-fill-label');
            const input = element(documentRef, 'input');
            input.type = 'text';
            input.maxLength = MAX_VALUE;
            input.autocomplete = 'off';
            input.name = name;
            input.placeholder = `${name} değeri`;
            input.setAttribute('aria-label', `${name} değişken değeri`);
            input.addEventListener('input', renderPreview);
            input.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== 'ArrowDown' && event.key !== 'ArrowUp')
                    return;
                event.preventDefault();
                const all = [...activeInputs.values()];
                const currentIndex = Math.max(0, all.indexOf(input));
                const nextIndex = event.key === 'ArrowUp' ? Math.max(0, currentIndex - 1) : Math.min(all.length - 1, currentIndex + 1);
                all[nextIndex]?.focus();
            });
            row.append(caption, input);
            fields.append(row);
            activeInputs.set(name, input);
            if (index === 0)
                rootRef.setTimeout?.(() => input.focus(), 0);
        });
        persistPresetBar();
        renderPreview();
        dialog.hidden = false;
        if (!activeNames.length)
            showError('Bu istem değişken içermiyor. Doğrudan mesaja aktarılabilir.');
    };
    const trapKeydown = (event) => {
        if (dialog.hidden)
            return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closeDialog();
            return;
        }
        if (event.key !== 'Tab')
            return;
        const focusables = [...dialog.querySelectorAll('button,input,select')].filter((node) => !node.hidden && !node.hasAttribute('disabled'));
        if (!focusables.length)
            return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last)
            return;
        if (event.shiftKey && documentRef.activeElement === first) {
            event.preventDefault();
            last.focus();
        }
        else if (!event.shiftKey && documentRef.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };
    const interceptUse = (event) => {
        const target = event.target instanceof Element ? event.target.closest('.prompt-item-actions button') : null;
        if (!target || target.textContent?.trim() !== 'Kullan')
            return;
        const row = target.closest('.prompt-item');
        const id = row?.dataset.promptId;
        if (!id)
            return;
        const prompt = core()?.loadItems?.(storage())?.find((item) => item.id === id);
        if (!prompt || !variableNames(prompt.body).length)
            return;
        event.preventDefault();
        event.stopImmediatePropagation();
        openFor(prompt);
    };
    close.addEventListener('click', closeDialog);
    cancel.addEventListener('click', closeDialog);
    copy.addEventListener('click', async () => {
        try {
            await rootRef.navigator?.clipboard?.writeText?.(preview.textContent || '');
            showError('Önizleme panoya kopyalandı.');
        }
        catch {
            showError('Önizleme panoya kopyalanamadı.');
        }
    });
    insert.addEventListener('click', insertIntoComposer);
    dialog.addEventListener('keydown', trapKeydown);
    card.addEventListener('click', interceptUse, true);
    return Object.freeze({
        mounted: true,
        open: openFor,
        close: closeDialog,
        destroy: () => {
            card.removeEventListener('click', interceptUse, true);
            closeDialog();
            dialog.remove();
            delete card.dataset.smartFillReady;
        }
    });
}
const api = Object.freeze({ STORAGE_KEY, mount, readPresets, writePresets, variableNames });
root.HafizePromptLibrarySmartFill = api;
const start = () => { if (root.document)
    mount(root.document, root); };
if (root.document?.readyState === 'loading')
    root.document.addEventListener('DOMContentLoaded', start, { once: true });
else
    start();

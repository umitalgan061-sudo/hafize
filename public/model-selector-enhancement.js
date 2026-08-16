(function exposeHafizeModelSelectorEnhancement(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeModelSelectorEnhancement = api;
  const install = () => api.mount({ documentRef: root.document, MutationObserverImpl: root.MutationObserver });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeModelSelectorEnhancement() {
  'use strict';

  const LOCAL_MODEL_PREFIX = 'local:';
  const STATUS_ID = 'modelProviderStatus';
  const STYLE_ID = 'modelProviderStatusStyle';
  const MARKER = 'hafizeModelProvider';
  const MAX_MODEL_ID_LENGTH = 240;
  const STYLE_TEXT = `
#${STATUS_ID}{display:block;margin-top:4px;color:var(--premium-muted);font-size:9px;line-height:1.25;max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${STATUS_ID}[data-provider="local"]{color:var(--premium-orange-strong)}
#${STATUS_ID}[data-state="warning"]{white-space:normal;color:var(--premium-orange-strong);font-weight:650}
@media(max-width:680px){#${STATUS_ID}{max-width:118px}}
`;

  function normalizeModelId(value) {
    if (typeof value !== 'string') return '';
    const model = value.trim();
    if (!model || model.length > MAX_MODEL_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(model)) return '';
    return model;
  }

  function classifyModel(value) {
    const id = normalizeModelId(value);
    if (!id) return null;
    const local = id.startsWith(LOCAL_MODEL_PREFIX);
    const displayId = local ? id.slice(LOCAL_MODEL_PREFIX.length).trim() || id : id;
    return Object.freeze({
      id,
      provider: local ? 'local' : 'nvidia',
      displayId,
      providerLabel: local ? 'Yerel sağlayıcı' : 'NVIDIA NIM'
    });
  }

  function optionLabel(value) {
    const model = classifyModel(value);
    if (!model) return '';
    return model.provider === 'local'
      ? `Yerel · ${model.displayId}`
      : `NVIDIA · ${model.displayId}`;
  }

  function isToolModeActive(toolButton) {
    return toolButton?.getAttribute?.('aria-pressed') === 'true';
  }

  function localToolModeConflict(modelValue, toolButton) {
    return classifyModel(modelValue)?.provider === 'local' && isToolModeActive(toolButton);
  }

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.(`#${STYLE_ID}`)) return false;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return true;
  }

  function createController({
    documentRef = globalThis.document,
    MutationObserverImpl = globalThis.MutationObserver
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') {
      throw new Error('INVALID_MODEL_SELECTOR_DOCUMENT');
    }

    let select = null;
    let toolButton = null;
    let composer = null;
    let status = null;
    let observer = null;
    let mounted = false;
    let generatedStatus = false;

    function ensureStatus() {
      const existing = documentRef.querySelector(`#${STATUS_ID}`);
      if (existing) return existing;
      const node = documentRef.createElement('small');
      node.id = STATUS_ID;
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      node.setAttribute('aria-atomic', 'true');
      const host = select?.closest?.('.model-wrap') || select?.parentNode;
      host?.append?.(node);
      generatedStatus = Boolean(node.parentNode);
      return node;
    }

    function enhanceOption(option) {
      const model = classifyModel(option?.value);
      if (!model || option.dataset?.[MARKER] === model.id) return false;
      if (option.dataset && !(MARKER in option.dataset)) option.dataset.hafizeOriginalModelLabel = option.textContent || model.id;
      option.textContent = optionLabel(model.id);
      option.title = model.id;
      if (option.dataset) option.dataset[MARKER] = model.id;
      return true;
    }

    function enhanceOptions() {
      const options = select?.options || [];
      let changed = 0;
      for (const option of options) if (enhanceOption(option)) changed += 1;
      return changed;
    }

    function renderStatus({ warning = false } = {}) {
      if (!status) return;
      const model = classifyModel(select?.value);
      if (!model) {
        status.hidden = true;
        status.textContent = '';
        status.removeAttribute?.('data-provider');
        status.removeAttribute?.('data-state');
        return;
      }
      const conflict = localToolModeConflict(model.id, toolButton);
      status.hidden = false;
      status.dataset.provider = model.provider;
      status.dataset.state = warning || conflict ? 'warning' : 'ready';
      status.textContent = conflict
        ? 'Yerel modelde araç modu kapatılmalı; gönderim engellendi.'
        : model.providerLabel;
      status.title = `Seçili model: ${model.id}`;
    }

    function tryDisableToolsForLocal() {
      if (!localToolModeConflict(select?.value, toolButton)) return true;
      if (toolButton?.disabled !== true && typeof toolButton?.click === 'function') toolButton.click();
      const safe = !localToolModeConflict(select?.value, toolButton);
      renderStatus({ warning: !safe });
      return safe;
    }

    function onSelectChange() {
      enhanceOptions();
      tryDisableToolsForLocal();
      renderStatus();
    }

    function onToolClickCapture(event) {
      if (event?.defaultPrevented || classifyModel(select?.value)?.provider !== 'local') return;
      if (isToolModeActive(toolButton)) return; // The user may always turn an existing tool mode off.
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      renderStatus({ warning: true });
    }

    function blockUnsafeSend(event) {
      if (!localToolModeConflict(select?.value, toolButton)) return false;
      event?.preventDefault?.();
      event?.stopImmediatePropagation?.();
      renderStatus({ warning: true });
      select?.focus?.();
      return true;
    }

    function onDocumentClickCapture(event) {
      if (!event?.target?.closest?.('[data-prompt]')) return;
      blockUnsafeSend(event);
    }

    function mount() {
      if (mounted) return false;
      select = documentRef.querySelector('#modelSelect');
      toolButton = documentRef.querySelector('#toolModeBtn');
      composer = documentRef.querySelector('#composer');
      if (!select) return false;
      installStyles(documentRef);
      status = ensureStatus();
      enhanceOptions();
      tryDisableToolsForLocal();
      renderStatus();
      select.addEventListener?.('change', onSelectChange);
      toolButton?.addEventListener?.('click', onToolClickCapture, true);
      composer?.addEventListener?.('submit', blockUnsafeSend, true);
      documentRef.addEventListener?.('click', onDocumentClickCapture, true);
      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(() => {
          enhanceOptions();
          renderStatus();
        });
        observer.observe(select, { childList: true });
        if (toolButton) observer.observe(toolButton, { attributes: true, attributeFilter: ['aria-pressed'] });
      }
      mounted = true;
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      observer?.disconnect?.();
      observer = null;
      select?.removeEventListener?.('change', onSelectChange);
      toolButton?.removeEventListener?.('click', onToolClickCapture, true);
      composer?.removeEventListener?.('submit', blockUnsafeSend, true);
      documentRef.removeEventListener?.('click', onDocumentClickCapture, true);
      for (const option of select?.options || []) {
        if (option.dataset?.hafizeOriginalModelLabel) option.textContent = option.dataset.hafizeOriginalModelLabel;
        if (option.dataset) {
          delete option.dataset.hafizeOriginalModelLabel;
          delete option.dataset[MARKER];
        }
        option.removeAttribute?.('title');
      }
      if (generatedStatus) status?.remove?.();
      status = null;
      select = null;
      toolButton = null;
      composer = null;
      mounted = false;
      return true;
    }

    return Object.freeze({ mount, destroy, enhanceOptions, renderStatus, tryDisableToolsForLocal, blockUnsafeSend });
  }

  function mount(options) {
    try {
      const controller = createController(options);
      return controller.mount() ? controller : null;
    } catch {
      return null;
    }
  }

  return Object.freeze({
    LOCAL_MODEL_PREFIX,
    STATUS_ID,
    STYLE_ID,
    MAX_MODEL_ID_LENGTH,
    normalizeModelId,
    classifyModel,
    optionLabel,
    isToolModeActive,
    localToolModeConflict,
    installStyles,
    createController,
    mount
  });
});

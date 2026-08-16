(function exposeHafizeComposerLimitFeedback(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeComposerLimitFeedback = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeComposerLimitFeedback() {
  'use strict';

  const CONTROL_ID = 'composerLimitFeedback';
  const STYLE_ID = 'hafize-composer-limit-feedback-style';
  const DEFAULT_LIMIT = 12_000;
  const WARNING_RATIO = 0.85;
  const DANGER_RATIO = 0.97;
  const STYLE_TEXT = `
.composer-limit-feedback{display:flex;justify-content:flex-end;align-items:center;gap:8px;min-height:18px;padding:0 8px 2px;color:var(--muted,#777);font-size:10px;line-height:1.2}
.composer-limit-feedback[data-state="warning"]{color:#8a651d}
.composer-limit-feedback[data-state="danger"]{color:#9a3f32;font-weight:650}
.composer-limit-meter{width:64px;height:3px;border:0;border-radius:999px;overflow:hidden;background:var(--line,#ddd)}
.composer-limit-meter::-webkit-progress-bar{background:var(--line,#ddd)}
.composer-limit-meter::-webkit-progress-value{background:currentColor}
.composer-limit-meter::-moz-progress-bar{background:currentColor}
`;

  function normalizeLimit(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric > DEFAULT_LIMIT) return DEFAULT_LIMIT;
    return Math.floor(numeric);
  }

  function snapshot(value, limit = DEFAULT_LIMIT) {
    const text = typeof value === 'string' ? value : '';
    const safeLimit = normalizeLimit(limit);
    const used = Math.min(text.length, safeLimit);
    const remaining = Math.max(0, safeLimit - used);
    const ratio = safeLimit ? used / safeLimit : 0;
    const state = ratio >= DANGER_RATIO ? 'danger' : ratio >= WARNING_RATIO ? 'warning' : 'normal';
    return Object.freeze({ used, remaining, limit: safeLimit, ratio, state });
  }

  function labelFor(value) {
    const state = snapshot(value?.value, value?.maxLength);
    if (state.state === 'danger') return `${state.remaining} karakter kaldı`;
    if (state.state === 'warning') return `${state.used.toLocaleString('tr-TR')} / ${state.limit.toLocaleString('tr-TR')}`;
    return `${state.remaining.toLocaleString('tr-TR')} karakter kullanılabilir`;
  }

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.(`#${STYLE_ID}`)) return false;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return true;
  }

  function createController({ documentRef = globalThis.document } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') throw new Error('INVALID_COMPOSER_LIMIT_DOCUMENT');
    let input = null;
    let control = null;
    let meter = null;
    let label = null;
    let mounted = false;

    function render() {
      if (!input || !control || !meter || !label) return null;
      const state = snapshot(input.value, input.maxLength);
      control.dataset.state = state.state;
      meter.max = state.limit;
      meter.value = state.used;
      meter.setAttribute('aria-valuemax', String(state.limit));
      meter.setAttribute('aria-valuenow', String(state.used));
      label.textContent = labelFor(input);
      return state;
    }

    function mount() {
      if (mounted) return true;
      input = documentRef.querySelector('#messageInput');
      const composer = documentRef.querySelector('#composer');
      if (!input || !composer) return false;
      const maxLength = normalizeLimit(input.maxLength);
      input.maxLength = maxLength;
      installStyles(documentRef);

      control = documentRef.querySelector(`#${CONTROL_ID}`);
      if (!control) {
        control = documentRef.createElement('div');
        control.id = CONTROL_ID;
        control.className = 'composer-limit-feedback';
        control.setAttribute('aria-live', 'polite');
        control.setAttribute('aria-atomic', 'true');

        meter = documentRef.createElement('progress');
        meter.className = 'composer-limit-meter';
        meter.setAttribute('aria-label', 'Mesaj karakter kullanımı');

        label = documentRef.createElement('span');
        label.className = 'composer-limit-label';
        control.append(meter, label);
        composer.insertBefore(control, composer.querySelector('.composer-row'));
      } else {
        meter = control.querySelector('.composer-limit-meter');
        label = control.querySelector('.composer-limit-label');
        if (!meter || !label) return false;
      }

      input.addEventListener('input', render);
      mounted = true;
      render();
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      input?.removeEventListener?.('input', render);
      control?.remove?.();
      mounted = false;
      input = null;
      control = null;
      meter = null;
      label = null;
      return true;
    }

    return Object.freeze({ mount, destroy, render });
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
    CONTROL_ID,
    STYLE_ID,
    DEFAULT_LIMIT,
    WARNING_RATIO,
    DANGER_RATIO,
    normalizeLimit,
    snapshot,
    labelFor,
    installStyles,
    createController,
    mount
  });
});
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

  function readAttribute(node, name) {
    if (!node || typeof node.hasAttribute !== 'function' || !node.hasAttribute(name)) return Object.freeze({ present: false, value: null });
    return Object.freeze({ present: true, value: node.getAttribute?.(name) ?? '' });
  }

  function restoreAttribute(node, name, state) {
    if (!node || !state) return;
    if (state.present) node.setAttribute?.(name, state.value);
    else node.removeAttribute?.(name);
  }

  function createController({ documentRef = globalThis.document } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') throw new Error('INVALID_COMPOSER_LIMIT_DOCUMENT');
    let input = null;
    let control = null;
    let meter = null;
    let label = null;
    let mounted = false;
    let controlOwned = false;
    let inputMaxLengthBeforeMount = null;
    let hostSnapshot = null;

    function render() {
      if (!mounted || !input || !control || !meter || !label) return null;
      const state = snapshot(input.value, input.maxLength);
      control.dataset.state = state.state;
      meter.max = state.limit;
      meter.value = state.used;
      meter.setAttribute('aria-valuemax', String(state.limit));
      meter.setAttribute('aria-valuenow', String(state.used));
      label.textContent = labelFor(input);
      return state;
    }

    function snapshotHostControl() {
      if (controlOwned || !control || !meter || !label) return null;
      const hasState = Object.prototype.hasOwnProperty.call(control.dataset || {}, 'state');
      return Object.freeze({
        hasState,
        state: hasState ? String(control.dataset.state) : '',
        meterMax: meter.max,
        meterValue: meter.value,
        ariaValueMax: readAttribute(meter, 'aria-valuemax'),
        ariaValueNow: readAttribute(meter, 'aria-valuenow'),
        labelText: String(label.textContent || '')
      });
    }

    function restoreHostControl() {
      if (controlOwned || !control || !meter || !label || !hostSnapshot) return;
      if (hostSnapshot.hasState) control.dataset.state = hostSnapshot.state;
      else if (control.dataset) delete control.dataset.state;
      meter.max = hostSnapshot.meterMax;
      meter.value = hostSnapshot.meterValue;
      restoreAttribute(meter, 'aria-valuemax', hostSnapshot.ariaValueMax);
      restoreAttribute(meter, 'aria-valuenow', hostSnapshot.ariaValueNow);
      label.textContent = hostSnapshot.labelText;
    }

    function mount() {
      if (mounted) return true;
      const nextInput = documentRef.querySelector('#messageInput');
      const composer = documentRef.querySelector('#composer');
      if (!nextInput || !composer) return false;

      let nextControl = documentRef.querySelector(`#${CONTROL_ID}`);
      let nextMeter = null;
      let nextLabel = null;
      let nextOwned = false;
      if (nextControl) {
        nextMeter = nextControl.querySelector('.composer-limit-meter');
        nextLabel = nextControl.querySelector('.composer-limit-label');
        if (!nextMeter || !nextLabel) return false;
      } else {
        nextControl = documentRef.createElement('div');
        nextControl.id = CONTROL_ID;
        nextControl.className = 'composer-limit-feedback';
        nextControl.setAttribute('aria-live', 'polite');
        nextControl.setAttribute('aria-atomic', 'true');

        nextMeter = documentRef.createElement('progress');
        nextMeter.className = 'composer-limit-meter';
        nextMeter.setAttribute('aria-label', 'Mesaj karakter kullanımı');

        nextLabel = documentRef.createElement('span');
        nextLabel.className = 'composer-limit-label';
        nextControl.append(nextMeter, nextLabel);
        composer.insertBefore(nextControl, composer.querySelector('.composer-row'));
        nextOwned = true;
      }

      input = nextInput;
      control = nextControl;
      meter = nextMeter;
      label = nextLabel;
      controlOwned = nextOwned;
      inputMaxLengthBeforeMount = input.maxLength;
      hostSnapshot = snapshotHostControl();
      input.maxLength = normalizeLimit(input.maxLength);
      installStyles(documentRef);
      input.addEventListener('input', render);
      mounted = true;
      render();
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      mounted = false;
      input?.removeEventListener?.('input', render);
      if (input && inputMaxLengthBeforeMount !== null) input.maxLength = inputMaxLengthBeforeMount;
      if (controlOwned) control?.remove?.();
      else restoreHostControl();
      input = null;
      control = null;
      meter = null;
      label = null;
      controlOwned = false;
      inputMaxLengthBeforeMount = null;
      hostSnapshot = null;
      return true;
    }

    function lifecycleSnapshot() {
      return Object.freeze({ mounted, controlOwned, hasInput: Boolean(input) });
    }

    return Object.freeze({ mount, destroy, render, lifecycleSnapshot });
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
    readAttribute,
    restoreAttribute,
    createController,
    mount
  });
});
(function exposeHafizeConversationReadingControls(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else {
    root.HafizeConversationReadingControls = api;
    const install = () => api.mount({ documentRef: root.document });
    if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationReadingControls() {
  'use strict';

  const SCALE_OPTIONS = Object.freeze(['90', '100', '110', '125']);
  const SPACING_OPTIONS = Object.freeze(['compact', 'normal', 'relaxed']);
  const DEFAULT_SCALE = '100';
  const DEFAULT_SPACING = 'normal';
  const CARD_ID = 'conversationReadingCard';
  const FOCUS_BUTTON_ID = 'conversationFocusToggle';
  const FOCUS_CLASS = 'hafize-reading-focus';

  function normalizeScale(value) {
    const normalized = String(value ?? '');
    return SCALE_OPTIONS.includes(normalized) ? normalized : DEFAULT_SCALE;
  }

  function normalizeSpacing(value) {
    const normalized = String(value ?? '');
    return SPACING_OPTIONS.includes(normalized) ? normalized : DEFAULT_SPACING;
  }

  function createOption(documentRef, value, text) {
    const option = documentRef.createElement('option');
    option.value = value;
    option.textContent = text;
    return option;
  }

  function createReadingCard(documentRef) {
    const card = documentRef.createElement('section');
    card.id = CARD_ID;
    card.className = 'utility-card conversation-reading-card';
    card.setAttribute('aria-labelledby', `${CARD_ID}Title`);

    const head = documentRef.createElement('div');
    head.className = 'utility-head';
    const icon = documentRef.createElement('span');
    icon.className = 'mini-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'Aa';
    const title = documentRef.createElement('span');
    title.id = `${CARD_ID}Title`;
    title.textContent = 'Okuma görünümü';
    head.append(icon, title);

    const controls = documentRef.createElement('div');
    controls.className = 'conversation-reading-controls';

    const scaleLabel = documentRef.createElement('label');
    scaleLabel.setAttribute('for', 'conversationReadingScale');
    const scaleText = documentRef.createElement('span');
    scaleText.textContent = 'Yazı boyutu';
    const scaleSelect = documentRef.createElement('select');
    scaleSelect.id = 'conversationReadingScale';
    scaleSelect.setAttribute('aria-label', 'Sohbet mesajı yazı boyutu');
    scaleSelect.append(
      createOption(documentRef, '90', 'Küçük · %90'),
      createOption(documentRef, '100', 'Normal · %100'),
      createOption(documentRef, '110', 'Büyük · %110'),
      createOption(documentRef, '125', 'Çok büyük · %125')
    );
    scaleLabel.append(scaleText, scaleSelect);

    const spacingLabel = documentRef.createElement('label');
    spacingLabel.setAttribute('for', 'conversationReadingSpacing');
    const spacingText = documentRef.createElement('span');
    spacingText.textContent = 'Satır aralığı';
    const spacingSelect = documentRef.createElement('select');
    spacingSelect.id = 'conversationReadingSpacing';
    spacingSelect.setAttribute('aria-label', 'Sohbet mesajı satır aralığı');
    spacingSelect.append(
      createOption(documentRef, 'compact', 'Sıkı'),
      createOption(documentRef, 'normal', 'Normal'),
      createOption(documentRef, 'relaxed', 'Ferah')
    );
    spacingLabel.append(spacingText, spacingSelect);
    controls.append(scaleLabel, spacingLabel);

    const note = documentRef.createElement('small');
    note.className = 'conversation-reading-note';
    note.textContent = 'Ayarlar yalnız bu sayfa oturumunda geçerlidir.';
    card.append(head, controls, note);
    return card;
  }

  function createFocusButton(documentRef) {
    const button = documentRef.createElement('button');
    button.id = FOCUS_BUTTON_ID;
    button.className = 'conversation-focus-toggle';
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', 'Sohbet odak modunu aç');
    button.textContent = '◎ Odak';
    return button;
  }

  function createController({ documentRef = globalThis.document } = {}) {
    if (!documentRef?.querySelector || !documentRef?.createElement) throw new Error('INVALID_READING_CONTROLS_DOCUMENT');
    let messages = null;
    let shell = null;
    let rail = null;
    let topbar = null;
    let card = null;
    let scaleSelect = null;
    let spacingSelect = null;
    let focusButton = null;
    let generatedCard = false;
    let generatedFocusButton = false;
    let mounted = false;
    let scale = DEFAULT_SCALE;
    let spacing = DEFAULT_SPACING;
    let focused = false;

    function render() {
      if (messages?.dataset) {
        messages.dataset.readingScale = scale;
        messages.dataset.readingSpacing = spacing;
      }
      shell?.classList?.toggle?.(FOCUS_CLASS, focused);
      if (scaleSelect) scaleSelect.value = scale;
      if (spacingSelect) spacingSelect.value = spacing;
      if (focusButton) {
        focusButton.setAttribute('aria-pressed', String(focused));
        focusButton.setAttribute('aria-label', focused ? 'Sohbet odak modundan çık' : 'Sohbet odak modunu aç');
        focusButton.textContent = focused ? '◎ Odaktan çık' : '◎ Odak';
        focusButton.title = focused ? 'Yardımcı araçları yeniden göster' : 'Yalnız sohbet alanına odaklan';
      }
    }

    function setScale(value) {
      scale = normalizeScale(value);
      render();
      return scale;
    }

    function setSpacing(value) {
      spacing = normalizeSpacing(value);
      render();
      return spacing;
    }

    function setFocused(value) {
      focused = Boolean(value);
      render();
      return focused;
    }

    function handleScale() { setScale(scaleSelect?.value); }
    function handleSpacing() { setSpacing(spacingSelect?.value); }
    function handleFocus() { setFocused(!focused); }

    function mount() {
      if (mounted) return true;
      messages = documentRef.querySelector('#messages');
      shell = documentRef.querySelector('.app-shell');
      rail = documentRef.querySelector('.utility-rail');
      topbar = documentRef.querySelector('.topbar');
      if (!messages || !shell || !rail || !topbar) return false;

      card = documentRef.querySelector(`#${CARD_ID}`);
      if (!card) {
        card = createReadingCard(documentRef);
        rail.append(card);
        generatedCard = true;
      }
      scaleSelect = card.querySelector?.('#conversationReadingScale');
      spacingSelect = card.querySelector?.('#conversationReadingSpacing');
      if (!scaleSelect || !spacingSelect) return false;

      focusButton = documentRef.querySelector(`#${FOCUS_BUTTON_ID}`);
      if (!focusButton) {
        focusButton = createFocusButton(documentRef);
        topbar.append(focusButton);
        generatedFocusButton = true;
      }

      scaleSelect.addEventListener?.('change', handleScale);
      spacingSelect.addEventListener?.('change', handleSpacing);
      focusButton.addEventListener?.('click', handleFocus);
      mounted = true;
      render();
      return true;
    }

    function destroy() {
      scaleSelect?.removeEventListener?.('change', handleScale);
      spacingSelect?.removeEventListener?.('change', handleSpacing);
      focusButton?.removeEventListener?.('click', handleFocus);
      if (messages?.dataset) {
        delete messages.dataset.readingScale;
        delete messages.dataset.readingSpacing;
      }
      shell?.classList?.remove?.(FOCUS_CLASS);
      if (generatedCard) card?.remove?.();
      if (generatedFocusButton) focusButton?.remove?.();
      messages = shell = rail = topbar = card = scaleSelect = spacingSelect = focusButton = null;
      generatedCard = generatedFocusButton = false;
      mounted = false;
      scale = DEFAULT_SCALE;
      spacing = DEFAULT_SPACING;
      focused = false;
    }

    return Object.freeze({
      mount,
      destroy,
      setScale,
      setSpacing,
      setFocused,
      getState: () => Object.freeze({ mounted, scale, spacing, focused })
    });
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
    SCALE_OPTIONS,
    SPACING_OPTIONS,
    DEFAULT_SCALE,
    DEFAULT_SPACING,
    CARD_ID,
    FOCUS_BUTTON_ID,
    FOCUS_CLASS,
    normalizeScale,
    normalizeSpacing,
    createReadingCard,
    createFocusButton,
    createController,
    mount
  });
});

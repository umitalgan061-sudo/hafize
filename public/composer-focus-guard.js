// Keep the message field reachable if another page layer intercepts pointer input.
(() => {
  'use strict';

  function recoverComposerFocus(event) {
    const input = document.getElementById('messageInput');
    if (!(input instanceof HTMLTextAreaElement)) return;

    const bounds = input.getBoundingClientRect();
    const x = Number(event.clientX);
    const y = Number(event.clientY);
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return;
    if (event.composedPath?.().includes(input)) return;

    const messages = document.getElementById('messages');
    if (input.disabled && messages?.getAttribute('aria-busy') === 'true') return;
    if (input.disabled) input.disabled = false;

    event.preventDefault();
    event.stopImmediatePropagation();
    input.focus({ preventScroll: true });
  }

  window.addEventListener('pointerdown', recoverComposerFocus, true);
  window.addEventListener('mousedown', recoverComposerFocus, true);
})();

(function installHafizeMarkdownEnhancement(root) {
  'use strict';
  const RENDERED = 'data-markdown-source';
  let observer = null;
  let installed = false;

  function renderNode(node) {
    if (!node || !root.HafizeMarkdown) return;
    const source = node.textContent || '';
    if (node.getAttribute(RENDERED) === source) return;
    const rendered = root.HafizeMarkdown.render(root.document, source);
    node.replaceChildren(...rendered.childNodes);
    node.setAttribute(RENDERED, source);
  }

  function scan() {
    const messages = root.document?.getElementById?.('messages');
    if (!messages || !root.HafizeMarkdown) return;
    messages.querySelectorAll('.message.assistant .content').forEach(renderNode);
  }

  function install() {
    if (installed || !root.document || !root.HafizeMarkdown) return;
    const messages = root.document.getElementById('messages');
    if (!messages) return;
    installed = true;
    observer = typeof MutationObserver === 'function'
      ? new MutationObserver(() => scan())
      : null;
    observer?.observe(messages, { childList: true, characterData: true, subtree: true });
    scan();
    root.addEventListener('beforeunload', () => observer?.disconnect?.(), { once: true });
  }

  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self);

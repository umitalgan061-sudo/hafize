(function installHafizeMarkdownEnhancement(root) {
  'use strict';
  const RENDERED = 'data-markdown-source';
  let observer = null;
  let installed = false;
  let retry = 0;
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
    if (installed || !root.document || !root.HafizeMarkdown) return false;
    const messages = root.document.getElementById('messages');
    if (!messages) return false;
    installed = true;
    observer = typeof MutationObserver === 'function' ? new MutationObserver(scan) : null;
    observer?.observe(messages, { childList: true, characterData: true, subtree: true });
    scan();
    root.addEventListener('beforeunload', () => observer?.disconnect?.(), { once: true });
    return true;
  }
  function waitForRenderer() {
    if (install()) return;
    if (retry >= 12) return;
    retry += 1;
    root.setTimeout?.(waitForRenderer, 50 * retry);
  }
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', waitForRenderer, { once: true });
  else waitForRenderer();
})(typeof globalThis !== 'undefined' ? globalThis : self);

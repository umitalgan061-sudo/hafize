(function addScheduledTaskKeyboard(root) {
  'use strict';
  const openShortcut = (event) => {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey || event.key.toLowerCase() !== 't') return;
    if (event.target?.matches?.('input,textarea,select,[contenteditable="true"]')) return;
    const workspace = root.ScheduledTasksWorkspace;
    if (!workspace?.open) return;
    event.preventDefault();
    workspace.open();
  };
  const boot = () => root.document?.addEventListener?.('keydown', openShortcut);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  root.addEventListener?.('beforeunload', () => root.document?.removeEventListener?.('keydown', openShortcut), { once: true });
})(typeof globalThis !== 'undefined' ? globalThis : self);

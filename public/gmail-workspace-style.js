(function exposeHafizeGmailWorkspaceStyle(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeGmailWorkspaceStyle = api;
  api.install(root.document);
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeGmailWorkspaceStyle() {
  'use strict';

  const HREF = '/gmail-workspace.css';
  const MARKER = 'data-hafize-gmail-workspace-style';

  function install(documentRef) {
    if (!documentRef?.head || typeof documentRef.createElement !== 'function') return false;
    if (documentRef.querySelector?.(`link[${MARKER}]`)) return false;
    const link = documentRef.createElement('link');
    link.rel = 'stylesheet';
    link.href = HREF;
    link.setAttribute(MARKER, '1');
    documentRef.head.append(link);
    return true;
  }

  return Object.freeze({ HREF, MARKER, install });
});

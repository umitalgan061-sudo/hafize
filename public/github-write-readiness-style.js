(function exposeHafizeGitHubWriteReadinessStyle(root) {
  'use strict';

  const documentRef = root?.document;
  const HREF = '/github-write-readiness.css';
  const MARKER = 'data-hafize-github-write-readiness-style';

  function mount() {
    if (!documentRef?.head || typeof documentRef.createElement !== 'function') return false;
    if (documentRef.querySelector?.(`link[${MARKER}]`)) return false;
    const link = documentRef.createElement('link');
    link.rel = 'stylesheet';
    link.href = HREF;
    link.setAttribute(MARKER, '1');
    documentRef.head.append(link);
    return true;
  }

  const api = Object.freeze({ HREF, MARKER, mount });
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else {
    root.HafizeGitHubWriteReadinessStyle = api;
    mount();
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);

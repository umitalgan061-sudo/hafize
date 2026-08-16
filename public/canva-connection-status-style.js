(function exposeHafizeCanvaConnectionStatusStyle(root) {
  'use strict';
  const documentRef = root.document;
  const MARKER = 'data-hafize-canva-connection-status-style';
  const HREF = '/canva-connection-status.css';

  function install() {
    if (!documentRef?.head) return false;
    if (documentRef.querySelector?.(`link[${MARKER}]`)) return false;
    const link = documentRef.createElement('link');
    link.rel = 'stylesheet';
    link.href = HREF;
    link.setAttribute(MARKER, '1');
    documentRef.head.append(link);
    return true;
  }

  root.HafizeCanvaConnectionStatusStyle = Object.freeze({ MARKER, HREF, install });
  install();
})(typeof globalThis !== 'undefined' ? globalThis : self);

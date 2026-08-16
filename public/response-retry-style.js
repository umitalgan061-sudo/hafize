(function mountHafizeResponseRetryStyle(root) {
  'use strict';

  const documentRef = root.document;
  if (!documentRef?.head || documentRef.querySelector('link[data-hafize-response-retry-style]')) return;
  const link = documentRef.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/response-retry.css';
  link.setAttribute('data-hafize-response-retry-style', '1');
  documentRef.head.append(link);
  root.HafizeResponseRetryStyle = Object.freeze({ mounted: true });
})(typeof globalThis !== 'undefined' ? globalThis : self);

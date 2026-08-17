(function installHafizeTextFileImportStyle(root) {
  'use strict';
  const documentRef = root?.document;
  if (!documentRef?.head || documentRef.querySelector?.('link[data-hafize-text-file-import-style]')) return;
  const link = documentRef.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/text-file-import.css';
  link.setAttribute('data-hafize-text-file-import-style', '1');
  documentRef.head.append(link);
})(typeof globalThis !== 'undefined' ? globalThis : self);

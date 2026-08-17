(function exposeHafizeGitHubDraftPrCreateStyle(root) {
  'use strict';
  const documentRef = root.document;
  if (!documentRef?.head) return;
  const marker = 'data-hafize-github-draft-pr-create-style';
  if (documentRef.querySelector?.(`link[${marker}]`)) return;
  const link = documentRef.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/github-draft-pr-create.css';
  link.setAttribute(marker, '1');
  documentRef.head.append(link);
})(typeof globalThis !== 'undefined' ? globalThis : self);

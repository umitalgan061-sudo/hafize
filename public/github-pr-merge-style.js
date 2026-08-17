(function exposeHafizeGitHubPrMergeStyle(root) {
  'use strict';
  const documentRef = root.document;
  if (!documentRef?.head || documentRef.querySelector?.('link[data-hafize-github-pr-merge-style]')) return;
  const link = documentRef.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/github-pr-merge.css';
  link.setAttribute('data-hafize-github-pr-merge-style', '1');
  documentRef.head.append(link);
})(typeof globalThis !== 'undefined' ? globalThis : self);

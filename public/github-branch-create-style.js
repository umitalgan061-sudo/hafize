(function installHafizeGitHubBranchCreateStyle(root) {
  'use strict';
  const documentRef = root?.document;
  if (!documentRef?.head) return;
  if (documentRef.querySelector?.('link[data-hafize-github-branch-create-style]')) return;
  const link = documentRef.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/github-branch-create.css';
  link.setAttribute('data-hafize-github-branch-create-style', '1');
  documentRef.head.append(link);
})(typeof globalThis !== 'undefined' ? globalThis : self);

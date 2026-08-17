(function exposeHafizeGitHubWriteActivityStyle(root) {
  'use strict';
  const documentRef = root?.document;
  if (!documentRef?.head || documentRef.querySelector?.('link[data-hafize-github-write-activity-style]')) return;
  const link = documentRef.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/github-write-activity.css';
  link.setAttribute('data-hafize-github-write-activity-style', '1');
  documentRef.head.append(link);
  root.HafizeGitHubWriteActivityStyle = Object.freeze({ href: link.href });
})(typeof globalThis !== 'undefined' ? globalThis : self);

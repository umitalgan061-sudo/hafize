(() => {
  'use strict';
  const doc = globalThis.document;
  if (!doc?.head || doc.querySelector('link[data-hafize-github-file-update-style]')) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/github-file-update.css';
  link.dataset.hafizeGithubFileUpdateStyle = '1';
  doc.head.append(link);
})();

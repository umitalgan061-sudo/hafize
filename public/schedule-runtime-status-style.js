(function mountHafizeScheduleRuntimeStatusStyle(root) {
  'use strict';

  const documentRef = root.document;
  if (!documentRef?.head || typeof documentRef.createElement !== 'function') return;
  if (documentRef.querySelector('link[data-hafize-schedule-runtime-style]')) return;

  const link = documentRef.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/schedule-runtime-status.css';
  link.setAttribute('data-hafize-schedule-runtime-style', '1');
  documentRef.head.append(link);
})(typeof globalThis !== 'undefined' ? globalThis : self);

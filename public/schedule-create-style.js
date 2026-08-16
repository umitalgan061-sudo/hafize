(function exposeHafizeScheduleCreateStyle(root) {
  'use strict';
  const documentRef = root?.document;
  if (!documentRef?.head || documentRef.querySelector?.('link[data-hafize-schedule-create-style]')) return;
  const link = documentRef.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/schedule-create.css';
  link.setAttribute('data-hafize-schedule-create-style', '1');
  documentRef.head.append(link);
  root.HafizeScheduleCreateStyle = Object.freeze({ installed: true });
})(typeof globalThis !== 'undefined' ? globalThis : self);

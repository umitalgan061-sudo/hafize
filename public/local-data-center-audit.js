(function installLocalDataCenterAudit(root) {
  'use strict';
  const CENTER_ID = 'localDataCenter';
  const AUDIT_ID = 'localDataCenterAudit';

  const make = (tag, value, className) => {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  };

  function statusFor(item) {
    if (!item.present) return ['empty', 'Boş'];
    if (item.unavailable) return ['unavailable', 'Erişilemiyor'];
    if (item.truncated) return ['truncated', 'Büyük değer'];
    if (item.count === 'okunamadı') return ['invalid', 'JSON okunamadı'];
    return ['valid', 'Geçerli'];
  }

  function mount() {
    const center = root.document?.getElementById?.(CENTER_ID);
    const api = root.HafizeLocalDataCenter;
    if (!center || !api || root.document.getElementById(AUDIT_ID)) return null;
    const section = make('section', undefined, 'local-data-audit');
    section.id = AUDIT_ID;
    section.setAttribute('aria-labelledby', 'localDataAuditTitle');
    const title = make('h3', 'Veri bütünlüğü');
    title.id = 'localDataAuditTitle';
    const summary = make('p', '', 'local-data-audit-summary');
    summary.setAttribute('aria-live', 'polite');
    const list = make('div', undefined, 'local-data-audit-list');
    list.setAttribute('role', 'list');
    section.append(title, summary, list);
    center.append(section);

    let destroyed = false;
    const render = () => {
      if (destroyed) return;
      const snapshot = api.inspect();
      const states = snapshot.map(statusFor);
      const bad = states.filter(([state]) => state === 'invalid' || state === 'unavailable' || state === 'truncated').length;
      summary.textContent = bad ? `${bad} alan dikkat gerektiriyor.` : 'Tüm yönetilen alanlar erişilebilir durumda.';
      list.replaceChildren();
      snapshot.forEach((item, index) => {
        const row = make('div', undefined, 'local-data-audit-row');
        row.setAttribute('role', 'listitem');
        const [state, label] = states[index];
        row.dataset.auditState = state;
        row.append(make('strong', item.label), make('span', label, `local-data-audit-badge local-data-audit-${state}`));
        list.append(row);
      });
    };
    const onStorage = (event) => { if (event.key === null || api.KNOWN_KEYS.has(event.key)) render(); };
    root.addEventListener?.('storage', onStorage);
    render();
    return Object.freeze({ refresh: render, destroy: () => { destroyed = true; root.removeEventListener?.('storage', onStorage); section.remove(); } });
  }

  root.HafizeLocalDataCenterAudit = Object.freeze({ mount, statusFor });
  const boot = () => mount();
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);

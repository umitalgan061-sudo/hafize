(function installHafizeComposerHistorySettings(root) {
  'use strict';
  const PANEL_ID = 'composerHistorySettings';
  const controller = () => root.HafizeComposerHistoryController;
  const api = () => root.HafizeComposerHistory;
  function boot() {
    const doc = root.document;
    const form = doc?.getElementById?.('composer');
    if (!doc || !form || doc.getElementById(PANEL_ID)) return null;
    const panel = doc.createElement('details');
    panel.id = PANEL_ID;
    panel.className = 'composer-history-settings';
    const summary = doc.createElement('summary');
    summary.textContent = 'Geçmiş gizlilik ayarları';
    const body = doc.createElement('div'); body.className = 'composer-history-settings-body';
    const enabledLabel = doc.createElement('label');
    const enabled = doc.createElement('input'); enabled.type = 'checkbox'; enabled.id = 'composerHistoryEnabled';
    enabledLabel.append(enabled, doc.createTextNode(' Gönderim geçmişini cihazda sakla'));
    const retentionLabel = doc.createElement('label');
    retentionLabel.append(doc.createTextNode(' Saklama limiti '));
    const select = doc.createElement('select'); select.id = 'composerHistoryRetention'; select.setAttribute('aria-label', 'Gönderim geçmişi saklama limiti');
    for (const value of api()?.RETENTION_VALUES || [0, 10, 20, 40]) { const option = doc.createElement('option'); option.value = String(value); option.textContent = value === 0 ? 'Kapalı' : `${value} kayıt`; select.append(option); }
    retentionLabel.append(select);
    const note = doc.createElement('small'); note.textContent = 'Geçmiş yalnızca bu cihazdaki localStorage alanında tutulur; sunucuya gönderilmez.';
    body.append(enabledLabel, retentionLabel, note); panel.append(summary, body);
    form.after(panel);
    const sync = () => { const current = controller()?.getSettings?.() || api()?.loadSettings?.() || { enabled: true, maxItems: 40 }; enabled.checked = current.enabled; select.value = String(current.maxItems); };
    const persist = () => { controller()?.setSettings?.({ enabled: enabled.checked, maxItems: Number(select.value) }); sync(); };
    enabled.addEventListener('change', persist); select.addEventListener('change', persist); root.addEventListener?.('hafize:composer-history-settings-changed', sync); sync();
    root.HafizeComposerHistorySettings = Object.freeze({ panel, refresh: sync, destroy: () => { enabled.removeEventListener('change', persist); select.removeEventListener('change', persist); root.removeEventListener?.('hafize:composer-history-settings-changed', sync); panel.remove(); delete root.HafizeComposerHistorySettings; } });
    return root.HafizeComposerHistorySettings;
  }
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);

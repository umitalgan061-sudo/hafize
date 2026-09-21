// TypeScript migration wave: compiled through Vite/Rolldown.\n// The browser-global surface is kept stable for compatibility with sibling modules.\n// @ts-nocheck\n(function seedHafizePromptLibrary(root) {
  'use strict';
  const STARTERS = Object.freeze([
    ['Metin editörü', 'Aşağıdaki metni {{baglam}} bağlamına uygun biçimde daha akıcı ve profesyonel hâle getir.\n\nMetin:\n{{metin}}', ['yazma', 'düzenleme']],
    ['Kısa özet', '{{icerik}} içeriğini {{uzunluk}} seviyesinde özetle. Ana fikirleri ve kritik ayrıntıları koru.', ['özet', 'öğrenme']],
    ['Kod incelemesi', '{{dil}} kodunu doğruluk, güvenlik, performans ve okunabilirlik açısından incele. Önce kritik bulguları sırala.\n\n{{kod}}', ['kod', 'inceleme']],
    ['Toplantı notu', 'Bu notları kararlar, sorumlular, açık sorular ve sonraki adımlar başlıklarıyla düzenle.\n\n{{notlar}}', ['iş', 'not']],
    ['Araştırma çerçevesi', '{{konu}} hakkında araştırma planı hazırla. Ana soruları, güvenilir kaynak türlerini, karşılaştırma ölçütlerini ve belirsizlikleri belirt.', ['araştırma', 'planlama']],
    ['Planlayıcı', '{{hedef}} için {{sure}} günlük uygulanabilir plan çıkar. Her gün tek ana hedef, ölçülebilir çıktı ve risk azaltma adımı ver.', ['planlama', 'günlük']],
    ['Karar matrisi', '{{secenekler}} seçeneklerini şu kriterlerle karşılaştır: {{kriterler}}. 1-5 puan ver ve varsayımları belirt.', ['karar', 'analiz']],
    ['E-posta taslağı', '{{amac}} amacıyla {{ton}} tonda kısa ve net bir e-posta yaz. Alıcı bağlamı: {{alici}}.', ['e-posta', 'iletişim']],
    ['Test senaryoları', '{{ozellik}} için mutlu yol, sınır durumları, hata yolları ve güvenlik kontrollerini içeren test senaryoları yaz.', ['test', 'yazılım']],
    ['Fikirden gereksinime', '{{fikir}} fikrini kullanıcı hikâyeleri, kabul kriterleri, veri modeli, riskler ve MVP kapsamına dönüştür.', ['ürün', 'MVP']]
  ]);
  function seed({ force = false } = {}) {
    const api = root.HafizePromptLibrary;
    const storage = root.localStorage;
    if (!api || !storage || typeof api.loadItems !== 'function' || typeof api.saveItems !== 'function') return false;
    const current = api.loadItems(storage);
    if (current.length && !force) return false;
    const stamp = new Date().toISOString();
    const existingTitles = new Set(current.map((item) => item.title));
    const additions = STARTERS
      .filter(([title]) => !existingTitles.has(title))
      .map(([title, body, tags], index) => api.normalizeItem({ id: `starter-${index + 1}-${Date.now()}`, title, body, tags, favorite: false, useCount: 0, createdAt: stamp, updatedAt: stamp }))
      .filter(Boolean);
    if (!additions.length) return false;
    return api.saveItems(storage, [...additions, ...current]);
  }
  root.HafizePromptLibraryStarters = Object.freeze({ STARTERS, seed });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', () => seed(), { once: true });
  else seed();
})(typeof globalThis !== 'undefined' ? globalThis : self);

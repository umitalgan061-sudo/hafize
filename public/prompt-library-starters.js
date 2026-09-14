(function installPromptLibraryStarters(root) {
  'use strict';
  const STARTERS = Object.freeze([
    { title: 'Metin editörü', body: 'Aşağıdaki metni anlamını koruyarak daha akıcı ve profesyonel hâle getir. Hedef bağlam: {{baglam}}.\n\nMetin:\n{{metin}}', tags: ['yazma', 'düzenleme'] },
    { title: 'Kısa özet', body: 'Bu içeriği {{format}} biçiminde, {{uzunluk}} seviyesinde özetle. Önemli ayrıntıları koru.\n\nİçerik:\n{{icerik}}', tags: ['özet', 'öğrenme'] },
    { title: 'Kod incelemesi', body: 'Şu kodu güvenlik, doğruluk, performans ve okunabilirlik açısından incele. Önce kritik sorunları, sonra uygulanabilir düzeltmeleri sırala. Dil: {{dil}}.\n\nKod:\n{{kod}}', tags: ['kod', 'inceleme'] },
    { title: 'Toplantı notu', body: 'Aşağıdaki notları kararlar, sorumlular, açık sorular ve sonraki adımlar başlıklarıyla düzenle.\n\nNotlar:\n{{notlar}}', tags: ['iş', 'not'] },
    { title: 'Araştırma çerçevesi', body: '{{konu}} hakkında araştırma planı hazırla. Ana soruları, güvenilir kaynak türlerini, karşılaştırma ölçütlerini ve belirsizlikleri belirt.', tags: ['araştırma', 'planlama'] },
    { title: 'Planlayıcı', body: '{{hedef}} için {{sure}} günlük uygulanabilir bir plan çıkar. Her gün için tek ana hedef, ölçülebilir çıktı ve risk azaltma adımı ver.', tags: ['planlama', 'günlük'] },
    { title: 'Karar matrisi', body: 'Seçenekleri {{kriterler}} ölçütleriyle karşılaştır. Her ölçütü 1-5 arası puanla, varsayımları ve en güçlü/zayıf seçeneği açıkla.\n\nSeçenekler:\n{{secenekler}}', tags: ['karar', 'analiz'] },
    { title: 'E-posta taslağı', body: '{{amac}} amacıyla kısa, nazik ve net bir e-posta hazırla. Ton: {{ton}}. Gereksiz dolgu cümlelerinden kaçın. Alıcı bağlamı: {{alici}}.', tags: ['e-posta', 'iletişim'] },
    { title: 'Test senaryoları', body: '{{ozellik}} için happy-path, sınır durumları, hata yolları ve güvenlik kontrollerini içeren test senaryoları yaz. Her testte beklenen sonucu belirt.', tags: ['test', 'yazılım'] },
    { title: 'Fikirden gereksinime', body: '{{fikir}} fikrini uygulanabilir ürün gereksinimlerine dönüştür. Kullanıcı hikâyeleri, kabul kriterleri, veri modeli, riskler ve MVP kapsamını çıkar.', tags: ['ürün', 'MVP'] }
  ]);
  function seed() {
    const api = root.HafizePromptLibrary;
    const storage = root.localStorage;
    if (!api || !storage || typeof api.loadItems !== 'function' || typeof api.saveItems !== 'function') return false;
    const current = api.loadItems(storage);
    if (current.length) return false;
    const items = STARTERS.map((item, index) => api.normalizeItem({ ...item, id: `starter-${index + 1}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), favorite: false, useCount: 0 }));
    return api.saveItems(storage, items.filter(Boolean));
  }
  const run = () => seed();
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})(typeof globalThis !== 'undefined' ? globalThis : self);

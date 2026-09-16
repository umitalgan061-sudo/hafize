export interface PromptStarterRecord { readonly title: string; readonly body: string; readonly tags: readonly string[]; }
export interface PromptStarterItem { readonly id: string; readonly title: string; readonly body: string; readonly tags?: readonly string[]; readonly favorite?: boolean; readonly useCount?: number; readonly createdAt?: string; readonly updatedAt?: string; }
interface PromptLibraryCore { readonly loadItems?: (storage: Storage) => PromptStarterItem[]; readonly normalizeItem?: (value: PromptStarterItem) => PromptStarterItem | null; readonly saveItems?: (storage: Storage, items: readonly PromptStarterItem[]) => boolean; }
interface StarterRoot extends Window { HafizePromptLibrary?: PromptLibraryCore; HafizePromptLibraryStarters?: Readonly<{ STARTERS: readonly PromptStarterRecord[]; seed: (options?: { force?: boolean }) => boolean }>; }

export const STARTERS: readonly PromptStarterRecord[] = Object.freeze([
  { title: 'Metin editörü', body: 'Aşağıdaki metni {{baglam}} bağlamına uygun biçimde daha akıcı ve profesyonel hâle getir.\n\nMetin:\n{{metin}}', tags: ['yazma', 'düzenleme'] },
  { title: 'Kısa özet', body: '{{icerik}} içeriğini {{uzunluk}} seviyesinde özetle. Ana fikirleri ve kritik ayrıntıları koru.', tags: ['özet', 'öğrenme'] },
  { title: 'Kod incelemesi', body: '{{dil}} kodunu doğruluk, güvenlik, performans ve okunabilirlik açısından incele. Önce kritik bulguları sırala.\n\n{{kod}}', tags: ['kod', 'inceleme'] },
  { title: 'Toplantı notu', body: 'Bu notları kararlar, sorumlular, açık sorular ve sonraki adımlar başlıklarıyla düzenle.\n\n{{notlar}}', tags: ['iş', 'not'] },
  { title: 'Araştırma çerçevesi', body: '{{konu}} hakkında araştırma planı hazırla. Ana soruları, güvenilir kaynak türlerini, karşılaştırma ölçütlerini ve belirsizlikleri belirt.', tags: ['araştırma', 'planlama'] },
  { title: 'Planlayıcı', body: '{{hedef}} için {{sure}} günlük uygulanabilir plan çıkar. Her gün tek ana hedef, ölçülebilir çıktı ve risk azaltma adımı ver.', tags: ['planlama', 'günlük'] },
  { title: 'Karar matrisi', body: '{{secenekler}} seçeneklerini şu kriterlerle karşılaştır: {{kriterler}}. 1-5 puan ver ve varsayımları belirt.', tags: ['karar', 'analiz'] },
  { title: 'E-posta taslağı', body: '{{amac}} amacıyla {{ton}} tonda kısa ve net bir e-posta yaz. Alıcı bağlamı: {{alici}}.', tags: ['e-posta', 'iletişim'] },
  { title: 'Test senaryoları', body: '{{ozellik}} için mutlu yol, sınır durumları, hata yolları ve güvenlik kontrollerini içeren test senaryoları yaz.', tags: ['test', 'yazılım'] },
  { title: 'Fikirden gereksinime', body: '{{fikir}} fikrini kullanıcı hikâyeleri, kabul kriterleri, veri modeli, riskler ve MVP kapsamına dönüştür.', tags: ['ürün', 'MVP'] }
]);

const root = globalThis as StarterRoot;
const api = (): PromptLibraryCore | undefined => root.HafizePromptLibrary;

export function seed({ force = false }: { force?: boolean } = {}): boolean {
  let storage: Storage;
  try { storage = root.localStorage; } catch { return false; }
  const core = api();
  if (!core?.loadItems || !core.saveItems || !core.normalizeItem) return false;
  const current = core.loadItems(storage);
  if (current.length && !force) return false;
  const stamp = new Date().toISOString();
  const existingTitles = new Set(current.map((item) => item.title));
  const additions = STARTERS.map((starter, index) => core.normalizeItem?.({ id: `starter-${index + 1}-${Date.now()}`, title: starter.title, body: starter.body, tags: starter.tags, favorite: false, useCount: 0, createdAt: stamp, updatedAt: stamp })).filter((item): item is PromptStarterItem => Boolean(item && (force || !existingTitles.has(item.title))));
  return additions.length > 0 && core.saveItems(storage, [...additions, ...current]);
}

export const HafizePromptLibraryStarters = Object.freeze({ STARTERS, seed });
root.HafizePromptLibraryStarters = HafizePromptLibraryStarters;
const boot = (): void => { void seed(); };
if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();

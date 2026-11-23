# Hafize — GitHub App ile komutsuz geliştirme

Bu akış Hafize'nin sohbet ajanı içindir. Git komutunu, npm install,
yerel shell, yönetici/root yetkisini ve genel dosya sistemi
yazma yetkisini gerektirmez. GitHub REST API çağrılarını korumalı
Node backend yapar.

## Önkoşullar

- Backend'de HAFIZE_GITHUB_APP_ID, HAFIZE_GITHUB_APP_INSTALLATION_ID ve
  sunucuya özel HAFIZE_GITHUB_APP_PRIVATE_KEY_PATH birlikte tanımlanır.
  Özel anahtar veya installation token tarayıcıya/LLM'e verilmez.
- HAFIZE_GITHUB_READ_REPOS=umitalgan061-sudo/hafize
- HAFIZE_GITHUB_WRITE_REPOS=umitalgan061-sudo/hafize
- İsteğe bağlı HAFIZE_GITHUB_AGENT_REPOS=umitalgan061-sudo/hafize
  Tanımlanmadığında yalnız Hafize seçilir; açıkça boş tanımlanırsa
  ajan GitHub yazma özelliği kapanır.
- Ajan sadece agent allowlist ve write allowlist kesişimindeki depoya yazabilir.
- Eski GITHUB_TOKEN aktif olsa bile, ajan yazma aracı yalnız gerçek
  GitHub App kimliği tanımlandığında sunulur.
- Kimliği doğrulanmış, etkileşimli SSE onay kanalı olan /api/agent/run
  gerekir. Arka plan, zamanlanmış veya yalnız JSON kullanan isteklerde
  ajan yazma aracı bulunmaz.

## Sohbetten geliştirme

Hafize'ye: Hafize deposundaki sorunu incele, ayrı dalda düzelt, taslak
PR hazırla. Ajan önce github_read_file ile dosyaları ve gerekiyorsa
güncel blob SHA bilgisini okur; sonra github_develop çağırır:

1. operation=branch: yalnız hafize/auto-* dalı, kaynak main.
2. operation=file: tek UTF-8 dosyayı bu dalda oluşturur/günceller;
   güncellemelerde eski blob SHA doğrulanır.
3. operation=pull: hedefi main, draft=true olan taslak PR.

**Her adım için ayrı kullanıcı onayı gerekir.** Onay gelmezse GitHub'a
yazılmaz. Onaydan sonra mevcut GitHub writer işlem/depo/tam içeriğe
bağlı tek kullanımlık ticket ile API isteğini gönderir.

Dosya onayı repo/dal/yol/mesaj, boyut, ilk 1000 karakter ve içeriğin
SHA-256 özetini gösterir. Büyük dosyanın tamamını ayrıca PR diff
görünümünde incele; yalnız önizlemeye güvenme. Tek dosya içerik limiti
96 KiB'dir.

## Güvenlik sınırı

- Main'e doğrudan commit yok; merge/deploy, force-push, repo silme yok.
- .env, gizli anahtar, kimlik bilgileri, token dosyaları engellenir.
- .github/workflows/ üzerinde ajan değişikliği yok.
- Başka hedef dal, draft=false veya kullanıcıdan gelen yetkisiz depo yok.
- Onaylanan içerikten farklı içerik yazılmaz.
- Retake deposu başlangıçta ajan yazma izin listesinde yok.

## Doğrulama ve geri dönüş

GitHub Actions üzerinde typecheck, test ve build yapılır; paketlerin
CI'da kurulması Hafize ajanına paket kurma yetkisi verildiği anlamına
gelmez. Ardından canlı backend'de gerçek GitHub App kimliği ve kullanıcı
onaylı branch → file → draft PR akışı ayrıca sınanmalıdır.

Bu uçtan uca kontrol başarıyla tamamlanmadan Retake izin listesine
eklenmez ve Retake'e otomatik yazma başlatılmaz.

Özelliği kapatmak için HAFIZE_GITHUB_AGENT_REPOS değişkenini açıkça boş
tanımla ve backend'i yeniden başlat. Gerekirse HAFIZE_GITHUB_WRITE_REPOS
de boş bırakılarak tüm writer kapatılabilir.

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
- Varsayılan modda kimliği doğrulanmış, etkileşimli SSE onay kanalı olan
  /api/agent/run gerekir.
- **İsteğe bağlı güvenli otonomi:** Sunucuda
  `HAFIZE_GITHUB_SAFE_AUTONOMY=true` ve imzalı kullanıcı oturumu sağlayan
  `HAFIZE_AUTH_REQUIRED=true` etkinse yalnız yapılandırılmış Hafize
  hesap sahibinin /api/agent/run talepleri için ayrı işlem onayı kalkar.
  Salt JSON istekleri de yalnız doğrulanmış hesap oturumunda kullanılabilir.
  Connector bearer hesabı, kimliği belirsiz istek, yerel açık oturum ya da
  farklı ajan için otonom GitHub yazma açılmaz.

## Sohbetten geliştirme

Hafize'ye: Hafize deposundaki sorunu incele, ayrı dalda düzelt, taslak
PR hazırla. Ajan önce github_read_file ile dosyaları ve gerekiyorsa
güncel blob SHA bilgisini okur; sonra github_develop çağırır:

1. operation=branch: yalnız hafize/auto-* dalı, kaynak main.
2. operation=file: tek UTF-8 dosyayı bu dalda oluşturur/günceller;
   güncellemelerde eski blob SHA doğrulanır.
3. operation=pull: hedefi main, draft=true olan taslak PR.

**Normal mod:** Her adım için kullanıcı onayı gerekir.
**Güvenli otonomi modu:** Sunucuda önceden tanımlanmış açık izin ve
kimliği doğrulanmış hesap sahibinin imzalı oturumu bulunuyorsa, yukarıdaki
yalnız üç geri alınabilir geliştirme adımı için ayrı onay penceresi açılmaz.
Her iki modda da mevcut GitHub writer işlem/depo/tam içeriğe bağlı
**tek kullanımlık ticket** üretir. Ajan kendisi otonomi modunu açamaz.

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
- Otonomi modu sunucu ayarıyla **varsayılan kapalıdır**. Onay arayüzünü
  kaldırmak, sınırsız komut, sonsuz API kotası veya yeni repo izni vermez.
- `main` dalına doğrudan değişiklik, PR merge, otomatik production deploy,
  kullanıcı dosyası silme, şifre/secret görme, dışarı veri gönderme ve
  terminalde keyfi komutlar bu onay gerektirmeyen kapsama dahil değildir.
- Oturum/CSRF, depo izin listesi, payload/doğrulama, gizli dosya ve
  içerik kontrolleri her iki modda da yürür.

## Doğrulama ve geri dönüş

GitHub Actions üzerinde typecheck, test ve build yapılır; paketlerin
CI'da kurulması Hafize ajanına paket kurma yetkisi verildiği anlamına
gelmez. Ardından canlı backend'de gerçek GitHub App kimliği ve kullanıcı
onaylı branch → file → draft PR akışı ayrıca sınanmalıdır.

Bu uçtan uca kontrol başarıyla tamamlanmadan Retake izin listesine
eklenmez ve Retake'e otomatik yazma başlatılmaz.

Güvenli otonomiyi kapatmak için `HAFIZE_GITHUB_SAFE_AUTONOMY=false`
ayarla ve backend'i yeniden başlat; araç bu durumda mevcut SSE onay
akışına geri döner. Ajan GitHub yazmasını tümden kapatmak için
`HAFIZE_GITHUB_AGENT_REPOS` değişkenini açıkça boş tanımla;
gerekirse `HAFIZE_GITHUB_WRITE_REPOS` de boş bırakılabilir.


## Render kurulumu ve onaysız rutin geliştirme

Hafize ve Retake gibi açık depoların salt-okunur incelemesi için
`HAFIZE_GITHUB_PUBLIC_READ=true` ve açıkça listelenmiş
`HAFIZE_GITHUB_READ_REPOS` yeterlidir. GitHub API'nin anonim kotası geçerlidir.
`github_read_file` satır aralıklarını ve blob SHA'yı, `github_inspect`
depo/dal/dosya listesi, PR merge durumu, commit ve kesin SHA'ya bağlı CI
sonuçlarını verir. Okuma işlemleri ayrı onay istemez.

Yazma bağlantısı için Render Dashboard > hafize-free > Environment altında
GitHub App özel anahtarını **Secret Files** bölümüne
`hafize-github-app.pem` adıyla yükle. Anahtarı chat'e, repoya veya loglara
koyma. Uygulama kimliği ve kurulum kimliği GitHub App ayarlarından alınır.
`HAFIZE_GITHUB_APP_PRIVATE_KEY_PATH=/etc/secrets/hafize-github-app.pem`
olarak tanımlanır. App kurulumunu yalnız gereken depolara ve Contents /
Pull requests yazma, Actions okuma gibi gereken izinlere sınırla.

`HAFIZE_GITHUB_SAFE_AUTONOMY=true` önceden yetkilendirilmiş, doğrulanmış
hesap sahibinin ayrı geliştirme dalı ve taslak PR işlerinde tekrar onay
istememesini sağlar. Bağlantıyı kurmak bu modu doğrulamaz: gerçek kullanıcı
oturumundan küçük bir branch/file/draft PR denemesiyle commit ve PR kanıtı
kontrol edilmelidir. Kritik yayın, merge, silme, güvenlik/izin değişiklikleri
ve keyfi komutlar bu rutin kapsama girmez.

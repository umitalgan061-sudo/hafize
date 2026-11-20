# Hafize GitHub App — CI durum paneli

Bu değişiklik PR #905 ile main'e alınan GitHub App auth mimarisini **değiştirmeden** eklenmiştir. PR #906'daki ortak App kimlik doğrulama dosyalarının çakışmasına neden olmamak için ayrı main tabanlı dal kullanılır.

## Davranış
- GitHub çalışma alanında CI paneli isteğe bağlı açılır; sayfa yüklenirken otomatik GitHub isteği yapılmaz.
- Sunucu `GET /api/github/app/ci` yolunda kullanıcının principal bilgisini zorunlu tutar; kimlik doğrulama açıkken geçerli oturum, kapalıyken yalnız yerel loopback principal kabul edilir.
- Endpoint, `HAFIZE_GITHUB_READ_REPOS` açık izin listesine uymayan depoları reddeder. GitHub App kurulmamışsa 503 döner.
- `lib/github-app-ci.ts` sunucu tarafında mevcut `GITHUB_FETCH` taşıyıcısını kullanır. Bu, PR #905'teki App installation token yönetimini yeniden uygulamadan kullanır; **token yetkilerini kendisi daha daraltmaz**.
- CI metadata çıktıları sınırlı tutulur; gizli token veya iş logu döndürülmez. Arayüz sonuçları yalnız textContent ile görüntüler.
- GitHub App installation, private key, Firebase dağıtımı ve üretim servisi bu PR kapsamında değiştirilmez.

## Kontroller
`npm run typecheck`, `npm run test:modern`, `npm run build`; GitHub Actions kalite iş akışı. Canlı kullanıcı oturumu ve gerçek App kimliğiyle uçtan uca test ayrıca gereklidir.

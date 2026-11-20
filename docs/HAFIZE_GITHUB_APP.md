# Hafize GitHub App kimliği — güvenli kurulum ve katkı kuralları

## Gerçek durum
Bu kod GitHub App'i GitHub üzerinde **oluşturmaz**, yüklemez ve hiçbir depoya otomatik olarak yetki vermez. App kaydı, sahibi tarafından GitHub Developer Settings > GitHub Apps > New GitHub App üzerinden yapılır; ardından yalnız onaylanan depolara kurulur. App ID, installation ID ve private key yalnız sunucuda tutulur.

## GitHub App kurulumu
- App adı (müsaitse): `Hafize`. Benzersiz ad gerekiyorsa `Hafize-UA` gibi bir alternatif.
- Homepage: `https://hafize-ua.web.app/`.
- Webhook kullanılmayacaksa *Active* kapatılır; kullanılırsa HTTPS webhook endpoint'i, imza doğrulaması ve gizli webhook secret zorunludur.
- Repository permissions: **Contents: Read and write** (branch/commit), **Pull requests: Read and write** (PR oluşturma), **Actions: Read-only** (run/job izleme), **Checks: Read-only** (check sonuçları); Metadata: Read-only otomatik.
- Organization, members, secrets, administration, deployments, workflows veya tüm depolara erişim izinleri istenmez. Check ve Actions okumayı kullanmayan kurulum bunları da kaldırabilir.
- Kurulum ekranında **Only select repositories** seçilir; ilk depo `umitalgan061-sudo/hafize` olmalıdır.
- App installation ID, App ID ve gizli PEM anahtarı GitHub'a commit edilmez. Private key, Firebase Hosting'deki statik istemciye asla gönderilmez; ayrı gizli backend ortamında tutulur.

## Server-side yapılandırma
```dotenv
HAFIZE_GITHUB_APP_ID=
HAFIZE_GITHUB_APP_INSTALLATION_ID=
HAFIZE_GITHUB_APP_PRIVATE_KEY=
HAFIZE_GITHUB_WRITE_REPOS=umitalgan061-sudo/hafize
```
`HAFIZE_GITHUB_APP_PRIVATE_KEY`, PEM'in satır sonlarını `\\n` ile escaped şekilde alabilir. Secret manager'da saklanmalı; env dosyası depoya eklenmemelidir. Birden çok hesap/installation gerekiyorsa mevcut tek-installation sağlayıcısı genişletilmeden **kullanılmamalıdır**.

`lib/github-app-auth.ts` installation kimliği, account sahibi, suspended durumu ve `repository_selection=selected` kontrolünü yapar. Kullanıcı onaylı, allowlist'teki **tek bir depo** ve yalnız işlem için gerekli `contents:write` veya `pull_requests:write` yetkisi ile installation token ister. Her işlem için kısa ömürlü token sunucu tarafında alınır. Normal GitHub API istemcisi `lib/github-workspace-write.ts` üzerinden kullanılır; token browser'a veya loglara verilmez.

GitHub App kimliği yalnız **write runtime** içinde etkinleşir. Read-only GitHub workspace ayrı olarak `GITHUB_TOKEN` kullanır; App destekli okuma/Actions/Checks izleme sonraki ayrı iş paketidir. Sadece App ayarlanırsa read workspace otomatik çalışmaz.

## Bot commit atfı ve Contributors
GitHub App bot account'ının login'i kurulan uygulamaya göre `<app-slug>[bot]` şeklindedir. GitHub App'in gerçek bot kullanıcı ID'si GitHub API'den doğrulanarak commit author/committer için `<bot-id>+<app-slug>[bot]@users.noreply.github.com` biçimindeki adres kullanılmalıdır. Bu adreste ID veya slug uydurulmamalıdır. Mevcut contents API akışı açık `author`/`committer` göndermediği için GitHub'ın sonuç commitinde bot atfı ayrıca **doğrulanmalıdır**; Hafize'nin Contributors bölümünde göründüğü iddia edilmez.

Contributors görünümü GitHub'ın atıf, varsayılan dal, commit geçmişi, sayım/cache ve bot işleme kurallarına bağlıdır. PR açmak tek başına Contributions/Contributors sıralamasını garanti etmez. Gerçek bot-authored commit, merge sonrasında GitHub üzerinden gözlenmeli; önceki ChatGPT, Claude veya diğer geliştirici commitleri **yeniden yazılmamalıdır**.

## Denetim ve yayın
- Her işlem için mevcut user-approved ticket, write allowlist ve default branch engeli korunur.
- `npm run typecheck`, `npm run test:modern`, `npm run build` ve Github Actions quality iş akışı izlenir.
- Bu belge Firebase deployu veya GitHub App kurulumunun gerçekleştiğinin kanıtı değildir.
- GitHub App kayıt ve kurulum adımı kullanıcı tarafından yapılır; gizli anahtar asla sohbette paylaşılmaz.
- Bir sonraki iş paketi: bot commit author/committer kimliğini API'den doğrulama, CI check görüntüleme ve GitHub App'den read-only workspace'e geçiş.

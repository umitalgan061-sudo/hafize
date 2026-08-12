# GitHub Read-Only Tool

Bu katman Hafize'nin NVIDIA NIM tool-calling döngüsüne ilk gerçek dış servis aracını ekler: `github_read_file`.

## Amaç

Ajanın izin verilen bir GitHub deposundaki metin dosyasını okuyabilmesi; buna karşılık GitHub token değerinin modele, tarayıcıya veya tool sonucuna hiçbir zaman girmemesi.

Tool permission kimliği `repo.read` olarak kalır. Model-facing fonksiyon adı yalnızca `github_read_file`'dır; modelin yazdığı fonksiyon adı backend yetkisi sayılmaz.

## Server-side yapılandırma

İki ortam değişkeni gerekir:

```text
GITHUB_TOKEN=<server-side token>
HAFIZE_GITHUB_READ_REPOS=umitalgan061-sudo/hafize
```

Birden fazla repo virgülle ayrılabilir:

```text
HAFIZE_GITHUB_READ_REPOS=owner/repo-a,owner/repo-b
```

Allowlist boşsa hiçbir repo okunamaz. Token yalnızca backend closure içinde tutulur ve agent context'e eklenmez.

GitHub tarafında mümkün olan en dar, salt-okunur repository/content yetkisi tercih edilmelidir. Gelecekte PAT yerine GitHub App/OAuth bağlantısı eklendiğinde aynı `repo.read` permission katmanı korunacaktır.

## Güvenlik sınırı

`github_read_file` şu kontrollerden geçer:

- Seçilen ajan `repo.read` permission'ına sahip olmalı.
- Repo `HAFIZE_GITHUB_READ_REPOS` allowlist'inde olmalı.
- Yol göreli olmalı; `..`, mutlak yol, ters slash ve null karakter reddedilir.
- `.env`, credential/secret adları, private-key benzeri dosyalar ve `.pem/.key/.p12/.pfx` uzantıları ağ isteği yapılmadan engellenir.
- Yalnızca GitHub Contents API'den dönen `type: file` ve base64 içerik kabul edilir.
- Binary içerik reddedilir.
- Modele en fazla 64 KiB metin verilir; daha büyük dosya `truncated: true` ile işaretlenir.
- GitHub hata gövdesi veya Authorization header tool sonucuna yansıtılmaz.

## Tool kullanan ajanlar

Mevcut registry'de `agency-minimal-engineer` ve `agency-code-reviewer` zaten `repo.read` yetkisine sahiptir. Bu PR yeni bir geniş yetki eklemek yerine mevcut permission'ı gerçek bir read-only executor'a bağlar.

Ana `hafize-general` ajanı `repo.read` yetkisine sahip olmadığı için GitHub dosya aracı ona otomatik sunulmaz. Daha sonra Orchestrator/delegation katmanı ana Hafize'nin işi uygun uzmana devretmesini sağlayacaktır.

## Tool calling akışı

```text
Kullanıcı
  -> Hafize backend
  -> NVIDIA NIM (yalnızca ajanın izinli tool tanımları)
  -> github_read_file isteği
  -> backend tool catalog doğrulaması
  -> agent registry repo.read doğrulaması
  -> repo/path allowlist + sensitive-path doğrulaması
  -> GitHub API (token yalnızca burada)
  -> sanitize edilmiş dosya sonucu
  -> NVIDIA NIM
  -> kullanıcı yanıtı
```

`repo.write_branch`, `repo.merge`, dosya silme veya başka GitHub yazma işlemleri bu katmanda yoktur.

## Testler

`npm run check` artık ayrıca şunları doğrular:

- GitHub allowlist ve path guard davranışı.
- Hassas path'in ağ erişiminden önce engellenmesi.
- Server token'ın tool sonucuna sızmaması.
- `repo.read` olmayan ajanın `github_read_file` kullanamaması.
- Executor hatasının yalnızca güvenli hata kodu/statü olarak modele dönmesi.

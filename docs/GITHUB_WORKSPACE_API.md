GitHub çalışma alanı HTTP API sözleşmesi

## GET /api/github/workspace

Temel eylemler action parametresi ile seçilir: repo, branches, commits, pulls veya file.

Zorunlu parametre: repository. İsteğe bağlı parametreler ref, path, state ve limit'tir.

Repo yanıtı normalized repository, name, fullName, description, defaultBranch, visibility, archived ve htmlUrl alanlarını içerir.

Branches yanıtı repository ve bounded branches listesi döndürür. Her branch name, sha ve protected alanlarını taşır.

Commits yanıtı repository, ref ve bounded commits listesi döndürür. Commit DTO'su sha, shortSha, message, author, date ve htmlUrl içerir.

Pulls yanıtı repository, state ve bounded pullRequests listesi döndürür. PR DTO'su number, title, state, draft, author, createdAt, updatedAt, htmlUrl, head ve base içerir.

File yanıtı mevcut GitHub read policy'den gelen repository, path, ref, sha, size, truncated ve content alanlarını döndürür.

## GET /api/github/workspace/directory

Zorunlu repository. İsteğe bağlı path ve ref. Yanıt entries listesiyle sınırlıdır. Entry file veya dir tipindedir ve obvious secret dosya isimleri çıkarılır.

## GET /api/github/workspace/compare

Zorunlu repository, base ve head. Base ile head aynı olamaz. Yanıt status, aheadBy, behindBy, totalCommits ve bounded files listesi içerir.

## Hata sözleşmesi

Tanımsız repository INVALID_GITHUB_REPOSITORY, allowlist dışı repository GITHUB_REPO_NOT_ALLOWED, geçersiz path INVALID_GITHUB_PATH, auth eksikliği GITHUB_NOT_CONFIGURED ve upstream başarısızlığı GITHUB_ENDPOINT_FAILED ile ifade edilir.

Hata yanıtları kısa kod taşır; GitHub upstream response body'si browser'a detail alanı olarak yansıtılmaz.

## Limitler

Repository 120, ref 200, path 400 karakterle sınırlıdır. Liste limitleri 1 ile 30 arasındadır. Dosya okumasındaki içerik sınırı mevcut github-read.ts politikasından devralınır.

## Cache ve kimlik

Browser çağrıları GET, same-origin credentials ve no-store ile yapılır. API response service worker shell cache'e alınmaz.

## Gerçekleştirmeyle uyumluluk

Bu API yalnızca read surface sağlar. Write endpoint eklemek mevcut workspace sözleşmesini genişletmek değil, farklı bir güvenlik alanı oluşturmak anlamına gelir ve ayrı tasarlanmalıdır.

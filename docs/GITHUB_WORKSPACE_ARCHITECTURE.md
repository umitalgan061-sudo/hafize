GitHub çalışma alanının mimarisi ve veri akışı

## Katmanlar

1. Tarayıcı UI: public/github-workspace.ts, github-workspace-extra.ts ve github-workspace-actions.ts.
2. Vite boundary: typed build çıktısı ve geliştirme ortamı path dönüşümü.
3. HTTP boundary: server.ts üzerindeki aynı-origin GET uçları.
4. Auth boundary: production-guard.ts bütün GitHub workspace uçlarını protectedPath kapsamına alır.
5. GitHub read boundary: github-read.ts allowlist, hassas dosya ve plaintext credential kontrollerini uygular.
6. Workspace readers: github-workspace.ts temel kaynakları, github-workspace-extra.ts dizin ve compare kaynaklarını normalize eder.

## İstek akışı

Tarayıcı yalnızca repository, ref, path ve görünüm parametrelerini gönderir. GitHub erişim token'ı sunucu ortamında kalır. Sunucu repository allowlist kontrolünden sonra GitHub API'ye gider. Sonuçlar bounded bir DTO ile browser'a döner.

## Temel kaynaklar

Repo görünümü repository metadatasını gösterir. Branch görünümü branch adı, SHA ve koruma bilgisini gösterir. Commit görünümü son commitleri getirir. PR görünümü state filtresiyle açık, kapalı veya tüm PR kayıtlarını okur. Dosya görünümü mevcut credential-aware readFile katmanını kullanır.

Dizin görünümü GitHub Contents API'nin yalnızca file ve dir öğelerini kullanır; obvious secret isimleri sonuçtan çıkarılır. Compare görünümü iki farklı ref arasında durum, commit sayısı ve bounded dosya farkı üretir.

## Yerel durum

Son repository, ref ve path değerleri sessionStorage içinde workspace state anahtarında tutulur. Recent repository geçmişi ayrı bir sessionStorage anahtarındadır. Browser tarafında GitHub token, Authorization header değeri veya uzak API yanıtının ham credential içeren kopyası kalıcı hale getirilmez.

## UI bağımlılıkları

Core kart kendisini utility rail içine mount eder. Extra ve actions katmanları core kartın DOM sözleşmesine ek yüzeyler takar. Katmanlardan biri bulunamazsa diğerleri uygulamayı bozmak yerine kendi mount işlemini atlar.

## Hata akışı

Backend tanınan hata kodlarını kısa biçimde döndürür. UI bu kodları kullanıcı diline çevirir. Uzak GitHub cevap gövdesi hata mesajına doğrudan taşınmaz. Bu, upstream ayrıntılarının browser'a sızmasını sınırlar.

## Cache

Service worker yalnız shell asset'lerini cache'ler. /api/github/workspace, /directory ve /compare yolları API prefix nedeniyle network-only sınıfında kalır. GitHub verisi service worker shell cache'ine yazılmaz.

## Yazma sınırı

Bu çalışma alanı repo.write_branch, repo.delete, repo.merge, external.write veya external.send işlemlerini sunmaz. GitHub değişiklikleri gerekiyorsa ayrı, açık kullanıcı onaylı bir write workflow gerektirir.

## Evrim

Yeni bir read action eklenirse aynı dört sözleşme güncellenmelidir: reader, server route, browser view ve test/DoD. Write action'lar bu çalışma alanının kapsamına eklenmemelidir.

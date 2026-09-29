# Konuşma Dalları Geliştirici Notları

Fork modülü app-shell içine büyük miktarda state taşımak yerine mevcut conversation storage'ı okur ve custom event ile uygulama state'ine geçiş ister.

## Ana sınırlar
STORAGE_KEY mevcut chat geçmişiyle aynıdır. MAX_CONVERSATIONS, MAX_MESSAGES, MAX_BRANCHES_PER_PARENT ve MAX_FORK_DEPTH kodun davranış sözleşmesidir.

## Lifecycle
Module boot aşamasında messages subtree observer kurar. App shell her render yaptığında yeni message article'ları decorate edilir.

## Event sözleşmesi
hafize:open-conversation yeni aktif conversation id'sini taşır.
hafize:conversation-forks-changed branch panelini yeniden taratır.

## DOM sınırı
Message text, title ve dialog preview textContent üzerinden yazılır. innerHTML veya outerHTML kullanılmaz.

## Network sınırı
Fork create işlemi network request yapmaz. Yeni dalın ilk gerçek model isteği app-shell submit akışında oluşur.

# Workspace navigation contract

Hafize’nin sidebar’ındaki **Görevler** ve **Bağlantılar** alanları artık gerçek, odaklı çalışma alanları olarak açılabilir. Bu katman yalnız mevcut UI kartlarını yeniden düzenler; yeni backend endpoint, connector permission veya write capability oluşturmaz.

## Çalışma alanları

- `chat`: mevcut ana sohbet görünümü; utility rail mevcut görünürlük durumlarını korur.
- `tasks`: yalnız `scheduleRuntimeCard` ve `scheduleListCard` gösterilir.
- `connections`: yalnız `accountConnectionCard`, `canvaConnectionCard` ve `githubWriteReadinessCard` gösterilir.
- `settings`: bu turda hâlâ disabled ve uygulanmamıştır.

## Güvenlik ve lifecycle

Workspace değeri sabit allowlist üzerinden normalize edilir. Card görünürlüğü de exact DOM id allowlist ile belirlenir; sonradan eklenen tanımsız bir utility card focused workspace içinde görünmez.

Mount başarısız olursa menü düğmeleri disabled kalır. Controller destroy edildiğinde `aria-current`, active class, hidden durumları ve host attribute'ları başlangıç durumuna geri döner. Workspace seçimi local/session storage'a gizlice yazılmaz.

Sunucu veya browser capability çalıştırılmaz. Controller yalnız `CustomEvent` ile workspace değişimini duyurabilir; event yetki veya onay taşımaz.

## PWA

`workspace-navigation.js` ve `workspace-navigation.css` shell asset olarak service-worker cache listesine girer. `/api/*` yolları network-only kalır.

## Erişilebilirlik

Focused workspace başlığında `aria-live` kullanılır ve çalışma alanına geçişte başlık odaklanabilir. Aktif sidebar düğmesi `aria-current="page"` ile işaretlenir. Reduced-motion ve forced-colors stilleri ayrıca korunur.

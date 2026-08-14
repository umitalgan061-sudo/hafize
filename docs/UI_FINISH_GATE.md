# Hafize UI Finish Gate

Bu sözleşme Agency Agents içindeki `UI Finish-Gate Reviewer` yaklaşımını Hafize'nin Claude-benzeri masaüstü, mobil ve PWA arayüzüne uyarlar. Amaç "daha modern" gibi öznel yorumlar değil, ürün işini ve ekran durumlarını kanıtlayan PASS/HOLD kararıdır.

## Ürün lensi

Hafize'nin ana ekranındaki ilk iş yapay zekâ ile konuşmaya başlamaktır. Bu nedenle ilk viewport şu sorulara açık cevap vermelidir:

- Kullanıcı nereye yazacak veya konuşacak?
- Hangi ajan/model aktif?
- Araç veya ses modu açık mı?
- Yanıt şu anda bekleniyor, üretiliyor veya seslendiriliyor mu?
- Geçmiş sohbet ve yardımcı araçlara nasıl ulaşılır?

Takvim, dekoratif efekt veya ikincil kartlar ana sohbet işini görsel olarak bastıramaz.

## Design contract

Her büyük UI değişikliğinde PR açıklaması veya inceleme notu şu kararları açıklar:

- **User + job:** Kullanıcı bu ekranda neyi bitirmeye çalışıyor?
- **First-read object:** İlk bakışta görülmesi gereken nesne nedir?
- **Primary action:** Ana etkileşim nedir?
- **Density:** Sıkı, dengeli veya ferah; neden?
- **Hierarchy:** Mesaj alanı, model/ajan, yardımcı kontroller ve ikincil bilgi hangi sırada?
- **Responsive priority:** Mobilde ne kalır, ne taşınır, ne gizlenir?
- **Forbidden defaults:** Hafize'nin işini gizleyen hangi jenerik desenler kullanılmayacak?
- **Finish evidence:** Hangi viewport ve durumlar doğrulandı?

## Yasaklanan jenerik davranışlar

Aşağıdakiler yalnız görsel moda uyduğu için eklenmez:

- birbirine eşit ağırlıkta gereksiz dashboard kartları;
- ana composer'dan daha baskın yardımcı paneller;
- işleve karşılığı olmayan gradient/glass/animation;
- mobilde yalnız desktop kartlarını alt alta dizmek;
- sahte veriyle dolu kalıcı dashboard görünümü;
- loading/error/empty/focus durumlarını sonradan yapılacak temizlik saymak.

## Zorunlu durumlar

Finish gate en az şu durumları inceler:

1. İlk açılış / boş sohbet.
2. Kullanıcı metin yazarken.
3. Yanıt stream ederken.
4. Tool activity çalışırken ve tamamlandığında.
5. Hata veya bağlantı problemi.
6. Sesli giriş aktifken.
7. Sesli yanıt açıksa thinking/speaking durumu.
8. Sidebar açık/kapalı.
9. Uzun mesaj ve uzun model/ajan adı.
10. Dar mobil viewport.
11. Klavye `focus-visible` durumu.
12. `prefers-reduced-motion` durumu.

## Masaüstü ve mobil doğrulama

Desktop incelemesi yalnız geniş ekranda hizalamaya bakmaz; ana iş akışının ilk viewport'ta okunurluğunu kontrol eder.

Mobil incelemesi şu sorulara cevap verir:

- Composer ekranda kalıyor mu?
- Gönder/mikrofon/araç kontrolleri yeterli dokunma alanına sahip mi?
- Model ve ajan seçimi kritik alanı taşırıyor mu?
- Utility rail ana sohbetin önüne geçiyor mu?
- Sidebar açıldığında içerik kullanılabilir kalıyor mu?
- Safe-area ve PWA standalone görünümü bozuluyor mu?

## Erişilebilirlik kapısı

PASS için kritik kontroller yalnız mouse ile değil klavyeyle de görünür ve kullanılabilir olmalıdır. Özellikle:

- gerçek buton/label semantics;
- anlamlı `aria-label` veya görünür metin;
- açık `:focus-visible` göstergesi;
- disabled ve pressed durumlarının anlaşılması;
- canlı durumların gereksiz tekrar yapmadan screen reader'a aktarılması;
- hareket azaltma tercihinin animasyonlarda uygulanması.

## PASS / HOLD

### PASS

- İlk-read object ve primary action nettir.
- Desktop ve mobile ana iş akışı korunur.
- Loading/empty/error/focus gibi belirtilen durumlar kasıtlıdır.
- Görsel efektler işlev hiyerarşisini bozmuyordur.
- İddia edilen iyileştirme screenshot, statik smoke veya uygun testle doğrulanmıştır.

### HOLD

- Ana sohbet işi ikincil kart veya dekor tarafından bastırılıyorsa.
- Mobil davranış yalnız "stack edildi" seviyesindeyse.
- Kritik bir focus/error/loading durumu tasarlanmamışsa.
- "Premium/modern/temiz" gibi sözcükler dışında görünür gerekçe yoksa.
- Kanıt olmadan görsel parity veya tamamlandı iddiası yapılıyorsa.

## Araç bağımlılığı

Hafize runtime gerçek screenshot/vision inceleme aracı kazanana kadar `UI Finish-Gate Reviewer` ayrı aktif ajan olarak registry'ye eklenmez. Bu sözleşme şimdilik insan/self-development incelemesi için kalite kapısıdır.

# Kod bloğu satır sarma sözleşmesi

Assistant Markdown kod bloklarında kullanıcı her blok için görünür `Satırı sar` kontrolüyle uzun satırları yatay kaydırma yerine sarılmış biçimde okuyabilir. Aynı kontrol `Kaydır` durumuna geçerek varsayılan yatay kaydırmaya döner.

## Kullanıcı kontrolü

- Varsayılan davranış değişmez; kod bloğu ilk açıldığında satır sarma kapalıdır.
- Değişiklik yalnız açık düğme tıklamasıyla ve yalnız ilgili kod bloğunda uygulanır.
- Durum `aria-pressed` ile erişilebilir biçimde duyurulur.
- Tercih kalıcı değildir; yeni oturumda veya yeniden render edilen blokta varsayılan davranış kullanılır.

## Veri ve güvenlik sınırı

Satır sarma yalnız CSS class değiştirir. Kod içeriğini değiştirmez, yürütmez veya ağa göndermez. Storage, cookie, clipboard, submit ya da tool çağrısı yapmaz. Clipboard davranışı mevcut `Kodu kopyala` kontrolünün ayrı güvenlik sözleşmesinde kalır.

## PWA

Davranış mevcut `/code-block-copy.js` shell asset'i içinde olduğundan cache sürümü v36'ya yükseltilmiştir. `/api/*` istekleri network-only kalır.

## Geri alma

Bu değişiklik kaldırılırsa wrap düğmesi, `hafize-code-wrap` CSS sınıfı, wrap testleri ve v36 cache ilerlemesi kaldırılır; kod kopyalama ve güvenli Markdown davranışları korunur.
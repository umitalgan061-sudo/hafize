# Kod satır kaydırma sözleşmesi

`public/code-wrap-toggle.js`, safe Markdown + code-block-copy tarafından oluşturulmuş kod shell'lerine kullanıcı kontrollü satır kaydırma düğmesi ekler.

Varsayılan davranış mevcut yatay kaydırmayı korur. Kullanıcı `Satırı kaydır` düğmesine bastığında yalnız ilgili `.hafize-code-shell` üzerinde `data-wrap="on"` olur ve `pre-wrap` + `overflow-wrap:anywhere` uygulanır. Aynı düğme davranışı geri kapatır ve `aria-pressed` durumunu günceller.

Bu tercih kalıcı değildir; storage/cookie kullanılmaz ve konuşmalar arasında taşınmaz. Controller kod içeriğini okumaz, değiştirmez veya clipboard'a yazmaz. Network, submit, tool çağrısı ve navigation yüzeyi yoktur.

Asset PWA shell cache v36 kapsamındadır; `/api/*` network-only kalır.

Geri almada controller, loader/PWA wiring, test ve bu belge kaldırılır; Markdown render ve kod kopyalama davranışları korunur.

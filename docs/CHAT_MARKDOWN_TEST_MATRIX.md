# Sohbet Markdown Render — Test Matrisi

| Alan | Kontrol |
| --- | --- |
| Bloklar | Başlık, paragraf, liste, alıntı, HR, fence |
| Inline | Kalın, eğik, üstü çizili, code span, escape |
| Link | http/https/mailto allowlist; javascript/data/göreli red |
| DOM | createElement tabanlı ağaç, `textContent`, yeniden render |
| Güvenlik | HTML injection, attribute injection, control chars |
| Sınırlar | Uzun satır, uzun yanıt, fence ve nesting sınırları |
| Streaming | Frame coalescing, final repaint, stale delta guard |
| Entegrasyon | app.js, downstream consumers, script bootstrap |
| Erişilebilirlik | aria-live, aria-busy, kod kopyalama düğmesi, klavye |

## Manuel tarayıcı doğrulaması

1. Normal asistan yanıtında başlık/listeler görsel olarak okunabilir.
2. Kod bloğu yatay taşmayı kendi kabında tutar.
3. Kod kopyalama düğmesi kaynak kodu panoya alır.
4. Koyu ve açık tema aynı semantik yapıyı korur.
5. Mobil görünümde bloklar yatay taşma üretmez.
6. Kullanıcı mesajları markdown olarak yorumlanmaz.
7. Streaming tamamlandığında ekran okuyucu için `aria-busy` kapanır.

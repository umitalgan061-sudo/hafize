# Geliştirici Rehberi

Kodun giriş noktası `public/settings-privacy.js` dosyasıdır.

Global API `HafizePrivacyCenter` ile test ve entegrasyon yapılabilir.

Storage yüzeyleri SURFACES allowlist'inden gelir.

UI action'ları DOM listener'larıyla bağlanır.

Yeni surface eklemek index veya server route değişikliği gerektirmemeli; yalnız storage contract ve dokümanlar güncellenmelidir.

Legacy app runtime ile privacy center arasında direct dependency yoktur.

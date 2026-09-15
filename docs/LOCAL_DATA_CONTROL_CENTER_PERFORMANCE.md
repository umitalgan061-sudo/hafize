# Yerel Veri Merkezi — Performans

## Bounded work

Inspector yalnız registry'deki sabit sayıda key'i kontrol eder. Her tekil okuma 1.5 MB ile sınırlandırılır.

## Rendering

Liste native DOM düğümleriyle bir kez oluşturulur ve snapshot değiştiğinde yeniden çizilir. Kullanıcı metni HTML parser'ına gönderilmez.

## Parsing

Bozuk veya kesilmiş değerler parse edilmeden metadata state'ine alınır. Böylece büyük string'ler gereksiz JSON parse maliyeti oluşturmaz.

## Refresh

Cross-tab storage event'i geldiğinde yalnız snapshot yenilenir. Polling veya sürekli timer kullanılmaz.

## Manifest

Metadata manifesti 250 KB ile bounded'dır ve yalnız kullanıcı tarafından başlatıldığında üretilir.

## UX hedefi

Settings panelini açmak chat composer performansını etkilememelidir. Data center ana chat event loop'una blocking ağ işlemi eklemez.

## Mobile

Liste yüksekliği sınırlıdır. Dar ekranlarda satırlar kırılır ve aksiyonlar erişilebilir kalır.

## Future scaling

Storage alanları çoğalırsa registry küçük gruplara ayrılabilir. Tam localStorage taraması veya içerik indexleme kullanılmamalıdır.

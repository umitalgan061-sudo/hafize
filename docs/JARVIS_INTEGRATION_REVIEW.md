# Jarvis entegrasyon incelemesi

İncelenen kaynak: `alpunlu12-commits/jarvis`.

Bu belge üçüncü taraf kodu Hafize'ye topluca kopyalamak için değil, yararlı ürün fikirlerini güvenli ve lisans uyumlu biçimde yeniden uygulamak için karar kaydıdır.

## Lisans sınırı

- İnceleme sırasında `main` dalında GitHub tarafından tanınan bir depo lisansı bulunmuyordu.
- Açık PR #7 içinde GNU AGPL v3 lisans dosyası eklenmiş durumda.
- PR #3 içindeki ZIP'ten çıkarılmış kaynaklar kapalı ve merge edilmemiş bir değişiklik setidir; bunları Hafize kaynaklarına doğrudan kopyalamıyoruz.
- Hafize'de Jarvis davranışlarından ilham alınabilir, ancak uygulama kodu kendi mimarimiz ve testlerimizle bağımsız olarak yazılır.

## Yararlı fikirler

### 1. Sesli durum makinesi

Jarvis; dinleme, düşünme, konuşma, sessiz, duraklatılmış ve hata durumlarını ayrı UI durumları olarak ele alıyor. Hafize için en değerli ilk aktarım budur.

Hafize uyarlaması:
- sesli yanıt varsayılan kapalı ve açık kullanıcı tercihi ister;
- yanıt stream ederken orb düşünme durumunu gösterebilir;
- tamamlanan yanıt cihazın yerleşik TTS motoruyla okunabilir;
- kullanıcı yeni mesaj gönderdiğinde veya mikrofona geçtiğinde TTS kesilir;
- sekme arka plana geçtiğinde ses çıkışı durur.

### 2. Kalıcı kişisel bellek

Jarvis kullanıcı kimliği, tercihler, projeler ve notlar için kalıcı bellek fikri kullanıyor. Hafize'de aynı ürün ihtiyacı değerlidir fakat düz JSON dosyası kullanılmamalıdır.

Planlanan Hafize yaklaşımı:
- kullanıcıya ait scope;
- sunucu tarafında şifreli/korumalı saklama;
- `memory.read`, `memory.write`, `memory.delete` gibi ayrı izinler;
- unutma/silme isteğinde kesin eşleşme ve kullanıcı kontrolü;
- secret veya credential değerlerini bellek bağlamına almama.

### 3. Ekran analizi

Aktif pencereyi görsel modele gönderme fikri yararlıdır. Hafize'de gizli ekran yakalama yerine açık kullanıcı paylaşımı kullanılmalıdır.

Planlanan yaklaşım:
- web/PWA için `getDisplayMedia` ile kullanıcı seçimli paylaşım;
- Electron için dar izinli ekran yakalama bridge'i;
- geçici görüntüyü kalıcı geçmişe otomatik yazmama;
- mümkün olduğunda NVIDIA vision modeli kullanma.

### 4. Yerel cihaz köprüsü

Sistem bilgisi, uygulama açma, tarayıcı açma ve medya kontrolü masaüstü Hafize için değerlidir. Bunlar cloud agent'ın doğrudan işletim sistemi komutu çalıştırması şeklinde değil, Electron tarafında allowlist'li bir device bridge olarak tasarlanmalıdır.

### 5. Yerel model sağlayıcısı

PR #7 Ollama sağlayıcısı fikrini ekliyor. Hafize'nin NVIDIA NIM ana sağlayıcısını bozmadan gelecekte isteğe bağlı `local` provider katmanı düşünülebilir. Tool izin sözleşmesi sağlayıcıdan bağımsız kalmalıdır.

### 6. Wake phrase / eller serbest kullanım

Jarvis çevresindeki issue ve belgeler sürekli dinleme yerine uyandırma ifadesi ihtiyacını gösteriyor. Hafize'de bu özellik ancak açık opt-in, görünür mikrofon göstergesi ve kolay kapatma ile masaüstü uygulamasında değerlendirilmelidir.

## Bilerek alınmayan desenler

- `shell=True` benzeri geniş terminal yürütme ve deny-list güvenliği.
- API anahtarlarını düz JSON dosyasına yazma.
- WhatsApp veya başka dış serviste ayrı uygulama onayı olmadan otomatik gönderme.
- Modelin önemli kullanıcı bilgisini kullanıcı kontrolü olmadan sessizce belleğe yazması.
- YouTube HTML çıktısını regex ile kazıma gibi kırılgan entegrasyonlar.
- `venv`, `__pycache__`, üretilmiş binary ve credential olabilecek yerel config dosyalarını repoya taşıma.

## Hafize güvenlik sözleşmesi değişmez

- backend default-deny tool authorization korunur;
- dış yazma/gönderme/merge işlemleri açık onay gerektirir;
- secret değerleri ajan bağlamına girmez;
- `.env`, credential ve `.github/workflows/` self-development tarafından değiştirilmez;
- yeni cihaz yetenekleri ayrı izinlerle ve en az yetkiyle açılır.

## Uygulama sırası

1. Sesli yanıt + düşünme/konuşma orb durumu + barge-in.
2. Güvenli kişisel bellek sözleşmesi.
3. Açık kullanıcı izinli ekran paylaşımı/analizi.
4. Electron device bridge: sistem bilgisi ve uygulama/tarayıcı açma.
5. İsteğe bağlı Ollama/local provider adaptörü.
6. Wake phrase ve gelişmiş hands-free modu.

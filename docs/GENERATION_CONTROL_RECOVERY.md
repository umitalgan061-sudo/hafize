# Üretim Kontrolü — Recovery

## Hedef

Bir üretim yarıda kesildiğinde kullanıcıya mevcut faydalı metni kaybettirmemek ve yeniden üretme sırasında eski cevabı güvenli biçimde korumak.

## Normal chat recovery

Streaming delta'ları assistant mesajına yazılır. Durdurma sonrasında mesaj içerikliyse korunur. İlk token gelmeden durdurulan boş assistant placeholder'ı storage'dan çıkarılır.

## Regeneration recovery

Regeneration başlamadan önce mevcut assistant içeriği memory içinde tutulur. Yeni stream abort veya failure ile kapanırsa önceki içerik geri yazılır.

Başarılı yeni üretimde eski cevap response alternates zincirine alınır. Durdurma bu zinciri değiştirmez.

## Ağ recovery

Offline olayı aktif generation'a offline stop reason ile iletilir. Network geri geldiğinde eski generation otomatik yeniden çalıştırılmaz. Böylece aynı kullanıcı isteğinin izinsiz ikinci kez gönderilmesi engellenir.

## Browser lifecycle

Sayfa kapanırken generation controller aktif stream'i abort eder. Timer ve event listener'lar temizlenir. Terminal history kaydı iki kez yazılmaz.

## Failure containment

History yazma hatası generation failure'a çevrilmez. Clipboard hatası response kaybına neden olmaz. Generation paneli ikinci bir prompt/response yedeği oluşturmaz.

## Kullanıcı güvencesi

- partial cevap durdurma sonrası korunur,
- regeneration hatasında eski cevap geri gelir,
- offline durumunda eski stream yeniden gönderilmez,
- tanı çıktısı prompt/response içermez,
- history 12 metadata kaydıyla sınırlıdır.

## Test sırası

begin → progress → stop → aborted → partial preserved

ve:

begin → progress → fail/abort → previous regeneration content restored.

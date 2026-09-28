# Yeniden Üretme Modları

## Normal
Yeni yanıt aynı konuşma bağlamıyla üretilir.

## Daha kısa
Yalnızca request gövdesine geçici yönerge eklenir. Conversation kaydına ayrı user message eklenmez.

## Daha detaylı
Yanıt kapsamını artırmayı isteyen geçici yönerge kullanılır.

## Daha resmi
Dil tonunu değiştiren geçici yönerge kullanılır.

## Madde madde
Yanıtın okunabilirliğini artıran geçici yönerge kullanılır.

## Özel
Kullanıcı en fazla 600 karakterlik kendi yönergesini yazar.

## Güvenlik
Yönerge normalized edilir, null byte temizlenir ve bounded uzunlukta tutulur.

## Persistence
Preset veya custom instruction conversation içine yazılmaz.

## Restore
Instruction ile üretilmiş cevabın önceki cevabı da normal alternate history davranışıyla korunur.

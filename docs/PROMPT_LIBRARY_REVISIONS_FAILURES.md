# Revision Failure Modes

## Storage okunamıyor

`readAll()` JSON parse veya storage erişim hatasında boş map döndürür. Ana prompt storage'ına müdahale edilmez.

## Storage yazılamıyor

`writeAll()` false döndürür. UI işlemin güvenle tamamlanmadığını status alanında gösterebilir.

## Prompt bulunamadı

Revision restore isteği sırasında prompt silinmişse restore yapılmaz ve `prompt-not-found` sonucu döner.

## Revision geçersiz

Boş body veya prompt id içermeyen revision normalize edilmez.

## Duplicate

Aynı başlık/body/tags kombinasyonu mevcutsa yeni snapshot eklenmez.

## Retention

10 revision sınırı aşıldığında eski kayıtlar retention dışına çıkar; bu durum ana prompt'u etkilemez.

## Export sınırı

1 MB limiti aşılırsa export en yeni 5 revision ile küçültülür.

## Date parsing

Geçersiz tarih UI sıralamasını bozabilir; source kayıtları güvenilir ISO timestamp ile üretir. Görüntüleme layer'ı Date formatter kullanır.

## Stale active prompt

Storage event sonrası active prompt tekrar core storage'dan çözülür. Kayıt bulunamazsa önceki snapshot referansı korunabilir ancak restore yeni hedef bulamaz.

## Event constructor

StorageEvent constructor desteklenmiyorsa generic refresh event fallback'i kullanılır.

## Browser quota

Private browsing veya dolu storage durumunda revision kaydı oluşmayabilir; uygulama shell'i çalışmaya devam eder.

## UI cleanup

Destroy çağrısı observer ve event listener'ları kaldırır, modal DOM'unu temizler.

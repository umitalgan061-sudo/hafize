# Zamanlanmış Görevler — Release Checklist

## Scope freeze

Bu release yalnızca mevcut schedule API için kullanıcı arayüzü sağlar.

Yeni scheduler algoritması eklenmez.

Yeni storage sistemi eklenmez.

Yeni auth sistemi eklenmez.

Yeni secret client'a aktarılmaz.

## Product behavior

Görevler menüden açılabilir.

Görev formu ajan seçebilir.

Görev formu task text girebilir.

Görev formu gelecekteki tarih/saat seçebilir.

Görev formu maksimum deneme sayısını 1–5 arasında seçebilir.

Hızlı şablonlar task textarea'yı doldurabilir.

Görev listesi server snapshot'ından oluşturulur.

Status filter local görünümü değiştirebilir.

Planlanmış görev iptal edilebilir.

İptal onayı alınır.

Trace ID görüntülenebilir.

Refresh manuel ve otomatik yapılabilir.

## API verification

GET `/api/schedules` mevcut endpoint olmalıdır.

POST `/api/schedules` mevcut endpoint olmalıdır.

DELETE `/api/schedules/:id` mevcut endpoint olmalıdır.

401 authentication failure beklenmelidir.

400 validation failure beklenmelidir.

404 not found beklenmelidir.

409 non-cancellable transition beklenmelidir.

503 capacity failure beklenmelidir.

Client request credentials same-origin olmalıdır.

## Browser verification

Chrome/Edge latest desktop: form, list, filter, cancel, keyboard.

Firefox latest desktop: form, list, filter, cancel, keyboard.

Safari desktop latest: datetime-local fallback ve form.

iOS Safari: modal bottom-sheet düzeni, keyboard viewport, scroll.

Android Chrome: modal scroll, keyboard, datetime picker.

## Keyboard verification

Ctrl+Shift+T görevler panelini açmalıdır.

Form alanında yazarken global shortcut input üzerine müdahale etmemelidir.

Escape modalı kapatmalıdır.

Tab ile tüm kontroller erişilebilir olmalıdır.

## Accessibility verification

Dialog accessible label taşımalıdır.

Status messages live region olmalıdır.

Task textarea accessible label taşımalıdır.

Agent select accessible label taşımalıdır.

Datetime input accessible label taşımalıdır.

Attempts select accessible label taşımalıdır.

Filter select accessible label taşımalıdır.

Trace button anlamlı accessible label taşımalıdır.

Focus visible olmalıdır.

Reduced motion desteklenmelidir.

Forced colors desteklenmelidir.

## Security verification

Client source'ta schedule token bulunmamalıdır.

Client source'ta NVIDIA secret bulunmamalıdır.

Task text HTML olarak yorumlanmamalıdır.

Schedule ID encoded olmalıdır.

API cache'lenmemelidir.

Owner ID client response'da bulunmamalıdır.

Cancel kullanıcı onaysız tetiklenmemelidir.

## PWA verification

Scheduled tasks CSS shell cache listesinde olmalıdır.

Scheduled tasks JS shell cache listesinde olmalıdır.

Enhancement JS shell cache listesinde olmalıdır.

Keyboard JS shell cache listesinde olmalıdır.

Cache version increment edilmelidir.

`/api/` network-only kalmalıdır.

## Regression verification

Conversation Workspace açılmalıdır.

Message Workspace açılmalıdır.

Prompt Library açılmalıdır.

Composer submit çalışmalıdır.

Voice controls etkilenmemelidir.

Sidebar toggling etkilenmemelidir.

Theme değişimi schedule modalına yansımadır.

## Failure verification

Offline durumda kullanıcıya generic servis hatası gösterilmelidir.

401 durumda authentication mesajı gösterilmelidir.

Capacity error durumda capacity mesajı gösterilmelidir.

409 cancel race sonrası güncel liste gösterilmelidir.

Malformed JSON response crash üretmemelidir.

## Rollback verification

PR revert edilebilir olmalıdır.

Server schedule kayıtları silinmemelidir.

Client-only static asset rollback data loss üretmemelidir.

## Operational readiness

Worker çalışıyor olmalıdır.

Schedule storage açılabiliyor olmalıdır.

Schedule auth configuration geçerli olmalıdır.

Schedule model configuration geçerli olmalıdır.

Lease runtime yapılandırması ayrı doğrulanmalıdır.

## Release gate

Güvenlik testi başarısızsa yayınlanmaz.

API ownership testi başarısızsa yayınlanmaz.

PWA policy testi başarısızsa yayınlanmaz.

Client syntax testi başarısızsa yayınlanmaz.

Manual keyboard testi başarısızsa yayınlanmaz.

## Post-release

İlk production kullanımında schedule API error oranı gözlenmelidir.

Worker gecikmeleri incelenmelidir.

Capacity hit sayıları incelenmelidir.

Kullanıcı destek bildirimleri sınıflandırılmalıdır.

Client telemetry eklenmesi bu release'in parçası değildir.

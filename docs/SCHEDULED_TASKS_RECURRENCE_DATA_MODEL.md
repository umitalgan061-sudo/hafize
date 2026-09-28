# Recurrence Veri Modeli

## Schedule kaydı
Schedule kaydı mevcut alanlarının yanında şu optional alanlara sahip olabilir:
`recurrence`, `seriesId`, `occurrenceCount`, `history`.

## recurrence
`frequency` üç değerden biri olmalıdır: daily, weekly, monthly.
`interval` 1 ile 30 arasında integer olmalıdır.

weekly için `daysOfWeek` 0–6 değerlerinden oluşur.
monthly için `dayOfMonth` 1–31 arasındadır.

## seriesId
Serinin sabit kimliğidir.
Tek seferlik kayıtlarda null tutulur.
Tekrarlı kaydın scheduleId değerinden türetilen deterministik bir seri bağı vardır.

## occurrenceCount
Tamamlanmış veya final failure olarak kapanmış oluşumların sayısını gösterir.
Retry ara durumları bu sayacı artırmaz.
Sayaç bounded integer olarak normalize edilir.

## history
Son 20 oluşumun özetini içerir.
Her satır status, attempts, maxAttempts, runAt, finishedAt ve lastError alanlarını taşıyabilir.
Bilinmeyen alanlar import sırasında atılır.

## Güvenlik
History içine credential, output veya kullanıcıya ait gizli bilgi alınmaz.
Hata kodları uppercase token biçiminde sınırlandırılır.
ID ve metin alanları bounded olarak okunur.

## Örnek
Bir günlük görev ilk çalışmasında completed olursa aynı schedule kaydı scheduled durumunda kalır,
runAt ertesi güne taşınır, attempts sıfırlanır ve history başına completed kaydı eklenir.

## Migration
Yeni alanların yokluğu legacy snapshot için normal durumdur.
Migration dosyası gerekmez; restoreSnapshot normalizer'ı defaults uygular.

## Test yükümlülüğü
Round-trip persistence, duplicate history, malformed recurrence, oversized history
ve backward-compatible snapshot testleri zorunludur.

# Prompt Library Revisions

## Amaç

Prompt Library'de istem düzenlenirken önceki içeriklerin yerel sürümlerini korumak ve gerektiğinde güvenli biçimde geri yüklemek.

## Saklama alanı

`hafize.prompt-library.revisions.v1` JSON array olarak tutulur. Sürüm kaydı ayrı bir storage anahtarıdır; prompt ana kaydının schema'sı değiştirilmez.

## Snapshot

Her revision başlık, gövde, etiket, favori, kullanım sayısı ve zaman damgalarından oluşan bounded bir snapshot taşır. Variable values veya sohbet geçmişi snapshot'a girmez.

## Capture

İçerik gerçekten değişmediyse yeni revision oluşturulmaz. Create, edit ve restore olayları reason alanı ile ayırt edilir.

## Sınırlar

Prompt başına en fazla 20 revision, tüm library için en fazla 600 revision tutulur. Body 8000, title 100, tag 24, reason 160 karakter sınırlarına normalize edilir.

## Geri yükleme

Kullanıcı açık onay verdikten sonra seçilen snapshot ana prompt'a yazılır. Mevcut değer `before-restore` revision olarak saklanır, ardından `restore` revision kaydedilir. `createdAt` korunur; `useCount` mevcut değerden devam eder.

## Orphan policy

Silinen prompt'ların revision kayıtları `pruneOrphans` ile temizlenir. Böylece geçmişte artık erişilemeyen istemler gereksiz yer tüketmez.

## JSON export

Revision export yalnızca seçilen prompt'un geçmişini ve metadata'yı içerir. Export network üzerinden gönderilmez.

## UI

Sürüm geçmişi paneli mevcut Prompt Library kartı içinde çalışır. İstem seçimi, yenileme, gizle/göster, geri yükleme ve JSON export gerçek DOM düğümleriyle yapılır.

## Güvenlik

Revision preview ve başlıklar `textContent` ile gösterilir. Kullanıcı verisi HTML string olarak yürütülmez. Restore destructive değildir; mevcut içerik önce yedeklenir.

## Lifecycle

Mount sırasında storage listener ve MutationObserver eklenir. Destroy bunların tamamını kaldırır ve paneli DOM'dan söker.

## DoD

Release öncesi capture, duplicate suppression, restore, bounds, orphan pruning, export, DOM safety ve lifecycle testleri tamamlanmalıdır.

# Composer Ekleri — Release Notes

## Yeni
Yerel text/code attachment paneli, line range, cursor insertion, undo, range copy, secret scan ve hızlı analiz eylemleri eklendi.

## Güvenlik
Pre-read byte validation, bounded memory, no-storage, no-network, no-submit ve secret confirmation uygulanır.

## Erişilebilirlik
ARIA status, keyboard shortcuts, Escape focus return, details preview ve forced-colors/reduced-motion desteği bulunur.

## PWA
Static attachment assetleri shell cache'e alındı ve cache version v37 olarak artırıldı.

## Backward compatibility
Conversation, Prompt Library ve Composer History storage formatları değiştirilmedi.

## Known limitation
Secret scanner regex tabanlıdır ve tam DLP değildir. Clipboard/drop desteği browser capability'lerine bağlıdır.

## Verification
Kaynak sözleşme, VM davranış, security, PWA, accessibility, lifecycle ve quick-action test paketleri bulunur.
# Konuşma Dalları Rollback Kontrol Listesi

## Öncesi
- PR head'in main ile aynı base üzerinden geldiğini doğrula.
- Fork child kayıtlarının parent mesajlarını değiştirmediğini doğrula.
- Snapshot export'un yalnız local dosya üretmesi gerekir.

## Rollback
1. PR revert edilir.
2. Service worker cache eski sürüme döner.
3. Mevcut conversation storage silinmez.
4. Fork alanları opsiyonel kaldığından mevcut sohbetler okunmaya devam eder.

## Sonrası
- Parent sohbet açılmalı.
- Fork UI bulunmasa bile conversation history kaybolmamalı.
- Yeni normal sohbet oluşturma akışı etkilenmemeli.
- Network endpoint davranışı değişmemeli.

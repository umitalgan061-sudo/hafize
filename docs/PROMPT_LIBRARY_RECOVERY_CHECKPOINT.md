# Repair checkpoint

Safe repair öncesi recovery snapshot checkpoint olarak local storage'a yazılır.

Checkpoint:
- prompt
- collection
- revision

alanlarını taşır.

Undo checkpoint'i restore eder ve başarı sonrasında temizler.

Checkpoint yalnızca son repair için tutulur.


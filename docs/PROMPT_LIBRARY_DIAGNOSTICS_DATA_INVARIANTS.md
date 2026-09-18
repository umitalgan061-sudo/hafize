# Diagnostics data invariants

1. Diagnostics read-only tarama ile başlar.
2. Repair kullanıcı onayı olmadan çalışmaz.
3. Duplicate promptlar drop edilmez.
4. Invalid records permanent delete yerine quarantine'a alınabilir.
5. Safe repair öncesi checkpoint vardır.
6. Undo checkpoint restore eder ve temizler.
7. Collection orphanları mevcut prompt ID'lerine göre budanır.
8. Remote storage veya analytics yoktur.

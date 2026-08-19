# Conversation search index budget

Canonical sohbet araması yalnız storage guard'dan geçmiş `user` ve `assistant` mesajlarını indeksler. İndeks sınırları:

- en fazla 30 sohbet;
- sohbet başına en fazla 120.000 karakter;
- tüm indeks için en fazla 1.200.000 karakter.

Parçalar birleştirilirken araya giren separator karakterleri de artık hem sohbet hem global bütçeye sayılır. Böylece içerik parçaları tek tek limite kadar doldurulup daha sonra `\n` separator'ları eklendiğinde birleşik string'in limiti aşması ve `normalizeSearchText()` tarafından tamamen boş indeks olarak reddedilmesi engellenir.

Boundary exact ve fail-closed kalır: separator için yer yoksa yeni parça eklenmez; user/assistant dışı roller indekslenmez; owner, trace, token, credential ve bilinmeyen conversation alanları arama metnine girmez. Yeni backend isteği veya persistent indeks eklenmez; arama hâlâ tarayıcıda bounded canonical snapshot üzerinde çalışır.

Regresyonlar exact 120.000 karakter sınırı, çok parçalı 200 mesajlık sohbet, 30 sohbetlik global baskı, separator ağırlıklı küçük parçalar, içerik eşleşmesi ve secret/role redaction davranışlarını kapsar.

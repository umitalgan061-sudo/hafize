# Merge Criteria

Merge öncesi base-to-head diff 3000 değişen satırı geçmemelidir.

Hedef yaklaşık 2800-3000 bandıdır.

Feature ana amacı local data inventory ve safe cleanup'dır.

Doküman ve testler feature contract'ının ayrılmaz parçalarıdır.

PR açıklaması what/why/testing/rollback bölümlerini içermelidir.

Doğrudan main'e self-development merge edilmez; branch + PR akışı kullanılır.

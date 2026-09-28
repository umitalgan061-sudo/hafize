# Tekrar Planlama Uyumluluk

Duplicate action yalnız schedule workspace'in row markup'ına bağımlıdır. Gerekli metadata açıkça dataset alanlarında tutulur.

Desteklenen row alanları:

- data-schedule-id
- data-agent-id
- data-run-at
- data-max-attempts
- data-status

Form alanları değişirse duplicate enhancement form selectorlerini yeni DOM'a göre güncellemek gerekir.

API değişikliği yoktur. Duplicate işlemi yeni endpoint çağırmaz.

Legacy scheduled-tasks.js dosyası yalnız typed-build köprüsü olarak kalır; duplicate mantığına ikinci bir implementation eklenmez.

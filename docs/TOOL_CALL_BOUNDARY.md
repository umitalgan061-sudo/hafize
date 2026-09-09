# Tool-call boundary

Model kaynaklı tool çağrıları execution öncesinde normalize edilir. Tool adı, çağrı kimliği ve JSON argument gövdesi uzunluk sınırlarına tabidir; dizi veya primitive argument kökleri kabul edilmez.

Tool hataları provider'ın ham mesajını dışarı taşımadan sınırlı bir `{ code, status }` sonucuna indirilir. Böylece upstream traceback, credential veya sınırsız hata metninin API yanıtına sızması engellenir.

Boundary'nin kendi reddi de kod taşır: eksik çağrı kimliği `INVALID_TOOL_CALL_ID`, geçersiz gövde `INVALID_TOOL_ARGUMENTS` olarak döner. Bu red nedenleri jenerik `TOOL_EXECUTION_FAILED` altında gizlenmez; provider detayı yine dışarı çıkmaz.

Skill permission filtresi bu boundary'den önce çalışır; boundary yetki vermez, yalnız girdinin güvenli şekle indirgenmesini sağlar.

# Tool-call boundary

Model kaynaklı tool çağrıları execution öncesinde normalize edilir. Tool adı, çağrı kimliği ve JSON argument gövdesi uzunluk sınırlarına tabidir; dizi veya primitive argument kökleri kabul edilmez.

Tool hataları provider'ın ham mesajını dışarı taşımadan sınırlı bir `{ code, status }` sonucuna indirilir. Böylece upstream traceback, credential veya sınırsız hata metninin API yanıtına sızması engellenir.

Skill permission filtresi bu boundary'den önce çalışır; boundary yetki vermez, yalnız girdinin güvenli şekle indirgenmesini sağlar.

Boundary'nin kendi doğrulama hataları (`INVALID_TOOL_CALL`, `INVALID_TOOL_CALL_ID`, `INVALID_TOOL_NAME`, `INVALID_TOOL_ARGUMENTS`, `TOOL_ARGUMENTS_TOO_LARGE`) makine tarafından okunabilir bir `code` taşır. Böylece reddedilen bir çağrı genel `TOOL_EXECUTION_FAILED` yerine nedenini bildirir; bu kodlar boundary'nin kendi sabitleridir ve provider metni içermez.

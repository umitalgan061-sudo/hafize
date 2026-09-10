# Tool-call boundary

Model kaynaklı tool çağrıları execution öncesinde normalize edilir. Tool adı, çağrı kimliği ve JSON argument gövdesi uzunluk sınırlarına tabidir; dizi veya primitive argument kökleri kabul edilmez.

Tool hataları provider'ın ham mesajını dışarı taşımadan sınırlı bir `{ code, status }` sonucuna indirilir. Böylece upstream traceback, credential veya sınırsız hata metninin API yanıtına sızması engellenir.

Boundary'nin kendi red kodları (`INVALID_TOOL_CALL`, `INVALID_TOOL_CALL_ID`, `INVALID_TOOL_NAME`, `INVALID_TOOL_ARGUMENTS`, `TOOL_ARGUMENTS_TOO_LARGE`) hata nesnesinde `code` olarak taşınır ve 400 statüsü ile döner; bunlar çağıranın kendi girdisiyle ilgilidir ve `TOOL_EXECUTION_FAILED` altında gizlenmez. Yalnız tanınmayan execution hataları `TOOL_EXECUTION_FAILED` koduna indirgenir.

Skill permission filtresi bu boundary'den önce çalışır; boundary yetki vermez, yalnız girdinin güvenli şekle indirgenmesini sağlar.

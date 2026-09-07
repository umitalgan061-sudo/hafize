# Connector capability matrix

Connector readiness artık tek tek boolean değerler yerine explicit capability isimleriyle ifade edilebilir: `github.read`, `gmail.read`, `canva.read`, `calendar.read/write`, `reminder.read/write`.

Write capability'leri read capability'sini gerektirir. Böylece bir provider'a yazma izni verilmiş gibi görünüp önce mevcut veriyi okuma yüzeyinin olmadığı durumlar blocker olarak raporlanabilir.

Matrix yalnız capability görünürlüğünü açıklar; OAuth/session credential üretmez ve provider çağrısı yapmaz.

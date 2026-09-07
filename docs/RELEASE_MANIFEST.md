# Release manifest

Release manifest, runtime readiness sonucunu ve release gate kontrollerini tek bir immutable çıktı altında toplar. `releaseable=true` yalnız readiness hazır ve tüm bildirilen checks geçtiğinde oluşur.

Manifest version + commit kimliğini taşır; eksik gate'ler `missingReleaseGates()` ile görünür. Bu contract deploy yapmaz ve merge kararı vermez; release reviewer için son deterministik kanıt katmanıdır.

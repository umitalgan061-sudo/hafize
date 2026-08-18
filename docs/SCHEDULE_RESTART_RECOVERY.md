# Schedule restart recovery

## Problem

Durable schedule storage bir process kapanması veya deploy sırasında `running` durumda kalmış kayıtları yeniden yükleyebilir. Eski davranış bu kayıtları olduğu gibi restore ettiği için worker yalnız `scheduled` kayıtları claim ettiğinden görev kalıcı olarak takılı kalabiliyordu.

## Recovery contract

Persistence `open()` sırasında snapshot doğrulandıktan sonra yalnız `status: running` kayıtlar interrupted olarak kabul edilir.

- `status` tekrar `scheduled` yapılır.
- Claim sırasında artırılmış `attempts` değeri bir azaltılır.
- `lastError` sabit `SCHEDULE_PROCESS_RESTARTED` olur.
- `runAt`, task, trace, owner, agent, retry policy ve diğer alanlar değiştirilmez.
- Scheduled/completed/failed/cancelled kayıtlar aynı kalır.

Attempt refund gereklidir çünkü process termination altyapı olayıdır; model çalışmasının başarıyla tamamlanıp store completion'a yazıldığı doğrulanamaz. Scheduled agent execution yolu dış write/send/merge için explicit approval sınırını aşamaz; bu nedenle restart recovery kullanıcı onayı gerektiren yan etkileri sessizce tekrar etmeye yetki vermez.

## Persist-before-resume

Recovery yalnız in-memory uygulanmaz. En az bir running kayıt bulunduğunda recovered snapshot, persistence `open()` tamamlanmadan önce adapter'a kaydedilir. Recovery save başarısızsa startup `SCHEDULE_PERSISTENCE_RECOVERY_SAVE_FAILED` ile fail-closed olur ve store açık kabul edilmez.

Bu sıra, process recovery'den hemen sonra tekrar çökerse aynı interrupted claim'in tekrar tekrar attempt tüketmesini veya bellekteki durum ile disk durumunun ayrışmasını önler.

## Veri minimizasyonu

Yeni alan veya persistent schema sürümü eklenmez. Var olan `lastError` alanında sabit hata kodu kullanılır. Provider exception, stack trace, credential, secret veya model çıktısı snapshot'a eklenmez.

## Multi-instance sınırı

Bu davranış durable snapshot açılış recovery'sidir. Aynı schedule üzerinde canlı iki instance yarışını çözmeye çalışmaz; bunun için mevcut Redis lease execution sınırı otoritedir. Recovery, process artık çalışmadığı için persisted `running` durumunun orphan kaldığı restart/deploy senaryosuna yöneliktir.

## Güvenlik sınırı

- Dört profilli selector/specialist roster değişmez.
- Backend tool authorization default-deny kalır.
- Dış write/send/merge explicit approval gerektirir.
- Secret değerleri agent context'e veya schedule snapshot'a eklenmez.
- Yeni endpoint, shell/exec/spawn, client storage veya credential dosyası yoktur.
- `.github/workflows/` değiştirilmez.

## Geri alma

`lib/schedule-restart-recovery.mjs`, persistence `open()` recovery wiring'i, testler ve bu belge revert edilebilir. Schedule snapshot schemaVersion değişmediğinden veri migrasyonu gerektirmez.

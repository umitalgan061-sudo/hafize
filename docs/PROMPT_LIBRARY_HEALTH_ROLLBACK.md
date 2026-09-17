# Health Center Geri Alma

## Kapsam

Geri alma yalnızca health center UI katmanını hedefler.

Prompt Library kayıtları otomatik olarak silinmez.

Collection ve revision verileri health panelinin kaldırılmasıyla değiştirilmez.

## Sıra

1. Health PR revert edilir.
2. Service worker cache yeni sürüme geçer.
3. Tarayıcı health asset'lerini kullanmayı bırakır.
4. Ana Prompt Library normal akışı çalışmaya devam eder.

## Storage

`hafize.prompt-library.health.v1` anahtarının kalması işlevsel olarak kritik değildir.

İstenirse ayrıca temizlenebilir; bu kullanıcı prompt'larını etkilemez.

## Onarım sonrası rollback

Onarım öncesi export alınmışsa bu yedek kullanıcı tarafından import edilebilir.

Health center doğrudan geri dönüş snapshot'ı tutmaz.

## Risk

En büyük risk yalnızca UI'nin görünmemesidir; Prompt Library storage formatı değiştirilmediği için veri katmanı bağımsızdır.

## Kontrol

Rollback sonrasında Prompt Library oluşturma, düzenleme, kullanım, Smart Fill, collections ve revisions akışları tekrar kontrol edilmelidir.

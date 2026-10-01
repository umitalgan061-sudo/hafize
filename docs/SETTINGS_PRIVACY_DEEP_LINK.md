# Settings Entegrasyonu

Privacy Center Settings Workspace içine mount edilir.

Settings workspace görünür olmadan privacy paneli oluşturulmaz.

Panel kendi kimliğini `privacyDataCenter` altında izole eder.

Workspace navigation değiştiğinde panel state'i framework tarafından silinmez.

Destroy yalnız privacy panelini ve kendi listener'larını kaldırır.

Bu entegrasyon diğer workspace'lerin storage scope'unu genişletmez.

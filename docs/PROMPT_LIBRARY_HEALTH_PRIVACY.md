# Health Center Gizlilik

Health center tüm verisini yalnızca kullanıcının cihazındaki local storage alanlarından okur.

Prompt içerikleri health state içine taşınmaz.

Tanı sonucunda uzak analytics, telemetry veya observability servisi çağrılmaz.

Sağlık raporu üretimi istemci içinde gerçekleşir.

Rapor kopyalama clipboard API ile kullanıcı etkileşimi sonrası yapılır.

Problemli prompt export kullanıcı tarafından ayrıca tetiklenir ve yerel dosya oluşturur.

Onarım için tarayıcı confirmation istenir.

Üçüncü taraf connector scope'ları sağlık modülüne aktarılmaz.

Health paneli konuşma geçmişi, mesaj workspace veya scheduled task verisini okumaz.

PWA cache yalnızca statik asset'leri barındırır; prompt storage tarayıcı cache'ine kopyalanmaz.

Gizlilik açısından modül, kullanıcıya yerel verisinin kalitesini incelemek için bir yardımcı görünürlük sağlar; yeni bir sunucu veri akışı oluşturmaz.

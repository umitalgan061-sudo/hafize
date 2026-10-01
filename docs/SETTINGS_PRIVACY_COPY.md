# Rapor ve Kopyalama Formatı

JSON raporu makine tarafından okunabilir privacy envanteridir. Human-readable summary ise support veya kişisel not alma için kısa bir metindir.

JSON alanları:

- format
- version
- generatedAt
- localOnly
- contentIncluded
- surfaces
- totals

Summary; yüzey adı, key sayısı, byte ve toplam sayaçları kullanır.

Her iki format da raw storage value taşımaz.

Clipboard kullanımı açık kullanıcı eylemiyle başlar. Otomatik kopyalama yapılmaz.

Rapor veya summary backend'e POST edilmez.

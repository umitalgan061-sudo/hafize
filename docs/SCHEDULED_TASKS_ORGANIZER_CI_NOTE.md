# Local Validation Note

Bu turdaki test dosyaları repository içindeki kaynak sözleşme kontrolleridir.

Yerel çalışma ortamında GitHub raw host DNS çözümlemesi başarısız olduğu için branch'in tam checkout'u üzerinde `node` test komutları çalıştırılamadı.

Test dosyaları dosya sistemi üstünden `fs.readFileSync` ile kaynakları okuyacak şekilde tasarlanmıştır.

PR açıldığında GitHub Actions mevcutsa testler orada çalıştırılmalıdır.

Repository'de zorunlu status check bulunmadığı için merge kararı yalnızca ölçülmüş diff ve PR mergeability durumuna dayandırılmamalı; kullanıcı kodu ayrıca review edilmelidir.

Bu özellik server schedule endpoint'lerini değiştirmediğinden backend contract regression riski sınırlı kapsamda tutulmuştur.

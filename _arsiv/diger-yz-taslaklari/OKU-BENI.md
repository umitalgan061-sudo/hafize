# Arşivlenmiş taslaklar

Bu dosyalar 2026-10-23'te başka bir yapay zeka tarafından `lib/` altına eklendi. Hiçbiri uygulamaya
bağlı değildi (hiçbir yerden import edilmiyordu) ve içleri gerçek işlev yerine taslaktı; örneğin:

- `research-fetcher.ts` gerçek arama yapmıyor, `https://google.search?q=...` gibi uydurma bağlantılar üretiyordu.
- `vision-encoder.ts` görseli analiz etmiyor, sıfırlardan oluşan sahte bir vektör döndürüyordu.
- `orchestrator-dag-runner.ts` adımları çalıştırmadan "başarılı" olarak işaretliyordu.
- `verification-engine.ts` içeriğe bakmadan kaynak sayısına göre "doğrulandı" diyordu.

Ayrıca toplam 156 TypeScript hatası içeriyorlardı. Bağlanırlarsa Hafize'nin sahte veri üretmesine yol
açacakları için silinmedi, buraya taşındı. Gerçek bir özellik geliştirirken fikir/iskelet olarak
kullanılabilirler; doğrudan geri taşımayın.

# Veri Saklama Sözleşmesi

Assistant alternates yalnız mevcut conversation object içinde tutulur.

Mesaj başına maksimum üç alternate vardır.

Her alternate maksimum 12000 karakterdir.

Feedback yalnız positive veya negative olabilir.

Generation metadata model, agentId, toolsEnabled, generatedAt ve durationMs alanlarıyla sınırlıdır.

Yeni alanlar conversation JSON dışında ayrı bir tracking database'e yazılmaz.

Sohbet silme mevcut conversation cleanup davranışını kullanır.

Tarayıcı storage erişilemezse mevcut persistence warning davranışı korunur.

Kullanıcı açıkça export istemediği sürece alternate içerikleri ayrı bir dosyaya yazılmaz.

Server-side retention policy bu feature tarafından değiştirilmez.

# Skill selection

Skill trigger seçimi yalnız agent'ın `describePublic()` sonucundan yapılır. Bu, registry'de bulunan ancak mevcut agent tool policy'si nedeniyle görünmeyen skill'lerin kullanıcı ifadesiyle tesadüfen seçilmesini engeller.

Skor deterministic'tir: exact trigger önce gelir (100 puan); aksi durumda skor, sorgu terimlerinin skill adı/açıklaması/trigger'ları tarafından karşılanan oranıdır ve eşitlikte skill adı sıralayıcı olur. Normalizasyon noktalamayı ayırıcı sayar, bu yüzden `hangi servisler hazır?` ile `hangi servisler hazır` aynı eşleşmeyi verir. Skor trigger sayısına bölünmez; trigger eklemek skill'in kendi skorunu düşürmez. Seçim yetki vermez; gerçek invocation hâlâ strict manifest + `authorizeAgentTool` kesişiminden geçer.

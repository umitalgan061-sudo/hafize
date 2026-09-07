# Skill selection

Skill trigger seçimi yalnız agent'ın `describePublic()` sonucundan yapılır. Bu, registry'de bulunan ancak mevcut agent tool policy'si nedeniyle görünmeyen skill'lerin kullanıcı ifadesiyle tesadüfen seçilmesini engeller.

Skor deterministic'tir: exact trigger önce gelir; aksi durumda normalized text term hit'leri kullanılır ve eşitlikte skill adı sıralayıcı olur. Seçim yetki vermez; gerçek invocation hâlâ strict manifest + `authorizeAgentTool` kesişiminden geçer.

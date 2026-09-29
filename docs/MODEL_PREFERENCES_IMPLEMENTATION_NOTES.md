# Model ve Ajan Tercihleri Implementation Notes

State helper ile UI helper ayrıdır.
App shell mevcut model ve agent listelerini kullanır.
Profil state'i conversation history'ye gömülmez.
Model seçimleri geçerli /api/models seçenekleriyle eşleşir.
Agent seçimleri geçerli /api/agents seçenekleriyle eşleşir.
Tool mode mevcut conversation state'iyle birlikte uygulanır.
Import önce preview helper'dan geçer.
UI render sırasında dinamik metinler DOM text API'leriyle oluşturulur.
Storage exception'ları kullanıcı sohbetini durdurmaz.
Cross-tab listener yalnız ilgili storage key'i dinler.
PWA değişikliği yeni CSS asset'ini cache'e ekler.

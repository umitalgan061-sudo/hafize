# Yerel Veri Merkezi — Envanter

| Alan | Key | İçerik türü | Clear grubu |
|---|---|---|---|
| Sohbetler | `hafize.conversations.v1` | JSON array | conversation |
| Taslaklar | `hafize.chat-drafts.v1` | JSON object | draft |
| İstemler | `hafize.prompt-library.v1` | JSON array | prompt |
| İstem filtreleri | `hafize.prompt-library.v1.state` | JSON object | prompt |
| Composer geçmişi | `hafize.composer-history.v1` | JSON array | history |
| Composer ayarları | `hafize.composer-history.settings.v1` | JSON object | history |
| Tema | `hafize.theme.v1` | primitive/object | preference |
| Hareket | `hafize.reduced-motion.v1` | primitive/object | preference |

## Kapsam kuralları

Tablodaki key'ler immutable registry ile eşleşir. Registry dışındaki key'ler otomatik clear hedefi değildir.

## Sahiplik

Veri biçiminin sahibi ilgili feature modülüdür. Data center schema migration yapmaz.

## Sensitivity

Sohbet, draft, prompt ve history içerik taşıyabilir. Tema ve motion tercihi yalnız ayar metadata'sıdır.

## Export

Data center manifesti yalnız tablo alanları ve metadata sayımlarını içerir. İçerik backup'ı ilgili feature tarafından sağlanır.

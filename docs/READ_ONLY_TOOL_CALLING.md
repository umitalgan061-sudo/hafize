# Hafize read-only NVIDIA tool-calling prototipi

Bu tur, Hafize'nin NVIDIA NIM tool-calling desteğini güvenlik sınırlarını gevşetmeden ilk kez gerçek runtime'a bağlar.

## Kapsam

Yeni `POST /api/tool-chat` endpoint'i yalnızca backend tarafından kayıtlı ve seçilen ajanın izin verdiği read-only araçları NVIDIA'ya `tools` alanında sunar. İlk araç `runtime_list_agents` adını taşır ve yalnızca Hafize runtime'ındaki ajanların public metadata listesini döndürür.

Model tarafındaki fonksiyon adı ile backend izin kimliği ayrıdır:

- model function name: `runtime_list_agents`
- permission id: `runtime.list_agents`

Bu ayrım, model-facing fonksiyon adını taşınabilir/şema-uyumlu tutarken backend tool policy adlandırmasını korur.

## Güvenlik akışı

1. İstemciden yalnızca `user` / `assistant` mesajları kabul edilir.
2. Seçilen ajan registry'den server-side çözülür.
3. Tool tanımı NVIDIA'ya gönderilmeden önce `authorizeAgentTool()` ile kontrol edilir.
4. NVIDIA bir tool call döndürürse isim tekrar permission id'ye çevrilir ve ikinci kez yetki kontrolü yapılır.
5. Argümanlar JSON nesnesi olarak doğrulanır.
6. Araç yalnızca local, read-only executor içinde çalıştırılır.
7. Tool sonucu `role: tool` mesajı olarak NVIDIA'ya geri verilir.
8. İkinci model yanıtı kullanıcıya döndürülür.

Modelin talep ettiği bilinmeyen, izin verilmeyen veya approval gerektiren araç yürütülmez.

## Bilinçli sınırlar

- Endpoint bu aşamada non-streaming'dir; mevcut `/api/chat` streaming davranışı değiştirilmez.
- En fazla 3 tool call kabul edilir.
- İkinci model turunda yeni tools listesi verilmez; böylece bu prototip tek araç turuyla sınırlıdır.
- GitHub/Gmail/Canva yazma, gönderme, silme veya merge aracı yoktur.
- API key, OAuth token veya secret hiçbir tool sonucuna eklenmez.
- Frontend henüz `/api/tool-chat` kullanmaz. Önce backend sözleşmesi ve permission enforcement sabitlenir.

## NVIDIA uyumluluğu

NVIDIA NIM LLM API, OpenAI-uyumlu `/v1/chat/completions` endpoint'inde `tools` ve `tool_choice` ile tool calling destekler. Bazı modeller/tool parser yapılandırmaları tool calling desteklemeyebilir; bu durumda upstream NVIDIA hatası güvenli biçimde istemciye normalize edilir.

## Sonraki adım

Bu prototip doğrulandıktan sonra aynı izin katmanı korunarak streaming tool-call orkestrasyonu ve ardından read-only GitHub araçları eklenebilir. Yazma/gönderme/merge araçları ayrıca açık kullanıcı onay kapısından geçmeden çalıştırılmamalıdır.

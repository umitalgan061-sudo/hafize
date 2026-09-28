# Üretim Metadata Sözleşmesi

Her başarılı normal assistant response model, agentId, toolsEnabled, generatedAt ve durationMs ile zenginleştirilebilir.

Model adı 160 karaktere kadar normalize edilir.

Agent ID 120 karaktere kadar normalize edilir.

Duration negatif veya geçersizse null olur.

Duration 600000 ms ile sınırlandırılır.

Timestamp kısa ISO string olarak saklanır.

Metadata request tekrarında prompt content olarak kullanılmaz.

Metadata UI bağlamıdır; secret değildir.

Restore işlemi mevcut bağlamı korur ve yeni timestamp üretir.

Malform metadata message normalize işlemini kırmaz.

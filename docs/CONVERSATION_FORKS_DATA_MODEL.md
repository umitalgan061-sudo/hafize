# Konuşma Dalları Veri Modeli

Fork kaydı mevcut conversation sözleşmesini genişleten opsiyonel alanlar kullanır.

- forkOf: parent conversation ID, en fazla 120 karakter.
- forkMessageId: fork noktası message ID, en fazla 120 karakter.
- forkDepth: 1–4 arası bounded seviye.
- forkNote: kullanıcı tarafından girilen amaç/not, en fazla 400 karakter.
- title: kullanıcı tarafından özelleştirilebilir, en fazla 80 karakter.

Messages kopyalanırken role, content ve at alanları korunur. Tool activity, feedback, alternates ve generation metadata bounded biçimde taşınır.

Parent conversation'ın messages dizisi fork sırasında değiştirilmez. Child yeni UUID ile oluşturulur.

Unknown veya malformed fork metadata app-shell normalize katmanında güvenli biçimde sınırlandırılır.

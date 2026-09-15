# Prompt Workspace — Workflow Semantiği

Workflow, birden fazla yerel istemin sıralı bir composer hazırlama akışıdır.

## Adım modeli

Her adım `promptId`, `mode` ve isteğe bağlı kısa `note` taşır. `mode=replace` o adımın metnini ana çıktı olarak kullanır. `mode=append` önceki çıktıya iki satır boşluk bırakarak ekler.

## Değişkenler

Workflow derlenirken ortak değişken sözlüğü kullanılır. Prompt Library'nin mevcut `{{değişken}}` değiştirme mekanizması çağrılır. Değişken değerleri yalnızca yerel işlem sırasında kullanılır; workflow storage içine çözülmüş metin yazılmaz.

## Composer davranışı

Workflow çalıştırmak `#messageInput` alanına metin hazırlayabilir. Form submit edilmez, send button tetiklenmez, network isteği yapılmaz.

## Sıralama

Workflow adımlarının sırası kullanıcı seçimiyle belirlenir. Aynı prompt bir workflow içinde teknik olarak birden fazla kez bulunabilir, fakat toplam adım sayısı 8'i geçmez.

## Hata koşulları

Workflow bulunamazsa sonuç `null` olur. Bir adımda prompt kimliği artık bulunmuyorsa workflow composer'a hazırlanmaz. Bu yaklaşım kısmi ve yanlış çıktı yerine güvenli başarısızlığı tercih eder.

## Düzenleme

İsim boş bırakılamaz ve aynı addaki workflow isimleri case-insensitive benzersizdir. Adım listesi güncellendiğinde her adım tekrar doğrulanır.

## Kullanıcı onayı

Silme işleminde onay istenir. Workflow çalıştırma veri yazma işlemi olmadığı için ayrıca onay gerektirmez; ancak dış servis veya otomatik gönderim davranışı bulunmaz.

## Performans

Workflow derleme en fazla 8 prompt okur ve çıktı 12.000 karakter ile sınırlandırılır. Bu nedenle UI açılışında ağır arama veya server çağrısı gerektirmez.

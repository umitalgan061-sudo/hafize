# Prompt Workspace

Prompt Workspace, Prompt Library içindeki yerel istemleri daha büyük ve tekrarlanabilir çalışma akışlarına dönüştüren cihaz-içi bir çalışma alanıdır.

## Kapsam

Workspace profilleri arama, sıralama, favori filtresi ve seçili istem kimlikleri gibi çalışma tercihlerini saklar. Koleksiyonlar istemleri konu veya kullanım amacı altında gruplar. Revizyonlar istem gövdesinin önceki sürümlerini korur. Prompt Pack bunları isteğe bağlı bileşenlerle dışa aktarıp içe aktarır. Workflow ise birden çok istemi belirli sırada composer'a hazırlayan yerel reçetedir.

## Temel ilkeler

1. Tüm çalışma alanı verisi browser storage'ta kalır.
2. Hiçbir özellik otomatik mesaj göndermez.
3. Dışa aktarma açık kullanıcı eylemi gerektirir.
4. İçe aktarma önce doğrulama ve sınır kontrolünden geçer.
5. ID çakışmaları mevcut verinin üzerine yazmaz.
6. Revizyon geri yükleme önce mevcut sürümü korumaya çalışır.
7. Servis worker API cevaplarını veya prompt içeriğini cache'lemez.

## Kullanım akışı

Kullanıcı önce istemleri seçer. Gerekirse koleksiyona atar veya workspace profili oluşturur. Workflow oluşturma, seçili istemleri sıralı adımlara dönüştürür. Composer'a hazırlama yalnızca metin alanını doldurur.

## Sınırlar

Workspace sayısı 16, workflow sayısı 24, workflow adımı 8, collection sayısı 24 ve toplu seçim 40 ile sınırlıdır. Prompt Pack 1,5 MB ile sınırlıdır.

## Erişilebilirlik

Kontroller gerçek button/select/input elementleridir. Yönetim yüzeyleri dialog semantiği kullanır. Durum mesajları polite live region ile duyurulur. Renk tek başına anlam taşımaz.

## Geri alma

Prompt Workspace katmanı geri alınsa dahi mevcut `hafize.prompt-library.v1` kayıtları korunur. Workspace, collection ve revision anahtarları bağımsız olduğundan veri kaybı olmadan UI katmanı devreden çıkarılabilir.

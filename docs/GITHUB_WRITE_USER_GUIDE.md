# GitHub Güvenli Yazma Kullanım Rehberi

## Önce
GitHub çalışma alanında repository ve branch bilgilerini kontrol et. Yazma allowlist'inde olmayan repository başarılı yazma yapamaz.

## Branch oluştur
Branch oluştur seçeneğinde repository, kaynak ref ve yeni branch adını gir. Önizleme doğruysa onay kutusunu işaretle ve Onayla ve yürüt düğmesine bas.

## Dosya commit et
Yalnız feature branch üzerinde çalış. Dosya yolu, commit mesajı ve içeriği gir. Mevcut dosyayı güncelliyorsan GitHub'dan okunmuş güncel SHA'yı ver.

Varsayılan branch doğrudan hedeflenemez. Secret veya workflow dosyaları için hata görülmesi güvenlik policy'sidir.

## Pull request
Head branch, base ref, başlık ve açıklamayı gir. Taslak PR seçeneği açıkken de kullanıcı onayı gerekir.

## İşlem geçmişi
Panelin altındaki Son başarılı işlemler alanı yalnız güvenli metadata gösterir. Commit gövdesi ve tokenlar history'ye alınmaz.

## Hatalar
Onay süresi dolarsa işlem yeniden önizleme ve onay gerektirir. Plan değişti hatası, onaydan sonra herhangi bir alanın değiştiğini belirtir. Upstream GitHub hatasında önce read workspace üzerinden durumu kontrol etmek gerekir.

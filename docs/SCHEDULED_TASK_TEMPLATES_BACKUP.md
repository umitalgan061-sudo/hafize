# Görev Şablonu Yedekleme

Görev şablonları açık kullanıcı tıklamasıyla JSON dosyasına aktarılabilir veya geri yüklenebilir.

Dışa aktarılan dosya version, source, exportedAt ve en fazla 12 normalize edilmiş template içerir. İçe aktarmada dosya boyutu 200 KB ile sınırlandırılır; aynı ada sahip kayıtlar tekrar eklenmez ve kapasite 12 ile korunur.

İçe aktarma doğrudan schedule API'ye dokunmaz. Geri yüklenen şablonlar yalnız forma uygulanabilir; gerçek görev oluşturma Preview onayı gerektirir.

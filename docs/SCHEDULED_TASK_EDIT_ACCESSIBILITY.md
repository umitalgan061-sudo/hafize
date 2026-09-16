# Schedule Edit Accessibility

Düzenleme paneli mevcut görev dialogu içinde çalışır ve yeni bir modal katman oluşturmaz.

Form alanlarının erişilebilir etiketleri korunur: ajan, görev metni, çalıştırma zamanı ve maksimum deneme.

`Düzenlemeyi iptal et` işlemi yalnızca local UI state'i değiştirir.

Escape davranışı görev panelini kapatma sözleşmesini korur. Kaydetme düğmesi ağ isteği sürerken disabled olur.

Mobil görünümde form alanları tek kolona düşer. Aksiyon düğmeleri dokunmatik hedef için esnek genişliğe sahiptir.

Focus, görev panelinin mevcut dialog yaşam döngüsüyle uyumludur. Başarılı düzenleme formu yeniden oluşturulduğunda yeni görev alanlarına dönüşür.

Hata mesajları status bölgesinde `aria-live="polite"` ile duyurulur.

Forced-colors ve reduced-motion kuralları mevcut görev paneliyle birlikte uygulanır.

Klavye kullanıcıları için `Düzenle`, `Değişiklikleri kaydet` ve `Düzenlemeyi iptal et` native button davranışını kullanır.

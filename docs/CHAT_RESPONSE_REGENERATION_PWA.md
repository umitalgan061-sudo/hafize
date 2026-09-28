# PWA Sözleşmesi

Response content service worker shell cache içine alınmaz.

Conversation localStorage uygulamanın mevcut client storage modelidir.

Yeni response helper typed Vite build zincirine dahildir.

HTML typed app-shell entrypoint'i yükler.

Legacy response logic eski bridge içine eklenmez.

Offline durumda yeni generation başlamaz.

Sayfa shell yüklenemese response data otomatik remote cache'den verilmez.

PWA update sonrası yeni typed artifact alınması yeterlidir.

Service worker API data caching politikasını değiştirmez.

Regression test yalnız static asset ve source boundaries kontrol eder.

# Denetim Olayları

Privacy Center kalıcı audit log oluşturmaz.

Kullanıcı eylemleri yalnız uygulama içi hafif event ile bildirilir:
- clear-surface
- clear-data-surfaces
- clear-preferences
- clear-all-known

Event detail yalnız action, yüzey id'si ve kaldırılan alan sayısını taşır.

Prompt, mesaj, Smart Fill değeri veya storage raw value event içine girmez.

Bu event'ler telemetry değildir. Remote sink eklenmesi ayrı kullanıcı onayı ve privacy review gerektirir.

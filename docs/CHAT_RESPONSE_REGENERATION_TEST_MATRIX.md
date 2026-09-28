# Yanıt Regeneration Test Matrisi

| Alan | Senaryo | Beklenen |
|---|---|---|
| Eligibility | Son assistant | aktif |
| Eligibility | Eski assistant | disabled |
| Network | offline | request yok |
| Model | model yok | request yok |
| Agent | agent yok | request yok |
| SSE | başarı | yeni içerik |
| SSE | hata | eski içerik |
| History | regeneration | alternatif eklenir |
| History | tekrar | max üç |
| History | duplicate | tek kopya |
| Restore | history var | en son alternatif |
| Restore | history yok | eylem yok |
| Tool | kapalı | chat endpoint |
| Tool | açık | agent endpoint |
| Feedback | positive | positive |
| Feedback | negative | negative |
| Feedback | off | alan kaldırılır |
| Copy | clipboard | aktif içerik |
| Privacy | telemetry | çağrı yok |
| Storage | legacy | uyumlu |
| Storage | malformed | safe normalize |
| Accessibility | keyboard | button çalışır |
| Accessibility | focus | outline |

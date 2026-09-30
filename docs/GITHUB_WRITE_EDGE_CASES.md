# GitHub Güvenli Yazma Edge Cases
1. Repository boşsa plan yürütülmez.
2. Repository biçimi sahip/depo olmalıdır.
3. Allowlist dışı repository server tarafından reddedilir.
4. Read allowlist yazma yetkisi vermez.
5. Write allowlist boşsa writer kapalıdır.
6. GitHub token yoksa writer yapılandırılmamıştır.
7. Kaynak ref boşsa branch planı reddedilir.
8. Tehlikeli Git ref karakterleri reddedilir.
9. Branch adı kontrol karakteri içeremez.
10. Branch adı iki nokta içeremez.
11. Branch adı üst dizin segmenti içeremez.
12. Branch name .lock ile bitemez.
13. Absolute file path reddedilir.
14. Backslash içeren path reddedilir.
15. Empty path segment reddedilir.
16. Dot segment reddedilir.
17. Dot-dot segment reddedilir.
18. .env dosyaları reddedilir.
19. Credential dosyaları reddedilir.
20. Secret dosyaları reddedilir.
21. Token dosyaları reddedilir.
22. Private key dosyaları reddedilir.
23. PEM dosyaları reddedilir.
24. PKCS12 benzeri dosyalar reddedilir.
25. .github/workflows yolları reddedilir.
26. İçerik boşsa file planı reddedilir.
27. İçerik 96 KiB sınırını aşamaz.
28. Commit mesajı bounded olmalıdır.
29. PR başlığı bounded olmalıdır.
30. PR body bounded olmalıdır.
31. Plaintext API key assignment reddedilir.
32. Authorization Bearer içeriği reddedilir.
33. Authorization Basic içeriği reddedilir.
34. Bilinen GitHub token desenleri reddedilir.
35. NVIDIA token desenleri reddedilir.
36. Google OAuth token desenleri reddedilir.
37. Private key block'u reddedilir.
38. Onay checkbox olmadan execute disabled kalır.
39. Server approved flag'i ayrıca kontrol eder.
40. Approval ticket random ve bounded uzunluktadır.
41. Approval ticket server memory'de tutulur.
42. Ticket browser storage'a yazılmaz.
43. Ticket GitHub'a gönderilmez.
44. Ticket expiry iki dakikadır.
45. Expired ticket purge edilir.
46. Approval Map 1000 kayıtla sınırlıdır.
47. Payload fingerprint approval'a bağlanır.
48. Repository değişirse fingerprint değişir.
49. Branch değişirse fingerprint değişir.
50. Content değişirse fingerprint değişir.
51. Ticket ilk tüketimde Map'ten silinir.
52. Replay ikinci write çağrısını engeller.
53. Wrong action mismatch üretir.
54. Wrong repository mismatch üretir.
55. Wrong payload mismatch üretir.
56. File update existing SHA taşıyabilir.
57. Missing existing SHA yeni file semantics kullanır.
58. Default branch server-side öğrenilir.
59. Default branch direct commit reddedilir.
60. Branch creation default branch'e commit değildir.
61. Branch creation source ref'i SHA'ya çözer.
62. Git refs POST yalnız consume sonrası yapılır.
63. Contents PUT yalnız consume sonrası yapılır.
64. Pulls POST yalnız consume sonrası yapılır.
65. Merge endpoint'i yoktur.
66. Force-push endpoint'i yoktur.
67. Branch delete endpoint'i yoktur.
68. Workflow modification endpoint'i yoktur.
69. Raw upstream error body client'a taşınmaz.
70. Response yalnız güvenli alanlara normalize edilir.
71. GitHub external URL pattern ile sınırlandırılır.
72. External links noopener noreferrer kullanır.
73. Dinamik sonuçlar textContent ile gösterilir.
74. HTML injection için innerHTML kullanılmaz.
75. Health write readiness yalnız boolean döndürür.
76. Health token veya allowlist içeriği açığa çıkarmaz.
77. Browser write fetch same-origin kullanır.
78. Browser write fetch no-store kullanır.
79. Production guard write route'larını korur.
80. POST route'larında CSRF kontrolü vardır.
81. Connector principal write route'una erişemez.
82. Write history sessionStorage'dadır.
83. History en fazla 12 kayıt tutar.
84. History content alanı taşımaz.
85. History ticket alanı taşımaz.
86. History token alanı taşımaz.
87. History filter action bazlıdır.
88. History copy yalnız görünür filtreyi kopyalar.
89. History clear GitHub varlıklarını değiştirmez.
90. Health failure UI'yı fail-open eder, server yine doğrular.
91. Write endpoint 404 olmayan route'u reddeder.
92. Invalid JSON standart HTTP hatasıyla döner.
93. Büyük request body rejected olur.
94. Upstream response JSON değilse normalized error döner.
95. Invalid SHA rejected olur.
96. Head ve base aynıysa PR reddedilir.
97. Draft PR yine açık kullanıcı onayı ister.
98. GitHub write başarısızsa ticket yeniden kullanılmaz.
99. Rollback read-only workspace'i korur.
100. Feature, repository governance ve GitHub audit kayıtlarının yerine geçmez.

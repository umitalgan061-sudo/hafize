# Smart Fill QA Matrisi

Bu belge değişkenli Prompt Library istemlerinin form tabanlı doldurma akışının doğrulama kapsamını tanımlar.

## A. Açılış

1. Değişkenli istem kartı `Alanları doldur` eylemini gösterir.
2. Değişkensiz istem kartı ek eylem göstermez.
3. Eylem prompt id'sini dataset üzerinden taşır.
4. Eksik prompt id'si ile işlem başlatılmaz.
5. Prompt storage okunamazsa kart render'ı bozulmaz.
6. Kütüphane kartı yoksa smart fill boot etmez.
7. Composer yoksa form sonucu gönderilmez.
8. Aynı dialog iki kez açılmaz.
9. Açılan dialog benzersiz bir id taşır.
10. Dialog native `dialog` elementidir.

## B. Değişkenler

11. Tek değişken tanınır.
12. Birden fazla değişken sıralı alan olarak gösterilir.
13. Aynı değişken yalnız bir kez gösterilir.
14. Büyük/küçük harf korunur.
15. Normalize edilmemiş karakter içeren değişken API'den gelmez.
16. 12 değişken üst sınırı korunur.
17. Değişken adı 32 karakteri aşmaz.
18. Değer 1000 karakteri aşamaz.
19. Boş değer kabul edilir fakat preview boş kalır.
20. Değer girildiğinde preview anında yenilenir.

## C. Preview

21. Preview prompt gövdesini temel alır.
22. Placeholder değeri verilen metinle değiştirilir.
23. Girilmeyen placeholder boş değerle değiştirilir.
24. HTML metni HTML olarak yorumlanmaz.
25. `<script>` metni çalıştırılmaz.
26. Event attribute metni çalıştırılmaz.
27. Çok uzun değer tekrar 1000 karaktere kesilir.
28. Bir placeholder birden fazla yerde varsa hepsi değiştirilir.
29. Placeholder olmayan metin aynen korunur.
30. Satır sonları korunur.

## D. Composer

31. `Mesaja aktar` composer value'sunu değiştirir.
32. Composer'a input event gönderilir.
33. Composer focus edilir.
34. Composer formu submit edilmez.
35. Smart fill send button'ı tıklamaz.
36. Enter key submit edilmez.
37. Tool mode tetiklenmez.
38. Attachment sistemi tetiklenmez.
39. Voice sistemi tetiklenmez.
40. Kullanıcı son gönderim kararını verir.

## E. Kullanım sayacı

41. Dialog açılması sayacı değiştirmez.
42. Preview değişmesi sayacı değiştirmez.
43. Preset seçmek sayacı değiştirmez.
44. Vazgeçmek sayacı değiştirmez.
45. Kapatmak sayacı değiştirmez.
46. Aktarım sonrası sayaç +1 olur.
47. Prompt bulunamazsa sayaç değişmez.
48. Storage write başarısızsa UI aktarmayı yine tamamlayabilir.
49. Negatif mevcut kullanım değeri normalizasyonla sıfırlanır.
50. 9999 üstü kullanım normalizasyonla sınırlandırılır.

## F. Hatırlama

51. Hatırlama checkbox'ı varsayılan olarak kapalıdır.
52. Daha önce hatırlanan değerler açık formda doldurulur.
53. Hatırlama anahtarı prompt storage'dan ayrıdır.
54. Export payload hatırlama değerlerini içermez.
55. 30 prompt üstü preference tutulmaz.
56. Bir promptta en fazla 12 değer tutulur.
57. Boş değer kalıcılaştırılmaz.
58. Storage JSON bozuksa boş preference kullanılır.
59. Storage read exception yakalanır.
60. Storage write exception yakalanır.

## G. Presetler

61. Preset anahtarı hatırlama anahtarından ayrıdır.
62. Bir prompt en fazla 8 preset tutar.
63. Preset adı 48 karakteri geçmez.
64. Preset değeri 1000 karakteri geçmez.
65. Preset değişkenleri güvenli isimlerden oluşur.
66. Aynı isimde preset güncellenir.
67. Farklı isimler ayrı tutulur.
68. Preset seçimi alan değerlerini günceller.
69. Preset seçimi preview'u günceller.
70. Preset silme onay ister.

## H. Lifecycle

71. Smart fill observer card dışında izleme yapmaz.
72. Dialog kapanınca ilgili observer bırakılır.
73. Page unload sırasında listener'lar temizlenir.
74. Aynı card'da ikinci fill butonu eklenmez.
75. MutationObserver yoksa temel açma API'si bozulmaz.
76. Storage event sonrası Prompt Library render'ı yenilenir.
77. Dialog dışarıdan kaldırılırsa uncaught error oluşmaz.
78. Composer dışarıdan kaldırılırsa kullanım artırılmaz.
79. Card yeniden render edilirse eylem yeniden eklenebilir.
80. Destroy sonrası yeni listener oluşmaz.

## I. DOM güvenliği

81. Dynamic title `textContent` kullanır.
82. Dynamic label `textContent` kullanır.
83. Preview `textContent` kullanır.
84. Dynamic preset adı `textContent` kullanır.
85. Input value DOM property'sidir.
86. `innerHTML` kullanılmaz.
87. `outerHTML` kullanılmaz.
88. `insertAdjacentHTML` kullanılmaz.
89. `eval` kullanılmaz.
90. `new Function` kullanılmaz.

## J. Ağ

91. Smart fill fetch yapmaz.
92. Smart fill XHR açmaz.
93. Smart fill Beacon kullanmaz.
94. Smart fill WebSocket açmaz.
95. Smart fill EventSource açmaz.
96. Analytics çağrısı yoktur.
97. Telemetry çağrısı yoktur.
98. Remote error reporter çağrısı yoktur.
99. Kullanım verisi backend'e post edilmez.
100. Hatırlanan değer backend'e post edilmez.

## K. Erişilebilirlik

101. Dialog labelled-by kullanır.
102. Değişken input erişilebilir ada sahiptir.
103. Kapatma butonu button tipindedir.
104. Vazgeç butonu button tipindedir.
105. Aktarım butonu button tipindedir.
106. Escape yolu vardır.
107. İlk alan focus alır.
108. Focus görünürdür.
109. Reduced-motion desteklenir.
110. Forced-colors desteklenir.

## L. Mobil

111. Dialog viewport'a sığar.
112. Field listesi scroll edilebilir.
113. Preview scroll edilebilir.
114. Action butonları dokunmaya uygun genişliktedir.
115. Sticky action alanı paneli kapatmaz.
116. Uzun prompt yatay taşma oluşturmaz.
117. Uzun değişken değeri layout'u bozmaz.
118. Preset satırı wrap olabilir.
119. Dialog backdrop görünürdür.
120. Küçük ekranda form kullanılabilir.

## M. Veri uyumluluğu

121. Eski prompt kayıtları variables alanı olmadan okunabilir.
122. Usage counter mevcut kayıtlarla uyumludur.
123. Smart fill prompt kayıtlarını migration zorlamadan okuyabilir.
124. Bozuk preference kayıtları ana kütüphaneyi bozmaz.
125. Bozuk preset kayıtları ana kütüphaneyi bozmaz.
126. İçe aktarılmış duplicate id kayıtları smart fill ile çalışabilir.
127. Prompt başlığı değişince id eşleşmesi korunur.
128. Aynı başlıklı promptlarda doğru id seçilir.
129. Silinen promptun presetleri ana promptu geri getirmez.
130. Storage namespace versioned'dır.

## N. Release gate

131. Kaynak syntax kontrolü geçmelidir.
132. DOM boundary testi geçmelidir.
133. Security testi geçmelidir.
134. Limits testi geçmelidir.
135. Lifecycle testi geçmelidir.
136. PWA asset testi geçmelidir.
137. Accessibility testi geçmelidir.
138. User journey testi geçmelidir.
139. Existing Prompt Library testleri gerilememelidir.
140. `npm run check` CI ortamında geçmelidir.

## O. Manuel smoke

141. Değişkenli starter açılır.
142. Form görünür.
143. Bir değer girilir.
144. Preview değişir.
145. Mesaja aktarılır.
146. Composer metni doğrudur.
147. Otomatik gönderim gerçekleşmez.
148. Prompt usage değeri artar.
149. Hatırlama işaretlenirse yeniden açmada değer görülür.
150. Hatırlama kapalıysa eski değer zorunlu değildir.
151. Preset kaydedilir.
152. Preset seçilir.
153. Preset preview'u değiştirir.
154. Preset silme çalışır.
155. Cancel hiçbir prompt verisini bozmaz.
156. Dialog tekrar açılabilir.
157. Aynı promptun duplicate başlığı doğru id ile çalışır.
158. Mobil görünüm kullanılabilir kalır.
159. Dark/light theme ile kontrast korunur.
160. Forced-colors modunda kontroller görünürdür.

## Sonuç

Bu matris 160 kontrol içerir. Release gate, güvenlik ve veri kaybı kontrollerini quota'nın üstünde değerlendirir.

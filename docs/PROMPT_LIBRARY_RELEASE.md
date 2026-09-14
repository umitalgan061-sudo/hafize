# Prompt Library Release Checklist

## Kod

- [ ] `prompt-library.js` syntax kontrolü geçiyor.
- [ ] `prompt-library-starters.js` syntax kontrolü geçiyor.
- [ ] `prompt-library-enhancements.js` syntax kontrolü geçiyor.
- [ ] `prompt-library-keyboard.js` syntax kontrolü geçiyor.

## UI

- [ ] Yeni istem oluşturma çalışıyor.
- [ ] Düzenleme çalışıyor.
- [ ] Favori çalışıyor.
- [ ] Arama ve etiket filtreleri çalışıyor.
- [ ] Kopyalama fallback davranışı kontrol edildi.
- [ ] Çoğaltma limit kontrolü çalışıyor.
- [ ] Toplu seçim sınırı 40.
- [ ] Toplu silme onay istiyor.

## Veri

- [ ] Storage key conversation history'den farklı.
- [ ] Bozuk JSON crash üretmiyor.
- [ ] Import duplicate id overwrite yapmıyor.
- [ ] Import 1 MB sınırını uyguluyor.
- [ ] Export 1 MB sınırını uyguluyor.
- [ ] Variables 12 adetten fazla taşınmıyor.
- [ ] Variable value 1000 karakterle sınırlı.

## Güvenlik

- [ ] Yeni backend endpoint yok.
- [ ] Yeni OAuth/credential surface yok.
- [ ] Prompt body HTML olarak render edilmiyor.
- [ ] Clipboard yalnız istemci tarafında.
- [ ] FileReader sonucu normalize ediliyor.

## PWA

- [ ] CSS shell listesinde.
- [ ] Core JS shell listesinde.
- [ ] Starter JS shell listesinde.
- [ ] Enhancement JS shell listesinde.
- [ ] Keyboard JS shell listesinde.
- [ ] Cache version artırıldı.

## Geri alma

Index referanslarını ve shell asset girdilerini geri almak yeterlidir. Prompt localStorage alanı geriye dönük olarak korunabilir.

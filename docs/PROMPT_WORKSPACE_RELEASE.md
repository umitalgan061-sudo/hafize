# Prompt Workspace — Release Checklist

## Kod

- [ ] Workspace storage modeli normalize ediliyor.
- [ ] Collection ID ve isim sınırları uygulanıyor.
- [ ] Revision başına en fazla 8 kayıt tutuluyor.
- [ ] Workflow 8 adımdan fazla kabul etmiyor.
- [ ] Prompt Pack 1,5 MB sınırı uyguluyor.
- [ ] Batch editor 40 seçim sınırında kalıyor.
- [ ] Smart Insert composer'a yazarak duruyor; submit etmiyor.
- [ ] Import review önce parse ve schema kontrolü yapıyor.
- [ ] Audit hassas prompt içeriğini loglamıyor.

## UI

- [ ] Dialog başlıkları erişilebilir.
- [ ] Status region'lar mevcut.
- [ ] Focus görünür.
- [ ] Mobil toolbar taşmıyor.
- [ ] Forced-colors görünümü kullanılabilir.
- [ ] Reduced-motion kullanıcıları için animasyon bağımlılığı yok.

## PWA

- [ ] Prompt Workspace CSS/JS asset'i shell cache'e ekleniyor veya bootstrap fallback'i çalışıyor.
- [ ] API istekleri cache dışında kalıyor.
- [ ] Prompt içeriği response cache'e taşınmıyor.
- [ ] Cache version bir önceki sürümden ayrılıyor.

## Güvenlik

- [ ] `fetch`, XHR ve WebSocket eklenmedi.
- [ ] Secret/token kalıcı storage'a yazılmıyor.
- [ ] User content HTML olarak interpolate edilmiyor.
- [ ] Import duplicate ID overwrite etmiyor.
- [ ] Delete işlemleri onay istiyor.

## Regression

- [ ] Mevcut Prompt Library create/edit/delete çalışıyor.
- [ ] Search ve sort korunuyor.
- [ ] Existing usage insights korunuyor.
- [ ] Smart Fill ile birlikte mount sırası kontrol ediliyor.
- [ ] Scheduled Tasks bağımsız kalıyor.

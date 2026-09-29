# Koleksiyon Tasarım Kararları

## Ayrı map

Prompt objesine `collectionId` eklemek yerine ayrı map seçildi. Böylece eski prompt normalize ve import kodu değiştirilmedi.

## Tek koleksiyon

Bir prompt tek koleksiyona atanır. Çoklu etiket zaten mevcut olduğu için koleksiyonları klasör semantiğinde tutmak daha anlaşılırdır.

## 24 koleksiyon

Sınırlı liste, hem UX hem storage büyüklüğü için yeterlidir.

## İsim benzersizliği

İsimler Türkçe locale-aware lower-case karşılaştırmasıyla tekilleştirilir.

## Silme

Koleksiyon silindiğinde promptlar korunur. Bu, veri kaybı riskini azaltır.

## Default

Varsayılan atama mevcut kayıtları taşımamalıdır. Yeni kayıt sınırıyla uygulanır.

## Export

Koleksiyon yedeği mapping ve collection metadata'yı kapsar; prompt içeriği ana Prompt Library export'undan ayrı tutulur.

## Import

Import destructive değildir. Mevcut isimli koleksiyonlar korunur, yalnızca eksik ilişkiler eklenir.

## Filtre

Filtre prompt listesinde görünürlük uygular; çekirdek library state'ini overwrite etmez.

## Network

Özellik tamamen local olduğundan yeni backend API'si yaratılmadı.

## Testability

Storage, normalizer, map, summary, export ve filter fonksiyonları modül API'sinden erişilebilir tutuldu.

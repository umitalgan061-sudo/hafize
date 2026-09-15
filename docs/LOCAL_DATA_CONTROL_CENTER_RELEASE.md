# Yerel Veri Merkezi — Release Checklist

## Ürün

- [ ] Settings içinde tekil mount var.
- [ ] Yönetilen alanlar doğru label ve açıklamayla görünür.
- [ ] Boş store normal durumdur.
- [ ] Byte özeti güvenli şekilde gösterilir.

## Destructive actions

- [ ] Tekli silme confirmation ister.
- [ ] Toplu silme confirmation ister.
- [ ] Unknown keys clear edilmez.
- [ ] Cancel mutation üretmez.

## Export

- [ ] Manifest explicit action ile üretilir.
- [ ] Manifest content backup değildir.
- [ ] Object URL revoke edilir.

## Security

- [ ] Network call yoktur.
- [ ] Cookie/account erişimi yoktur.
- [ ] Dynamic content text olarak render edilir.
- [ ] Raw storage value UI'ya sınırsız aktarılmaz.

## PWA

- [ ] CSS shell cache'de.
- [ ] JS shell cache'de.
- [ ] Cache version artırılmıştır.
- [ ] API policy unchanged.

## Release evidence

PR diff ölçülür, test sonuçları gerçek durumuyla yazılır ve rollback yöntemi PR gövdesinde belirtilir.

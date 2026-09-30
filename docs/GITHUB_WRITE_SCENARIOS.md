# GitHub Güvenli Yazma Senaryoları

## Yeni feature
1. Read workspace ile repository ve source branch kontrol edilir.
2. Safe write panelinden branch planı hazırlanır.
3. Kullanıcı planı onaylar.
4. Server ticket üretir.
5. Branch oluşturulur.
6. Read workspace ile yeni branch doğrulanır.
7. File commit veya PR ayrı bir açık onayla yürütülür.

## Var olan dosya
Kullanıcı dosyanın güncel SHA bilgisini sağlar. Write request bu SHA'yı GitHub Contents API'ye gönderir. Branch ucu veya dosya değişmişse GitHub optimistic concurrency hatası işlemi durdurur.

## Yeni dosya
existingSha boş bırakılır. GitHub yeni dosya oluşturur; aynı path zaten varsa upstream hata verir ve uygulama bunu GITHUB_WRITE_FAILED olarak normalize eder.

## PR
Head branch ve base ref açıkça yazılır. Head=base reddedilir. PR oluşturmak merge etmek anlamına gelmez.

## Hatalı plan
Plan değiştirilirse approval fingerprint eşleşmez. Kullanıcı yeni plan oluşturup yeniden onaylar.

## Secret denemesi
Secret benzeri path veya credential içeriği daha GitHub'a ulaşmadan server policy tarafından reddedilir.

## Workflow
.github/workflows altına yazma kapalıdır. Self-development workflow dosyalarını bu feature ile değiştiremez.

## Recovery
Bir yazma başarısız olduğunda ticket tekrar kullanılmaz. Önce read workspace ile repository state kontrol edilir, sonra yeni plan üretilir.

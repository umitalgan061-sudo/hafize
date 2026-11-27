# Hafize Render yayını: CI kapılı, ölçülü, doğrulanmış

`render.yaml` içinde `autoDeployTrigger: off` bilerek kapalıdır: ana dala günde onlarca commit girer ve her biri ücretsiz derleme süresini harcardı. Bunun yerine `.github/workflows/hafize-render-release.yml`:

- günde iki kez (08:17 ve 20:17, İstanbul) ve **Actions → "Hafize Render — gated release" → Run workflow** ile elle çalışır;
- yalnız **ana dalın en yeni commit'ini** ele alır; o commit'in `Hafize quality` push çalışması **başarılı** değilse yüklemez (sürmekteyse 25 dk bekler);
- canlı `/release.json` commit'i ile karşılaştırır: zaten canlıysa ya da arada yalnız belge, iş akışı veya test değiştiyse **yüklemez** (`force` girdisiyle zorlanabilir, testler yine şarttır);
- yayından hemen önce main SHA değerini ve canlı sunucunun sağlık yanıtını tekrar doğrular; aktif ajan görevi, bekleyen dağıtım veya doğrulanamayan sağlık varsa yayını erteler (`force` da bunu aşmaz). Bu dış kontrol atomik görev kilidi değildir; kontrol ile dağıtım arasında çok kısa bir yarış penceresi kalır. Kalıcı görev günlüğü bu durumda kayıtları korur;
- Render deploy hook adresine `ref=<tam SHA>` ekleyerek tam olarak o commit'i yükletir;
- 30 dk içinde `/release.json` o commit'i ve `/api/health/live` yanıtı göstermezse başarısız olur.

Karar kuralları `scripts/render-release-plan.mjs` içinde, birim testleri `scripts/render-release-plan.test.mjs` içindedir.

## Tek seferlik kurulum

1. Render → **hafize-free** → **Settings** → **Deploy Hook** adresini kopyalayın. Bu adres bir **sırdır**; kimseyle paylaşmayın, sohbete yapıştırmayın.
2. GitHub → `umitalgan061-sudo/hafize` → **Settings → Secrets and variables → Actions → New repository secret**: ad `HAFIZE_RENDER_DEPLOY_HOOK`, değer kopyaladığınız adres.
3. İsteğe bağlı deneme: **Actions → Hafize Render — gated release → Run workflow**. Özet satırı canlı commit'i, ana dalı, kalite sonucunu ve kararı gösterir.

Sır tanımlı değilken akış hiçbir şey yapmaz. Yalnız `https://api.render.com/deploy/srv-dc1valbl550s73flt7rg?key=…` biçimi kabul edilir (başka servis, başka adres veya ek parametre reddedilir); adres hiçbir zaman günlüğe yazılmaz. Adresin ele geçtiğinden şüphelenirseniz Render'da **Regenerate Hook** yapıp sırrı güncelleyin.

Aynı adres Render ortamında `HAFIZE_RENDER_DEPLOY_HOOK` olarak da tanımlanırsa Hafize'nin uygulama içi yayın aracı da onu kullanabilir (`lib/github-agent-release.ts`); bu iş akışı için gerekli değildir.

## Retake sitesi (retake06-ua) de kendiliğinden güncel kalır

`.github/workflows/retake-hosting-live.yml` günde iki kez (08:47 ve 20:47) Retake ana dalının en yeni commit'ine bakar: CI'ı (`test`, `windows-startup`) yeşilse, canlı `retake-release.json` commit'inin devamıysa ve sitenin sunduğu bir dosya değiştiyse (yalnız `tools/`, test, belge, `.py`/`.ps1` değişikliği sayılmaz) o commit'i yayınlar ve canlı baytları doğrular. Ek sır gerekmez.

- `RETAKE_RELEASE_SHA` değiştiğinde (ya da **Run workflow → pinned**) eskisi gibi o commit yayınlanır.
- Dosyadaki ilgisiz bir değişiklik canlı siteyi daha eski sabit commit'e **geri döndürmez**. Bilerek geri almak için `RETAKE_AUTO_FOLLOW: "off"` yapıp SHA'yı sabitleyin ya da **Run workflow → pinned** kullanın.
- **Run workflow → follow** zamanlamayı beklemeden aynı takip kontrolünü yapar.

## Uygulama içi yayın ve görev kabulü

Hafize'nin kendi Render yayın isteği, yalnız yayınlayan HTTP ajan isteği kalmışsa yerel görev rezervasyonu alır. Ayna/harici uygulama içi yayın için hiçbir ajan isteği kalmamış olmalıdır. Redis kabul işlemi veya son kayıt yazımı devam eden istekler de sayılır. Yerel rezervasyon varken yeni ajan istekleri (kalıcı olmayanlar dahil) reddedilir; kapanan sunucu sağlık yanıtında dağıtım bekliyor olarak işaretlenir. Bu koruma aynı süreçteki uygulama içi yayınlar içindir. Render panelinden veya doğrudan API'den yapılan dağıtımları durduramaz; zamanlanmış dış yayın kontrolü de atomik değildir. Elle yayın için önce etkin görev olmadığını ve kesin main CI sonucunu kontrol edin, mümkünse kapılı GitHub iş akışını kullanın.

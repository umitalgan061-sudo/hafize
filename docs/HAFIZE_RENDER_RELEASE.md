# Hafize Render yayını: CI kapılı, ölçülü, doğrulanmış

`render.yaml` içinde `autoDeployTrigger: off` bilerek kapalıdır: ana dala günde onlarca commit girer ve her biri ücretsiz derleme süresini harcardı. Bunun yerine `.github/workflows/hafize-render-release.yml`:

- günde iki kez (08:17 ve 20:17, İstanbul) ve **Actions → "Hafize Render — gated release" → Run workflow** ile elle çalışır;
- yalnız **ana dalın en yeni commit'ini** ele alır; o commit'in `Hafize quality` push çalışması **başarılı** değilse yüklemez (sürmekteyse 25 dk bekler);
- canlı `/release.json` commit'i ile karşılaştırır: zaten canlıysa ya da arada yalnız belge, iş akışı veya test değiştiyse **yüklemez** (`force` girdisiyle zorlanabilir, testler yine şarttır);
- Render deploy hook adresine `ref=<tam SHA>` ekleyerek tam olarak o commit'i yükletir;
- 30 dk içinde `/release.json` o commit'i ve `/api/health/live` yanıtı göstermezse başarısız olur.

Karar kuralları `scripts/render-release-plan.mjs` içinde, birim testleri `scripts/render-release-plan.test.mjs` içindedir.

## Tek seferlik kurulum

1. Render → **hafize-free** → **Settings** → **Deploy Hook** adresini kopyalayın. Bu adres bir **sırdır**; kimseyle paylaşmayın, sohbete yapıştırmayın.
2. GitHub → `umitalgan061-sudo/hafize` → **Settings → Secrets and variables → Actions → New repository secret**: ad `HAFIZE_RENDER_DEPLOY_HOOK`, değer kopyaladığınız adres.
3. İsteğe bağlı deneme: **Actions → Hafize Render — gated release → Run workflow**. Özet satırı canlı commit'i, ana dalı, kalite sonucunu ve kararı gösterir.

Sır tanımlı değilken akış hiçbir şey yapmaz. Yalnız `https://api.render.com/deploy/srv-dc1valbl550s73flt7rg?key=…` biçimi kabul edilir (başka servis, başka adres veya ek parametre reddedilir); adres hiçbir zaman günlüğe yazılmaz. Adresin ele geçtiğinden şüphelenirseniz Render'da **Regenerate Hook** yapıp sırrı güncelleyin.

Aynı adres Render ortamında `HAFIZE_RENDER_DEPLOY_HOOK` olarak da tanımlanırsa Hafize'nin uygulama içi yayın aracı da onu kullanabilir (`lib/github-agent-release.ts`); bu iş akışı için gerekli değildir.

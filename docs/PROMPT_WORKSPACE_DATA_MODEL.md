# Prompt Workspace — Veri Modeli

## Storage anahtarları

`hafize.prompt-library.v1` temel istem listesidir.

`hafize.prompt-library.v1.state` arama, etiket, favori ve sıralama durumunu tutar.

`hafize.prompt-library.collections.v1` koleksiyon listesini ve istem-koleksiyon eşleşmelerini tutar.

`hafize.prompt-library.workspaces.v1` çalışma alanı profillerini ve aktif profili tutar.

`hafize.prompt-library.revisions.v1` istem revizyon geçmişini tutar.

`hafize.prompt-library.workflows.v1` workflow reçetelerini tutar.

## Workspace

```text
{
  version: 1,
  activeId: string,
  workspaces: [
    {
      id: string,
      name: string,
      tags: string[],
      selectedIds: string[],
      state: { query, tag, favoriteOnly, sort },
      createdAt: string,
      updatedAt: string
    }
  ]
}
```

Varsayılan `default` workspace silinemez.

## Collection

Koleksiyon nesnesi `id`, `name` ve `createdAt` alanlarıyla sınırlıdır. Atamalar ayrı sözlükte tutulur. Geçersiz koleksiyon kimlikleri normalize işleminde yok sayılır.

## Revision

Bir revizyon istem kimliği, artan sürüm numarası, başlık, gövde, etiketler, timestamp ve kaynak bilgisini taşır. Her istem için en fazla 8 revizyon korunur.

## Workflow

Workflow kimliği ve adı yanında 1–8 adım taşır. Her adım istem kimliği, `replace` veya `append` modu ve kısa not içerir. Var olmayan isteme ait adım kaydedilmez.

## Pack

Pack; temel istemler, state, collections, workspaces ve revisions bileşenlerini versiyonlu tek JSON nesnesinde birleştirir. Bileşenler bağımsız normalize edilir.

## Bounded davranış

Tüm koleksiyonlar ve import verileri önce sayısal/karakter uzunluğu sınırlarından geçirilir. Parse edilemeyen veri varsayılan boş yapı kabul edilir; mevcut geçerli kayıtların üzerine körlemesine yazılmaz.

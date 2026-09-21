# GitHub çalışma alanı scope sözleşmesi

## İzin verilen yüzey

Workspace yalnız repository read, branch read, commit read, pull request read, directory read, file read ve ref compare işlemlerini içerir.

## Yasak yüzey

Repository yazma, branch oluşturma, commit, PR oluşturma, PR merge, PR kapatma, dosya silme ve secret okuma bu modülün kapsamı değildir.

## Yetki kaynağı

Repository erişimi HAFIZE_GITHUB_READ_REPOS allowlist'inden gelir. UI tarafındaki kullanıcı girişi allowlist'in yerini tutmaz.

## Browser scope

Browser yalnız same-origin workspace endpoint'lerini çağırır. GitHub API doğrudan browser'dan çağrılmaz.

## Server scope

Server token'ı yalnız GitHub upstream çağrısında kullanır. Workspace response DTO'ları yalnız UI için gerekli alanları içerir.

## Agent scope

Mevcut agent registry write ve merge işlemlerini ayrı approval policy ile sınırlar. Workspace bu policy'leri gevşetmez.

## Scope genişletme

Yeni bir read scope eklenirse reader, route, auth, PWA ve test katmanları birlikte güncellenmelidir. Write scope ayrı bir tasarım ve onay gerektirir.

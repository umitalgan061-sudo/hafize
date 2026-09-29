# Koleksiyon Operating Model

Collection metadata kullanıcı tarafından yönetilir.

Prompt content Prompt Library core tarafından yönetilir.

Collection module sadece prompt ID'leri ile ilişki kurar.

Responsibility:
- Core: prompt lifecycle
- Collections: grouping/filtering
- Keyboard: shortcut focus

Create:
Collection add -> local storage.

Assign:
Prompt selector -> map.

Bulk:
Selection -> map.

Default:
New prompt detection -> map.

Delete:
Collection -> map entries removed.

Rename:
Collection metadata only.

Filter:
DOM visibility only.

Export:
Collection metadata + map.

Import:
Normalize + merge.

Cleanup:
Render reconciliation.

Failure isolation:
Collection error prompt core verisini bozmaz.

Security isolation:
No backend calls.

Lifecycle isolation:
Destroy panel observer and root listeners temizlenir.

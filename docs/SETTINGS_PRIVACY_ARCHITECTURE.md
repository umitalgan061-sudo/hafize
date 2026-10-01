# Mimari

Privacy Center bağımsız bir browser modülüdür. Settings Workspace hazır olduğunda kendi section'ını ekler.

Public API:

- SURFACES
- classifyKey
- inspectStorage
- storageEstimate
- clearSurface
- clearDataSurfaces
- clearPreferences
- clearAllKnown
- privacySummary
- privacyReport
- mount

Mount sırasında CSS asset'i mevcut değilse dinamik link ile güvenli şekilde eklenebilir. index.html aynı asset'i doğrudan yüklediği için normal production yolunda tek stylesheet kullanılır.

Modül Settings Workspace'in işleyişini değiştirmez. Yalnız kendi panelini yönetir.

Destroy ile listener'lar ve panel node'u kaldırılır.

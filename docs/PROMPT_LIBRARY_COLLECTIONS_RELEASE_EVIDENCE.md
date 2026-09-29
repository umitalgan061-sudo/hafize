# Koleksiyon Release Evidence

Base:
`998547ddc63e8b3a62ad74c3ed49614df62620d4`

Branch:
`hafize/auto-prompt-collections-0929`

Release evidence şunları içermelidir:

1. GitHub compare changed lines ölçümü.
2. PR head SHA.
3. Test dosyalarının listesi.
4. PWA asset kontrolü.
5. README feature kaydı.
6. Rollback yolu.

Manual smoke:
- collection create
- assignment
- filter
- bulk assignment
- default
- rename
- delete
- export/import

Security:
- HTML-looking name
- oversized import
- malformed JSON
- stale ID

Accessibility:
- label
- role
- keyboard
- mobile
- forced-colors

Release, 3000 changed lines hard limitini aşmamalıdır.

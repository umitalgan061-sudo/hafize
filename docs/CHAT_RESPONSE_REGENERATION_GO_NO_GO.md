# Release Go / No-Go

## GO
- TypeScript typecheck geçer.
- Vite build geçer.
- Pure helper tests geçer.
- Source security contract geçer.
- No-submit contract geçer.
- PWA asset policy değişmez.
- Diff 3000 sınırının altında kalır.

## NO-GO
- Previous response loss.
- Multiple simultaneous streams.
- API endpoint mismatch.
- Unbounded alternates.
- Secret leakage.
- Broken legacy conversation normalization.
- Typecheck failure.

## Sign-off
Release owner test output ve GitHub diff ölçümünü kaydeder.

## Rollback
Yalnız response feature commitleri revert edilir.

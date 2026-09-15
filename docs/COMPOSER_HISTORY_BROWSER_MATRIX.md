# Composer History — Tarayıcı Matrisi

## Chromium

localStorage supported.

Textarea selectionStart supported.

FileReader supported.

Blob/Object URL export supported.

Keyboard events expose modifier and composition state.

## Firefox

The same core APIs are expected.

Arrow key behavior must remain bounded to composer edge positions.

Export must use the same browser download path.

## Safari

Storage quota and private browsing behavior may differ.

The feature must fail soft when storage is unavailable.

Object URL cleanup remains mandatory.

## Mobile Safari

Hardware keyboard may be absent.

Panel remains touch accessible.

Rows wrap long prompts.

Settings controls remain full-width where needed.

## Android browsers

Soft keyboard and IME composition must not trigger history navigation unexpectedly.

Touch targets should retain existing global button sizing.

## PWA

All static history assets must be shell-cached.

History state must remain local after install/relaunch.

## Unsupported cases

When localStorage is unavailable, feature UI may be present but storage should be inert.

When FileReader is unavailable, backup import is unavailable without breaking chat.

When Object URL is unavailable, export can fail gracefully.

## Verification

Every browser target needs functional keyboard, storage and panel smoke coverage where automation exists.

No browser-specific code path may introduce remote sync.

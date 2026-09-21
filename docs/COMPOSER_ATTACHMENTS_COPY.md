# Composer Ekleri — Range Copy

## Amaç
Kullanıcı seçtiği satır aralığını composer'a eklemeden de panoya alabilsin.

## Input
Start ve end line clamp edilmiş değerlerdir.

## Output
Clipboard'a fenced wrapper olmadan ham text range yazılır.

## Failure
Clipboard API yoksa veya permission hatası oluşursa status mesajı gösterilir.

## Side effects
Composer değeri değişmez. Attachment queue değişmez. Submit oluşmaz.

## Privacy
Clipboard çağrısı kullanıcı tarafından tetiklenen button click eyleminde gerçekleşir.

## Mobile
Kopyala action'ı touch ile erişilebilir küçük bir button olarak kalır.
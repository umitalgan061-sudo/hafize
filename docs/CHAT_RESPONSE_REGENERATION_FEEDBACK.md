# Yerel Feedback Sözleşmesi

Feedback yalnız assistant message üzerinde tutulur.

Geçerli state positive veya negative'dir.

Aynı state tekrar seçilirse alan kaldırılır.

Positive seçildiğinde negative temizlenir.

Negative seçildiğinde positive temizlenir.

Feedback generation request body içine eklenmez.

Feedback server endpoint çağrısı yapmaz.

Feedback local conversation save ile persist edilir.

Eski mesajlarda feedback olmaması normaldir.

Malformed feedback normalize sırasında yok sayılır.

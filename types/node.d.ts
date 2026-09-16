// Sunucu tarafı ve kontrol paketleri için yardımcı tipler.
//
// Buradaki hiçbir şey çalışma zamanına eklenmez; yalnızca `lib/`, `server.mjs`
// ve `scripts/` içindeki JSDoc açıklamalarının kullanabileceği ortak adlar
// tanımlanır.

export {};

declare global {
  /**
   * Kontrol paketlerindeki test ikizleri için.
   *
   * Bir ikiz, test ettiği yüzeyin yalnızca kullanılan kadarını uygular ve
   * kalan alanlar testin içinde tek tek atanır. `TestDouble<T>` bilinen
   * yüzeyi tipli tutarken bu geçici alanlara izin verir; böylece ikizi
   * kurmak için sınıf gövdesine gerçek koda ait olmayan alanlar eklemek
   * gerekmez.
   *
   * Yalnızca `scripts/` içinde kullanılır. `lib/` veya `public/` içinde bir
   * yerde görünüyorsa, orada gerçekten eksik olan bir tip vardır.
   */
  type TestDouble<T> = T & Record<string, any>;

  /**
   * Doğrulanmamış girdi.
   *
   * Bir sınır fonksiyonu (HTTP gövdesi, model yanıtı, dosyadan okunan
   * zarf) keyfi bir nesne alır ve doğrulamayı kendi içinde yapar. Bu ad,
   * "burada alan erişimi bilerek gevşek" demenin okunur yoludur.
   */
  type UnvalidatedInput = Record<string, any>;
}

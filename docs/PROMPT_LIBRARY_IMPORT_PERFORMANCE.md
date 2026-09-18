# Import performance

## Analiz maliyeti
Import planı linear biçimde kayıtları tarar. Giriş dizisi bounded slice ile sınırlandırılır.

## DOM maliyeti
Önizlemede yalnızca sınırlı sayıda kayıt render edilir.

## Storage
Onay öncesi yazma yoktur. Onay sonrası tek ana prompt storage yazımı kullanılır.

## Büyük dosya
1 MB üstündeki dosyalar parse edilmeden reddedilir.

## Recovery
Recovery snapshot JSON serileştirmesi bounded çıktı boyutunda tutulur.

## Hedef
Normal kullanıcı yedeklerinde interaktif panelin bloklanmaması amaçlanır; daha büyük veri setlerinde limitleme tercih edilir.

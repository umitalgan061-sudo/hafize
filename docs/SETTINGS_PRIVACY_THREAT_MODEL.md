# Tehdit Modeli

## Varlıklar

Kullanıcının sohbetleri, prompt'ları, değişken setleri, tercihleri, görev şablonları ve backup meta bilgileri localStorage'dadır.

## Tehditler

1. Yanlış storage anahtarının silinmesi.
2. Gizlilik raporunda metin içeriğinin sızması.
3. Bilinmeyen bir credential alanının ifşa edilmesi.
4. Toplu silmenin tek tıklamayla çalışması.
5. Storage exception sonrası kısmi ve kontrolsüz işlem.
6. Dinamik DOM metninden HTML injection oluşması.
7. PWA cache'e hassas response yazılması.

## Önlemler

Allowlist, unknown-key preservation, ikinci onay, bounded scan, content-free report, textContent ve network yokluğu temel kontrollerdir.

Service Worker yalnız shell asset'lerini cache listesine alır; /api yolları network-only kalır.

## Kabul

Bu önlemlerden biri kaldırılırsa feature security review gerektirir.

# Collections + Revisions test matrix

## Collection CRUD

| ID | Senaryo | Beklenen |
| --- | --- | --- |
| C01 | geçerli ad | collection oluşturulur |
| C02 | boş ad | null döner |
| C03 | yalnız boşluk | null döner |
| C04 | 80+ karakter ad | normalize edilir |
| C05 | duplicate ad | ikinci kayıt reddedilir |
| C06 | case varyantı | duplicate kabul edilmez |
| C07 | description | 240 sınırında tutulur |
| C08 | unknown fields | korunmaz |
| C09 | update existing | kayıt güncellenir |
| C10 | update missing | null döner |
| C11 | delete existing | true döner |
| C12 | delete missing | false döner |

## Membership

| ID | Senaryo | Beklenen |
| --- | --- | --- |
| M01 | mevcut prompt | eklenir |
| M02 | olmayan prompt | eklenmez |
| M03 | duplicate id | tek kayıt |
| M04 | 121 üyelik | 120 ile sınırlanır |
| M05 | empty list | koleksiyon boş kalır |
| M06 | remove member | üye çıkar |
| M07 | same prompt / two collections | her ikisi çalışır |
| M08 | prompt delete | orphan cleanup |
| M09 | invalid membership type | reddedilir |
| M10 | oversized id | bounded |

## Search

| ID | Senaryo | Beklenen |
| --- | --- | --- |
| S01 | exact name | eşleşir |
| S02 | description term | eşleşir |
| S03 | Turkish case | eşleşir |
| S04 | empty query | tümü görünür |
| S05 | long query | 100 karaktere iner |
| S06 | unknown field | aramaya girmez |

## Import/export

| ID | Senaryo | Beklenen |
| --- | --- | --- |
| I01 | valid export | parse edilir |
| I02 | invalid JSON | exception UI'a taşınmaz |
| I03 | duplicate name | skipped |
| I04 | duplicate id | new id |
| I05 | unknown prompt ids | pruned |
| I06 | 500 KB+ file | rejected |
| I07 | body included | collection exportta bulunmaz |
| I08 | script payload | data olarak kalır |
| I09 | empty collection list | valid |
| I10 | malformed root | zero import |

## Collection UI

| ID | Senaryo | Beklenen |
| --- | --- | --- |
| U01 | mount | one panel |
| U02 | second mount | duplicate panel yok |
| U03 | search input | list refresh |
| U04 | filter button | selected collection active |
| U05 | delete | confirmation |
| U06 | hide | aria-expanded false |
| U07 | show | aria-expanded true |
| U08 | selection | assignment visible |
| U09 | assign | membership update |
| U10 | remove | membership update |
| U11 | select all | at most 40 |
| U12 | clear selection | all unchecked |
| U13 | duplicate collection | new id |
| U14 | keyboard shortcut | search focus |
| U15 | DOM payload | textContent only |

## Revision capture

| ID | Senaryo | Beklenen |
| --- | --- | --- |
| R01 | create | one revision |
| R02 | identical capture | no duplicate |
| R03 | body change | revision |
| R04 | title change | revision |
| R05 | tag change | revision |
| R06 | favorite change | revision |
| R07 | 21st revision | oldest bounded |
| R08 | 601st global | global bounded |
| R09 | malformed snapshot | skipped |
| R10 | body null | skipped |

## Restore

| ID | Senaryo | Beklenen |
| --- | --- | --- |
| RR01 | valid revision | current prompt restored |
| RR02 | missing prompt | null |
| RR03 | missing revision | null |
| RR04 | confirm cancelled | unchanged |
| RR05 | before restore | current state captured |
| RR06 | prompt id | preserved |
| RR07 | createdAt | preserved |
| RR08 | useCount | preserved |
| RR09 | updatedAt | refreshed |
| RR10 | restore reason | recorded |

## Revision UI

| ID | Senaryo | Beklenen |
| --- | --- | --- |
| RU01 | selector | prompt list |
| RU02 | refresh | current history |
| RU03 | restore | confirmation |
| RU04 | JSON export | local Blob |
| RU05 | hide/show | aria state |
| RU06 | current prompt | focus/scroll |
| RU07 | clear history | confirmation |
| RU08 | missing storage | safe empty |

## Lifecycle

| ID | Senaryo | Beklenen |
| --- | --- | --- |
| L01 | mount | listeners created |
| L02 | destroy | listeners removed |
| L03 | observer | disconnected |
| L04 | panel remove | no stale node |
| L05 | external storage | render refresh |
| L06 | beforeunload | cleanup |

## Security

| ID | Senaryo | Beklenen |
| --- | --- | --- |
| X01 | HTML payload | not executed |
| X02 | event handler payload | not interpreted |
| X03 | network primitive | absent |
| X04 | authorization token | absent |
| X05 | cookie write | absent |
| X06 | beacon | absent |
| X07 | eval | absent |
| X08 | Function ctor | absent |
| X09 | prompt body collection export | absent |
| X10 | prompt body revision export | scoped only |

## PWA

| ID | Senaryo | Beklenen |
| --- | --- | --- |
| P01 | collection JS | shell asset |
| P02 | collection enhancement | shell asset |
| P03 | collection CSS | shell asset |
| P04 | revision JS | shell asset |
| P05 | revision enhancement | shell asset |
| P06 | revision CSS | shell asset |
| P07 | cache version | v36 |
| P08 | API path | network-only |

## Regression

The matrix is additive. Passing these cases must not imply that the broader typed Vitest suite, production hardening suite, authentication suite, scheduled-task suite, or existing workspace tests can be skipped.

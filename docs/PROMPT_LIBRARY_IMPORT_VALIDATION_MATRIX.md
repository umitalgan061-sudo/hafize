# Import validation matrix

| Girdi | Beklenen |
| --- | --- |
| Array payload | Kabul |
| version/items wrapper | Kabul |
| non-object item | Invalid |
| empty body | Invalid |
| duplicate existing id | Rekey |
| duplicate incoming id | Rekey |
| >120 total | Capacity skip |
| >1 MB file | Reject |
| malformed JSON | Reject |
| user cancel | No write |
| confirmed import | Fresh merge |

Her satır source contract ve uygun kullanıcı akışı ile doğrulanmalıdır.

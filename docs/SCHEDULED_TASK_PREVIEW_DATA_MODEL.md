# Preview Veri Sözleşmesi

Preview formdan şu alanları okur:

- agentId
- agentLabel
- task
- localWhen
- attempts

Preview bu veriden yalnız güvenli bir istemci özeti üretir.

Onay öncesi gösterilen payload şekli mevcut POST sözleşmesini temsil eder:

    { agentId, task, runAt, maxAttempts }

runAt lokal tarih alanından ISO biçimine dönüştürülür. Preview payload'ı göndermez; yalnız kullanıcıya inceleme ve destek amacıyla gösterir.

Row duplicate metadata'sı:

- agentId
- maxAttempts
- runAt
- scheduleId

Task metni row başlığından okunur. Credential, token ve server secret alanları taşınmaz.

import { calculationFor } from '../../lib/chat-calculation.ts';

/** Add a computed reference to simple text-only arithmetic requests at the chat boundary. */
export function withCalculation(base:typeof fetch):typeof fetch {
  return function(input,init) {
    if(init?.method?.toUpperCase()!=='POST'||typeof init.body!=='string')return base(input,init);
    const url=new URL(input instanceof Request?input.url:input,location.href);
    if(url.origin!==location.origin||!['/api/chat','/api/agent/run'].includes(url.pathname))return base(input,init);
    let body=init.body;
    try {
      const data=JSON.parse(body);
      const last=Array.isArray(data.messages)?data.messages.at(-1):null;
      if(last?.role==='user'&&typeof last.content==='string'){
        const reference=calculationFor(last.content);
        if(reference){last.content+='\n\n[Hafize yerel hesap sonucu: '+reference+']';body=JSON.stringify(data);}
      }
    } catch { /* Non-JSON requests continue through the normal transport. */ }
    return base(input,body===init.body?init:{...init,body});
  };
}

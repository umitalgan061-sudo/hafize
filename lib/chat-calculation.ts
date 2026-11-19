/** Recognize complete arithmetic questions only. Turkish decimal comma, thin grammar, no eval. */
export function calculationFor(text: string): string | null {
  if (text.length > 250) return null;
  let expr=text.trim().toLocaleLowerCase('tr-TR').replace(/^(?:hesapla|işlem)\s*:\s*/,'')
    .replace(/\s*(?:kaç(?:tır)?|nedir|eder|hesapla)[?! .]*$/,'').replace(/[?=]\s*$/,'').trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(expr)) return null;
  function bounded(value:number):number {
    if (!Number.isFinite(value) || Math.abs(value)>Number.MAX_SAFE_INTEGER) throw Error();
    return value;
  }
  const num='(\\d+(?:,\\d+)?)';
  const pct=new RegExp('^'+num+"(?:\\s*tl)?['’]?(?:nin|nın|nun|nün|in|ın|un|ün)?\\s+(?:yüzde\\s*|%\\s*)"+num+"(?:['’]?(?:si|sı|i|ı))?(?:\\s+kaç)?$").exec(expr);
  if(pct)expr=pct[1]+' × '+pct[2]+' / 100';
  else if (!/^[\d\s,()+*/×÷−-]+$/.test(expr) || !/[+*/×÷−-]/.test(expr)) return null;
  // Dot notation is ambiguous in Turkish (decimal or thousands); leave it to normal chat.
  const tokens=expr.match(/\d+(?:,\d+)?|[()+*/×÷−-]/g) || [];
  if(tokens.length>80 || tokens.join('')!==expr.replace(/\s+/g,'')) return null;
  let pos=0;
  function atom():number {
    const token=tokens[pos++];
    if(token==='-'||token==='−')return -atom();
    if(token==='+')return atom();
    if(token==='('){const v=sum();if(tokens[pos++]!==')')throw Error();return v;}
    if(!token || !/^\d/.test(token))throw Error();
    return Number(token.replace(',','.'));
  }
  function product():number {
    let v=atom();
    while(['*','×','/','÷'].includes(tokens[pos]??'')){
      const op=tokens[pos++],right=atom();
      v=bounded(op==='*'||op==='×'?v*right:v/right);
    }
    return v;
  }
  function sum():number {
    let v=product();
    while(['+','-','−'].includes(tokens[pos]??'')){const op=tokens[pos++],right=product();v=bounded(op==='+'?v+right:v-right);}
    return v;
  }
  try {
    const value=sum();
    if(pos!==tokens.length || !Number.isFinite(value) || Math.abs(value)>Number.MAX_SAFE_INTEGER || tokens.some(t=>/^\d/.test(t)&&t.replace(',','').length>12))return null;
    return expr+' ≈ '+value.toLocaleString('tr-TR',{maximumSignificantDigits:12});
  } catch {return null;}
}

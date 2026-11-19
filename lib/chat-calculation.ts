/** Recognize complete arithmetic questions only. Turkish decimal comma, thin grammar, no eval. */
function evaluate(text: string): {expr:string; value:number; base?:string} | null {
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
    return {expr,value,...(pct?{base:pct[1]!}:{})};
  } catch {return null;}
}

type Calculation = NonNullable<ReturnType<typeof evaluate>>;
function display(calc:Calculation) {
  return calc.expr+' ≈ '+calc.value.toLocaleString('tr-TR',{maximumSignificantDigits:12});
}
export function calculationFor(text:string) {
  const result=evaluate(text);
  return result ? display(result) : null;
}

type Turn = {role?:string; content?:unknown};
const rateQuestion = /^(?:(?:peki(?: ya)?|o zaman)\s+)?(?:(sonucun|çıkan sonucun|ana tutarın|aynı tutarın)\s+)?(?:%\s*|yüzde\s+)(\d+(?:,\d+)?)(?:['’]?(?:si|sı|i|ı|u|ü))?(?:\s+(?:kaç(?:tır)?|ne kadar)(?:\s+eder)?)?[?.!]*$/u;
function rateFollowup(text:string) {
  return text.length<=150 ? rateQuestion.exec(text.trim().toLocaleLowerCase('tr-TR')) : null;
}

/** Resolve consecutive user calculations in the request; never reuse state across chats. */
export function conversationCalculation(turns:Turn[]):string|null {
  const last=turns.at(-1);
  if(last?.role!=='user'||typeof last.content!=='string')return null;
  const direct=calculationFor(last.content);
  if(direct || !rateFollowup(last.content))return direct;
  const followups: RegExpExecArray[]=[];
  let previous:Calculation|null=null;
  for(let i=turns.length-1;i>=0 && i>=turns.length-24;i--){
    const turn=turns[i];
    if(turn?.role==='assistant')continue;
    if(turn?.role!=='user'||typeof turn.content!=='string')return null;
    const match=rateFollowup(turn.content);
    if(match){followups.push(match);continue;}
    previous=evaluate(turn.content);
    break;
  }
  if(!previous)return null;
  for(const match of followups.reverse()){
    const target=match[1];
    const resultRequested=target==='sonucun'||target==='çıkan sonucun';
    if(!previous.base && !resultRequested)return null;
    const amount=resultRequested ? previous.value : Number(previous.base!.replace(',','.'));
    const rate=Number(match[2]!.replace(',','.'));
    const value=amount*rate/100;
    if(match[2]!.replace(',','').length>12 || !Number.isFinite(value)||Math.abs(amount*rate)>Number.MAX_SAFE_INTEGER)return null;
    const literal=String(amount).replace('.',',');
    previous={expr:literal+' × '+match[2]+' / 100',value,base:literal};
  }
  return display(previous);
}

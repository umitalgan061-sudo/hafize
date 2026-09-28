const FREQUENCIES = Object.freeze(['daily','weekly','monthly']);
const MAX_INTERVAL = 30;
const MAX_HISTORY = 20;
const WEEKDAYS = Object.freeze([0,1,2,3,4,5,6]);

function finiteInteger(value){ return Number.isInteger(value) && Number.isFinite(value); }
function clampInt(value,min,max,fallback){ return finiteInteger(value) ? Math.min(Math.max(value,min),max) : fallback; }
function isoDate(value,label='date'){
  const date=value instanceof Date?new Date(value.getTime()):new Date(value);
  if(Number.isNaN(date.getTime())) throw new Error(`INVALID_SCHEDULE_RECURRENCE:${label}`);
  return date;
}
function cleanFrequency(value){
  if(value==null || value==='') return null;
  const frequency=String(value);
  if(!FREQUENCIES.includes(frequency)) throw new Error('INVALID_SCHEDULE_RECURRENCE:frequency');
  return frequency;
}
function normalizeDays(value){
  if(value==null) return [];
  if(!Array.isArray(value)) throw new Error('INVALID_SCHEDULE_RECURRENCE:daysOfWeek');
  const seen=new Set();
  for(const day of value){
    if(!finiteInteger(day) || !WEEKDAYS.includes(day)) throw new Error('INVALID_SCHEDULE_RECURRENCE:daysOfWeek');
    seen.add(day);
  }
  return [...seen].sort((a,b)=>a-b);
}
function daysInMonth(year,month){ return new Date(Date.UTC(year,month+1,0)).getUTCDate(); }

export function normalizeRecurrence(value, { allowNull=true } = {}){
  if(value==null){
    if(allowNull) return null;
    throw new Error('INVALID_SCHEDULE_RECURRENCE:missing');
  }
  if(Array.isArray(value)||typeof value!=='object') throw new Error('INVALID_SCHEDULE_RECURRENCE:shape');
  const allowed=new Set(['frequency','interval','daysOfWeek','dayOfMonth','timezone']);
  for(const key of Object.keys(value)) if(!allowed.has(key)) throw new Error('INVALID_SCHEDULE_RECURRENCE:field');
  const frequency=cleanFrequency(value.frequency);
  if(!frequency) throw new Error('INVALID_SCHEDULE_RECURRENCE:frequency');
  const interval=clampInt(value.interval,1,MAX_INTERVAL,1);
  const days=normalizeDays(value.daysOfWeek);
  let dayOfMonth=value.dayOfMonth;
  if(dayOfMonth!=null){
    if(!finiteInteger(dayOfMonth)||dayOfMonth<1||dayOfMonth>31) throw new Error('INVALID_SCHEDULE_RECURRENCE:dayOfMonth');
  }
  if(frequency==='weekly' && !days.length) throw new Error('INVALID_SCHEDULE_RECURRENCE:weeklyDays');
  if(frequency!=='weekly' && days.length) throw new Error('INVALID_SCHEDULE_RECURRENCE:daysOfWeek');
  if(frequency!=='monthly' && dayOfMonth!=null) throw new Error('INVALID_SCHEDULE_RECURRENCE:dayOfMonth');
  if(frequency==='monthly' && dayOfMonth==null) throw new Error('INVALID_SCHEDULE_RECURRENCE:monthlyDay');
  let timezone=value.timezone;
  if(timezone!=null){
    timezone=String(timezone).trim().slice(0,64);
    if(!timezone || /[\r\n]/.test(timezone)) throw new Error('INVALID_SCHEDULE_RECURRENCE:timezone');
  }
  return Object.freeze({
    frequency,
    interval,
    daysOfWeek:Object.freeze(days),
    dayOfMonth:dayOfMonth==null?null:dayOfMonth,
    ...(timezone?{timezone}: {})
  });
}

export function isRecurring(value){ return normalizeRecurrence(value,{allowNull:true})!==null; }

function addDays(date,days){
  const next=new Date(date.getTime());
  next.setUTCDate(next.getUTCDate()+days);
  return next;
}
function addMonths(date,months,preferredDay){
  const next=new Date(date.getTime());
  const day=preferredDay ?? next.getUTCDate();
  const targetMonth=next.getUTCMonth()+months;
  next.setUTCDate(1);
  next.setUTCMonth(targetMonth);
  next.setUTCDate(Math.min(day,daysInMonth(next.getUTCFullYear(),next.getUTCMonth())));
  return next;
}
function nextWeekly(date, rule){
  const candidates=[];
  for(const day of rule.daysOfWeek){
    let delta=(day-date.getUTCDay()+7)%7;
    if(delta===0) delta=7;
    candidates.push(addDays(date,delta));
  }
  candidates.sort((a,b)=>a.getTime()-b.getTime());
  let next=candidates[0];
  if(rule.interval>1 && next){
    const weekStart=new Date(date.getTime());
    const currentDay=weekStart.getUTCDay();
    const normalizedCurrent=addDays(weekStart,-currentDay);
    const nextWeekStart=addDays(normalizedCurrent,7*rule.interval);
    const minCandidate=rule.daysOfWeek[0];
    next=new Date(nextWeekStart.getTime());
    next.setUTCDate(nextWeekStart.getUTCDate()+minCandidate);
    for(const day of rule.daysOfWeek){
      const candidate=new Date(nextWeekStart.getTime());
      candidate.setUTCDate(nextWeekStart.getUTCDate()+day);
      if(candidate.getTime()>date.getTime()){ next=candidate; break; }
    }
  }
  return next;
}
export function nextOccurrence(runAt, recurrence, { now=runAt } = {}){
  const base=isoDate(runAt,'runAt');
  const rule=normalizeRecurrence(recurrence,{allowNull:false});
  const current=isoDate(now,'now');
  let next;
  if(rule.frequency==='daily') next=addDays(base,rule.interval);
  else if(rule.frequency==='monthly') next=addMonths(base,rule.interval,rule.dayOfMonth);
  else next=nextWeekly(base,rule);
  let guard=0;
  while(next.getTime()<=current.getTime() && guard<366){
    if(rule.frequency==='daily') next=addDays(next,rule.interval);
    else if(rule.frequency==='monthly') next=addMonths(next,rule.interval,rule.dayOfMonth);
    else next=nextOccurrence(next,rule,{now:current});
    guard+=1;
  }
  if(guard>=366) throw new Error('INVALID_SCHEDULE_RECURRENCE:runaway');
  return next.toISOString();
}

export function nextOccurrences(runAt, recurrence, { now=runAt, limit=10 } = {}){
  const safeLimit=clampInt(limit,1,50,10);
  const result=[];
  let current=isoDate(now,'now');
  let cursor=isoDate(runAt,'runAt');
  const rule=normalizeRecurrence(recurrence,{allowNull:false});
  for(let i=0;i<safeLimit;i+=1){
    const next=nextOccurrence(cursor,rule,{now:current});
    result.push(next);
    cursor=next;
    current=new Date(cursor);
  }
  return result;
}

export function recordOccurrence(history, occurrence){
  const current=Array.isArray(history)?history.slice():[];
  const allowed=new Set(['scheduleId','status','attempts','maxAttempts','runAt','finishedAt','lastError']);
  const safe={};
  if(occurrence && typeof occurrence==='object'){
    for(const key of Object.keys(occurrence)) if(allowed.has(key)) safe[key]=occurrence[key];
  }
  safe.status=typeof safe.status==='string'?safe.status:'completed';
  safe.attempts=clampInt(safe.attempts,0,9999,0);
  safe.maxAttempts=clampInt(safe.maxAttempts,1,5,1);
  safe.runAt=isoDate(safe.runAt??new Date(),'historyRunAt').toISOString();
  safe.finishedAt=isoDate(safe.finishedAt??new Date(),'finishedAt').toISOString();
  if(safe.lastError!=null) safe.lastError=String(safe.lastError).slice(0,120);
  else safe.lastError=null;
  if(safe.scheduleId!=null) safe.scheduleId=String(safe.scheduleId).slice(0,120);
  current.unshift(Object.freeze(safe));
  return Object.freeze(current.slice(0,MAX_HISTORY));
}

export function summarizeHistory(history){
  const list=Array.isArray(history)?history:[];
  const completed=list.filter(x=>x?.status==='completed').length;
  const failed=list.filter(x=>x?.status==='failed').length;
  const running=list.filter(x=>x?.status==='running').length;
  return Object.freeze({ total:list.length, completed, failed, running, last:list[0]??null });
}

export const RECURRENCE_FREQUENCIES=FREQUENCIES;
export const RECURRENCE_LIMITS=Object.freeze({maxInterval:MAX_INTERVAL,maxHistory:MAX_HISTORY});

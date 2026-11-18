type Weights = [number, number, number];
const train = [[-2,0],[0,1],[1,2],[2,-1],[-1,-2],[3,1]];
const holdout = [[1,-1],[-3,2],[2,2],[0,-2]];
function residual(w: Weights, [x,y]: number[]) {
  return w[0]*x! + w[1]*y! + w[2] - (2*x! - 3*y! + 1);
}
function mse(w: Weights) {
  return holdout.reduce((total, row) => total + residual(w,row)**2, 0) / holdout.length;
}
function fit(initial: Weights, rate: number, epochs: number): Weights {
  const w: Weights = [...initial];
  for (let i=0; i<epochs; i++) {
    const gradient: Weights = [0,0,0];
    for (const row of train) {
      const d = residual(w,row);
      [...row,1].forEach((x,j) => { gradient[j] = gradient[j]! + 2*d*x/train.length; });
    }
    gradient.forEach((g,j) => { w[j] = w[j]! - rate*g; });
  }
  return w;
}
function same(actual: unknown, expected: number): boolean {
  return typeof actual === 'number' && Number.isFinite(actual) && Number.isFinite(expected) &&
    Math.abs(actual-expected) <= 1e-10*Math.max(1e-14,Math.abs(expected));
}
function equalWeights(data: unknown,w: Weights) {
  return Array.isArray(data) && data.length === 3 && w.every((value,i)=>same(data[i],value));
}
// Half-integer points are disjoint from both integer-valued datasets used by the lab.
export function probeWeights(weights: Weights) {
  const coordinates = [-4.5,-2.5,0.5,2.5,4.5];
  let totalSquared = 0;
  let maximum = -1;
  let worstPoint = [0,0];
  for (const x of coordinates) {
    for (const y of coordinates) {
      const absolute = Math.abs(residual(weights,[x,y]));
      totalSquared += absolute ** 2;
      if (absolute > maximum) {
        maximum = absolute;
        worstPoint = [x,y];
      }
    }
  }
  return { count: coordinates.length**2, rmse: Math.sqrt(totalSquared/coordinates.length**2), maximum, worstPoint };
}

export function reviewExperiment(raw: string) {
  if (raw.length > 2_000_000) throw Error('Dosya 2 MB sınırını aşıyor.');
  const doc = JSON.parse(raw);
  if (doc?.model !== 'linear-2d-v1' || JSON.stringify(doc.train)!==JSON.stringify(train) ||
      JSON.stringify(doc.holdout)!==JSON.stringify(holdout) || !Array.isArray(doc.audit) ||
      !doc.audit.length || doc.audit.length>2000) throw Error('Model, veri kümesi veya kayıt biçimi desteklenmiyor.');
  let current: Weights = [0,0,0], candidate: Weights | null = null;
  const history: Weights[] = [];
  let evaluated=0, accepted=0, rolledBack=0;
  for (const [i, event] of doc.audit.entries()) {
    const invalid = () => new Error('Kayıt ' + (i+1) + ' yeniden hesaplanan deneyle uyuşmuyor.');
    if (event?.action === 'evaluate') {
      if (!equalWeights(event.initial,current) || !Number.isFinite(event.rate) || event.rate<0.001 || event.rate>2 ||
          !Number.isInteger(event.epochs) || event.epochs<1 || event.epochs>200) throw invalid();
      const weights = fit(current,event.rate,event.epochs);
      const before = mse(current), after = mse(weights);
      if (!equalWeights(event.weights,weights) || !same(event.before,before) || !(Number.isFinite(after) ? same(event.after,after) : event.after === null) ||
          event.improved !== (after<before) || event.trainingRows!==train.length || event.validationRows!==holdout.length) throw invalid();
      candidate = after<before ? weights : null;
      evaluated++;
    } else if (event?.action === 'accept' && candidate && equalWeights(event.weights,candidate)) {
      history.push(current); current=candidate; candidate=null; accepted++;
    } else if (event?.action === 'rollback' && history.length && equalWeights(event.weights,history[history.length-1]!)) {
      current=history.pop()!; candidate=null; rolledBack++;
    } else throw invalid();
  }
  return { evaluated, accepted, rolledBack, activeMse:mse(current), baselineMse:mse([0,0,0]), weights:current, probe:probeWeights(current) };
}

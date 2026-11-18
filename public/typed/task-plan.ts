import { reviewExperiment } from '../../lib/weight-experiment.ts';
import { validatePlan } from '../../lib/task-plan.ts';

const input = document.querySelector<HTMLTextAreaElement>('#tasks')!;
const output = document.querySelector<HTMLElement>('#schedule')!;
function inspect() {
  const rows = input.value.split('\n').map(line => line.trim()).filter(Boolean);
  try {
    const plan = validatePlan(rows.map((title, index) => ({
      id: 's' + (index + 1), title, tool: 'reason', args: { instruction: title }
    })), new Set(), 40);
    const done = new Set<string>();
    const lines: string[] = [];
    while (done.size < plan.length) {
      const group = plan.filter(step => !done.has(step.id) && step.dependsOn.every(id => done.has(id)));
      lines.push('Aşama ' + (lines.length + 1) + '\n' + group.map(step => step.id + ' · ' + step.title).join('\n'));
      group.forEach(step => done.add(step.id));
    }
    output.textContent = lines.join('\n\n');
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    output.textContent = code === 'PLAN_HAS_CYCLE' ? 'Görevler birbirini bekliyor. Döngü oluşturan başvuruyu değiştir.' :
      code.startsWith('PLAN_UNKNOWN_DEPENDENCY:') ? 'Eksik veya kendine bakan adım: ' + code.split(':')[1] :
      'Bir ile kırk arasında görev gir.';
  }
}
document.querySelector('#check')!.addEventListener('click', inspect);
inspect();

const picker = document.querySelector<HTMLInputElement>('#experiment-file')!;
const report = document.querySelector<HTMLElement>('#review')!;
picker.addEventListener('change', async () => {
  const file = picker.files?.[0];
  report.textContent = '';
  if (!file) return;
  try {
    if (file.size>2_000_000) throw Error('Dosya 2 MB sınırını aşıyor.');
    const result = reviewExperiment(await file.text());
    if (picker.files?.[0] !== file) return;
    report.textContent = [
      'Deney yeniden hesaplandı.',
      'Deneme: '+result.evaluated+' · Kabul: '+result.accepted+' · Geri alma: '+result.rolledBack,
      'Başlangıç hatası: '+result.baselineMse.toPrecision(6),
      'Etkin ağırlıkların hatası: '+result.activeMse.toPrecision(6),
      'Etkin ağırlıklar: '+result.weights.map(w=>w.toPrecision(6)).join(', '),
      '',
      'Ek sınama · '+result.probe.count+' ayrı örnek',
      'Kök ortalama karesel hata (RMSE): '+result.probe.rmse.toPrecision(6),
      'En büyük mutlak hata: '+result.probe.maximum.toPrecision(6)+' · Girdi: ('+result.probe.worstPoint.join(', ')+')'
    ].join('\n');
  } catch (error) {
    if (picker.files?.[0] === file) report.textContent = error instanceof SyntaxError ? 'Geçerli bir JSON dosyası seç.' : String(error instanceof Error ? error.message : error);
  }
});

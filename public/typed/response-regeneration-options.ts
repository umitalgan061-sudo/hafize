export interface RegenerationPreset {
  id: string;
  label: string;
  instruction: string;
}

export interface ChatRequestMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const REGENERATION_PRESETS: readonly RegenerationPreset[] = Object.freeze([
  Object.freeze({ id: 'concise', label: 'Daha kısa', instruction: 'Aynı soruyu yanıtla; önceki cevabı daha kısa, doğrudan ve gereksiz tekrarları azaltılmış biçimde yeniden yaz.' }),
  Object.freeze({ id: 'detailed', label: 'Daha detaylı', instruction: 'Aynı soruyu yanıtla; önceki cevabı daha ayrıntılı, gerekçeli ve gerekli bağlamı eklenmiş biçimde yeniden yaz.' }),
  Object.freeze({ id: 'formal', label: 'Daha resmi', instruction: 'Aynı soruyu yanıtla; önceki cevabı daha resmi, profesyonel ve nötr bir dille yeniden yaz.' }),
  Object.freeze({ id: 'bullets', label: 'Madde madde', instruction: 'Aynı soruyu yanıtla; önceki cevabı mümkün olduğunca okunabilir başlıklar ve madde işaretleri kullanarak yeniden yaz.' })
]);

export const MAX_REGENERATION_INSTRUCTION = 600;

export function normalizeRegenerationInstruction(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\0/g, '').trim().slice(0, MAX_REGENERATION_INSTRUCTION);
}

export function presetById(id: unknown): RegenerationPreset | null {
  if (typeof id !== 'string') return null;
  return REGENERATION_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function buildRegenerationMessages(
  history: unknown,
  instruction: unknown
): ChatRequestMessage[] {
  if (!Array.isArray(history)) return [];
  const output: ChatRequestMessage[] = [];
  for (const entry of history) {
    if (!entry || typeof entry !== 'object') continue;
    const role = (entry as { role?: unknown }).role;
    const content = (entry as { content?: unknown }).content;
    if ((role !== 'user' && role !== 'assistant' && role !== 'system') || typeof content !== 'string') continue;
    const clean = content.trim().slice(0, 12000);
    if (!clean) continue;
    output.push({ role, content: clean });
  }
  const cleanInstruction = normalizeRegenerationInstruction(instruction);
  if (cleanInstruction) output.push({ role: 'user', content: cleanInstruction });
  return output;
}

export function isPresetInstruction(value: unknown): boolean {
  const clean = normalizeRegenerationInstruction(value);
  return REGENERATION_PRESETS.some((preset) => preset.instruction === clean);
}

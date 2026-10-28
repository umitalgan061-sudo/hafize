// Versioned prompt registry with A/B experiments. prompts/registry.json lists each prompt's versions
// (semver, one file per version, kept in the repository so history lives in git) and an optional
// experiment that splits conversations between versions by weight. Assignment is a stable hash of
// the conversation id, so a conversation keeps its variant; feedback is recorded per variant.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface PromptVersion { readonly version: string; readonly file: string; readonly note?: string }
interface Experiment { readonly enabled: boolean; readonly variants: readonly { readonly name: string; readonly version: string; readonly weight: number }[] }
interface PromptEntry { readonly id: string; readonly active: string; readonly versions: readonly PromptVersion[]; readonly experiment?: Experiment }

export interface PromptAssignment { readonly promptId: string; readonly variant: string; readonly version: string; readonly text: string }

export function createPromptRegistry({ dir }: { readonly dir: string }) {
  const cache = new Map<string, string>();
  let entries: PromptEntry[] = [];

  function reload(): number {
    cache.clear();
    const file = join(dir, 'registry.json');
    if (!existsSync(file)) { entries = []; return 0; }
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { prompts?: PromptEntry[] };
    entries = (parsed.prompts || []).filter((entry) => entry && typeof entry.id === 'string' && Array.isArray(entry.versions));
    return entries.length;
  }

  function text(entry: PromptEntry, version: string): string {
    const found = entry.versions.find((item) => item.version === version);
    if (!found || !/^[a-z0-9][a-z0-9._-]*\.md$/i.test(found.file)) return '';
    const key = `${entry.id}@${version}`;
    if (!cache.has(key)) {
      try { cache.set(key, readFileSync(join(dir, found.file), 'utf8').trim()); } catch { cache.set(key, ''); }
    }
    return cache.get(key)!;
  }

  /** Picks the variant for this conversation (stable) and returns its prompt text. */
  function assign(promptId: string, conversationKey: string): PromptAssignment | null {
    const entry = entries.find((item) => item.id === promptId);
    if (!entry) return null;
    const experiment = entry.experiment;
    if (experiment?.enabled && experiment.variants.length) {
      const total = experiment.variants.reduce((sum, variant) => sum + Math.max(0, variant.weight), 0);
      if (total > 0) {
        const bucket = createHash('sha256').update(`${promptId}:${conversationKey}`).digest().readUInt32BE(0) % total;
        let cursor = 0;
        for (const variant of experiment.variants) {
          cursor += Math.max(0, variant.weight);
          if (bucket < cursor) return { promptId, variant: variant.name, version: variant.version, text: text(entry, variant.version) };
        }
      }
    }
    return { promptId, variant: 'default', version: entry.active, text: text(entry, entry.active) };
  }

  function describe() {
    return entries.map((entry) => ({ id: entry.id, active: entry.active, versions: entry.versions.map((item) => ({ version: item.version, note: item.note || '' })), experiment: entry.experiment || null }));
  }

  reload();
  return Object.freeze({ assign, describe, reload });
}
export type PromptRegistry = ReturnType<typeof createPromptRegistry>;

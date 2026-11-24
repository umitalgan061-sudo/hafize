
import type {ModelTaskKind} from './model-lab.ts';
export const EXPERT_MODEL_TASKS=Object.freeze({
  'agency-orchestrator':'reasoning-agent',
  'agency-minimal-engineer':'coding',
  'agency-code-reviewer':'coding',
  'expert-researcher':'reasoning-agent',
  'expert-coder':'coding',
  'expert-data-analyst':'reasoning-agent',
  'expert-math':'reasoning-agent',
  'expert-legal-tr':'reasoning-agent',
  'expert-health':'reasoning-agent',
  'expert-finance':'reasoning-agent',
  'expert-writer':'agent',
  'expert-vision':'reasoning-agent'
} satisfies Record<string,ModelTaskKind>);
export function expertModelTask(id:string|undefined):ModelTaskKind|undefined{
  return id&&Object.hasOwn(EXPERT_MODEL_TASKS,id)?EXPERT_MODEL_TASKS[id as keyof typeof EXPERT_MODEL_TASKS]:undefined;
}

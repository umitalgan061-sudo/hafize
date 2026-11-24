
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
  'expert-vision':'reasoning-agent',
  'team-product':'reasoning-agent',
  'team-requirements':'reasoning-agent',
  'team-ux':'agent',
  'team-ui':'coding',
  'team-frontend':'coding',
  'team-responsive':'coding',
  'team-accessibility':'coding',
  'team-backend':'coding',
  'team-api':'coding',
  'team-database':'coding',
  'team-realtime':'coding',
  'team-pwa':'coding',
  'team-performance':'coding',
  'team-security':'reasoning-agent',
  'team-privacy':'reasoning-agent',
  'team-qa':'coding',
  'team-unit-test':'coding',
  'team-integration-test':'coding',
  'team-e2e':'coding',
  'team-release':'reasoning-agent',
  'team-cloud':'coding',
  'team-observability':'coding',
  'team-seo':'agent',
  'team-content':'agent',
  'team-data-source':'reasoning-agent',
  'team-gis':'coding',
  'team-ai-routing':'reasoning-agent',
  'team-voice':'coding',
  'team-documentation':'agent',
  'team-architecture-review':'reasoning-agent',
  'team-design-review':'agent',
  'team-code-review':'coding',
  'team-acceptance':'reasoning-agent'
} satisfies Record<string,ModelTaskKind>);
export function expertModelTask(id:string|undefined):ModelTaskKind|undefined{
  return id&&Object.hasOwn(EXPERT_MODEL_TASKS,id)?EXPERT_MODEL_TASKS[id as keyof typeof EXPERT_MODEL_TASKS]:undefined;
}

/** Keep task-qualified, verified models at the front, but distribute roles over the
 * top three candidates. Never introduce an unverified model or override cooldown. */
export function diversifyExpertModels(id:string|undefined,verified:readonly string[]):string[]{
 const list=[...new Set(verified)];if(!expertModelTask(id)||list.length<2)return list;
 let hash=0;for(const ch of id!)hash=(Math.imul(hash,31)+ch.charCodeAt(0))>>>0;
 const n=Math.min(3,list.length),first=hash%n;
 return [list[first]!,...list.filter((_,i)=>i!==first)];
}

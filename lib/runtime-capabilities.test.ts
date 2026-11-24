import { OWNER_PROJECTS, OWNER_REPOSITORIES, matchOwnerProjects } from './owner-project-catalog.ts';
import { describe, expect, it } from 'vitest';
import { budgetSnapshot, capabilitySnapshot, capabilityInstruction, formatCapabilityAnswer, isStandaloneCapabilityQuestion } from './runtime-capabilities.ts';
import { getAllowedNvidiaTools, getRuntimeCapabilities, executeNvidiaToolCall, listToolPermissions } from './tool-runtime.ts';
import { createAgentRunLedger } from './agent-run-ledger.ts';

const agent = { id: 'primary', name: 'Hafize', toolPolicy: { default: 'deny' as const, allow: ['runtime.status', 'repo.read'], deny: [], approvalRequired: [] } };
const budget = { maxToolRounds: 100, roundsStarted: 5, toolCallsCompleted: 12, timeoutMs: 1800000, elapsedMs: 12000, expertMaxRounds: 8, maxCallsPerRound: 8 };
describe('authoritative runtime awareness', () => {
  it('reports exact advertised names rather than the entire catalog', async () => {
    const context = { traceId: 'trace', agent, registry: { agents: [agent] }, runtimeBudget: () => budget };
    const names = getAllowedNvidiaTools(agent, context).map(t => t.function.name);
    const snapshot = getRuntimeCapabilities(agent, { ...context, advertisedToolNames: names });
    expect(snapshot.availableTools).toEqual(names);
    expect(snapshot.catalogSize).toBe(listToolPermissions().length);
    expect(snapshot.unavailableTools.find(t => t.name === 'github_read_file')?.state).toBe('unavailable');
    expect(snapshot.budget?.roundsRemaining).toBe(95);
    expect(snapshot.budget?.totalCallCeiling).toBe(800);
    const result = await executeNvidiaToolCall(agent, { id: 'c1', function: { name: 'runtime_status', arguments: '{}' } }, context);
    expect(result).toMatchObject({ ok: true, value: { capabilities: { availableTools: names, budget: { maxToolRounds: 100 } } } });
  });
  it('never treats an unadvertised tool as active', () => {
    const snapshot = getRuntimeCapabilities(agent, { traceId: 'trace', agent, advertisedToolNames: [] });
    expect(snapshot.availableToolCount).toBe(0);
    expect(snapshot.budget).toBeNull();
  });
  it('has truthful bounded counters', () => {
    expect(budgetSnapshot({ ...budget, elapsedMs: 2000000, roundsStarted: 100 })).toMatchObject({ roundsRemaining: 0, remainingMs: 0, completionGuaranteed: false });
    const answer = formatCapabilityAnswer(capabilitySnapshot([{ name: 'runtime_status', state: 'available' }], budget, 13));
    expect(answer).toContain('100');
    expect(answer).toContain('800');
    expect(answer).toContain('12 (ana asistan dahil toplam 13)');
    expect(answer).toContain('sınırsız değildir');
  });
  it('only intercepts standalone capacity questions', () => {
    for (const q of ['Şuan kaç tane araç çağrısı yapabiliyorsun?', 'Şu an kaç aracın var?', 'Aktif araç listesini göster', 'Araç turu sınırın kaç?']) expect(isStandaloneCapabilityQuestion(q)).toBe(true);
    for (const q of ['Araçlarını göster ve depoyu değiştir', 'Kaç araç kullanabiliyorsun? Sonra kodu yayınla.', '100 tur yap', '']) expect(isStandaloneCapabilityQuestion(q)).toBe(false);
  });
  it('records a full 100-round eight-call run without ledger exhaustion', () => {
    const ledger = createAgentRunLedger({ traceId: 'large-run', agentId: 'primary', maxEntries: 2048, now: () => 0 });
    for (let index = 0; index < 800; index++) {
      const entry = ledger.recordToolStart('runtime_status');
      ledger.recordToolFinish(entry.taskId, { ok: true });
    }
    expect(ledger.snapshot().entries.length).toBe(801);
    expect(ledger.finish({ ok: true }).status).toBe('completed');
  });
  it('does not execute a tool after request cancellation', async () => {
    const controller = new AbortController(); controller.abort();
    const result = await executeNvidiaToolCall(agent, { id: 'c1', function: { name: 'runtime_status', arguments: '{}' } }, { traceId: 'trace', agent, signal: controller.signal });
    expect(result).toMatchObject({ ok: false, error: 'TOOL_ABORTED' });
  });
});

describe('connection-aware GitHub capability reporting', () => {
  it('reports public inspection without misrepresenting write access', () => {
    const snapshot = capabilitySnapshot([{ name: 'github_inspect', state: 'available' }, { name: 'github_develop', state: 'unavailable' }], budget, 13, { readMode: 'public_read_only', appConfigured: false, readRepositories: ['owner/example'], developmentRepositories: [], developmentConfigured: false, safeOwnerDevelopment: false, interactiveApproval: false });
    const answer = formatCapabilityAnswer(snapshot);
    expect(answer).toContain('salt-okunur');
    expect(answer).toContain('GitHub App sunucu kurulumu eksik');
    expect(snapshot.availableTools).not.toContain('github_develop');
  });
});


describe('owner project discovery', () => {
  const base = { readMode: 'app' as const, appConfigured: true, developmentRepositories: [], developmentConfigured: false, safeOwnerDevelopment: false, interactiveApproval: false };
  it('points to the Borsa monorepo folder and distinguishes a missing read scope from a missing project', () => {
    const msg = capabilityInstruction(capabilitySnapshot([], null, 1, { ...base, readRepositories: ['umitalgan061-sudo/hafize', 'umitalgan061-sudo/retake'] }));
    expect(msg).toContain('umitalgan061-sudo/hafize-siteler');
    expect(msg).toContain('borsa-gunlugu/');
    expect(msg).toContain('borsa-gunlugu-ua.web.app');
    expect(msg).toContain('okuma izin listesinde değil');
    expect(msg).toContain('proje yok deme');
    expect(msg).toContain('ajan geliştirme listesinde değil');
  });
  it('directs allowed reads to the correct repository without treating that as write permission', () => {
    const msg = capabilityInstruction(capabilitySnapshot([], null, 1, { ...base, readRepositories: ['umitalgan061-sudo/hafize-siteler'] }));
    expect(msg).toContain('github_inspect ile önce bu depoyu kontrol et');
    expect(msg).toContain('ajan geliştirme listesinde değil');
    expect(msg).toContain('mevcut canlı site veya erişim kanıtı değildir');
  });
});


describe('complete owner project inventory',()=>{
  it('covers every inspected repository, distinguishes subprojects and does not invent unknown URLs',()=>{
    expect(OWNER_REPOSITORIES.length).toBe(14);
    expect(OWNER_PROJECTS.filter(p=>p.repository.endsWith('/hafize-siteler')).length).toBe(3);
    expect(OWNER_PROJECTS.find(p=>p.id==='westeros')?.urls).toEqual([]);
    expect(OWNER_PROJECTS.find(p=>p.id==='tarim')?.urls).toEqual([]);
  });
  it('resolves Turkish project names and URLs without mistaking similar names',()=>{
    for (const [query,id] of [['Borsa Günlüğü sitesini incele','borsa'],['borsa-gunlugu-ua.web.app','borsa'],['Tiyatro Günlüğü','etkinlik'],['Westeros haritası','westeros'],['Ankara 3D haritası','ankara3d'],['hafize-weight-space-demo-2.web.app','weight2'],['Retake06-ua','retake']]) {
      expect(matchOwnerProjects(query).map(p=>p.id)).toEqual([id]);
    }
    expect(matchOwnerProjects('bilinmeyen proje')).toEqual([]);
    expect(matchOwnerProjects('Borsa Günlüğü ve Retake').map(p=>p.id)).toEqual(['borsa','retake']);
    expect(matchOwnerProjects('hafize-ua.web.app').map(p=>p.id)).toEqual(['hafize','hafize-legacy']);
  });
});


describe('three-hour long-run capacity',()=>{
 it('reports 200 rounds, 1600 root calls and 180 minutes',()=>{
  const b={...budget,maxToolRounds:200,timeoutMs:10_800_000,expertMaxRounds:24};
  expect(budgetSnapshot(b)).toMatchObject({totalCallCeiling:1600,roundsRemaining:195,remainingMs:10_788_000});
  expect(formatCapabilityAnswer(capabilitySnapshot([],b,13))).toContain('180 dakika');
 });
 it('keeps a large root and expert ledger and fits the final SSE frame',()=>{
  const ledger=createAgentRunLedger({traceId:'three-hour',agentId:'primary',maxEntries:4096,now:()=>0});
  for(let i=0;i<1600+16*24*4;i++){
   const t=ledger.recordToolStart('github_inspect');
   ledger.recordToolFinish(t.taskId,{ok:true});
  }
  ledger.finish({ok:true});
  const full=ledger.snapshot(),stream=ledger.streamSnapshot();
  expect(full.entries.length).toBe(3137);
  expect(stream.entries[0]?.status).toBe('completed');
  expect(stream.entries.at(-1)?.taskId).toBe(full.entries.at(-1)?.taskId);
  expect(stream).toMatchObject({totalEntries:3137,truncated:true,omittedEntries:3017});
  expect(Buffer.byteLength(JSON.stringify(stream),'utf8')).toBeLessThan(128*1024);
 });
});

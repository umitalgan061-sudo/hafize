// Registry doğrulayıcısı.
//
// `loadAgentRegistry` kendi içinde şema ve politika sınırlarını uygular. Burada
// ek olarak registry ile araç kataloğu arasındaki çapraz değişmezler kontrol
// edilir; bu iki taraf ayrı dosyalarda tutulduğu için sessizce ayrışabilirler.

import { AGENT_PERMISSION_POLICY, loadAgentRegistry } from '../lib/agent-runtime.mjs';
import { listToolPermissions } from '../lib/tool-runtime.mjs';

const registry = await loadAgentRegistry();
const tools = listToolPermissions();
const problems = [];

const allowedBy = new Map();
const approvalOnlyBy = new Map();
for (const agent of registry.agents) {
  for (const permission of agent.toolPolicy?.allow || []) {
    if (!allowedBy.has(permission)) allowedBy.set(permission, []);
    allowedBy.get(permission).push(agent.id);
  }
  for (const permission of agent.toolPolicy?.approvalRequired || []) {
    if (!approvalOnlyBy.has(permission)) approvalOnlyBy.set(permission, []);
    approvalOnlyBy.get(permission).push(agent.id);
  }
}

const never = new Set(AGENT_PERMISSION_POLICY.never);
const seen = new Set();

for (const { permission, functionName } of tools) {
  // Bir araç, hiçbir ajana verilmemesi gereken bir izni asla uygulamamalıdır.
  if (never.has(permission)) {
    problems.push(`${functionName}: yasaklı izin uyguluyor (${permission})`);
    continue;
  }
  // Katalogdaki iki araç aynı izni paylaşırsa yetki kararı belirsizleşir.
  if (seen.has(permission)) problems.push(`${permission}: birden fazla araç tarafından uygulanıyor`);
  seen.add(permission);

  // Onay gerektiren izinlerin allow listesine girmemesini `loadAgentRegistry`
  // zaten reddediyor; burada tekrar edilmez.

  // Hiçbir ajana verilmemiş bir araç erişilemez koddur; ya registry ya da
  // katalog eksik kalmıştır.
  if (!allowedBy.has(permission) && !approvalOnlyBy.has(permission)) {
    problems.push(`${functionName}: hiçbir ajana verilmemiş izin (${permission})`);
  }
}

if (problems.length) {
  console.error(`Agent registry doğrulaması başarısız (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `Agent registry OK: ${registry.agents.length} agents, default=${registry.defaultAgent}, ` +
  `${tools.length} araç izni registry ile eşleşiyor`
);

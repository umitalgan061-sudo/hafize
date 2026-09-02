// Registry ↔ tool katalog çapraz denetimi.
//
// Yükleyici (`loadAgentRegistry`) tek bir ajanın policy'sini doğrular; burada
// ise registry ile çalışma zamanı tool kataloğu arasındaki tutarlılık aranır:
// erişilemeyen araç ve yazım hatalı connector izni sessizce kalmasın.
const CONNECTOR_PREFIX = 'connector.';

function grantedPermissions(agent) {
  const policy = agent?.toolPolicy ?? {};
  return [
    ...(Array.isArray(policy.allow) ? policy.allow : []),
    ...(Array.isArray(policy.approvalRequired) ? policy.approvalRequired : [])
  ];
}

export function auditAgentToolPolicies(registry, toolPermissions) {
  if (!registry || !Array.isArray(registry.agents)) throw new Error('INVALID_AGENT_TOOL_AUDIT:registry');
  if (!Array.isArray(toolPermissions)) throw new Error('INVALID_AGENT_TOOL_AUDIT:toolPermissions');

  const catalog = new Set(toolPermissions.map((entry) => entry.permission));
  const problems = [];
  const granted = new Set();

  for (const agent of registry.agents) {
    for (const permission of grantedPermissions(agent)) {
      granted.add(permission);
      // Connector izinleri yalnızca connector araçlarını açmak için vardır;
      // katalogda karşılığı yoksa bu bir yazım hatası veya kaldırılmış araçtır.
      if (permission.startsWith(CONNECTOR_PREFIX) && !catalog.has(permission)) {
        problems.push(`UNKNOWN_CONNECTOR_PERMISSION:${agent.id}:${permission}`);
      }
    }
  }

  // Hiçbir ajanın kullanamadığı araç, modele hiç sunulmayan ölü koddur.
  for (const { permission, functionName } of toolPermissions) {
    if (!granted.has(permission)) problems.push(`UNREACHABLE_TOOL:${functionName}:${permission}`);
  }

  return { problems, tools: toolPermissions.length, grantedPermissions: granted.size };
}

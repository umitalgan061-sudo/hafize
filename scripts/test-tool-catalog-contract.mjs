import assert from 'node:assert/strict';
import {
  executeNvidiaToolCall,
  getAllowedNvidiaTools,
  getPublicToolActivity,
  getPublicToolRunningActivity,
  listToolPermissions
} from '../lib/tool-runtime.mjs';

// Bu test tek tek araçların davranışını değil, tool catalog'un tamamının uyması
// gereken güvenlik sözleşmesini doğrular. Yeni bir araç kaydedildiğinde sözleşme
// sessizce atlanamaz; buradaki döngüler yeni aracı otomatik olarak kapsar.

const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const NEVER_TOOL_PERMISSIONS = new Set([
  'secret.read',
  'repo.delete',
  'repo.merge',
  'repo.write_branch',
  'external.write',
  'external.send'
]);
const DENIED_TOOL_ERRORS = new Set(['TOOL_NOT_AUTHORIZED', 'TOOL_UNAVAILABLE']);

// Kayıtlı her aracın `available()` koşulunu karşılayan maksimal context.
// Yeni bir araç yeni bir context anahtarı gerektiriyorsa bu liste bilinçli
// olarak güncellenmelidir; aksi halde aşağıdaki görünürlük kontrolü kırılır.
function createMaximalContext() {
  return {
    traceId: '00000000-0000-4000-8000-000000000009',
    registry: { agents: [] },
    nvidiaConfigured: true,
    githubReadConfigured: true,
    githubReadFile: async () => ({ content: '# Hafize', truncated: false }),
    delegateAgent: async () => ({ ok: true, value: { answer: 'ok' } }),
    canvaReadAuthenticated: true,
    canvaReadTool: { execute: async () => ({ design: { id: 'DAF1' } }) },
    gmailReadAuthenticated: true,
    gmailReadTool: { execute: async () => ({ messages: [] }) }
  };
}

const catalog = listToolPermissions();
assert.ok(catalog.length >= 5, 'tool catalog beklenenden küçük');

const permissions = new Set();
const functionNames = new Set();

for (const { permission, functionName } of catalog) {
  assert.equal(typeof permission, 'string', `permission string değil: ${functionName}`);
  assert.equal(typeof functionName, 'string', `functionName string değil: ${permission}`);
  assert.match(permission, PERMISSION_PATTERN, `permission biçimi geçersiz: ${permission}`);
  assert.match(functionName, /^[a-z][a-z0-9_]{0,63}$/, `functionName biçimi geçersiz: ${functionName}`);

  assert.equal(permissions.has(permission), false, `permission tekrar ediyor: ${permission}`);
  assert.equal(functionNames.has(functionName), false, `functionName tekrar ediyor: ${functionName}`);
  permissions.add(permission);
  functionNames.add(functionName);

  assert.equal(
    NEVER_TOOL_PERMISSIONS.has(permission),
    false,
    `model tarafından çağrılabilir araç yasaklı/onay-gerektiren izin altında kayıtlı: ${permission}`
  );
}

// Her aracın kullanıcıya görünen durum etiketi eksiksiz olmalı ve araç
// sonucundan hiçbir veri sızdırmamalıdır.
for (const { functionName } of catalog) {
  const running = getPublicToolRunningActivity(functionName);
  assert.deepEqual(
    Object.keys(running || {}).sort(),
    ['label', 'state'],
    `running activity sözleşmesi eksik: ${functionName}`
  );
  assert.equal(running.state, 'running');
  assert.ok(running.label.trim().length > 0, `running etiketi boş: ${functionName}`);

  const success = getPublicToolActivity(functionName, { ok: true, value: { token: 'tok-should-not-leak' } });
  assert.deepEqual(Object.keys(success).sort(), ['label', 'state'], `success activity sözleşmesi eksik: ${functionName}`);
  assert.equal(success.state, 'success');
  assert.ok(success.label.trim().length > 0, `success etiketi boş: ${functionName}`);

  const failure = getPublicToolActivity(functionName, {
    ok: false,
    error: 'PRIVATE_ERROR_CODE',
    value: { repository: 'secret/repo', path: '.env', token: 'tok-should-not-leak' }
  });
  assert.deepEqual(Object.keys(failure).sort(), ['label', 'state'], `failure activity sözleşmesi eksik: ${functionName}`);
  assert.equal(failure.state, 'failure');
  assert.ok(failure.label.trim().length > 0, `failure etiketi boş: ${functionName}`);

  const serialized = JSON.stringify([running, success, failure]);
  for (const secret of ['tok-should-not-leak', 'PRIVATE_ERROR_CODE', 'secret/repo', '.env']) {
    assert.equal(serialized.includes(secret), false, `public activity veri sızdırıyor: ${functionName}/${secret}`);
  }

  // Sonuç okunamıyorsa güvenli taraf başarısızlıktır.
  assert.equal(getPublicToolActivity(functionName, undefined).state, 'failure');
  assert.equal(getPublicToolActivity(functionName, { ok: 'true' }).state, 'failure');
}

// Kayıtlı olmayan isimler ne etiket ne de yürütme yolu bulur.
for (const unknown of ['repo_delete', 'secret_read', '', null, undefined, 42, {}]) {
  assert.equal(getPublicToolRunningActivity(unknown), null);
  assert.equal(getPublicToolActivity(unknown, { ok: true }), null);
}

const denyAllAgent = { id: 'deny-all', name: 'Deny All', toolPolicy: { default: 'deny', allow: [] } };
const allowAllAgent = {
  id: 'allow-all',
  name: 'Allow All',
  toolPolicy: { default: 'deny', allow: [...permissions] }
};
const explicitDenyAgent = {
  id: 'explicit-deny',
  name: 'Explicit Deny',
  toolPolicy: { default: 'deny', allow: [...permissions], deny: [...permissions] }
};
const approvalAgent = {
  id: 'approval',
  name: 'Approval',
  toolPolicy: { default: 'deny', approvalRequired: [...permissions] }
};

// Default-deny: izin listesi boş bir ajan hiçbir aracı görmez ve hiçbirini yürütemez.
assert.deepEqual(getAllowedNvidiaTools(denyAllAgent, createMaximalContext()), []);
assert.deepEqual(getAllowedNvidiaTools(denyAllAgent, {}), []);
assert.deepEqual(getAllowedNvidiaTools(explicitDenyAgent, createMaximalContext()), []);
assert.deepEqual(getAllowedNvidiaTools(approvalAgent, createMaximalContext()), []);

// Yetkili ajan için her kayıtlı araç maksimal context altında görünür olmalı.
const exposed = getAllowedNvidiaTools(allowAllAgent, createMaximalContext()).map((tool) => tool.function.name);
assert.deepEqual(
  exposed.slice().sort(),
  [...functionNames].sort(),
  'yeni bir araç maksimal context altında görünmüyor; createMaximalContext güncellenmeli'
);

for (const definition of getAllowedNvidiaTools(allowAllAgent, createMaximalContext())) {
  assert.equal(definition.type, 'function');
  assert.ok(definition.function.description.trim().length > 0);
  assert.equal(definition.function.parameters.type, 'object');
  assert.equal(
    definition.function.parameters.additionalProperties,
    false,
    `araç parametreleri serbest alan kabul ediyor: ${definition.function.name}`
  );
  const serializedDefinition = JSON.stringify(definition);
  for (const forbidden of ['ownerId', 'accessToken', 'refreshToken', 'apiKey']) {
    assert.equal(
      serializedDefinition.includes(forbidden),
      false,
      `araç tanımı kimlik alanı taşıyor: ${definition.function.name}/${forbidden}`
    );
  }
}

for (const { functionName } of catalog) {
  const toolCall = { id: 'call_contract', type: 'function', function: { name: functionName, arguments: '{}' } };

  for (const agent of [denyAllAgent, explicitDenyAgent, approvalAgent]) {
    const denied = await executeNvidiaToolCall(agent, toolCall, {
      ...createMaximalContext(),
      agent,
      approvalGranted: false
    });
    assert.equal(denied.ok, false, `yetkisiz ajan aracı yürüttü: ${agent.id}/${functionName}`);
    assert.equal('value' in denied, false, `reddedilen çağrı değer döndürdü: ${agent.id}/${functionName}`);
    assert.equal(
      DENIED_TOOL_ERRORS.has(denied.error),
      true,
      `beklenmeyen ret kodu: ${agent.id}/${functionName}/${denied.error}`
    );
  }

  // Bağlantı/konfigürasyon yokken araç adı doğru olsa bile yürütülmez.
  const unavailable = await executeNvidiaToolCall(allowAllAgent, toolCall, {
    agent: allowAllAgent,
    registry: { agents: [] },
    traceId: '00000000-0000-4000-8000-00000000000a',
    approvalGranted: true
  });
  if (unavailable.ok === false) {
    assert.equal(DENIED_TOOL_ERRORS.has(unavailable.error), true, `beklenmeyen kod: ${functionName}/${unavailable.error}`);
  }

  // Bozuk argüman yürütmeye ulaşmadan reddedilir.
  const badArgs = await executeNvidiaToolCall(
    allowAllAgent,
    { id: 'call_bad', type: 'function', function: { name: functionName, arguments: '[]' } },
    { ...createMaximalContext(), agent: allowAllAgent, approvalGranted: true }
  );
  assert.deepEqual(badArgs, { ok: false, error: 'INVALID_TOOL_ARGUMENTS' }, `argüman doğrulaması eksik: ${functionName}`);
}

// Onay gerektiren izin, onay verildiğinde çalışır; bu yol yalnızca açık onayla açılır.
const approvedRuntimeStatus = await executeNvidiaToolCall(
  approvalAgent,
  { id: 'call_approved', type: 'function', function: { name: 'runtime_status', arguments: '{}' } },
  { ...createMaximalContext(), agent: approvalAgent, approvalGranted: true }
);
assert.equal(approvedRuntimeStatus.ok, true);
assert.equal(JSON.stringify(approvedRuntimeStatus).includes('tok-should-not-leak'), false);

const unknownTool = await executeNvidiaToolCall(
  allowAllAgent,
  { id: 'call_unknown', type: 'function', function: { name: 'repo_delete', arguments: '{}' } },
  { ...createMaximalContext(), agent: allowAllAgent, approvalGranted: true }
);
assert.deepEqual(unknownTool, { ok: false, error: 'UNKNOWN_TOOL' });

console.log(
  `Tool catalog contract OK: ${catalog.length} araç için benzersiz izin, güvenli public activity, default-deny ve argüman doğrulaması zorunlu`
);

// Configuration discovery for Hafize.
//
// Hafize reads 27 environment variables across chat, connectors, scheduling and
// memory. Most are optional, but several features are all-or-nothing: setting
// some of a group's variables and not the rest makes the process fail at boot.
// This module turns the raw environment into a report the server can print, so
// an operator learns what is on, what is off, and what is half-configured
// without reading the source.
//
// Security: values are never read into the report. Only variable NAMES and a
// set/unset boolean ever leave this module.

const GROUPS = Object.freeze([
  {
    id: 'chat',
    title: 'NVIDIA NIM sohbeti',
    required: true,
    variables: ['NVIDIA_API_KEY'],
    optional: ['NIM_BASE_URL', 'HAFIZE_CONTEXT_LIMIT_TOKENS'],
    blocks: 'Sohbet, model listesi ve zamanlanmış görev yürütme çalışmaz.'
  },
  {
    id: 'connectors',
    title: 'Gmail / Canva connector kimliği',
    fatalWhenPartial: true,
    variables: [
      'HAFIZE_CONNECTOR_AUTH_TOKEN',
      'HAFIZE_CONNECTOR_AUTH_SUBJECT',
      'HAFIZE_CONNECTOR_OWNER_KEY_B64',
      'HAFIZE_OAUTH_TOKEN_STORAGE_DIR',
      'HAFIZE_OAUTH_TOKEN_KEY_B64'
    ],
    blocks: 'Gmail ve Canva bağlantıları kapalı kalır.'
  },
  {
    id: 'github',
    title: 'GitHub salt-okunur erişim',
    variables: ['GITHUB_TOKEN', 'HAFIZE_GITHUB_READ_REPOS'],
    blocks: 'github_read_file aracı ajanlara sunulmaz.'
  },
  {
    id: 'scheduleApi',
    title: 'Zamanlanmış görev API\'si',
    fatalWhenPartial: true,
    variables: ['HAFIZE_SCHEDULE_AUTH_TOKEN', 'HAFIZE_SCHEDULE_AUTH_SUBJECT'],
    optional: ['HAFIZE_SCHEDULE_MODEL', 'HAFIZE_SCHEDULE_TICK_MS', 'HAFIZE_SCHEDULE_RUN_TIMEOUT_MS'],
    blocks: '/api/schedules uçları kapalı kalır; görev oluşturulamaz.'
  },
  {
    id: 'scheduleStorage',
    title: 'Zamanlanmış görev kalıcı deposu',
    fatalWhenPartial: true,
    variables: ['HAFIZE_SCHEDULE_STORAGE_FILE', 'HAFIZE_SCHEDULE_STORAGE_KEY_BASE64'],
    blocks: 'Görevler yalnızca bellekte tutulur ve yeniden başlatmada kaybolur.'
  },
  {
    id: 'scheduleLease',
    title: 'Çok örnekli çalıştırma kilidi (Redis)',
    variables: ['HAFIZE_SCHEDULE_LEASE_PROVIDER', 'HAFIZE_SCHEDULE_REDIS_URL'],
    optional: [
      'HAFIZE_SCHEDULE_LEASE_HOLDER_ID',
      'HAFIZE_SCHEDULE_LEASE_MS',
      'HAFIZE_SCHEDULE_LEASE_RENEW_INTERVAL_MS'
    ],
    blocks: 'Aynı görev birden fazla sunucu örneğinde birlikte çalışabilir.'
  },
  {
    id: 'memory',
    title: 'Şifreli kişisel bellek',
    fatalWhenPartial: true,
    variables: ['HAFIZE_MEMORY_STORAGE_DIR', 'HAFIZE_MEMORY_KEY_B64'],
    optional: ['HAFIZE_MEMORY_MAX_FILE_BYTES'],
    blocks: 'Kalıcı kişisel bellek kapalı kalır.'
  },
  {
    id: 'localModel',
    title: 'Yerel model sağlayıcısı',
    variables: ['HAFIZE_LOCAL_MODEL_ENABLED'],
    optional: ['HAFIZE_LOCAL_MODEL_BASE_URL'],
    blocks: 'Yalnızca NVIDIA NIM sağlayıcısı kullanılabilir.'
  }
]);

function isSet(env, name) {
  const value = env[name];
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Classify one group as 'ready' (every variable set), 'off' (none set, so the
 * feature is simply disabled) or 'incomplete' (a partial group). An incomplete
 * group is the actionable case: it is either a silently disabled feature the
 * operator believed they had enabled, or — when fatalWhenPartial — a boot crash.
 */
function describeGroup(env, group) {
  const present = group.variables.filter((name) => isSet(env, name));
  const missing = group.variables.filter((name) => !isSet(env, name));
  const state = missing.length === 0 ? 'ready' : present.length === 0 ? 'off' : 'incomplete';
  return Object.freeze({
    id: group.id,
    title: group.title,
    state,
    required: group.required === true,
    fatal: state === 'incomplete' && group.fatalWhenPartial === true,
    blocks: group.blocks,
    missing: Object.freeze(missing),
    optionalMissing: Object.freeze((group.optional || []).filter((name) => !isSet(env, name)))
  });
}

export function buildSetupStatus(options) {
  const { env = process.env } = options ?? {};
  if (!env || Array.isArray(env) || typeof env !== 'object') {
    throw new Error('INVALID_SETUP_STATUS:env');
  }
  const groups = Object.freeze(GROUPS.map((group) => describeGroup(env, group)));
  const chat = groups.find((group) => group.id === 'chat');
  return Object.freeze({
    // `ready` means a user can actually hold a conversation, nothing more.
    ready: chat.state === 'ready',
    // `fatal` groups abort startup, so the server can report them before crashing.
    fatal: Object.freeze(groups.filter((group) => group.fatal)),
    incomplete: Object.freeze(groups.filter((group) => group.state === 'incomplete')),
    groups
  });
}

const MARKS = Object.freeze({ ready: '✓', off: '·', incomplete: '!' });

export function formatSetupStatus(status) {
  if (!status || typeof status !== 'object' || !Array.isArray(status.groups)) {
    throw new Error('INVALID_SETUP_STATUS:status');
  }
  const lines = ['Hafize yapılandırma durumu:'];
  for (const group of status.groups) {
    lines.push(`  ${MARKS[group.state]} ${group.title}`);
    if (group.state === 'off') {
      lines.push(`      kapalı — ${group.blocks}`);
      lines.push(`      gerekli: ${group.missing.join(', ')}`);
    }
    if (group.state === 'incomplete') {
      lines.push(`      EKSİK — ${group.missing.join(', ')} tanımlı değil.`);
      lines.push(group.fatal
        ? '      Bu grup kısmi bırakılırsa sunucu açılışta durur.'
        : `      ${group.blocks}`);
    }
  }
  if (!status.ready) {
    lines.push('');
    lines.push('  Sohbet kapalı: NVIDIA_API_KEY tanımlı değil.');
    lines.push('  Kurulum adımları: docs/KURULUM.md — değişken listesi: .env.example');
  }
  return lines.join('\n');
}

/**
 * Rendered instead of a raw stack trace when a half-configured group would
 * otherwise abort startup deep inside a runtime factory.
 */
export function formatFatalSetupError(status) {
  const lines = ['Hafize başlatılamadı — yapılandırma eksik.'];
  for (const group of status.fatal) {
    lines.push(`  ${group.title}: ${group.missing.join(', ')} tanımlı değil.`);
    lines.push('      Bu grubun ya tamamı tanımlanmalı ya da tamamı boş bırakılmalıdır.');
  }
  lines.push('');
  lines.push('  Ayrıntı: docs/KURULUM.md');
  return lines.join('\n');
}

export const SETUP_VARIABLES = Object.freeze(
  GROUPS.flatMap((group) => [...group.variables, ...(group.optional || [])])
);

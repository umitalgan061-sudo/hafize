import { readFile } from 'node:fs/promises';
import { authorizeAgentTool, resolveAgent } from './agent-runtime.mjs';

const DEFAULT_SKILL_REGISTRY_URL = new URL('../skills/registry.json', import.meta.url);
const ID_PATTERN = /^[a-z][a-z0-9-]{1,79}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const MAX_PROMPT_LENGTH = 6000;
const NEVER_SKILL_PERMISSIONS = new Set(['secret.read', 'repo.delete']);

function invalid(field) {
  throw new Error(`INVALID_SKILL_REGISTRY:${field}`);
}

function requireString(value, field, maxLength = 1000) {
  if (typeof value !== 'string') invalid(field);
  const text = value.trim();
  if (!text || text.length > maxLength) invalid(field);
  return text;
}

function requireUniqueStrings(value, field, pattern) {
  if (!Array.isArray(value)) invalid(field);
  const seen = new Set();
  const result = [];
  for (const item of value) {
    const text = typeof item === 'string' ? item.trim() : '';
    if (!text || (pattern && !pattern.test(text)) || seen.has(text)) invalid(field);
    seen.add(text);
    result.push(text);
  }
  return result;
}

function capabilityState(agent, permission) {
  const policy = agent?.toolPolicy || {};
  if ((policy.deny || []).includes(permission)) return 'denied';
  if ((policy.allow || []).includes(permission)) return 'allowed';
  if ((policy.approvalRequired || []).includes(permission)) return 'approval_required';
  return 'missing';
}

function validateSkill(raw, agentRegistry, ids) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) invalid('skill');
  const id = requireString(raw.id, 'skill.id', 80);
  if (!ID_PATTERN.test(id) || ids.has(id)) invalid(`skill.id:${id}`);
  ids.add(id);

  const name = requireString(raw.name, `${id}.name`, 120);
  const description = requireString(raw.description, `${id}.description`, 500);
  const prompt = requireString(raw.prompt, `${id}.prompt`, MAX_PROMPT_LENGTH);
  const context = raw.context === 'inline' || raw.context === 'fork' ? raw.context : null;
  if (!context) invalid(`${id}.context`);
  if (typeof raw.userInvocable !== 'boolean') invalid(`${id}.userInvocable`);

  const allowedAgents = requireUniqueStrings(raw.allowedAgents, `${id}.allowedAgents`, ID_PATTERN);
  if (allowedAgents.length === 0) invalid(`${id}.allowedAgents`);
  const requiredPermissions = requireUniqueStrings(
    raw.requiredPermissions || [],
    `${id}.requiredPermissions`,
    PERMISSION_PATTERN
  );

  for (const permission of requiredPermissions) {
    if (NEVER_SKILL_PERMISSIONS.has(permission)) invalid(`${id}.forbiddenPermission:${permission}`);
  }

  const approvalRequired = new Set();
  for (const agentId of allowedAgents) {
    const agent = resolveAgent(agentRegistry, agentId);
    if (!agent || agent.id !== agentId) invalid(`${id}.unknownAgent:${agentId}`);
    for (const permission of requiredPermissions) {
      const state = capabilityState(agent, permission);
      if (state === 'denied' || state === 'missing') {
        invalid(`${id}.permissionMismatch:${agentId}:${permission}`);
      }
      if (state === 'approval_required') approvalRequired.add(permission);
    }
  }

  return Object.freeze({
    id,
    name,
    description,
    prompt,
    context,
    userInvocable: raw.userInvocable,
    allowedAgents: Object.freeze(allowedAgents),
    requiredPermissions: Object.freeze(requiredPermissions),
    approvalRequired: Object.freeze([...approvalRequired])
  });
}

export async function loadSkillRegistry(agentRegistry, fileUrl = DEFAULT_SKILL_REGISTRY_URL) {
  if (!agentRegistry?.agents) invalid('agentRegistry');
  const parsed = JSON.parse(await readFile(fileUrl, 'utf8'));
  if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.skills)) invalid('schemaVersion');

  const ids = new Set();
  const skills = parsed.skills.map((skill) => validateSkill(skill, agentRegistry, ids));
  return Object.freeze({ schemaVersion: 1, skills: Object.freeze(skills) });
}

export function listPublicSkills(skillRegistry, agentId) {
  const id = typeof agentId === 'string' ? agentId.trim() : '';
  return skillRegistry.skills
    .filter((skill) => skill.userInvocable && (!id || skill.allowedAgents.includes(id)))
    .map(({ id: skillId, name, description, context, allowedAgents, approvalRequired }) => ({
      id: skillId,
      name,
      description,
      context,
      allowedAgents: [...allowedAgents],
      approvalRequired: [...approvalRequired]
    }));
}

export function resolveSkill(skillRegistry, agent, skillId) {
  if (skillId == null || skillId === '') return { ok: true, skill: null };
  const id = typeof skillId === 'string' ? skillId.trim() : '';
  if (!ID_PATTERN.test(id)) return { ok: false, error: 'INVALID_SKILL' };
  const skill = skillRegistry.skills.find((item) => item.id === id);
  if (!skill || !skill.userInvocable) return { ok: false, error: 'INVALID_SKILL' };
  if (!skill.allowedAgents.includes(agent.id)) return { ok: false, error: 'SKILL_NOT_ALLOWED_FOR_AGENT' };

  const permissions = skill.requiredPermissions.map((permission) => ({
    permission,
    authorization: authorizeAgentTool(agent, permission)
  }));
  if (permissions.some(({ authorization }) => authorization.reason === 'explicit_deny' || authorization.reason === 'default_deny')) {
    return { ok: false, error: 'SKILL_PERMISSION_MISMATCH' };
  }
  return { ok: true, skill, permissions };
}

export function applyInlineSkill(systemMessage, skill) {
  if (!skill) return systemMessage;
  if (skill.context !== 'inline') throw new Error('SKILL_REQUIRES_FORK');
  if (systemMessage?.role !== 'system' || typeof systemMessage.content !== 'string') {
    throw new Error('INVALID_SYSTEM_MESSAGE');
  }
  return {
    role: 'system',
    content: `${systemMessage.content}\n\nAktif prosedür: ${skill.name}\n${skill.prompt}\nBu prosedür yeni araç yetkisi vermez; backend izinleri değişmez.`
  };
}

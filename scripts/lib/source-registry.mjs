/**
 * Canonical source locations for Hafize's browser and runtime modules.
 *
 * The TypeScript migration waves moved every browser module out of `public/*.js`
 * into a typed source (`public/*.ts`, `public/typed/*.ts` or
 * `public/typed/legacy/*.ts`) and every migrated runtime module out of
 * `lib/*.mjs` into `lib/*.ts`. Check suites that still pointed at the removed
 * `.js` / `.mjs` paths stopped verifying anything: the read threw `ENOENT`, so
 * the suite failed for a bookkeeping reason instead of a product reason.
 *
 * This module keeps the old -> new mapping in one place so a future migration
 * wave only edits `MIGRATED_SOURCES`, and exposes resolution helpers that throw
 * a named error instead of silently reading a stale path.
 *
 * It is a helper, not a suite: `run-checks.mjs` only executes `test-*` and
 * `validate-*` files.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

/**
 * Pre-migration path -> current typed source path.
 *
 * Keys are the historical paths that suites and docs referenced before the
 * TypeScript waves; values are the files that carry the behaviour today.
 */
export const MIGRATED_SOURCES = Object.freeze({
  "server.mjs": "server.ts",
  "lib/canva-agent-runtime.mjs": "lib/canva-agent-runtime.ts",
  "lib/delegated-agent-runner.mjs": "lib/delegated-agent-runner.ts",
  "lib/github-read.mjs": "lib/github-read.ts",
  "lib/gmail-agent-runtime.mjs": "lib/gmail-agent-runtime.ts",
  "lib/redis-schedule-lease-runtime.mjs": "lib/redis-schedule-lease-runtime.ts",
  "lib/schedule-http-api.mjs": "lib/schedule-http-api.ts",
  "lib/schedule-storage-runtime.mjs": "lib/schedule-storage-runtime.ts",
  "public/app.js": "public/typed/app-shell.ts",
  "public/auth.js": "public/typed/auth.ts",
  "public/chat-composer-features.js": "public/typed/chat-composer-features.ts",
  "public/chat-drafts.js": "public/typed/legacy/chat-drafts.ts",
  "public/chat-history-export.js": "public/typed/legacy/chat-history-export.ts",
  "public/chat-history-management.js": "public/typed/chat-history-management.ts",
  "public/chat-history-search.js": "public/typed/chat-history-search.ts",
  "public/chat-markdown.js": "public/chat-markdown.ts",
  "public/composer-history-backup.js": "public/typed/legacy/composer-history-backup.ts",
  "public/composer-history-help.js": "public/typed/legacy/composer-history-help.ts",
  "public/composer-history-panel.js": "public/typed/legacy/composer-history-panel.ts",
  "public/composer-history-settings.js": "public/typed/legacy/composer-history-settings.ts",
  "public/composer-history.js": "public/typed/legacy/composer-history.ts",
  "public/conversation-workspace-keyboard.js": "public/typed/legacy/conversation-workspace-keyboard.ts",
  "public/conversation-workspace.js": "public/conversation-workspace.ts",
  "public/connector-hub.js": "public/typed/legacy/connector-hub.ts",
  "public/hands-free-background-guard.js": "public/typed/hands-free-background-guard.ts",
  "public/hands-free.js": "public/typed/hands-free.ts",
  "public/message-workspace-policy.js": "public/typed/legacy/message-workspace-policy.ts",
  "public/markdown-renderer.js": "public/markdown-renderer.ts",
  "public/message-workspace.js": "public/typed/message-workspace.ts",
  "public/prompt-library-bulk-organizer.js": "public/typed/legacy/prompt-library-bulk-organizer.ts",
  "public/prompt-library-collections-enhancements.js": "public/typed/legacy/prompt-library-collections-enhancements.ts",
  "public/prompt-library.js": "public/typed/prompt-library.ts",
  "public/prompt-library-collections.js": "public/typed/legacy/prompt-library-collections.ts",
  "public/prompt-library-command-palette.js": "public/prompt-library-command-palette.ts",
  "public/prompt-library-diagnostics.js": "public/typed/legacy/prompt-library-diagnostics.ts",
  "public/prompt-library-enhancements.js": "public/typed/legacy/prompt-library-enhancements.ts",
  "public/prompt-library-import-preview.js": "public/typed/legacy/prompt-library-import-preview.ts",
  "public/prompt-library-keyboard.js": "public/typed/legacy/prompt-library-keyboard.ts",
  "public/prompt-library-revisions-enhancements.js": "public/typed/legacy/prompt-library-revisions-enhancements.ts",
  "public/prompt-library-revisions.js": "public/typed/legacy/prompt-library-revisions.ts",
  "public/prompt-library-safety.js": "public/typed/legacy/prompt-library-safety.ts",
  "public/prompt-library-smart-fill-hints.js": "public/prompt-library-smart-fill-hints.ts",
  "public/prompt-library-smart-fill.js": "public/prompt-library-smart-fill.ts",
  "public/prompt-library-smart-insert-activity.js": "public/typed/legacy/prompt-library-smart-insert-activity.ts",
  "public/prompt-library-smart-insert-center.js": "public/typed/legacy/prompt-library-smart-insert-center.ts",
  "public/prompt-library-smart-insert-history-bridge.js": "public/typed/legacy/prompt-library-smart-insert-history-bridge.ts",
  "public/prompt-library-smart-insert-history.js": "public/typed/legacy/prompt-library-smart-insert-history.ts",
  "public/prompt-library-smart-insert-presets.js": "public/typed/legacy/prompt-library-smart-insert-presets.ts",
  "public/prompt-library-smart-insert-shortcuts.js": "public/typed/legacy/prompt-library-smart-insert-shortcuts.ts",
  "public/prompt-library-smart-insert-suggestions.js": "public/typed/legacy/prompt-library-smart-insert-suggestions.ts",
  "public/prompt-library-smart-insert-validation.js": "public/typed/legacy/prompt-library-smart-insert-validation.ts",
  "public/prompt-library-smart-insert.js": "public/typed/legacy/prompt-library-smart-insert.ts",
  "public/prompt-library-smart-views-builder.js": "public/typed/legacy/prompt-library-smart-views-builder.ts",
  "public/prompt-library-smart-views-history.js": "public/typed/legacy/prompt-library-smart-views-history.ts",
  "public/prompt-library-smart-views-safety.js": "public/typed/legacy/prompt-library-smart-views-safety.ts",
  "public/prompt-library-smart-views.js": "public/typed/legacy/prompt-library-smart-views.ts",
  "public/prompt-library-starters.js": "public/typed/legacy/prompt-library-starters.ts",
  "public/prompt-library-usage.js": "public/typed/legacy/prompt-library-usage.ts",
  "public/scheduled-task-actions.js": "public/typed/legacy/scheduled-task-actions.ts",
  "public/scheduled-task-detail.js": "public/typed/legacy/scheduled-task-detail.ts",
  "public/scheduled-task-draft.js": "public/typed/legacy/scheduled-task-draft.ts",
  "public/scheduled-task-duplicate.js": "public/typed/legacy/scheduled-task-duplicate.ts",
  "public/scheduled-task-export.js": "public/typed/legacy/scheduled-task-export.ts",
  "public/scheduled-task-insights.js": "public/typed/legacy/scheduled-task-insights.ts",
  "public/scheduled-task-planning.js": "public/typed/legacy/scheduled-task-planning.ts",
  "public/scheduled-task-preview-activity.js": "public/typed/legacy/scheduled-task-preview-activity.ts",
  "public/scheduled-task-preview.js": "public/typed/legacy/scheduled-task-preview.ts",
  "public/scheduled-task-status-summary.js": "public/typed/legacy/scheduled-task-status-summary.ts",
  "public/scheduled-task-template-presets.js": "public/typed/legacy/scheduled-task-template-presets.ts",
  "public/scheduled-task-templates-backup.js": "public/typed/legacy/scheduled-task-templates-backup.ts",
  "public/scheduled-task-templates.js": "public/typed/legacy/scheduled-task-templates.ts",
  "public/scheduled-tasks-countdown.js": "public/scheduled-tasks-countdown.ts",
  "public/scheduled-tasks-enhancements.js": "public/typed/legacy/scheduled-tasks-enhancements.ts",
  "public/scheduled-tasks-keyboard.js": "public/typed/legacy/scheduled-tasks-keyboard.ts",
  "public/screen-share.js": "public/typed/legacy/screen-share.ts",
  "public/scheduled-tasks.js": "public/typed/scheduled-tasks.ts",
  "public/settings-privacy.js": "public/typed/settings-privacy.ts",
  "public/sw-policy.js": "public/sw-policy.ts",
  "public/settings-workspace.js": "public/typed/legacy/settings-workspace.ts",
  "public/sw.js": "public/sw.ts",
  "public/ui-shell.js": "public/typed/ui-shell.ts",
  "public/voice-input.js": "public/typed/voice-input.ts",
  "public/voice-output.js": "public/typed/voice-output.ts",
  "public/workspace-navigation.js": "public/typed/workspace-navigation.ts",
});

/** Directories searched, in order, when resolving a bare module name. */
export const SOURCE_ROOTS = Object.freeze(['public', 'public/typed', 'public/typed/legacy', 'lib']);

/** Extensions searched, in order, when resolving a bare module name. */
export const SOURCE_EXTENSIONS = Object.freeze(['.ts', '.mjs', '.js']);

function repoPath(relative) {
  return path.join(ROOT, relative);
}

/**
 * Current repository-relative path for a source reference.
 *
 * Accepts a repository-relative path (`public/sw-policy.js`,
 * `lib/github-read.mjs`, `public/typed/ui-shell.ts`) or a bare module name
 * (`sw-policy`, `ui-shell`). Returns `null` when nothing matches, so callers
 * can decide between a soft check and a hard failure.
 */
export function findSource(reference) {
  const value = String(reference ?? '').trim().replace(/^\.\//, '');
  if (!value || value.includes('..')) return null;
  if (existsSync(repoPath(value))) return value;
  const migrated = MIGRATED_SOURCES[value];
  if (migrated && existsSync(repoPath(migrated))) return migrated;
  if (value.includes('/')) return null;
  for (const root of SOURCE_ROOTS) {
    for (const extension of SOURCE_EXTENSIONS) {
      const candidate = path.posix.join(root, `${value}${extension}`);
      if (existsSync(repoPath(candidate))) return candidate;
    }
  }
  return null;
}

/** Like {@link findSource}, but throws `SOURCE_NOT_FOUND:<reference>` instead of returning null. */
export function resolveSource(reference) {
  const resolved = findSource(reference);
  if (!resolved) throw new Error(`SOURCE_NOT_FOUND:${reference}`);
  return resolved;
}

/** Absolute path for a source reference. */
export function sourcePath(reference) {
  return repoPath(resolveSource(reference));
}

/** UTF-8 text of a source reference. */
export function readSource(reference) {
  return readFileSync(sourcePath(reference), 'utf8');
}

/** UTF-8 text of several source references, keyed by the reference passed in. */
export function readSources(references) {
  const entries = references.map((reference) => [reference, readSource(reference)]);
  return Object.fromEntries(entries);
}

function hafizeGlobals() {
  return Object.keys(globalThis).filter((key) => key.startsWith('Hafize'));
}

/**
 * Imports a browser module and returns its public API.
 *
 * Browser modules come in two shapes after the migration: ESM sources that use
 * `export`, and UMD-wrapped sources that assign a frozen `Hafize*` global.
 * Node treats a `.ts` file under this package as ESM, so the UMD `module.exports`
 * branch is never taken and `require()` of such a module yields `{}`. This helper
 * imports the source and merges whatever `Hafize*` global it installed, so suites
 * see one object either way.
 */
export async function loadBrowserModule(reference) {
  const before = new Set(hafizeGlobals());
  const namespace = await import(sourcePath(reference));
  const installed = {};
  for (const key of hafizeGlobals()) {
    if (before.has(key)) continue;
    const api = globalThis[key];
    if (api && typeof api === 'object') Object.assign(installed, api);
  }
  // A plain ESM source is returned as its own namespace, so suites still see the
  // read-only export bindings instead of a mutable copy of them.
  if (!Object.keys(installed).length) return namespace;
  return { ...installed, ...namespace, default: namespace.default ?? installed };
}

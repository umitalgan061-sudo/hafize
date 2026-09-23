import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [enhancements, center, history, bridge, suggestions, shortcuts, presets, css, historyCss, suggestionsCss, sw] = await Promise.all([
  readFile(new URL('public/prompt-library-enhancements.js', root), 'utf8'),
  readFile(new URL('public/prompt-library-smart-insert-center.js', root), 'utf8'),
  readFile(new URL('public/prompt-library-smart-insert-history.js', root), 'utf8'),
  readFile(new URL('public/prompt-library-smart-insert-history-bridge.js', root), 'utf8'),
  readFile(new URL('public/prompt-library-smart-insert-suggestions.js', root), 'utf8'),
  readFile(new URL('public/prompt-library-smart-insert-shortcuts.js', root), 'utf8'),
  readFile(new URL('public/prompt-library-smart-insert-presets.js', root), 'utf8'),
  readFile(new URL('public/prompt-library-smart-insert.css', root), 'utf8'),
  readFile(new URL('public/prompt-library-smart-insert-history.css', root), 'utf8'),
  readFile(new URL('public/prompt-library-smart-insert-suggestions.css', root), 'utf8'),
  readFile(new URL('public/sw-policy.js', root), 'utf8')
]);

const contains = (source, pattern, name) => assert.match(source, pattern, name);
const absent = (source, pattern, name) => assert.doesNotMatch(source, pattern, name);

contains(enhancements, /prompt-library-smart-insert\.js/, 'enhancements loads smart insert');
contains(enhancements, /prompt-library-smart-insert-center\.js/, 'enhancements loads profile center');
contains(enhancements, /prompt-library-smart-insert-history\.js/, 'enhancements loads history');
contains(enhancements, /prompt-library-smart-insert-history-bridge\.js/, 'enhancements loads history bridge');
contains(enhancements, /prompt-library-smart-insert-suggestions\.js/, 'enhancements loads suggestions');
contains(enhancements, /prompt-library-smart-insert-shortcuts\.js/, 'enhancements loads shortcuts');
contains(enhancements, /prompt-library-smart-insert-center\.css/, 'enhancements loads center css');
contains(enhancements, /prompt-library-smart-insert-history\.css/, 'enhancements loads history css');
contains(enhancements, /prompt-library-smart-insert-suggestions\.css/, 'enhancements loads suggestions css');

contains(center, /MAX_PROFILES\s*=\s*24/); contains(center, /MAX_PROFILE_NAME\s*=\s*60/); contains(center, /MAX_VARIABLES\s*=\s*12/); contains(center, /MAX_VALUE\s*=\s*1000/);
contains(center, /MAX_QUERY\s*=\s*80/); contains(center, /normalizeProfile/); contains(center, /normalizeProfiles/); contains(center, /loadProfiles/); contains(center, /saveProfiles/); contains(center, /importProfiles/); contains(center,
  /exportProfiles/); contains(center, /duplicateProfile/); contains(center, /renameProfile/); contains(center, /toggleFavorite/); contains(center, /deleteProfile/);
contains(center, /localStorage/); contains(center, /setAttribute\('aria-labelledby'/); contains(center, /setAttribute\('role', 'listitem'/); contains(center, /replaceChildren/); absent(center, /innerHTML\s*=/,
  'center never assigns HTML'); absent(center, /fetch\(|XMLHttpRequest|WebSocket/, 'center remains local');

contains(history, /MAX_ENTRIES\s*=\s*40/); contains(history, /record\(/); contains(history, /recent\(/); contains(history, /countFor\(/); contains(history, /promptId/); contains(history, /usedAt/); contains(history,
  /label/); absent(history, /item\.body|rawValue|values\s*:/, 'history excludes prompt content and variable values');
contains(bridge, /pending/); contains(bridge, /data-prompt-smart-insert/); contains(bridge, /reason !== 'insert'/); contains(bridge, /SmartInsertHistory\.record/); absent(bridge, /api\.open\s*=|wrappedOpen/,
  'bridge does not mutate frozen API');

contains(suggestions, /score\(/); contains(suggestions, /rank\(/); contains(suggestions, /recommend\(/); contains(suggestions, /fillValues\(/); contains(suggestions, /hasMissing\(/); contains(suggestions,
  /MAX_SUGGESTIONS\s*=\s*5/); absent(suggestions, /fetch\(|XMLHttpRequest|WebSocket/);
contains(shortcuts, /Ctrl|ctrlKey/); contains(shortcuts, /metaKey/); contains(shortcuts, /event\.shiftKey/); contains(shortcuts, /key === 'i'/); contains(shortcuts, /key === 'l'/); contains(shortcuts, /key === 'h'/); contains(shortcuts,
  /isTyping/); absent(shortcuts, /form\.submit|requestSubmit/);

contains(presets, /PRESET_KEY/); contains(presets, /MAX_PRESETS\s*=\s*32/); contains(presets, /upsert\(/); contains(presets, /favorite\(/); contains(presets, /search\(/); contains(presets, /diffMissing\(/); contains(presets,
  /renderPicker\(/); contains(presets, /importText\(/); contains(presets, /exportText\(/); absent(presets, /fetch\(|XMLHttpRequest|WebSocket/);

contains(css, /prompt-library-variable-dialog/); contains(css, /max-width:700px/); contains(css, /forced-colors:active/); contains(css, /prefers-reduced-motion:reduce/);
contains(historyCss, /prompt-smart-insert-history/); contains(historyCss, /forced-colors:active/); contains(suggestionsCss, /prompt-smart-insert-suggestions/); contains(suggestionsCss, /max-width:700px/);
contains(sw, /prompt-library-smart-insert\.js/); contains(sw, /prompt-library-smart-insert-center\.js/); contains(sw, /prompt-library-smart-insert-history\.js/); contains(sw, /prompt-library-smart-insert-history-bridge\.js/); contains(sw,
  /prompt-library-smart-insert-suggestions\.js/); contains(sw, /prompt-library-smart-insert-shortcuts\.js/); contains(sw, /prompt-library-smart-insert-presets\.js/); contains(sw, /CURRENT_CACHE\s*=\s*`\$\{CACHE_PREFIX\}v38`/);

console.log('prompt-library-smart-insert-integration: ok');

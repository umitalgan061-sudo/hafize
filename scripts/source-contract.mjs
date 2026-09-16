// Shared helpers for source-contract suites.
//
// Frontend modules build their DOM with the element API, so an accessibility
// contract can be written either as markup (`aria-label="…"`) or as a
// `setAttribute('aria-label', '…')` call. Suites assert the contract, not the
// spelling. This module is a helper, not a suite (run-checks only executes
// test-*/validate-*).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DECLARATION_PATTERN = /^([a-zA-Z-]+)="([^"]*)"$/;

/** True when `source` declares `name="value"` as markup or via setAttribute. */
export function attributeDeclared(source, declaration) {
  if (typeof source !== 'string') return false;
  const match = DECLARATION_PATTERN.exec(declaration);
  if (!match) return source.includes(declaration);
  const [, name, value] = match;
  return source.includes(declaration)
    || source.includes(`setAttribute('${name}', '${value}')`)
    || source.includes(`setAttribute("${name}", "${value}")`);
}

export function assertAttributeDeclared(source, declaration, label = declaration) {
  assert.ok(attributeDeclared(source, declaration), label);
}

/**
 * True when `source` mentions a class as a selector, as a bare class name, or
 * as one entry of a class list (`className = 'icon-btn chat-stream-stop'`),
 * which is how a module that reuses a shared button style spells it.
 */
export function classDeclared(source, selector) {
  if (typeof source !== 'string') return false;
  const className = selector.replace(/^\./, '');
  if (source.includes(selector) || source.includes(`'${className}'`) || source.includes(`"${className}"`)) return true;
  return new RegExp(`['"\\s.]${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\\s]`).test(source);
}

export function assertClassDeclared(source, selector, label = selector) {
  assert.ok(classDeclared(source, selector), label);
}

/**
 * True when `css` contains `snippet`, ignoring formatting whitespace, so a
 * stylesheet reformat (`max-width:560px` vs `max-width: 560px`) is not a
 * contract change.
 */
export function cssIncludes(css, snippet) {
  const squeeze = (value) => String(value).replace(/\s+/g, '');
  return squeeze(css).includes(squeeze(snippet));
}

export function assertCssIncludes(css, snippet, label = snippet) {
  assert.ok(cssIncludes(css, snippet), label);
}

// --- Declaration and call shapes -------------------------------------------
//
// The browser modules that moved to TypeScript kept their behaviour but changed
// their spelling: `function open(prompt) {` became
// `const open = (prompt: PromptRecord): void =>` and `node.closest('.x')` became
// `node.closest<HTMLElement>('.x')`. Suites assert behaviour, so the helpers
// below match a declaration or a call in either style — and keep failing when
// the behaviour itself disappears.

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** Reads a repo-relative file, independent of the caller's working directory. */
export function readSource(file) {
  return readFileSync(path.join(ROOT, file), 'utf8');
}

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches a named unit of behaviour however it is declared: a function
 * declaration, an arrow constant (typed or not), a class method or an async
 * variant of any of those.
 */
export function declarationPattern(name) {
  const escaped = escapeForRegExp(name);
  return new RegExp(
    `(?:(?:async\\s+)?function\\s+${escaped}\\s*[(<]` +
      `|(?:const|let|var)\\s+${escaped}\\s*(?::[^=\\n]+)?=\\s*(?:async\\s*)?[(<]` +
      `|^\\s*(?:async\\s+)?${escaped}\\s*\\([^)]*\\)\\s*[:{])`,
    'm'
  );
}

/** True when `source` declares `name` in any of the supported styles. */
export function declaresFunction(source, name) {
  return declarationPattern(name).test(source);
}

export function assertDeclaresFunction(source, name, label = `declares ${name}()`) {
  assert.ok(declaresFunction(source, name), label);
}

/**
 * Matches a call to `name`, tolerating optional chaining (`name?.(`) and an
 * explicit type argument list (`name<T>(`).
 */
export function callPattern(name, argumentText = '') {
  const escaped = escapeForRegExp(name);
  const args = argumentText ? escapeForRegExp(argumentText) : '';
  return new RegExp(`${escaped}\\s*(?:<[^<>()]*>)?\\s*\\??\\.?\\(\\s*${args}`);
}

/** True when `source` calls `name`, with `argumentText` as a literal prefix of its arguments. */
export function callsFunction(source, name, argumentText = '') {
  return callPattern(name, argumentText).test(source);
}

export function assertCalls(source, name, argumentText = '', label = `calls ${name}(${argumentText})`) {
  assert.ok(callsFunction(source, name, argumentText), label);
}

/** Asserts every listed behaviour anchor is present, reporting the first gap by name. */
export function assertAnchors(source, anchors, kind = 'anchor') {
  for (const [name, pattern] of anchors) {
    if (pattern instanceof RegExp) assert.match(source, pattern, `missing ${kind}: ${name}`);
    else assert.ok(source.includes(pattern), `missing ${kind}: ${name}`);
  }
}

// Shared helpers for source-contract suites.
//
// Frontend modules build their DOM with the element API, so an accessibility
// contract can be written either as markup (`aria-label="…"`) or as a
// `setAttribute('aria-label', '…')` call. Suites assert the contract, not the
// spelling. This module is a helper, not a suite (run-checks only executes
// test-*/validate-*).

import assert from 'node:assert/strict';

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

/** True when `source` mentions a class either as a selector or as a bare class name. */
export function classDeclared(source, selector) {
  if (typeof source !== 'string') return false;
  const className = selector.replace(/^\./, '');
  return source.includes(selector) || source.includes(`'${className}'`) || source.includes(`"${className}"`);
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

/**
 * True when `source` sets a `data-*` attribute, either as markup, through
 * `setAttribute`, or through the `dataset` property.
 *
 * The three spellings are the same DOM attribute: `data-diagnostics-repair`
 * is what `node.dataset.diagnosticsRepair = …` produces, so a suite asserting
 * the attribute must accept whichever spelling the module happens to use.
 */
export function dataAttributeDeclared(source, attribute) {
  if (typeof source !== 'string') return false;
  const name = String(attribute).replace(/^data-/, '');
  if (!name || !/^[a-z0-9-]+$/.test(name)) return false;
  const camel = name.replace(/-([a-z0-9])/g, (_match, char) => char.toUpperCase());
  return source.includes(`data-${name}`)
    || source.includes(`setAttribute('data-${name}'`)
    || source.includes(`setAttribute("data-${name}"`)
    || new RegExp(`dataset\\.${camel}\\b`).test(source)
    || source.includes(`dataset['${name}']`)
    || source.includes(`dataset["${name}"]`);
}

export function assertDataAttributeDeclared(source, attribute, label = attribute) {
  assert.ok(dataAttributeDeclared(source, attribute), label);
}

/**
 * True when `source` declares `name` as a bounded constant with `limit`,
 * either directly or through one alias hop.
 *
 * `const MAX_FILE = 1000000; const MAX_BYTES = MAX_FILE;` states the same
 * bound as a single literal, so a suite asserting the bound should not have to
 * know which of the two names carries the number.
 */
export function boundDeclared(source, name, limit) {
  if (typeof source !== 'string') return false;
  const number = String(limit);
  const grouped = number.replace(/\B(?=(\d{3})+(?!\d))/g, '_');
  const literal = `(?:${number}|${grouped})`;
  if (new RegExp(`\\b${name}\\s*[=:]\\s*${literal}\\b`).test(source)) return true;
  const alias = new RegExp(`\\b${name}\\s*[=:]\\s*([A-Za-z_$][\\w$]*)\\b`).exec(source);
  if (!alias) return false;
  return new RegExp(`\\b${alias[1]}\\s*[=:]\\s*${literal}\\b`).test(source);
}

export function assertBoundDeclared(source, name, limit, label = `${name} = ${limit}`) {
  assert.ok(boundDeclared(source, name, limit), label);
}

/**
 * Source text of one function, from its `function <name>` declaration to the
 * matching closing brace.
 *
 * Slicing "from function A to function B" breaks the moment a function is
 * inserted between the two, silently widening the slice to cover unrelated
 * code — a read-only contract asserted that way starts failing on a write in
 * a neighbouring function. Brace matching keeps the slice exact.
 */
export function functionSource(source, name) {
  if (typeof source !== 'string') return '';
  const start = new RegExp(`(?:^|[^\\w$])(?:async\\s+)?function\\s+${name}\\s*\\(`, 'm').exec(source);
  if (!start) return '';
  const from = start.index + start[0].indexOf('function');
  const open = source.indexOf('{', from);
  if (open < 0) return '';
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(from, index + 1);
    }
  }
  return '';
}

export function assertFunctionSource(source, name) {
  const body = functionSource(source, name);
  assert.ok(body, `function ${name} is declared`);
  return body;
}

/**
 * True when `source` declares `name` as a callable, in any of the spellings
 * used across this codebase.
 *
 * The TypeScript migration turned inner `function x() {}` declarations into
 * `const x = (…) => …` bindings without changing behaviour, so a suite
 * asserting "this function exists" must not depend on which form was kept.
 */
export function functionDeclared(source, name) {
  if (typeof source !== 'string') return false;
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?:^|[^\\w$.])(?:(?:async\\s+)?function\\s*\\*?\\s*${escaped}\\s*[(<]`
    + `|(?:const|let|var)\\s+${escaped}\\s*(?::[^=;\\n]+)?=\\s*(?:async\\s*)?(?:function\\b|[(<]|[\\w$]+\\s*=>)`
    + `|${escaped}\\s*[(:]\\s*(?:async\\s*)?(?:function\\b|\\([^)]*\\)\\s*(?::[^=>;\\n]+)?=>))`,
    'm'
  ).test(source);
}

export function assertFunctionDeclared(source, name, label = `function ${name} is declared`) {
  assert.ok(functionDeclared(source, name), label);
}

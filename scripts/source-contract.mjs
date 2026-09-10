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

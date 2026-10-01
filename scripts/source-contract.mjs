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
 * True when `source` declares a function called `name`, in any of the forms the
 * codebase uses.
 *
 * The TypeScript migration rewrote `function openFor(prompt) {` as
 * `const openFor = (prompt: PromptRecord): void => {`, which changed no
 * behaviour but broke every suite that matched the `function` keyword. What a
 * contract suite means by "the module still has this function" is the binding,
 * not the syntax that introduces it.
 */
export function functionDeclared(source, name) {
  if (typeof source !== 'string' || !name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?:^|[^\\w.])(?:`
    + `(?:async\\s+)?function\\s*\\*?\\s*${escaped}\\s*[(<]`         // function f(   /  function f<T>(
    + `|(?:const|let|var)\\s+${escaped}\\s*(?::[^=;]+)?=\\s*`           // const f = …
    + `(?:async\\s*)?(?:function|\\(|<|[\\w$]+\\s*=>)`                 //   … arrow or function expression
    + `|${escaped}\\s*[(<][^)]*\\)\\s*(?::[^{;]+)?\\{`                 // method shorthand / object member
    + `)`,
    'm'
  ).test(source);
}

export function assertFunctionDeclared(source, name, label = `function ${name}`) {
  assert.ok(functionDeclared(source, name), label);
}

/**
 * True when `source` returns focus to a remembered element.
 *
 * Returning focus to whatever opened a dialog is an accessibility contract, but
 * it can be written as `lastFocus?.focus?.()` or as an
 * `instanceof HTMLElement` guard followed by `.focus()`. Both satisfy it.
 */
export function focusRestored(source, binding) {
  if (typeof source !== 'string' || !binding) return false;
  const escaped = binding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\??\\.\\s*focus\\s*\\??\\.?\\s*\\(`).test(source)
    || new RegExp(`${escaped}\\s+instanceof\\s+HTMLElement\\)\\s*${escaped}\\.focus\\(`).test(source);
}

export function assertFocusRestored(source, binding, label = `focus returns to ${binding}`) {
  assert.ok(focusRestored(source, binding), label);
}

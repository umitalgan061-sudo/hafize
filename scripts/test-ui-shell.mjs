import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const shell = require('../public/ui-shell.js');

assert.equal(shell.resolveTheme('dark', false), 'dark');
assert.equal(shell.resolveTheme('light', true), 'light');
assert.equal(shell.resolveTheme(null, true), 'dark');
assert.equal(shell.resolveTheme('system', false), 'light');
assert.deepEqual(shell.WEEKDAYS, ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']);

const may2025 = shell.createMonthCells(2025, 4, 15);
assert.equal(may2025.length, 42);
assert.deepEqual(may2025.slice(0, 4).map(({ day, outside }) => [day, outside]), [
  [28, true], [29, true], [30, true], [1, false]
]);
assert.equal(may2025.filter((cell) => cell.selected).length, 1);
assert.equal(may2025.find((cell) => cell.selected)?.day, 15);
assert.equal(may2025[0].year, 2025);
assert.equal(may2025[0].month, 3);
assert.equal(may2025[41].day, 8);
assert.equal(may2025[41].month, 5);

const feb2024 = shell.createMonthCells(2024, 1, 29);
assert.equal(feb2024.some((cell) => cell.day === 29 && !cell.outside && cell.selected), true);

console.log('UI shell OK: theme resolution and Monday-first 42-cell Turkish calendar contract verified');

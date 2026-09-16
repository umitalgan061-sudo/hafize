import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const readme=await readFile(new URL('../README.md',import.meta.url),'utf8');
for(const token of ['/api/schedules/:id` PATCH/DELETE','+15 dk','+1 saat','Tekrar planla','Seçilen görevlerde']) assert.ok(readme.includes(token),`README missing ${token}`);
console.log('scheduled task edit README contract ok');

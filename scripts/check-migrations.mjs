#!/usr/bin/env node
/**
 * Migration sanity check (CI gate). Migrations are hand-authored SQL in scripts/.
 * This doesn't apply them — it catches the cheap mistakes that would otherwise
 * fail at apply time: empty files, leftover merge-conflict markers, and DDL/DML
 * with no statement terminator. Exits non-zero on any problem.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'scripts';
const sqlFiles = readdirSync(dir).filter((f) => f.endsWith('.sql'));

const problems = [];
for (const f of sqlFiles) {
  const sql = readFileSync(join(dir, f), 'utf8');
  if (sql.trim().length === 0) problems.push(`${f}: empty`);
  if (/^(<{7}|={7}|>{7})/m.test(sql)) problems.push(`${f}: merge-conflict marker`);
  if (/\b(create|alter|insert|update)\b/i.test(sql) && !sql.includes(';')) {
    problems.push(`${f}: has DDL/DML but no ';' terminator`);
  }
}

if (problems.length > 0) {
  console.error(`✗ migration check failed (${problems.length}):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`✓ ${sqlFiles.length} SQL migration files OK`);
process.exit(0);

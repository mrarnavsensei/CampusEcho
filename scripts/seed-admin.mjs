#!/usr/bin/env node
// Usage: node scripts/seed-admin.mjs <email> <password> [displayName] [role]
// Role options: super_admin | moderator | event_manager | support_admin (default: super_admin)

import { webcrypto } from 'node:crypto';
import { randomUUID } from 'node:crypto';

import { readFileSync } from 'node:fs';

const input = process.argv.slice(2);
const fromStdin = input[0] === '--password-stdin';
const [email, argumentPassword, argumentName, argumentRole] = fromStdin ? input.slice(1) : input;
const password = fromStdin ? readFileSync(0, 'utf8').replace(/\r?\n$/, '') : argumentPassword;
const displayName = (fromStdin ? argumentPassword : argumentName) || 'Super Admin';
const role = (fromStdin ? argumentName : argumentRole) || 'super_admin';

if (!email || !password) {
  console.error('Usage: node scripts/seed-admin.mjs --password-stdin <email> [displayName] [role]');
  console.error('Supply the password on stdin; SQL is printed, never executed. See docs/LAUNCH-TOOLING.md.');
  process.exit(1);
}

if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email.trim()) || email.length > 254 || password.length < 12 || password.length > 256 || !/^[\p{L}\p{N} ._-]{1,80}$/u.test(displayName)) {
  console.error('Use a valid email, a 12–256 character password, and a simple display name (letters, numbers, spaces, dot, underscore, hyphen).');
  process.exit(1);
}

const VALID_ROLES = ['super_admin', 'moderator', 'event_manager', 'support_admin'];
if (!VALID_ROLES.includes(role)) {
  console.error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
  process.exit(1);
}

async function hashPassword(plain) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(plain),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const hashBuffer = await webcrypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const toHex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:sha256:600000:${toHex(salt)}:${toHex(hashBuffer)}`;
}

const hash = await hashPassword(password);
const id = randomUUID();
const now = Date.now();

const sql = `INSERT INTO admin_accounts (id, email, password_hash, display_name, role, status, created_at, updated_at)
VALUES ('${id}', '${email.trim().toLowerCase()}', '${hash}', '${displayName.replace(/'/g, "''")}', '${role}', 'active', ${now}, ${now});`;

console.log(sql);
console.error('SQL generated only. Review and apply it using the actual environment database name and deployment configuration. Never use wrangler.migrations.jsonc remotely.');
if (!fromStdin) console.error('Prefer --password-stdin to keep passwords out of command arguments and shell history.');

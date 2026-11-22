// Usage: node scripts/hash-password.mjs "your password"
import { scryptSync, randomBytes } from "crypto";
const pw = process.argv[2];
if (!pw) { console.error('Usage: node scripts/hash-password.mjs "password"'); process.exit(1); }
const salt = randomBytes(16).toString("hex");
console.log(`ADMIN_PASSWORD_HASH='scrypt:${salt}:${scryptSync(pw, salt, 32).toString("hex")}'`);

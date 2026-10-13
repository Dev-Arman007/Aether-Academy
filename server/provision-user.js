import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '.env') });
const { PROVISION_NAME: name, PROVISION_EMAIL: email, PROVISION_PASSWORD: password, PROVISION_ROLE: role = 'admin' } = process.env;
if (!name || name.trim().length < 2 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12 || !['admin', 'faculty', 'parent'].includes(role)) {
  console.error('Set PROVISION_NAME, PROVISION_EMAIL, PROVISION_PASSWORD (12+ chars), PROVISION_ROLE (admin|faculty|parent), and MONGODB_URI in server/.env or the shell environment.');
  process.exit(1);
}
if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is required.'); process.exit(1); }

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'faculty', 'admin', 'parent'], default: 'student' },
  active: { type: Boolean, default: true },
}, { timestamps: true });
const User = mongoose.model('User', userSchema);
try {
  await mongoose.connect(process.env.MONGODB_URI);
  const existing = await User.findOne({ email: email.trim().toLowerCase() });
  if (existing) throw new Error('An account already exists for this email; the provision command never overwrites accounts.');
  const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), passwordHash: await bcrypt.hash(password, 12), role });
  console.log(`Created ${role} account ${user.email} (${user.id}). Remove PROVISION_PASSWORD from the environment now.`);
} catch (error) {
  const message = error instanceof Error && error.message.includes('An account already exists')
    ? error.message
    : `Could not provision account (${error?.name || 'error'}).`;
  console.error(message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

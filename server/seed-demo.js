import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
dotenv.config({ path: path.join(here, '.env') });
const credentialPath = path.join(root, '.demo-credentials.txt');
const teacherEmail = 'demo.teacher@example.test';
const studentEmail = 'demo.student@example.test';
const className = 'DEMO · Grade 8 Mathematics';

if (process.env.NODE_ENV === 'production') throw new Error('Demo seeding is disabled in production.');
if (process.env.DEMO_SEED !== 'true') throw new Error('Set DEMO_SEED=true to confirm you want to add demo accounts and sample records to the configured database.');
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing from server/.env.');

const userSchema = new mongoose.Schema({ name: String, email: { type: String, unique: true }, passwordHash: String, role: String, active: { type: Boolean, default: true } }, { timestamps: true });
const classSchema = new mongoose.Schema({ name: String, subject: String, teacher: mongoose.Schema.Types.ObjectId, students: [mongoose.Schema.Types.ObjectId] }, { timestamps: true });
const attendanceSchema = new mongoose.Schema({ class: mongoose.Schema.Types.ObjectId, student: mongoose.Schema.Types.ObjectId, date: Date, status: String, markedBy: mongoose.Schema.Types.ObjectId }, { timestamps: true });
const assignmentSchema = new mongoose.Schema({ class: mongoose.Schema.Types.ObjectId, title: String, instructions: String, dueAt: Date, createdBy: mongoose.Schema.Types.ObjectId, submissions: [{ student: mongoose.Schema.Types.ObjectId, text: String, submittedAt: Date }] }, { timestamps: true });
const User = mongoose.model('User', userSchema);
const SchoolClass = mongoose.model('Class', classSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Assignment = mongoose.model('Assignment', assignmentSchema);

function password() { return `Demo-${randomBytes(18).toString('base64url')}!`; }
async function main() {
  let savedCredentials;
  try { savedCredentials = JSON.parse(await readFile(credentialPath, 'utf8')); } catch { savedCredentials = null; }
  const existing = await User.find({ email: { $in: [teacherEmail, studentEmail] } }).select('email role').lean();
  if (existing.length && !savedCredentials) throw new Error('A demo account already exists but the local demo credential file is missing. Refusing to reset any password.');
  for (const user of existing) {
    const expected = user.email === teacherEmail ? 'faculty' : 'student';
    if (user.role !== expected) throw new Error(`The demo address ${user.email} is already used by a different account role. No accounts were changed.`);
  }
  const credentials = savedCredentials || { teacherPassword: password(), studentPassword: password() };
  const accounts = [
    { email: teacherEmail, name: 'Demo Teacher', role: 'faculty', password: credentials.teacherPassword },
    { email: studentEmail, name: 'Demo Student', role: 'student', password: credentials.studentPassword },
  ];
  const people = {};
  for (const account of accounts) {
    let person = await User.findOne({ email: account.email });
    if (!person) person = await User.create({ name: account.name, email: account.email, passwordHash: await bcrypt.hash(account.password, 12), role: account.role, active: true });
    people[account.role] = person;
  }
  let room = await SchoolClass.findOne({ name: className, teacher: people.faculty._id });
  if (!room) room = await SchoolClass.create({ name: className, subject: 'Mathematics', teacher: people.faculty._id, students: [people.student._id] });
  else if (!room.students.some((id) => String(id) === String(people.student._id))) { room.students.push(people.student._id); await room.save(); }
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  await Attendance.findOneAndUpdate({ class: room._id, student: people.student._id, date: today }, { $set: { status: 'present', markedBy: people.faculty._id } }, { upsert: true, new: true });
  const assignmentTitle = 'DEMO · Fractions practice';
  const dueAt = new Date(); dueAt.setDate(dueAt.getDate() + 7);
  await Assignment.findOneAndUpdate({ class: room._id, title: assignmentTitle }, { $setOnInsert: { class: room._id, title: assignmentTitle, instructions: 'Explain one method for adding fractions with unlike denominators. This sample assignment is for the live dashboard demo.', dueAt, createdBy: people.faculty._id } }, { upsert: true, new: true });
  await writeFile(credentialPath, [
    'Aether Academy local demo accounts (synthetic data; do not use in production)',
    `Teacher: ${teacherEmail}`,
    `Teacher password: ${credentials.teacherPassword}`,
    `Student: ${studentEmail}`,
    `Student password: ${credentials.studentPassword}`,
    `Class: ${className}`,
  ].join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
  console.log(`Demo data is ready. Credentials are saved in ${credentialPath}`);
  console.log(`Created or reused ${teacherEmail} and ${studentEmail}; enrolled the student in ${className}.`);
}

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await main();
} finally {
  await mongoose.disconnect();
}

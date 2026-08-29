import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { badRequest, unauthorized } from '../../lib/errors.js';

const SALT_ROUNDS = 10;

export const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  department: u.department,
  isOnCall: u.isOnCall,
  isActive: u.isActive,
  createdAt: u.createdAt,
});

export async function registerUser({ email, password, name, department }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw badRequest('An account with that email already exists');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  // Public self-registration is always an END_USER. Elevated roles are granted by an admin.
  return prisma.user.create({
    data: { email, passwordHash, name, department, role: 'END_USER' },
  });
}

export async function verifyCredentials({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw unauthorized('Invalid email or password');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw unauthorized('Invalid email or password');
  return user;
}

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

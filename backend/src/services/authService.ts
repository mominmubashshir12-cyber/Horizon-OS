// Auth service — encapsulates authentication logic (password hashing, token generation, user lookup).

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { TokenPayload, UserRole } from '../types';

const SALT_ROUNDS = 12;

/**
 * Hashes a plain-text password with bcrypt.
 */
export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(plainText, salt);
}

/**
 * Compares a plain-text password against a bcrypt hash.
 */
export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

/**
 * Generates a signed JWT access token.
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/**
 * Generates a signed JWT refresh token.
 */
export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn });
}

/**
 * Looks up a user by username and returns the full record (including passwordHash).
 * Returns null if not found.
 */
export async function findUserByUsername(username: string) {
  return prisma.user.findUnique({ where: { username } });
}

/**
 * Builds a TokenPayload from a user record.
 */
export function buildTokenPayload(user: {
  id: number;
  username: string;
  role: string;
  firmId: number;
}): TokenPayload {
  return {
    userId: user.id,
    username: user.username,
    role: user.role as UserRole,
    firmId: user.firmId,
  };
}

// TODO: Implement token blacklisting for logout
// TODO: Implement password-reset flow
// TODO: Implement account lockout after N failed attempts

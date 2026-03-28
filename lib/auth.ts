import { jwtVerify, SignJWT } from 'jose';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'pulse-dev-secret-key-min-32-chars-long-2026'
);

const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '7d';
const SESSION_WARNING_MINUTES = 5;

/**
 * Hash a plaintext password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verify a plaintext password against a bcrypt hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a JWT access token (short-lived, 1 hour)
 */
export async function createToken(
  userId: string,
  email: string
): Promise<string> {
  const token = await new SignJWT({
    userId,
    email,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);

  return token;
}

/**
 * Create a JWT refresh token (long-lived, 7 days)
 */
export async function createRefreshToken(
  userId: string,
  email: string
): Promise<string> {
  const token = await new SignJWT({
    userId,
    email,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify and decode a JWT token.
 * Returns payload with remaining time info for session timeout warning.
 */
export async function verifyToken(
  token: string
): Promise<{
  userId: string;
  email: string;
  type?: string;
  expiresAt?: number;
  warningActive?: boolean;
} | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    const exp = verified.payload.exp as number | undefined;
    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = exp ? exp - now : Infinity;
    const warningThreshold = SESSION_WARNING_MINUTES * 60;

    return {
      userId: verified.payload.userId as string,
      email: verified.payload.email as string,
      type: (verified.payload.type as string) || 'access',
      expiresAt: exp,
      warningActive: remainingSeconds <= warningThreshold && remainingSeconds > 0,
    };
  } catch {
    return null;
  }
}

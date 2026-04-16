import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { findValidResetToken, markResetTokenUsed, updateUserPassword } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'pulse-dev-secret-key-min-32-chars-long-2026'
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and new password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    // Verify the JWT token
    let payload;
    try {
      const verified = await jwtVerify(token, JWT_SECRET);
      payload = verified.payload;
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired reset link. Please request a new one.' },
        { status: 400 }
      );
    }

    if (payload.type !== 'password_reset' || !payload.tokenId || !payload.userId) {
      return NextResponse.json(
        { error: 'Invalid reset token.' },
        { status: 400 }
      );
    }

    // Check token in database (not used, not expired)
    const resetRecord = await findValidResetToken(payload.tokenId as string);
    if (!resetRecord) {
      return NextResponse.json(
        { error: 'This reset link has already been used or has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Hash new password and update user
    const hashedPassword = await hashPassword(password);
    const updatedUser = await updateUserPassword(payload.userId as string, hashedPassword);

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'User account not found.' },
        { status: 404 }
      );
    }

    // Mark token as used
    await markResetTokenUsed(payload.tokenId as string);

    return NextResponse.json(
      { success: true, message: 'Password has been reset successfully.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[PRISM] Reset password error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

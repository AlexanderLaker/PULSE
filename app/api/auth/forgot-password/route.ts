import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, createPasswordResetToken } from '@/lib/db';
import { SignJWT } from 'jose';
import crypto from 'crypto';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'pulse-dev-secret-key-min-32-chars-long-2026'
);

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const RESET_TOKEN_EXPIRY_HOURS = 1;

async function sendResetEmail(email: string, resetUrl: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[PRISM] No RESEND_API_KEY configured — reset email not sent');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [email],
        subject: 'PRISM — Reset Your Password',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="font-size: 20px; font-weight: 700; color: #1D1D1F; margin-bottom: 16px;">Reset your password</h2>
            <p style="font-size: 14px; color: #6E6E73; line-height: 1.6; margin-bottom: 24px;">
              We received a request to reset your PRISM account password. Click the button below to set a new password. This link expires in ${RESET_TOKEN_EXPIRY_HOURS} hour.
            </p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background: #1D1D1F; color: #fff; text-decoration: none; border-radius: 999px; font-size: 14px; font-weight: 600;">
              Reset Password
            </a>
            <p style="font-size: 12px; color: #AEAEB2; line-height: 1.6; margin-top: 32px;">
              If you didn't request this, you can safely ignore this email. Your password will not be changed.
            </p>
            <hr style="border: none; border-top: 1px solid #E5E5E7; margin: 32px 0 16px;" />
            <p style="font-size: 11px; color: #AEAEB2;">PRISM Profit Pool Shift Model</p>
          </div>
        `,
      }),
    });

    return response.ok;
  } catch (err) {
    console.error('[PRISM] Failed to send reset email:', err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Always return success to prevent email enumeration attacks
    const successResponse = NextResponse.json(
      { success: true, message: 'If an account exists with this email, a reset link has been sent.' },
      { status: 200 }
    );

    // Look up user
    const user = await findUserByEmail(email);
    if (!user) {
      // Return success anyway (anti-enumeration)
      return successResponse;
    }

    // Generate a secure reset token
    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Create a JWT reset token that embeds the tokenId
    const resetJwt = await new SignJWT({
      tokenId,
      userId: user.id,
      email: user.email,
      type: 'password_reset',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${RESET_TOKEN_EXPIRY_HOURS}h`)
      .sign(JWT_SECRET);

    // Store in DB
    await createPasswordResetToken(user.id, tokenId, expiresAt);

    // Build reset URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${resetJwt}`;

    // Send email
    await sendResetEmail(user.email, resetUrl);

    return successResponse;
  } catch (error) {
    console.error('[PRISM] Forgot password error:', error);
    // Still return success to prevent enumeration
    return NextResponse.json(
      { success: true, message: 'If an account exists with this email, a reset link has been sent.' },
      { status: 200 }
    );
  }
}

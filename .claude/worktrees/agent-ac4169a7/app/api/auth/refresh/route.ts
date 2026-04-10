import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, createToken, createRefreshToken } from '@/lib/auth';

export async function POST() {
  try {
    const cookieStore = cookies();
    const refreshToken = cookieStore.get('pulse-refresh-token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token provided' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(refreshToken);
    if (!payload || payload.type !== 'refresh') {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }

    // Issue new access token
    const newAccessToken = await createToken(payload.userId, payload.email);
    // Optionally rotate refresh token
    const newRefreshToken = await createRefreshToken(payload.userId, payload.email);

    const response = NextResponse.json({
      success: true,
      user: { id: payload.userId, email: payload.email },
    });

    // Set new access token cookie (1 hour)
    response.cookies.set('pulse-token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60, // 1 hour
    });

    // Set new refresh token cookie (7 days)
    response.cookies.set('pulse-refresh-token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}

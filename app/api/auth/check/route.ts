import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Get token from cookies
    const token = request.cookies.get('pulse-token')?.value;

    if (!token) {
      return NextResponse.json(
        { authenticated: false },
        { status: 200 }
      );
    }

    // Verify token
    const decoded = await verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { authenticated: false },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: decoded.userId,
          email: decoded.email,
        },
        session: {
          expiresAt: decoded.expiresAt,
          warningActive: decoded.warningActive,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message, authenticated: false },
      { status: 200 }
    );
  }
}

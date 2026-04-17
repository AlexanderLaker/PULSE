import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, createUser } from '@/lib/db';
import { createToken, createRefreshToken, hashPassword } from '@/lib/auth';

const ACCESS_KEYWORD = process.env.PRISM_ACCESS_KEYWORD || 'PRISM2026';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, password, keyword } = body;

    // Validate keyword first
    if (!keyword || keyword.trim() !== ACCESS_KEYWORD) {
      return NextResponse.json(
        { error: 'Invalid access keyword.' },
        { status: 403 }
      );
    }

    // Validate input
    if (!email || !name || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: email, name, password' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password length (8 chars minimum)
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Validate name
    if (name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name cannot be empty' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password and create user in Neon DB
    const hashedPw = await hashPassword(password);
    const user = await createUser(email, hashedPw, name);

    // Create tokens
    const token = await createToken(user.id, user.email, user.role);
    const refreshToken = await createRefreshToken(user.id, user.email, user.role);

    // Create response with cookie
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    );

    // Set access token cookie (1 hour)
    response.cookies.set('pulse-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });

    // Set refresh token cookie (7 days)
    response.cookies.set('pulse-refresh-token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

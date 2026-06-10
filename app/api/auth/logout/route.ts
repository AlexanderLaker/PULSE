/** Legacy custom-auth route — superseded by Clerk (2026-06 cleanup).
 * Stubbed to 410 Gone; real tree has no such file. */
import { NextResponse } from 'next/server';
const gone = () => NextResponse.json({ error: 'Gone — auth moved to Clerk (/sign-in)' }, { status: 410 });
export const GET = gone; export const POST = gone; export const PUT = gone; export const DELETE = gone;

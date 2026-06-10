/** Legacy auth page — superseded by Clerk (2026-06 cleanup). */
import { redirect } from 'next/navigation';
export default function Page() { redirect('/sign-in'); }

/**
 * PUT /api/journey: an admin saves the Consumer Journey tile map.
 *
 * Forwarded to PUT /api/v1/journey with an admin token (lib/backend.ts). The
 * dashboard reads the stored content from GET /api/v1/journey directly.
 */
import { forwardAdminWrite } from '@/lib/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: Request) {
  return forwardAdminWrite(req, '/api/v1/journey', (body) =>
    Array.isArray(body.lhc) && Array.isArray(body.hair) ? null : 'The body must hold the lhc and hair journeys as arrays',
  );
}

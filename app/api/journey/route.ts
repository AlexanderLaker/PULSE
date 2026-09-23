/**
 * PUT /api/journey: an admin saves the Consumer Journey tile map.
 *
 * Body: {base_version, content: {lhc, hair}}, where base_version is the stored
 * version the edit started from. Forwarded to PUT /api/v1/journey with an
 * admin token (lib/adminWrite.ts), which checks the whole shape and answers 409
 * when someone saved in the meantime. The dashboard reads the stored content
 * from GET /api/v1/journey directly.
 */
import { forwardAdminWrite } from '@/lib/adminWrite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: Request) {
  return forwardAdminWrite(req, '/api/v1/journey', (body) => {
    const content = body.content as Record<string, unknown> | undefined;
    if (!Number.isInteger(body.base_version) || (body.base_version as number) < 0) {
      return 'base_version must be the stored version the edit started from (0 for the bundled content)';
    }
    return content && Array.isArray(content.lhc) && Array.isArray(content.hair)
      ? null
      : 'content must hold the lhc and hair journeys as arrays';
  });
}

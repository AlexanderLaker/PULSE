/**
 * PUT /api/drivers/{id}: an admin edits a driver.
 *
 * Forwarded to PUT /api/v1/drivers/{id} with an admin token (lib/adminWrite.ts).
 * Reads and expert proposals need no route here: they go to /api/v1 directly
 * with the viewer cookie.
 */
import { forwardAdminWrite } from '@/lib/adminWrite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardAdminWrite(req, `/api/v1/drivers/${encodeURIComponent(id)}`);
}

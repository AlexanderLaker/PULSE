'use client';

/**
 * A banner under the navigation while the service answers but its database
 * cannot be used: during the one-time schema migration, on a deployment
 * without a database URL, or when the database cannot be reached. The views
 * below it then show their empty states; this says why, once, for all of them.
 */
import type { FC } from 'react';
import { AlertTriangle } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import { S, HEADLINE_FONT } from '@/lib/theme';
import type { DatabaseFailure } from '@/types';

export const SERVICE_NOTICES: Record<DatabaseFailure, string> = {
  legacy_schema:
    'PRISM is being updated: its database is moving to the current schema. The drivers and the run return as soon as the update has finished.',
  no_database:
    'This deployment has no database configured, so there is nothing to show. An administrator sets DATABASE_URL in the Vercel project settings.',
  db_error:
    'The database cannot be reached right now. PRISM keeps trying and reloads by itself once it answers.',
};

const ServiceNotice: FC = () => {
  const { databaseFailure } = usePrism();
  if (!databaseFailure) return null;
  return (
    <div role="status" style={{ backgroundColor: S.amberContainer, color: S.onAmberContainer }}>
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-2.5 flex items-start gap-2.5 text-[13px]" style={{ lineHeight: 1.5 }}>
        <AlertTriangle size={15} strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 2 }} />
        <span><strong style={{ fontFamily: HEADLINE_FONT }}>Service notice.</strong> {SERVICE_NOTICES[databaseFailure]}</span>
      </div>
    </div>
  );
};

export default ServiceNotice;

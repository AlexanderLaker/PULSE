'use client';

/**
 * A banner under the navigation while the service answers but its database
 * cannot be used: while it awaits a schema migration, on a deployment
 * without a database URL, when a database in use has lost its drivers, or
 * when the database cannot be reached. The views
 * below keep what they last loaded (on a first visit they have nothing to
 * show); this says why, once, for all of them.
 */
import type { FC } from 'react';
import { AlertTriangle } from 'lucide-react';
import usePrism from '@/hooks/usePrism';
import { S, HEADLINE_FONT, FIGURES } from '@/lib/theme';
import type { DatabaseFailure } from '@/types';

/** What every reader is told. */
export const SERVICE_NOTICES: Record<DatabaseFailure, string> = {
  migration_pending:
    'PRISM is being updated: its database is moving to the current schema. The dashboard loads the drivers and the run again by itself as soon as the update has finished.',
  no_database:
    'PRISM has no data to show yet: this deployment has no database configured.',
  drivers_missing:
    'The database holds earlier runs or driver edits but no drivers, so its drivers were lost. An administrator restores the database from its backup, and PRISM reloads by itself once that is done.',
  db_error:
    'The database cannot be reached right now. PRISM keeps trying and reloads by itself once it answers.',
};

const CODE = { ...FIGURES, fontSize: '0.95em' };

const ServiceNotice: FC = () => {
  const { databaseFailure } = usePrism();
  if (!databaseFailure) return null;
  return (
    <div role="status" style={{ backgroundColor: S.amberContainer, color: S.onAmberContainer }}>
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-2.5 flex items-start gap-2.5 text-[13px]" style={{ lineHeight: 1.5 }}>
        <AlertTriangle size={15} strokeWidth={2.4} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
        <div className="min-w-0">
          <span><strong style={{ fontFamily: HEADLINE_FONT }}>Service notice.</strong> {SERVICE_NOTICES[databaseFailure]}</span>
          {/* The banner does not know the reader's role, so what the
              administrator does about it is folded away for whoever can act. */}
          {databaseFailure === 'no_database' && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[12px] font-semibold" style={{ fontFamily: HEADLINE_FONT }}>
                For the administrator
              </summary>
              <p className="mt-1 text-[12px]">
                Set <code style={CODE}>DATABASE_URL</code> in the Vercel project settings to the Neon database the
                production runs write to, then redeploy.
              </p>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceNotice;

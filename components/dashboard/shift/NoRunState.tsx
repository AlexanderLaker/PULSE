/**
 * What the page shows when there is no run to show, and why: the service's
 * own diagnosis in plain words for viewers and in operational terms for
 * admins.
 */
import React, { type FC } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { NO_VALUE } from '@/lib/format';
import { S, SHADOW, HEADLINE_FONT, MONO_FONT } from '@/lib/theme';
import type { DiagnosticsResult } from '@/types';

/** Why the page has no run to show. */
type NoRunReason = 'unreachable' | 'migrating' | 'not_configured' | 'db_unreachable' | 'unservable' | 'no_run';

/** The reason from the service's diagnosis; undefined while the diagnosis is still loading. */
export function noRunReason(
  apiAvailable: boolean, diagnostics: DiagnosticsResult | null | undefined,
): NoRunReason | undefined {
  if (!apiAvailable || diagnostics === null) return 'unreachable';
  if (diagnostics === undefined) return undefined;
  if (diagnostics.simulation_reason === 'migration_pending') return 'migrating';
  if (diagnostics.simulation_reason === 'no_database') return 'not_configured';
  if (!diagnostics.db_reachable || diagnostics.simulation_reason === 'db_error') return 'db_unreachable';
  if (diagnostics.simulation_reason === 'malformed') return 'unservable';
  if (diagnostics.simulation_reason === 'no_rows') return 'no_run';
  // "ok": the service holds a run, but the dashboard's request for it failed.
  return 'unreachable';
}

/** Viewers get plain titles; admins, who can act on it, the operational one. */
const NO_RUN_TITLE: Record<NoRunReason, { viewer: string; admin: string }> = {
  unreachable:    { viewer: 'Results unavailable right now', admin: 'The run cannot be loaded' },
  migrating:      { viewer: 'PRISM is being updated', admin: 'The database awaits a migration' },
  not_configured: { viewer: 'Data connection issue', admin: 'No database configured' },
  db_unreachable: { viewer: 'Data connection issue', admin: 'The API cannot reach the database' },
  unservable:     { viewer: 'Latest run needs a refresh', admin: 'Latest run cannot be served' },
  no_run:         { viewer: 'No simulation available yet', admin: 'No run stored yet' },
};

const CODE: React.CSSProperties = { fontFamily: MONO_FONT, fontSize: '0.92em' };

export const NoRunState: FC<{
  reason: NoRunReason;
  isAdmin: boolean;
  diagnostics: DiagnosticsResult | null | undefined;
  /** Why the dashboard's own request for the run failed, when it did. */
  requestError: string | null;
  /** Loads everything again; offered wherever something failed. */
  onRetry: () => void;
}> = ({ reason, isAdmin, diagnostics, requestError, onRetry }) => {
  const problem = reason !== 'no_run';
  const Icon = problem ? AlertTriangle : Info;
  return (
    <div
      className="flex flex-col items-center justify-center py-20 px-8 text-center rounded-2xl"
      style={{ backgroundColor: S.surface, boxShadow: SHADOW.card }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{
          backgroundColor: problem ? S.errorContainer : S.primaryContainer,
          color: problem ? S.error : S.primary,
        }}
      >
        <Icon size={22} />
      </div>
      <h3
        className="text-[20px] font-extrabold mb-2"
        style={{ fontFamily: HEADLINE_FONT, color: S.onSurface }}
      >
        {NO_RUN_TITLE[reason][isAdmin ? 'admin' : 'viewer']}
      </h3>
      <div
        className="max-w-xl text-[14px] space-y-3"
        style={{ color: S.onSurfaceVariant, lineHeight: 1.5 }}
      >
        {!isAdmin ? (
          <p>
            {reason === 'no_run'
              ? 'No simulation run has been published yet. Results appear here automatically as soon as the PRISM team publishes the first run.'
              : reason === 'migrating'
                ? 'PRISM’s database is moving to the current schema. The results return here as soon as the update has finished.'
                : 'The results cannot be loaded right now. Please check back shortly; if this persists, contact the PRISM team.'}
          </p>
        ) : reason === 'migrating' ? (
          <>
            <p>
              Until the migration has run, the API serves nothing and writes nothing; the run shows
              here once it has committed.
            </p>
            {diagnostics?.error && (
              <p style={{ fontFamily: MONO_FONT, fontSize: '12px', color: S.error }}>
                {diagnostics.error}
              </p>
            )}
          </>
        ) : reason === 'not_configured' ? (
          <p>
            This deployment has no <code style={CODE}>DATABASE_URL</code> (or{' '}
            <code style={CODE}>POSTGRES_URL</code>). Set it in the Vercel project settings to the Neon database
            the production runs write to, then redeploy.
          </p>
        ) : reason === 'unreachable' ? (
          <>
            <p>
              The dashboard gets no run from the PRISM API under{' '}
              <code style={CODE}>/api/v1</code>. Check that the Python service is deployed
              and answering, then reload the page.
            </p>
            {requestError && (
              <p style={{ fontFamily: MONO_FONT, fontSize: '12px', color: S.error }}>
                {requestError}
              </p>
            )}
          </>
        ) : reason === 'db_unreachable' ? (
          <>
            <p>
              The PRISM API answers but cannot query its database. Check that{' '}
              <code style={CODE}>POSTGRES_URL</code> (or <code style={CODE}>DATABASE_URL</code>) in the
              Vercel project settings points to the Neon database the production runs write to.
            </p>
            {diagnostics?.error && (
              <p style={{ fontFamily: MONO_FONT, fontSize: '12px', color: S.error }}>
                {diagnostics.error}
              </p>
            )}
            <p className="text-[12px]" style={{ color: S.onSurfaceVariant }}>
              The service&rsquo;s own read-out is at <code style={CODE}>/api/v1/diagnostics</code>;
              the function&rsquo;s log in Vercel names the kind of failure.
            </p>
          </>
        ) : reason === 'unservable' ? (
          <>
            <p>
              Run{' '}
              <strong style={{ color: S.onSurface }}>
                #{diagnostics?.latest_run_id ?? NO_VALUE}
              </strong>{' '}
              exists in the database but lacks part of what the dashboard reads.
            </p>
            {diagnostics?.error && (
              <p style={{ fontFamily: MONO_FONT, fontSize: '12px', color: S.error }}>
                {diagnostics.error}
              </p>
            )}
            <p>
              Run <code style={CODE}>python3 scripts/run_production.py</code> again to store a
              complete run.
            </p>
          </>
        ) : (
          <p>
            Runs are made offline by <code style={CODE}>python3 scripts/run_production.py</code>,
            which stores them in the database. Once one is stored, all four lenses (Time Path,
            Force, Value Chain and Region) fill in here.
          </p>
        )}
      </div>
      {problem && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 px-4 py-1.5 rounded-full text-[12px] font-semibold"
          style={{ backgroundColor: S.primary, color: S.onPrimary, border: 'none', cursor: 'pointer' }}
        >
          Try again
        </button>
      )}
    </div>
  );
};

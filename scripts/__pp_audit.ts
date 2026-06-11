/* Temporary numeric audit for profitPoolData v2 — run once, then delete. */
import {
  PROFIT_POOL_SLIDES, poolCagr, slidePoolSummary, itemGp1PoolEurBn, toPoolRating,
} from '../lib/profitPoolData';

let fail = 0;
for (const s of PROFIT_POOL_SLIDES) {
  const sum = s.items.reduce((a, it) => a + it.revenueShare, 0);
  if (Math.abs(sum - 1) > 0.015) { console.log(`SHARE SUM OFF: ${s.id} = ${sum.toFixed(3)}`); fail++; }
  const { gp1PoolNowEurBn, gp1PoolTerminalEurBn, weightedPoolCagr } = slidePoolSummary(s);
  console.log(`\n${s.id}  rev pool €${s.poolSizeEurBn}bn | GP1 pool €${gp1PoolNowEurBn.toFixed(1)} → €${gp1PoolTerminalEurBn.toFixed(1)}bn | weighted ${ (weightedPoolCagr*100).toFixed(2) }% p.a.`);
  for (const it of s.items) {
    const pc = poolCagr(it);
    const r = toPoolRating(pc);
    console.log(`  ${(it.label + ' ' + (it.sublabel ?? '')).padEnd(28)} rev ${(it.revenueCAGR*100).toFixed(1).padStart(5)}%  gp1Δ ${String(it.gp1DeltaBps).padStart(5)}bps  pool ${(pc*100).toFixed(2).padStart(6)}%  ${r.direction === 'flat' ? '↔' : (r.direction === 'up' ? '↑'.repeat(r.arrows) : '↓'.repeat(r.arrows))}  €${itemGp1PoolEurBn(s, it).toFixed(1)}bn`);
    if (!isFinite(pc)) { console.log('  NON-FINITE POOL CAGR'); fail++; }
  }
}
console.log(fail === 0 ? '\nAUDIT OK' : `\nAUDIT FAILURES: ${fail}`);

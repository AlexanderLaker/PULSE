/**
 * ConvergenceBadge — Shows MC simulation convergence diagnostics.
 */
import { FC } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

interface Convergence {
  r_hat?: number;
  rhat?: number;
  converged?: boolean;
}

interface SimulationData {
  convergence?: Convergence;
  iterations?: number;
}

interface ConvergenceBadgeProps {
  simulation?: SimulationData;
}

// ─── ConvergenceBadge ─────────────────────────────────────────────────────

const ConvergenceBadge: FC<ConvergenceBadgeProps> = ({ simulation }) => {
  if (!simulation?.convergence) return null;

  const conv = simulation.convergence;
  const rHat = conv.r_hat ?? conv.rhat;
  const converged = rHat ? rHat < 1.1 : conv.converged !== false;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium ${
        converged
          ? 'bg-expansion/12 text-expansion'
          : 'bg-warning/12 text-warning'
      }`}
    >
      {converged ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
      {converged ? 'MC stable (seed-checked)' : 'MC unstable — rerun advised'}
      {rHat != null && (
        <span className="font-mono opacity-70">R̂={rHat.toFixed(3)}</span>
      )}
      {simulation.iterations && (
        <span className="opacity-60">· {simulation.iterations.toLocaleString()} iter</span>
      )}
    </motion.div>
  );
};

export default ConvergenceBadge;

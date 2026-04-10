/**
 * SettingsPanel — Export, model configuration, and advanced options
 * Extracted from WarRoom for modularity
 */

import { useState, FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Download, Share2, RotateCcw, ChevronDown } from 'lucide-react';
import { T, fmtPct } from '@/lib/format';

// ─── Types ────────────────────────────────────────────────────────────────

interface SettingsPanelProps {
  onExcel?: () => Promise<void>;
  onPowerBI?: () => Promise<void>;
  onPDF?: () => Promise<void>;
  onRefresh?: () => void;
  backendAvailable?: boolean;
  modelAccuracy?: number;
}

// ─── SettingsPanel ────────────────────────────────────────────────────────

const SettingsPanel: FC<SettingsPanelProps> = ({
  onExcel = () => Promise.resolve(),
  onPowerBI = () => Promise.resolve(),
  onPDF = () => Promise.resolve(),
  onRefresh = () => {},
  backendAvailable = true,
  modelAccuracy = 0.73,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  const handleExport = async (type: 'excel' | 'powerbi' | 'pdf'): Promise<void> => {
    setExporting(true);
    try {
      if (type === 'excel') await onExcel();
      else if (type === 'powerbi') await onPowerBI();
      else if (type === 'pdf') await onPDF();
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        backgroundColor: T.bg2,
        borderRadius: 12,
        border: `1px solid ${T.border}`,
        overflow: 'hidden',
      }}
    >
      {/* Trigger */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 24,
          backgroundColor: T.bg2,
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = T.bg3;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = T.bg2;
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Settings size={20} color={T.accent} />
          <div style={{ textAlign: 'left' }}>
            <h3
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: T.text,
                margin: 0,
              }}
            >
              Export & Settings
            </h3>
            <p
              style={{
                fontSize: 13,
                color: T.text3,
                margin: '4px 0 0 0',
              }}
            >
              Download results and configure output
            </p>
          </div>
        </div>
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={20} color={T.text3} />
        </motion.div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              padding: 24,
              borderTop: `1px solid ${T.border}`,
            }}
          >
            {/* Model Status */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                backgroundColor: T.bg3,
                borderRadius: 8,
                border: `1px solid ${T.border}`,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: T.text,
                  fontWeight: 500,
                }}
              >
                Model Accuracy
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontFamily: T.mono,
                  color: T.green,
                  fontWeight: 600,
                }}
              >
                {fmtPct(modelAccuracy)}
              </span>
            </div>

            {/* Backend Status */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                backgroundColor: backendAvailable ? 'rgba(48,209,88,0.05)' : 'rgba(255,159,10,0.05)',
                borderRadius: 8,
                border: `1px solid ${backendAvailable ? 'rgba(48,209,88,0.2)' : 'rgba(255,159,10,0.2)'}`,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: T.text,
                  fontWeight: 500,
                }}
              >
                Backend
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: backendAvailable ? T.green : T.amber,
                  fontWeight: 600,
                }}
              >
                {backendAvailable ? '● Online' : '● Mock Data'}
              </span>
            </div>

            {/* Export Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: T.text,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  margin: 0,
                }}
              >
                Export As
              </h4>

              <button
                onClick={() => handleExport('excel')}
                disabled={exporting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  backgroundColor: T.bg3,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  opacity: exporting ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!exporting) {
                    e.currentTarget.style.backgroundColor = T.bg4;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!exporting) {
                    e.currentTarget.style.backgroundColor = T.bg3;
                  }
                }}
              >
                <Download size={16} color={T.accent} />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: T.text,
                      margin: 0,
                    }}
                  >
                    Excel Shift Matrix
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: T.text3,
                      margin: 0,
                    }}
                  >
                    Continuous paths with percentiles
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleExport('powerbi')}
                disabled={exporting || !backendAvailable}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  backgroundColor: T.bg3,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  cursor: exporting || !backendAvailable ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  opacity: exporting || !backendAvailable ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!exporting && backendAvailable) {
                    e.currentTarget.style.backgroundColor = T.bg4;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!exporting && backendAvailable) {
                    e.currentTarget.style.backgroundColor = T.bg3;
                  }
                }}
              >
                <Share2 size={16} color={T.purple} />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: T.text,
                      margin: 0,
                    }}
                  >
                    Power BI Push
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: T.text3,
                      margin: 0,
                    }}
                  >
                    To semantic model (requires Azure)
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleExport('pdf')}
                disabled={exporting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  backgroundColor: T.bg3,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  opacity: exporting ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!exporting) {
                    e.currentTarget.style.backgroundColor = T.bg4;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!exporting) {
                    e.currentTarget.style.backgroundColor = T.bg3;
                  }
                }}
              >
                <Download size={16} color={T.red} />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: T.text,
                      margin: 0,
                    }}
                  >
                    PDF Report
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: T.text3,
                      margin: 0,
                    }}
                  >
                    Executive summary with methodology
                  </p>
                </div>
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 16px',
                backgroundColor: T.accent,
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                color: '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              <RotateCcw size={16} />
              Refresh Data
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SettingsPanel;

/**
 * PRISM Innovation Explorer — Generative Product Images
 * SVG-based product visuals for each innovation concept
 * Editorial quality, abstract/geometric style
 */

import React from 'react';

interface ProductImageProps {
  innovationId: string;
  gradient: string;
  accent: string;
  size?: 'card' | 'hero';
}

// Abstract product illustrations using SVG
const illustrations: Record<string, (accent: string) => React.ReactNode> = {
  'inn_01': (a) => ( // Microbiome Scalp Care
    <g>
      <circle cx="120" cy="100" r="60" fill={a} opacity="0.15"/>
      <circle cx="120" cy="100" r="40" fill={a} opacity="0.25"/>
      <circle cx="120" cy="100" r="20" fill={a} opacity="0.4"/>
      {/* Microbiome dots */}
      {[...Array(12)].map((_, i) => (
        <circle key={i} cx={120 + Math.cos(i * 30 * Math.PI / 180) * 50} cy={100 + Math.sin(i * 30 * Math.PI / 180) * 50} r={3 + (i % 3)} fill="white" opacity={0.6 + (i % 3) * 0.1}/>
      ))}
      {/* Bottle silhouette */}
      <rect x="105" y="60" width="30" height="65" rx="6" fill="white" opacity="0.9"/>
      <rect x="110" y="50" width="20" height="15" rx="3" fill="white" opacity="0.9"/>
      <rect x="108" y="90" width="24" height="2" fill={a} opacity="0.5"/>
      <rect x="108" y="95" width="18" height="2" fill={a} opacity="0.3"/>
    </g>
  ),
  'inn_02': (a) => ( // Anti-Thinning Hair Density
    <g>
      {/* Hair strands */}
      {[...Array(8)].map((_, i) => (
        <path key={i} d={`M${90 + i * 8},140 Q${88 + i * 8},100 ${92 + i * 7},50`} stroke="white" strokeWidth="2" fill="none" opacity={0.4 + i * 0.07}/>
      ))}
      {/* Serum dropper */}
      <rect x="108" y="55" width="24" height="55" rx="5" fill="white" opacity="0.9"/>
      <path d="M115,55 L120,42 L125,55" fill="white" opacity="0.9"/>
      <circle cx="120" cy="120" r="4" fill={a} opacity="0.6"/>
      <circle cx="120" cy="130" r="3" fill={a} opacity="0.4"/>
      <circle cx="120" cy="138" r="2" fill={a} opacity="0.3"/>
    </g>
  ),
  'inn_03': (a) => ( // Bio-Logic Laundry Sheets
    <g>
      {/* Stacked sheets */}
      <rect x="85" y="70" width="70" height="4" rx="2" fill="white" opacity="0.5" transform="rotate(-5,120,72)"/>
      <rect x="85" y="78" width="70" height="4" rx="2" fill="white" opacity="0.6" transform="rotate(-3,120,80)"/>
      <rect x="85" y="86" width="70" height="4" rx="2" fill="white" opacity="0.7" transform="rotate(-1,120,88)"/>
      <rect x="85" y="94" width="70" height="4" rx="2" fill="white" opacity="0.8"/>
      <rect x="85" y="102" width="70" height="4" rx="2" fill="white" opacity="0.9"/>
      {/* Leaf eco symbol */}
      <path d="M120,55 Q135,40 140,55 Q135,65 120,55" fill="white" opacity="0.7"/>
      <line x1="120" y1="55" x2="132" y2="48" stroke={a} strokeWidth="1" opacity="0.5"/>
      {/* Enzyme circles */}
      <circle cx="100" cy="130" r="8" fill="white" opacity="0.3"/>
      <circle cx="120" cy="135" r="6" fill="white" opacity="0.25"/>
      <circle cx="140" cy="128" r="7" fill="white" opacity="0.3"/>
    </g>
  ),
  'inn_04': (a) => ( // Premium Fabric Refresh
    <g>
      {/* Mist spray bottle */}
      <rect x="105" y="65" width="30" height="60" rx="8" fill="white" opacity="0.9"/>
      <rect x="112" y="55" width="16" height="15" rx="2" fill="white" opacity="0.9"/>
      <rect x="118" y="48" width="12" height="10" rx="1" fill="white" opacity="0.8"/>
      {/* Mist particles */}
      {[...Array(15)].map((_, i) => (
        <circle key={i} cx={135 + Math.random() * 40} cy={45 + Math.random() * 50} r={1.5 + Math.random() * 2} fill="white" opacity={0.2 + Math.random() * 0.4}/>
      ))}
      {/* Fragrance waves */}
      <path d="M140,60 Q150,55 155,65" stroke="white" strokeWidth="1.5" fill="none" opacity="0.4"/>
      <path d="M145,55 Q158,48 163,60" stroke="white" strokeWidth="1.5" fill="none" opacity="0.3"/>
    </g>
  ),
  'inn_05': (a) => ( // Smart Auto-Dosing Cartridge
    <g>
      {/* Cartridge shape */}
      <rect x="100" y="55" width="40" height="70" rx="10" fill="white" opacity="0.9"/>
      <rect x="108" y="65" width="24" height="20" rx="4" fill={a} opacity="0.3"/>
      <rect x="108" y="90" width="24" height="15" rx="4" fill={a} opacity="0.2"/>
      <rect x="108" y="110" width="24" height="10" rx="4" fill={a} opacity="0.15"/>
      {/* NFC chip indicator */}
      <circle cx="120" cy="135" r="6" fill="white" opacity="0.5"/>
      <path d="M116,135 Q120,128 124,135" stroke={a} strokeWidth="1" fill="none" opacity="0.4"/>
      {/* Connection lines */}
      <line x1="140" y1="75" x2="165" y2="65" stroke="white" strokeWidth="1" opacity="0.3" strokeDasharray="3,3"/>
      <line x1="140" y1="95" x2="165" y2="95" stroke="white" strokeWidth="1" opacity="0.3" strokeDasharray="3,3"/>
    </g>
  ),
  'inn_06': (a) => ( // Garment Lifetime Protection
    <g>
      {/* Shirt/garment silhouette */}
      <path d="M95,65 L105,55 L120,62 L135,55 L145,65 L140,75 L135,70 L135,130 L105,130 L105,70 L100,75 Z" fill="white" opacity="0.85" stroke="white" strokeWidth="1"/>
      {/* Shield overlay */}
      <path d="M110,85 L120,80 L130,85 L130,105 Q120,115 110,105 Z" fill={a} opacity="0.3" stroke="white" strokeWidth="1"/>
      {/* Fiber repair dots */}
      <circle cx="115" cy="95" r="2" fill="white" opacity="0.7"/>
      <circle cx="125" cy="92" r="2" fill="white" opacity="0.7"/>
      <circle cx="120" cy="100" r="2" fill="white" opacity="0.7"/>
    </g>
  ),
  'inn_07': (a) => ( // Premium Men's Grooming
    <g>
      {/* Grooming products lineup */}
      <rect x="80" y="75" width="22" height="50" rx="5" fill="white" opacity="0.9"/>
      <rect x="107" y="65" width="26" height="60" rx="6" fill="white" opacity="0.85"/>
      <rect x="138" y="80" width="22" height="45" rx="5" fill="white" opacity="0.8"/>
      {/* Labels */}
      <rect x="84" y="90" width="14" height="2" fill={a} opacity="0.4"/>
      <rect x="111" y="82" width="18" height="2" fill={a} opacity="0.4"/>
      <rect x="142" y="95" width="14" height="2" fill={a} opacity="0.4"/>
      {/* Matte finish texture */}
      <rect x="107" y="65" width="26" height="12" rx="6" fill="white" opacity="0.3"/>
    </g>
  ),
  'inn_08': (a) => ( // AI Hair Color Platform
    <g>
      {/* Color swatches fan */}
      {[...Array(7)].map((_, i) => (
        <rect key={i} x="100" y="55" width="40" height="70" rx="4" fill="white" opacity={0.3 + i * 0.08} transform={`rotate(${-15 + i * 5},120,90)`}/>
      ))}
      {/* AI eye/scan symbol */}
      <ellipse cx="120" cy="90" rx="18" ry="12" fill="none" stroke="white" strokeWidth="2" opacity="0.8"/>
      <circle cx="120" cy="90" r="6" fill="white" opacity="0.8"/>
      <circle cx="120" cy="90" r="3" fill={a} opacity="0.6"/>
      {/* Scan lines */}
      <line x1="95" y1="90" x2="100" y2="90" stroke="white" strokeWidth="1.5" opacity="0.4"/>
      <line x1="140" y1="90" x2="145" y2="90" stroke="white" strokeWidth="1.5" opacity="0.4"/>
    </g>
  ),
  'inn_09': (a) => ( // PFAS-Free Dish Care
    <g>
      {/* Dish tab */}
      <rect x="100" y="65" width="40" height="35" rx="8" fill="white" opacity="0.9"/>
      <rect x="105" y="70" width="14" height="25" rx="4" fill={a} opacity="0.25"/>
      <rect x="121" y="70" width="14" height="25" rx="4" fill={a} opacity="0.15"/>
      {/* Water drops */}
      <path d="M120,115 Q115,125 120,135 Q125,125 120,115" fill="white" opacity="0.6"/>
      <path d="M105,120 Q102,127 105,133 Q108,127 105,120" fill="white" opacity="0.4"/>
      <path d="M135,118 Q132,126 135,132 Q138,126 135,118" fill="white" opacity="0.4"/>
      {/* Leaf */}
      <path d="M140,60 Q150,50 155,62 Q150,70 140,60" fill="white" opacity="0.5"/>
    </g>
  ),
  'inn_10': (a) => ( // Biotech Hair Repair
    <g>
      {/* DNA helix */}
      {[...Array(6)].map((_, i) => (
        <React.Fragment key={i}>
          <circle cx={110 + Math.sin(i * 1.2) * 15} cy={50 + i * 18} r="4" fill="white" opacity={0.5 + i * 0.06}/>
          <circle cx={130 - Math.sin(i * 1.2) * 15} cy={50 + i * 18} r="4" fill="white" opacity={0.5 + i * 0.06}/>
          <line x1={110 + Math.sin(i * 1.2) * 15} y1={50 + i * 18} x2={130 - Math.sin(i * 1.2) * 15} y2={50 + i * 18} stroke="white" strokeWidth="1" opacity="0.3"/>
        </React.Fragment>
      ))}
      {/* Repair bottle */}
      <rect x="108" y="80" width="24" height="45" rx="5" fill="white" opacity="0.85"/>
      <rect x="113" y="73" width="14" height="10" rx="2" fill="white" opacity="0.85"/>
    </g>
  ),
  'inn_11': (a) => ( // Climate Insect Defense
    <g>
      {/* Shield shape */}
      <path d="M95,60 L120,50 L145,60 L145,100 Q120,125 95,100 Z" fill="white" opacity="0.2" stroke="white" strokeWidth="1.5"/>
      {/* Mesh pattern */}
      {[...Array(4)].map((_, i) => (
        <line key={`h${i}`} x1="100" y1={65 + i * 12} x2="140" y2={65 + i * 12} stroke="white" strokeWidth="0.5" opacity="0.3"/>
      ))}
      {[...Array(4)].map((_, i) => (
        <line key={`v${i}`} x1={105 + i * 10} y1="55" x2={105 + i * 10} y2="115" stroke="white" strokeWidth="0.5" opacity="0.3"/>
      ))}
      {/* Temperature icon */}
      <rect x="117" y="70" width="6" height="30" rx="3" fill="white" opacity="0.7"/>
      <circle cx="120" cy="104" r="6" fill="white" opacity="0.7"/>
    </g>
  ),
  'inn_12': (a) => ( // Bond Repair Technology
    <g>
      {/* Bond chain links */}
      <circle cx="105" cy="85" r="12" fill="none" stroke="white" strokeWidth="2.5" opacity="0.7"/>
      <circle cx="125" cy="85" r="12" fill="none" stroke="white" strokeWidth="2.5" opacity="0.7"/>
      {/* Connection glow */}
      <circle cx="115" cy="85" r="5" fill="white" opacity="0.5"/>
      {/* Salon-to-consumer arrow */}
      <path d="M90,115 L150,115" stroke="white" strokeWidth="1.5" opacity="0.4"/>
      <polygon points="150,115 145,111 145,119" fill="white" opacity="0.4"/>
      <text x="95" y="130" fill="white" opacity="0.4" fontSize="8" fontFamily="Inter">PRO</text>
      <text x="137" y="130" fill="white" opacity="0.4" fontSize="8" fontFamily="Inter">HOME</text>
    </g>
  ),
  'inn_13': (a) => ( // Emerging Markets
    <g>
      {/* Globe with grid */}
      <circle cx="120" cy="90" r="35" fill="none" stroke="white" strokeWidth="1.5" opacity="0.5"/>
      <ellipse cx="120" cy="90" rx="20" ry="35" fill="none" stroke="white" strokeWidth="1" opacity="0.3"/>
      <line x1="85" y1="90" x2="155" y2="90" stroke="white" strokeWidth="1" opacity="0.3"/>
      <ellipse cx="120" cy="75" rx="30" ry="8" fill="none" stroke="white" strokeWidth="0.7" opacity="0.2"/>
      <ellipse cx="120" cy="105" rx="30" ry="8" fill="none" stroke="white" strokeWidth="0.7" opacity="0.2"/>
      {/* Sachet packets */}
      <rect x="105" y="80" width="12" height="16" rx="2" fill="white" opacity="0.7"/>
      <rect x="123" y="82" width="12" height="14" rx="2" fill="white" opacity="0.6"/>
    </g>
  ),
  'inn_14': (a) => ( // Day-2 Hair Revival
    <g>
      {/* Sun/morning icon */}
      <circle cx="120" cy="70" r="15" fill="white" opacity="0.3"/>
      {[...Array(8)].map((_, i) => (
        <line key={i} x1={120 + Math.cos(i * 45 * Math.PI / 180) * 20} y1={70 + Math.sin(i * 45 * Math.PI / 180) * 20} x2={120 + Math.cos(i * 45 * Math.PI / 180) * 26} y2={70 + Math.sin(i * 45 * Math.PI / 180) * 26} stroke="white" strokeWidth="1.5" opacity="0.3"/>
      ))}
      {/* Spray bottle */}
      <rect x="108" y="90" width="24" height="40" rx="5" fill="white" opacity="0.85"/>
      <rect x="113" y="83" width="14" height="10" rx="2" fill="white" opacity="0.85"/>
      <line x1="127" y1="88" x2="135" y2="82" stroke="white" strokeWidth="1" opacity="0.4"/>
      {/* Refresh particles */}
      <circle cx="140" cy="78" r="2" fill="white" opacity="0.4"/>
      <circle cx="145" cy="85" r="1.5" fill="white" opacity="0.3"/>
      <circle cx="138" cy="73" r="1.5" fill="white" opacity="0.35"/>
    </g>
  ),
  'inn_15': (a) => ( // Aromatherapy Home Care
    <g>
      {/* Glass bottle with trigger */}
      <rect x="105" y="65" width="30" height="55" rx="4" fill="white" opacity="0.85"/>
      <rect x="110" y="57" width="8" height="12" rx="2" fill="white" opacity="0.85"/>
      <rect x="118" y="60" width="20" height="6" rx="2" fill="white" opacity="0.7"/>
      {/* Botanical elements */}
      <path d="M90,100 Q95,85 100,95" stroke="white" strokeWidth="1.5" fill="none" opacity="0.4"/>
      <circle cx="90" cy="100" r="3" fill="white" opacity="0.35"/>
      <path d="M150,90 Q145,78 140,88" stroke="white" strokeWidth="1.5" fill="none" opacity="0.4"/>
      <circle cx="150" cy="90" r="3" fill="white" opacity="0.35"/>
      {/* Essential oil drops */}
      <path d="M120,130 Q117,138 120,145 Q123,138 120,130" fill="white" opacity="0.5"/>
    </g>
  ),
  'inn_16': (a) => ( // Circular Refill Station
    <g>
      {/* Circular arrows */}
      <path d="M120,55 A35,35 0 1,1 85,90" fill="none" stroke="white" strokeWidth="2" opacity="0.5"/>
      <polygon points="85,90 80,83 90,85" fill="white" opacity="0.5"/>
      <path d="M120,125 A35,35 0 1,1 155,90" fill="none" stroke="white" strokeWidth="2" opacity="0.5"/>
      <polygon points="155,90 160,97 150,95" fill="white" opacity="0.5"/>
      {/* Bottle in center */}
      <rect x="112" y="75" width="16" height="30" rx="4" fill="white" opacity="0.8"/>
      <rect x="115" y="70" width="10" height="8" rx="2" fill="white" opacity="0.8"/>
      {/* Refill indicator */}
      <rect x="114" y="85" width="12" height="15" rx="2" fill={a} opacity="0.3"/>
    </g>
  ),
};

export default function InnovationProductImage({ innovationId, gradient, accent, size = 'card' }: ProductImageProps) {
  const viewBox = size === 'hero' ? '0 0 240 200' : '0 0 240 180';
  const height = size === 'hero' ? '100%' : '100%';

  const illustration = illustrations[innovationId];

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: gradient,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background pattern */}
      <svg width="100%" height="100%" viewBox="0 0 240 200" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, opacity: 0.08 }}>
        <defs>
          <pattern id={`grid-${innovationId}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="240" height="200" fill={`url(#grid-${innovationId})`}/>
      </svg>
      {/* Main illustration */}
      <svg width="100%" height={height} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" style={{ position: 'relative', zIndex: 1 }}>
        {illustration ? illustration(accent) : (
          <g>
            <circle cx="120" cy="100" r="30" fill="white" opacity="0.2"/>
            <circle cx="120" cy="100" r="15" fill="white" opacity="0.3"/>
          </g>
        )}
      </svg>
    </div>
  );
}

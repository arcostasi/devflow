import React, { useId } from 'react';

interface DevFlowLogoProps {
  className?: string;
}

const DevFlowLogo: React.FC<DevFlowLogoProps> = ({ className }) => {
  const baseId = useId().replace(/:/g, '');
  const flowGradientId = `${baseId}-flow`;
  const panelGradientId = `${baseId}-panel`;
  const accentGradientId = `${baseId}-accent`;

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={flowGradientId} x1="3" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="48%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>
        <linearGradient id={panelGradientId} x1="4" y1="4" x2="19" y2="19" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#0b1220" />
        </linearGradient>
        <linearGradient id={accentGradientId} x1="14" y1="9" x2="20" y2="15" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>

      <rect x="3.25" y="4" width="6.25" height="6.25" rx="1.75" fill={`url(#${panelGradientId})`} stroke={`url(#${flowGradientId})`} strokeWidth="0.95" />
      <rect x="3.25" y="13.75" width="6.25" height="6.25" rx="1.75" fill={`url(#${panelGradientId})`} stroke={`url(#${flowGradientId})`} strokeWidth="0.95" />
      <rect x="14.25" y="8.9" width="6.5" height="6.5" rx="1.9" fill={`url(#${panelGradientId})`} stroke={`url(#${flowGradientId})`} strokeWidth="0.95" />

      <path d="M9.55 7.15H12.2C13 7.15 13.77 7.5 14.29 8.11L15.55 9.56" stroke={`url(#${flowGradientId})`} strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.55 16.9H12.2C13 16.9 13.77 16.55 14.29 15.94L15.55 14.49" stroke={`url(#${flowGradientId})`} strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M11.95 7.15V16.9"
        stroke="rgba(147, 197, 253, 0.78)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M16.65 10.85L19.05 12.15L16.65 13.45"
        fill="none"
        stroke={`url(#${accentGradientId})`}
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5.25 7.1H7.45" stroke="rgba(255,255,255,0.82)" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M5.25 16.85H7.45" stroke="rgba(255,255,255,0.82)" strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="18.05" cy="10.85" r="0.85" fill="#e0f2fe" />
    </svg>
  );
};

export default DevFlowLogo;

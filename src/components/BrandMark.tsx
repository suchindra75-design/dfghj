import React from 'react';

/** Brainmatrix logo tile: a gradient square with a stylised EEG trace. */
export const BrandMark: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => (
  <div
    className={`brand-gradient relative shrink-0 rounded-[28%] shadow-md ring-1 ring-white/20 flex items-center justify-center overflow-hidden ${className}`}
    style={{ width: size, height: size }}
    aria-hidden="true"
  >
    {/* soft top sheen */}
    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
    <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} className="relative">
      <path
        d="M2 13h3.2l1.6-4.5 2.6 9 2.4-12 2.3 10.5 1.7-5 1.2 2H22"
        fill="none"
        stroke="white"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

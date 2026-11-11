import React from 'react';
import { motion } from 'motion/react';
import { BrandMark } from './BrandMark';

interface EEGLoadingStateProps {
  message?: string;
  subtext?: string;
  channelId?: string;
}

/** A calm launch/loading screen: brand mark, a travelling EEG trace and an indeterminate bar. */
export const EEGLoadingState: React.FC<EEGLoadingStateProps> = ({
  message = 'Loading your recording',
  subtext,
  channelId = '3469764',
}) => {
  // One EEG-like cycle, repeated; the dash offset animation makes it travel.
  const cycle: [number, number][] = [
    [0, 30], [18, 30], [24, 22], [30, 38], [36, 12], [42, 46], [48, 26], [54, 30],
    [80, 30], [86, 24], [92, 36], [98, 18], [104, 40], [110, 28], [116, 30], [140, 30],
  ];
  const points = [...cycle, ...cycle.slice(1).map(([x, y]) => [x + 140, y] as [number, number])];
  const trace = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 select-none"
      role="status"
      aria-live="polite"
    >
      <motion.div
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <BrandMark size={56} />
      </motion.div>

      <svg viewBox="0 0 280 60" className="w-64 h-14 mt-8" aria-hidden="true">
        <defs>
          <linearGradient id="eegFade" x1="0" x2="1">
            <stop offset="0" stopColor="#6366F1" stopOpacity="0" />
            <stop offset="0.3" stopColor="#6366F1" />
            <stop offset="0.7" stopColor="#2563EB" />
            <stop offset="1" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={trace}
          fill="none" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <motion.path
          d={trace}
          fill="none"
          stroke="url(#eegFade)"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="90 400"
          animate={{ strokeDashoffset: [90, -400] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
        />
      </svg>

      <h2 className="mt-6 text-[17px] font-semibold tracking-tight text-[#0B1220]">{message}</h2>
      <p className="mt-1.5 text-[13px] text-[#64748B] max-w-xs">
        {subtext ?? `Fetching EEG data from channel #${channelId}`}
      </p>

      <div className="mt-6 h-1 w-40 rounded-full bg-[#E2E8F0] overflow-hidden">
        <motion.div
          className="h-full w-1/3 rounded-full brand-gradient"
          animate={{ x: ['-100%', '300%'] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </motion.div>
  );
};

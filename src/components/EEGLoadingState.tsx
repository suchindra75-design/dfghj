import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, Radio } from 'lucide-react';
import { motion } from 'motion/react';

interface EEGLoadingStateProps {
  message?: string;
  subtext?: string;
  channelId?: string;
}

export const EEGLoadingState: React.FC<EEGLoadingStateProps> = ({
  message = 'Synchronizing EEG telemetry...',
  subtext = 'Calibrating baseline voltage and streaming telemetry packets from Channel 3469764',
  channelId = '3469764',
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 96) return 96;
        return prev + Math.floor(Math.random() * 8) + 4;
      });
    }, 180);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="py-16 md:py-24 max-w-2xl mx-auto flex flex-col items-center justify-center text-center px-4 select-none font-mono"
    >
      {/* Medical Scope Box */}
      <div className="w-full bg-white border border-[#CBD5E1] rounded-lg shadow-xs overflow-hidden mb-5">
        {/* Reticle Top Header */}
        <div className="px-3.5 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between text-[11px] text-[#64748B]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
            <span className="font-bold text-[#0F172A]">EEG SIGNAL ACQUISITION</span>
          </div>
          <div className="flex items-center gap-2">
            <span>CH #{channelId}</span>
            <span className="text-[#CBD5E1]">&bull;</span>
            <span className="text-[#16A34A] font-medium">PHY-OK</span>
          </div>
        </div>

        {/* Oscilloscope Canvas Simulator */}
        <div className="relative w-full h-36 bg-white overflow-hidden flex items-center justify-center">
          {/* Subtle Grid Reticle */}
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, #E2E8F0 1px, transparent 1px),
                linear-gradient(to bottom, #E2E8F0 1px, transparent 1px)
              `,
              backgroundSize: '24px 24px',
            }}
          />

          {/* Zero baseline */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-b border-dashed border-[#CBD5E1]" />

          {/* Precision EEG Waveform Path Drawing */}
          <svg
            className="w-full h-full relative z-10"
            viewBox="0 0 600 140"
            preserveAspectRatio="none"
          >
            {/* Background ghost wave */}
            <path
              d="M 0 70 L 60 70 Q 75 66 85 70 T 110 70 L 140 70 Q 148 62 155 70 L 165 70 L 175 42 L 185 105 L 195 24 L 205 85 L 215 70 L 235 70 Q 255 52 275 70 L 320 70 L 330 70 Q 345 66 355 70 T 380 70 L 410 70 Q 418 62 425 70 L 435 70 L 445 42 L 455 105 L 465 24 L 475 85 L 485 70 L 505 70 Q 525 52 545 70 L 600 70"
              fill="none"
              stroke="#F1F5F9"
              strokeWidth="2"
            />

            {/* Active Drawing EEG Waveform */}
            <motion.path
              d="M 0 70 L 60 70 Q 75 66 85 70 T 110 70 L 140 70 Q 148 62 155 70 L 165 70 L 175 42 L 185 105 L 195 24 L 205 85 L 215 70 L 235 70 Q 255 52 275 70 L 320 70 L 330 70 Q 345 66 355 70 T 380 70 L 410 70 Q 418 62 425 70 L 435 70 L 445 42 L 455 105 L 465 24 L 475 85 L 485 70 L 505 70 Q 525 52 545 70 L 600 70"
              fill="none"
              stroke="#0F172A"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0.4 }}
              animate={{
                pathLength: [0, 1],
                opacity: [0.7, 1],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            {/* Subtle Lead Tracer Dot */}
            <motion.circle
              r="3.5"
              fill="#2563EB"
              initial={{ offsetDistance: '0%' }}
              animate={{
                cx: [0, 600],
                cy: [70, 70],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </svg>

          {/* Calibration scale bracket */}
          <div className="absolute left-2 inset-y-3 flex flex-col justify-between text-[9px] text-[#94A3B8] font-mono pointer-events-none">
            <span>+50µV</span>
            <span>0µV</span>
            <span>-50µV</span>
          </div>

          <div className="absolute right-2 bottom-1.5 text-[9px] text-[#94A3B8] font-mono pointer-events-none">
            100mm/s &bull; 10mm/mV
          </div>
        </div>

        {/* Loading Progress Bar */}
        <div className="w-full bg-[#F1F5F9] h-1 overflow-hidden">
          <motion.div
            className="h-full bg-[#2563EB]"
            initial={{ width: '12%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Typography Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#0F172A] tracking-wider uppercase">
          <Activity className="w-3.5 h-3.5 text-[#2563EB]" />
          <span>{message}</span>
        </div>
        <p className="text-[11px] text-[#64748B] max-w-lg leading-relaxed">
          {subtext}
        </p>
      </div>

      {/* Security & Protocol Badge */}
      <div className="mt-4 flex items-center gap-2 text-[10px] text-[#94A3B8]">
        <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />
        <span>Direct SSL/TLS Connection to ThingSpeak API</span>
      </div>
    </motion.div>
  );
};

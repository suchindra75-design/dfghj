import React, { useId } from 'react';
import { motion } from 'motion/react';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}

/** iOS-style segmented control with an animated selection thumb. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
  ariaLabel,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
}) {
  const id = useId();
  const h = size === 'sm' ? 'h-7 text-[11.5px]' : 'h-8 text-[12.5px]';
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-center p-0.5 rounded-md bg-[#0F172A]/[0.045] ring-1 ring-inset ring-[#0F172A]/[0.04] ${className}`}
    >
      {options.map(opt => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={String(opt.value)}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`relative ${h} px-2.5 sm:px-3 rounded-[7px] font-medium whitespace-nowrap transition-colors ${
              active ? 'text-[#0B1220]' : 'text-[#64748B] hover:text-[#0B1220]'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[7px] bg-white shadow-xs ring-1 ring-[#0F172A]/[0.06]"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

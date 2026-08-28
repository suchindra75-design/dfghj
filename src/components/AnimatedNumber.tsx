import React, { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  formatter?: (val: number) => string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 800,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  formatter,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const hasAnimatedRef = useRef<boolean>(false);
  const startValRef = useRef<number>(0);

  useEffect(() => {
    // Only animate on first mount or significant value change
    if (isNaN(value) || value === null || value === undefined) {
      setDisplayValue(0);
      return;
    }

    if (hasAnimatedRef.current) {
      setDisplayValue(value);
      return;
    }

    hasAnimatedRef.current = true;
    const startValue = 0;
    const endValue = value;
    const startTime = performance.now();

    let animationFrameId: number;

    const easeOutCubic = (t: number): number => {
      return 1 - Math.pow(1 - t, 3);
    };

    const updateCounter = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easedProgress = easeOutCubic(progress);

      const current = startValue + (endValue - startValue) * easedProgress;
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCounter);
      } else {
        setDisplayValue(endValue);
      }
    };

    animationFrameId = requestAnimationFrame(updateCounter);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [value, duration]);

  const formatted = formatter
    ? formatter(displayValue)
    : displayValue.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

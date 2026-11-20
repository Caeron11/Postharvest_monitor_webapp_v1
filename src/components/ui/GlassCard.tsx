import React, { useRef } from 'react';

export type GlassTier = 'recessed' | 'surface' | 'floating';
export type GlassRadius = 'outer' | 'nested' | 'pill';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  tier?: GlassTier;
  radius?: GlassRadius;
  refraction?: boolean;
  specular?: boolean;
  as?: 'div' | 'section' | 'article' | 'aside';
}

const TIER_CLASS: Record<GlassTier, string> = {
  recessed: 'glass-recessed',
  surface: 'glass-surface',
  floating: 'glass-floating',
};

const RADIUS_CLASS: Record<GlassRadius, string> = {
  outer: 'rounded-[28px]',
  nested: 'rounded-[20px]',
  pill: 'rounded-full',
};

export function GlassCard({
  tier = 'surface',
  radius = 'outer',
  refraction = true,
  specular = false,
  as: Tag = 'div',
  className = '',
  onMouseMove,
  children,
  ...rest
}: GlassCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (specular && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ref.current.style.setProperty('--mouse-x', `${x}px`);
      ref.current.style.setProperty('--mouse-y', `${y}px`);
    }
    onMouseMove?.(e);
  };

  const classes = [
    TIER_CLASS[tier],
    RADIUS_CLASS[radius],
    refraction && tier !== 'recessed' ? 'glass-refraction' : '',
    specular ? 'glass-specular' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag
      ref={ref}
      className={classes}
      onMouseMove={specular ? handleMouseMove : onMouseMove}
      {...rest}
    >
      {children}
    </Tag>
  );
}

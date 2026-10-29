import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@/lib/utils';

type LogoVariant = 'primary' | 'onDark' | 'stacked' | 'stackedOnDark' | 'mark';

const SOURCES: Record<LogoVariant, { src: string; width: number; height: number }> = {
  primary: { src: '/brand/logo-primary.svg', width: 332, height: 72 },
  onDark: { src: '/brand/logo-primary-on-dark.svg', width: 332, height: 72 },
  stacked: { src: '/brand/logo-stacked.svg', width: 220, height: 150 },
  stackedOnDark: { src: '/brand/logo-stacked-on-dark.svg', width: 220, height: 150 },
  mark: { src: '/brand/logomark.svg', width: 64, height: 64 },
};

/**
 * The brand lockup.
 *
 * `priority` is on by default because the header logo is above the fold on
 * every page, and a late-loading logo is a visible layout shift on the one
 * element a visitor uses to recognise where they are.
 */
export function Logo({
  variant = 'primary',
  className,
  height = 40,
  priority = true,
  alt = 'Samarkhand Hotel',
}: {
  variant?: LogoVariant;
  className?: string;
  height?: number;
  priority?: boolean;
  alt?: string;
}) {
  const source = SOURCES[variant];
  const width = Math.round((source.width / source.height) * height);

  return (
    <Image
      src={source.src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={cn('h-auto w-auto select-none', className)}
      style={{ height, width }}
    />
  );
}

/** The logo as a link home, with an accessible label. */
export function LogoLink({
  variant = 'primary',
  height = 40,
  className,
}: {
  variant?: LogoVariant;
  height?: number;
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cn(
        'inline-flex shrink-0 items-center rounded-sm transition-opacity hover:opacity-85',
        className,
      )}
      aria-label="Samarkhand Hotel — bosh sahifa"
    >
      <Logo variant={variant} height={height} alt="" />
    </Link>
  );
}

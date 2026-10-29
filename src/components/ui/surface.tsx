import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

const cardVariants = cva('rounded-lg transition-shadow duration-300', {
  variants: {
    tone: {
      plain: 'bg-ivory-50 border border-sand-300',
      raised: 'bg-ivory-50 border border-sand-200 shadow-[var(--shadow-card)]',
      sand: 'bg-sand-200/60 border border-sand-300',
      dark: 'bg-chocolate-800 border border-chocolate-700 text-ivory-100',
    },
    interactive: {
      true: 'hover:shadow-[var(--shadow-raised)] focus-within:shadow-[var(--shadow-raised)]',
      false: '',
    },
  },
  defaultVariants: { tone: 'raised', interactive: false },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export function Card({ className, tone, interactive, ...props }: CardProps) {
  return (
    <div className={cn(cardVariants({ tone, interactive }), className)} {...props} />
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-medium leading-none [&_svg]:size-3.5',
  {
    variants: {
      tone: {
        neutral: 'bg-sand-200 text-chocolate-700',
        brown: 'bg-brown-500 text-ivory-50',
        gold: 'bg-gold-500 text-chocolate-900',
        terracotta: 'bg-terracotta-500 text-ivory-50',
        outline: 'border border-brown-500/35 text-chocolate-700',
        success: 'bg-success-100 text-success-600',
        warning: 'bg-warning-100 text-warning-600',
        danger: 'bg-danger-100 text-danger-600',
        info: 'bg-info-100 text-info-600',
        onDark: 'bg-ivory-50/15 text-ivory-50 backdrop-blur-sm',
      },
      size: {
        sm: 'px-2 py-1 text-[0.6875rem] tracking-wide',
        md: 'px-2.5 py-1.5 text-xs',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'sm' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Demo-data marker                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Marks content that came from the seed rather than from verified hotel
 * information. Used wherever seeded prices, contacts or testimonials appear,
 * so a visitor is never misled about what has been confirmed.
 */
export function DemoBadge({
  className,
  label = 'Namuna maʼlumot',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Badge
      tone="warning"
      className={cn('uppercase tracking-[0.08em]', className)}
      title="Bu maʼlumot namuna sifatida kiritilgan va mehmonxona tomonidan hali tasdiqlanmagan."
    >
      {label}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/* Section heading                                                             */
/* -------------------------------------------------------------------------- */

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  tone = 'light',
  as: Tag = 'h2',
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  tone?: 'light' | 'dark';
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'max-w-prose',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      {eyebrow ? (
        <p
          className={cn(
            'mb-3 text-xs font-semibold uppercase tracking-[0.18em]',
            tone === 'dark' ? 'text-gold-300' : 'text-brown-400',
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <Tag
        className={cn(
          'text-balance',
          Tag === 'h1'
            ? 'text-4xl sm:text-5xl lg:text-6xl'
            : 'text-3xl sm:text-4xl',
          tone === 'dark' ? 'text-ivory-50' : 'text-chocolate-800',
        )}
      >
        {title}
      </Tag>
      {description ? (
        <p
          className={cn(
            'mt-4 text-base leading-relaxed sm:text-lg',
            tone === 'dark' ? 'text-ivory-100/80' : 'text-brown-400',
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Section wrapper                                                             */
/* -------------------------------------------------------------------------- */

export function Section({
  id,
  className,
  tone = 'ivory',
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  tone?: 'ivory' | 'sand' | 'dark' | 'none';
}) {
  const tones = {
    ivory: 'bg-ivory-50',
    sand: 'bg-sand-200/50',
    dark: 'bg-chocolate-800 text-ivory-100',
    none: '',
  } as const;

  return (
    <section
      id={id}
      className={cn('py-16 sm:py-20 lg:py-24', tones[tone], className)}
      {...props}
    >
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton + empty state                                                      */
/* -------------------------------------------------------------------------- */

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} aria-hidden="true" {...props} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg',
        'border border-dashed border-sand-300 bg-sand-200/30 px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="flex size-12 items-center justify-center rounded-full bg-sand-200 text-brown-400 [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <p className="font-display text-xl text-chocolate-800">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-brown-400">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

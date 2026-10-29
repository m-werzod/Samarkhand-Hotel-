import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The Samarkhand button family.
 *
 * `primary` is the warm-brown workhorse used for every booking action. Hover
 * darkens rather than lightens (warm browns look muddy when lightened), press
 * adds a 1px optical nudge, and the focus ring is the brand gold so it reads
 * against both ivory and chocolate backgrounds.
 *
 * Every size clears a 44px touch target at `md` and above; `sm` is reserved
 * for dense admin tables where a pointer is assumed.
 */
const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-md font-medium tracking-wide',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-200',
    'ease-[var(--ease-out-soft)]',
    'disabled:pointer-events-none disabled:opacity-55',
    'active:translate-y-px',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-brown-500 text-ivory-50 shadow-[var(--shadow-subtle)]',
          'hover:bg-chocolate-700 hover:shadow-[var(--shadow-card)]',
          'active:bg-chocolate-800',
        ].join(' '),
        secondary: [
          'bg-sand-200 text-chocolate-800',
          'hover:bg-sand-300 active:bg-sand-400',
        ].join(' '),
        outline: [
          'border border-brown-500/35 bg-transparent text-chocolate-800',
          'hover:border-brown-500 hover:bg-brown-500/8',
          'active:bg-brown-500/14',
        ].join(' '),
        ghost: 'text-chocolate-700 hover:bg-brown-500/10 active:bg-brown-500/16',
        gold: [
          'bg-gold-500 text-chocolate-900 shadow-[var(--shadow-subtle)]',
          'hover:bg-gold-400 active:bg-gold-300',
        ].join(' '),
        /** For placement over photography and dark scrims. */
        onDark: [
          'border border-ivory-50/35 bg-ivory-50/10 text-ivory-50 backdrop-blur-sm',
          'hover:bg-ivory-50/20 hover:border-ivory-50/60 active:bg-ivory-50/26',
        ].join(' '),
        danger: [
          'bg-danger-600 text-ivory-50',
          'hover:bg-danger-600/90 active:bg-danger-600/80',
        ].join(' '),
        link: 'text-brown-500 underline-offset-4 hover:underline hover:text-chocolate-800',
      },
      size: {
        sm: 'h-9 px-3 text-sm [&_svg]:size-4',
        md: 'h-11 px-5 text-[0.9375rem] [&_svg]:size-[1.125rem]',
        lg: 'h-13 px-7 text-base [&_svg]:size-5',
        xl: 'h-14 px-9 text-[1.0625rem] [&_svg]:size-5',
        icon: 'size-11 [&_svg]:size-5',
        iconSm: 'size-9 [&_svg]:size-4',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      block: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the single child element (e.g. a Next `<Link>`). */
  asChild?: boolean;
  /** Shows a spinner, disables interaction and announces busy state. */
  loading?: boolean;
  /** Replaces the label while `loading`, for screen readers and sighted users. */
  loadingLabel?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant,
      size,
      block,
      asChild = false,
      loading = false,
      loadingLabel,
      disabled,
      children,
      type,
      ...props
    },
    ref,
  ) {
    const Comp = asChild ? Slot : 'button';

    // `asChild` hands rendering to the caller's element, so a spinner would
    // break its single-child contract. Callers that need a loading state
    // should use a real button.
    if (asChild) {
      return (
        <Comp
          ref={ref}
          className={cn(buttonVariants({ variant, size, block }), className)}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size, block }), className)}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            <span>{loadingLabel ?? children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

export { buttonVariants };

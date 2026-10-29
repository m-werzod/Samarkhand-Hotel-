'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-chocolate-900/65 backdrop-blur-[2px]',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        className,
      )}
      {...props}
    />
  );
});

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Hides the built-in close button for fully custom chrome (e.g. lightbox). */
  hideClose?: boolean;
  /** `sheet` slides up from the bottom — the right pattern on phones. */
  variant?: 'centered' | 'sheet' | 'full';
}

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent(
  { className, children, hideClose, variant = 'centered', ...props },
  ref,
) {
  const layout = {
    centered: [
      'left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
      'rounded-xl',
    ].join(' '),
    // Full width at the bottom on small screens, centred from `sm` up.
    sheet: [
      'inset-x-0 bottom-0 max-h-[88vh] w-full rounded-t-2xl',
      'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg',
      'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl',
    ].join(' '),
    full: 'inset-0 w-full rounded-none',
  }[variant];

  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed z-50 overflow-y-auto bg-ivory-50 shadow-[var(--shadow-overlay)]',
          'focus:outline-none',
          layout,
          className,
        )}
        {...props}
      >
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close
            className={cn(
              'absolute right-3 top-3 rounded-md p-2 text-brown-400',
              'transition-colors hover:bg-sand-200 hover:text-chocolate-800',
            )}
          >
            <X className="size-5" aria-hidden="true" />
            <span className="sr-only">Yopish</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('space-y-1.5 border-b border-sand-300 px-6 py-5 pr-14', className)}
      {...props}
    />
  );
}

export function DialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-5', className)} {...props} />;
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-sand-300 px-6 py-4',
        'sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('font-display text-2xl text-chocolate-800', className)}
      {...props}
    />
  );
});

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-sm leading-relaxed text-brown-400', className)}
      {...props}
    />
  );
});

/**
 * Confirmation dialog for destructive admin actions.
 *
 * Deliberately requires an explicit `confirmLabel` so the button never just
 * reads "OK" — the operator should see what they are about to do.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Bekor qilish',
  onConfirm,
  pending,
  tone = 'danger',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
  tone?: 'danger' | 'primary';
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose
            className={cn(
              'inline-flex h-11 items-center justify-center rounded-md px-5',
              'bg-sand-200 text-sm font-medium text-chocolate-800',
              'transition-colors hover:bg-sand-300',
            )}
          >
            {cancelLabel}
          </DialogClose>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending || undefined}
            className={cn(
              'inline-flex h-11 items-center justify-center rounded-md px-5',
              'text-sm font-medium text-ivory-50 transition-colors',
              'disabled:pointer-events-none disabled:opacity-60',
              tone === 'danger'
                ? 'bg-danger-600 hover:bg-danger-600/90'
                : 'bg-brown-500 hover:bg-chocolate-700',
            )}
          >
            {pending ? 'Bajarilmoqda…' : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

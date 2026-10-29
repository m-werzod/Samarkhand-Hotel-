'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Label                                                                       */
/* -------------------------------------------------------------------------- */

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & {
    required?: boolean;
  }
>(function Label({ className, children, required, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        'block text-sm font-medium text-chocolate-700',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {children}
      {required ? (
        <span className="ml-0.5 text-danger-600" aria-hidden="true">
          *
        </span>
      ) : null}
    </LabelPrimitive.Root>
  );
});

/* -------------------------------------------------------------------------- */
/* Shared control surface                                                      */
/* -------------------------------------------------------------------------- */

const controlSurface = [
  'w-full rounded-md border bg-ivory-50 text-chocolate-800',
  'placeholder:text-brown-300',
  'transition-[border-color,box-shadow] duration-150',
  'hover:border-brown-300',
  'focus:border-brown-500 focus:outline-none focus:ring-2 focus:ring-gold-500/35',
  'disabled:cursor-not-allowed disabled:bg-sand-200/60 disabled:opacity-70',
  'aria-[invalid=true]:border-danger-600 aria-[invalid=true]:ring-danger-600/25',
].join(' ');

/* -------------------------------------------------------------------------- */
/* Input                                                                       */
/* -------------------------------------------------------------------------- */

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(controlSurface, 'h-11 border-sand-300 px-3.5', className)}
      {...props}
    />
  );
});

/* -------------------------------------------------------------------------- */
/* Textarea                                                                    */
/* -------------------------------------------------------------------------- */

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        controlSurface,
        'resize-y border-sand-300 px-3.5 py-2.5 leading-relaxed',
        className,
      )}
      {...props}
    />
  );
});

/* -------------------------------------------------------------------------- */
/* Native select                                                               */
/*                                                                             */
/* A native <select> beats a custom listbox on mobile: it gets the platform    */
/* wheel picker, works offline from the accessibility tree, and costs no JS.   */
/* -------------------------------------------------------------------------- */

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          controlSurface,
          'h-11 appearance-none border-sand-300 pl-3.5 pr-10',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-brown-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5 7.5 5 5 5-5" />
      </svg>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Field wrapper                                                               */
/* -------------------------------------------------------------------------- */

export interface FieldProps {
  /** Must match the control's `id` so the label and messages are associated. */
  id: string;
  label: string;
  hint?: string;
  error?: string | undefined;
  required?: boolean;
  className?: string;
  /** Receives the wiring the control needs: id, aria-describedby, aria-invalid. */
  children: (aria: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': boolean | undefined;
  }) => React.ReactNode;
}

/**
 * Wires a label, hint and error message to a control with correct ARIA.
 *
 * Using a render prop rather than cloning children keeps the association
 * explicit and survives wrappers like react-hook-form's `register`.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-brown-400">
          {hint}
        </p>
      ) : null}
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium text-danger-600"
        >
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

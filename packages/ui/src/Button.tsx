'use client';

import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-anchor-50 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: 'bg-brand-gradient text-white focus:ring-primary-400 shadow-md shadow-primary-500/30 hover:shadow-lg hover:shadow-primary-500/40 hover:-translate-y-px active:translate-y-0 active:shadow-sm',
        secondary: 'bg-white hover:bg-anchor-100 text-anchor-800 border border-anchor-300 focus:ring-anchor-400 shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0',
        destructive: 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-400 shadow-md shadow-red-500/30 hover:-translate-y-px active:translate-y-0',
        outline: 'border border-anchor-300 bg-transparent hover:bg-anchor-100 text-anchor-800 focus:ring-anchor-400',
        ghost: 'bg-transparent hover:bg-anchor-100 text-anchor-600 focus:ring-anchor-400',
        link: 'bg-transparent hover:underline text-primary-500 focus:ring-primary-400',
      },
      size: {
        default: 'py-2 px-4 text-sm',
        sm: 'py-1.5 px-3 text-xs',
        lg: 'py-3 px-6 text-lg',
        icon: 'p-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };

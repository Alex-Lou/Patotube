import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/15 text-primary border border-primary/30',
        secondary: 'bg-secondary text-secondary-foreground border border-border/60',
        outline: 'border border-border text-foreground',
        muted: 'bg-muted text-muted-foreground border border-border/60',
        success: 'bg-success/15 text-success border border-success/30',
        destructive: 'bg-destructive/15 text-destructive border border-destructive/30',
        soon:
          'bg-foreground/5 text-muted-foreground border border-dashed border-border italic',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

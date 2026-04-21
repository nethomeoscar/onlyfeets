// components/ui/LoadingSpinner.tsx
'use client';

import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <div className={`flex justify-center items-center py-4 ${className}`}>
      <Loader2 className={`${sizes[size]} text-pink-500 animate-spin`} />
    </div>
  );
}

"use client"

import React from 'react';

interface ProgressProps {
  value?: number;
  className?: string;
}

export function Progress({ value = 0, className = '' }: ProgressProps) {
  return (
    <div className={`relative h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800 ${className}`}>
      <div 
        className="h-full bg-blue-500 dark:bg-blue-400 transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
} 
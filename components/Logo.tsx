import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 32, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="AIjsonformatter Logo"
    >
      {/* Background circle with gradient */}
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="aiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      
      {/* Main container */}
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="6"
        fill="url(#logoGradient)"
        stroke="#4f46e5"
        strokeWidth="0.5"
      />
      
      {/* JSON Braces */}
      <path
        d="M9 11c-1.1 0-2 .9-2 2v1c0 .55-.45 1-1 1s-1 .45-1 1 .45 1 1 1c.55 0 1 .45 1 1v1c0 1.1.9 2 2 2"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M23 11c1.1 0 2 .9 2 2v1c0 .55.45 1 1 1s1 .45 1 1-.45 1-1 1c-.55 0-1 .45-1 1v1c0 1.1-.9 2-2 2"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Center elements */}
      <circle cx="16" cy="12" r="1" fill="white" />
      <rect x="15" y="15" width="2" height="6" rx="1" fill="white" />
      
      {/* AI indicator - small sparkle */}
      <circle cx="22" cy="8" r="1.5" fill="url(#aiGradient)" />
      <path
        d="M22 6.5v3M20.5 8h3"
        stroke="white"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default Logo; 
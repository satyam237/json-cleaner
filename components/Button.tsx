import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  ringOffsetClass?: string; // Allow overriding focus ring offset
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ringOffsetClass, // Default will be determined below
  ...props
}) => {

  const variantStyles = {
    primary: "bg-indigo-500 hover:bg-indigo-600 focus:ring-indigo-400 text-white",
    secondary: "bg-slate-500/80 hover:bg-slate-500/100 focus:ring-slate-400 text-slate-100", // Semi-transparent
    danger: "bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  // Determine final chosen offset.
  // If ringOffsetClass is provided, it takes precedence.
  // Otherwise, default to 'focus:ring-offset-slate-800' for the new page background.
  const finalChosenOffset = ringOffsetClass || 'focus:ring-offset-slate-800';
  
  const baseStyles = `inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 ${finalChosenOffset} transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed`;

  return (
    <button
      type="button"
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
import React from 'react';

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({ type, title, children, className }) => {
  const baseClasses = "p-4 rounded-md shadow-md";
  const typeClasses = {
    success: "bg-green-700/40 text-green-300 border border-green-600/60",
    error: "bg-red-700/40 text-red-300 border border-red-600/60",
    warning: "bg-yellow-700/40 text-yellow-300 border border-yellow-600/60",
    info: "bg-blue-700/40 text-blue-300 border border-blue-600/60",
  };

  return (
    <div className={`${baseClasses} ${typeClasses[type]} ${className || ''}`} role="alert">
      {title && <h3 className="text-md font-semibold mb-1">{title}</h3>}
      <div className="text-sm">{children}</div>
    </div>
  );
};
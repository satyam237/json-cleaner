import React from 'react';

interface JsonInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hasError: boolean;
  className?: string;
}

export const JsonInput: React.FC<JsonInputProps> = ({ value, onChange, placeholder, hasError, className }) => {
  const baseClasses = "w-full h-full p-4 text-slate-200 resize-none focus:outline-none focus:ring-2 rounded-b-md border";
  const errorClasses = "focus:ring-red-500 border-red-500/70 focus:border-red-500";
  // Updated focus:ring-offset to match the glass pane's background (slate-700/30) or a similar dark shade
  const normalClasses = "focus:ring-indigo-500 border-slate-600/50 focus:border-indigo-500 focus:ring-offset-slate-800"; 
  const textareaClasses = `${baseClasses} ${hasError ? errorClasses : normalClasses} ${className || ''}`;

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || "Paste your JSON here for online formatting, validation, or to check JSON syntax..."}
      className={textareaClasses}
      spellCheck="false"
      style={{ 
        fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', 
        background: 'rgba(30, 41, 59, 0.5)' /* slate-800 with 50% opacity */
      }}
      aria-invalid={hasError}
      aria-describedby={hasError ? "json-input-error" : undefined}
    />
  );
};
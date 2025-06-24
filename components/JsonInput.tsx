import React from 'react';

interface JsonInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hasError: boolean;
  className?: string;
  onClearHighlights?: () => void;
}

export const JsonInput: React.FC<JsonInputProps> = ({ 
  value, 
  onChange, 
  placeholder, 
  hasError, 
  className,
  onClearHighlights
}) => {
  const baseClasses = "w-full h-full p-4 text-slate-200 resize-none focus:outline-none focus:ring-2 rounded-b-md border";
  const errorClasses = "focus:ring-red-500 border-red-500/70 focus:border-red-500";
  const normalClasses = "focus:ring-indigo-500 border-slate-600/50 focus:border-indigo-500 focus:ring-offset-slate-800"; 
  const textareaClasses = `${baseClasses} ${hasError ? errorClasses : normalClasses} ${className || ''}`;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Clear highlights when user starts typing
    if (onClearHighlights) {
      onClearHighlights();
    }
  };

  return (
    <textarea
      value={value}
      onChange={handleChange}
      placeholder={placeholder || "Paste your JSON here for online formatting, validation, or to check JSON syntax..."}
      className={textareaClasses}
      spellCheck="false"
      style={{ 
        fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', 
        fontSize: '14px',
        lineHeight: '1.5',
        background: 'rgba(30, 41, 59, 0.5)'
      }}
      aria-invalid={hasError}
      aria-describedby={hasError ? "json-input-error" : undefined}
    />
  );
};
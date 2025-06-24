import React, { useRef, useState, useEffect } from 'react';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);

  const baseClasses = "w-full h-full resize-none focus:outline-none focus:ring-2 rounded-b-md border";
  const errorClasses = "focus:ring-red-500 border-red-500/70 focus:border-red-500";
  const normalClasses = "focus:ring-indigo-500 border-slate-600/50 focus:border-indigo-500 focus:ring-offset-slate-800"; 

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Clear highlights when user starts typing
    if (onClearHighlights) {
      onClearHighlights();
    }
  };

  // Update line count when value changes
  useEffect(() => {
    const lines = value.split('\n').length;
    setLineCount(Math.max(1, lines));
  }, [value]);

  // Sync scroll between textarea and line numbers
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <div className={`relative flex w-full h-full ${className || ''}`}>
      {/* Line Numbers */}
      <div 
        ref={lineNumbersRef}
        className="flex-shrink-0 w-12 bg-slate-600/30 border-r border-slate-600/50 overflow-hidden"
        style={{
          fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: '14px',
          lineHeight: '1.5',
        }}
      >
        <div className="px-2 py-4 text-slate-400 text-right select-none">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1} className="leading-6">
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Text Area */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onScroll={handleScroll}
        placeholder={placeholder || "Paste your JSON here for online formatting, validation, or to check JSON syntax..."}
        className={`${baseClasses} ${hasError ? errorClasses : normalClasses} pl-4 pr-4 py-4 text-slate-200 bg-transparent flex-1`}
        spellCheck="false"
        style={{ 
          fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', 
          fontSize: '14px',
          lineHeight: '1.5',
          background: 'rgba(30, 41, 59, 0.5)',
          tabSize: 2,
          whiteSpace: 'pre',
          overflow: 'auto',
          resize: 'none'
        }}
        aria-invalid={hasError}
        aria-describedby={hasError ? "json-input-error" : undefined}
      />
    </div>
  );
};

import React from 'react';

interface JsonOutputProps {
  data: string;
  className?: string;
  // selectedOutputFormat?: 'json' | 'python'; // No longer needed for this simpler version
}

export const JsonOutput: React.FC<JsonOutputProps> = ({ data, className }) => {
  return (
    <pre 
        className={`w-full h-full p-4 overflow-auto text-slate-200 rounded-b-md ${className || ''}`}
        style={{ 
          fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', 
          background: 'rgba(30, 41, 59, 0.5)' /* slate-800 with 50% opacity */
        }}
    >
      <code>{data}</code>
    </pre>
  );
};

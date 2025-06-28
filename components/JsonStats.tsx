import React from 'react';
import { useTheme } from '../hooks/useTheme';

interface JsonStatsProps {
  originalText: string;
  formattedText: string;
  className?: string;
}

export const JsonStats: React.FC<JsonStatsProps> = ({ 
  originalText, 
  formattedText, 
  className 
}) => {
  const { theme } = useTheme();
  const calculateStats = (text: string) => {
    const bytes = new Blob([text]).size;
    const lines = text ? text.split('\n').length : 0;
    const characters = text.length;
    const words = text ? text.split(/\s+/).filter(word => word.length > 0).length : 0;
    
    return {
      bytes,
      kb: (bytes / 1024).toFixed(2),
      lines,
      characters,
      words
    };
  };

  const originalStats = calculateStats(originalText);
  const formattedStats = calculateStats(formattedText);
  
  const compressionRatio = originalText && formattedText && originalStats.bytes > 0
    ? ((1 - formattedStats.bytes / originalStats.bytes) * 100).toFixed(1)
    : null;

  const showComparison = originalText && formattedText && originalText !== formattedText;

  return (
    <div className={`text-xs ${
      theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
    } ${className || ''}`}>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <strong className={theme === 'dark' ? 'text-slate-300' : 'text-gray-800'}>Characters:</strong> {formattedStats.characters.toLocaleString()}
        </span>
        <span>
          <strong className={theme === 'dark' ? 'text-slate-300' : 'text-gray-800'}>Lines:</strong> {formattedStats.lines.toLocaleString()}
        </span>
        <span>
          <strong className={theme === 'dark' ? 'text-slate-300' : 'text-gray-800'}>Size:</strong> {formattedStats.kb} KB
        </span>
        {showComparison && compressionRatio && (
          <span className={`${Number(compressionRatio) > 0 ? 'text-green-400' : 'text-red-400'}`}>
            <strong>Compression:</strong> {Number(compressionRatio) > 0 ? '+' : ''}{compressionRatio}%
          </span>
        )}
      </div>
    </div>
  );
}; 
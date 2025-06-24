import React from 'react';
import { TextShimmer } from './ui/text-shimmer';
import { SparklesIcon } from '../constants';

export const AiLoadingIndicator: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-3 py-8">
      <div className="flex items-center space-x-2">
        <SparklesIcon className="w-6 h-6 text-indigo-400 animate-pulse" style={{ animationDuration: '2s' }} />
        <TextShimmer 
          className="text-lg font-medium [--base-color:theme(colors.slate.400)] [--base-gradient-color:theme(colors.indigo.400)] dark:[--base-color:theme(colors.slate.400)] dark:[--base-gradient-color:theme(colors.indigo.400)]" 
          duration={1.8}
        >
          AI is processing your data...
        </TextShimmer>
        <SparklesIcon className="w-6 h-6 text-indigo-400 animate-pulse" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
      </div>
      <p className="text-sm text-slate-400 animate-pulse" style={{ animationDuration: '3s' }}>This may take a moment</p>
    </div>
  );
}; 
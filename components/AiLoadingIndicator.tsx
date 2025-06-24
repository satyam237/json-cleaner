import React from 'react';
import { TextShimmer } from './ui/text-shimmer';

export const AiLoadingIndicator: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-3 py-8">
      <div className="flex items-center space-x-2">
        <TextShimmer 
          className="text-lg font-medium [--base-color:theme(colors.slate.400)] [--base-gradient-color:theme(colors.indigo.400)] dark:[--base-color:theme(colors.slate.400)] dark:[--base-gradient-color:theme(colors.indigo.400)]" 
          duration={1.8}
        >
          Analyzing and fixing your data...
        </TextShimmer>
      </div>
    </div>
  );
}; 
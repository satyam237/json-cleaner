import React, { useState } from 'react';

// Declare gtag for Google Analytics
declare global {
  function gtag(...args: any[]): void;
}

interface FeedbackWidgetProps {
  className?: string;
}

// Simple thumbs up/down icons
const ThumbsUpIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5.904 9.5h.799c.187 0 .374.038.56.11l.25.105c.312.132.642.26.968.49a.5.5 0 0 1 .327.501v.005a.5.5 0 0 1-.327.501c-.326.23-.656.358-.968.49l-.25.105a.5.5 0 0 1-.56.11H5.904Z" />
  </svg>
);

const ThumbsDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715a12.137 12.137 0 0 1-.068-1.285c0-2.848.992-5.464 2.649-7.521C5.287 4.247 5.886 4 6.504 4h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384m-10.253 1.5H9.7m8.075-9.75c.225.632.347 1.303.347 1.989 0 1.17-.131 2.316-.347 3.489m0-5.478c.328-1.013.566-2.094.566-3.239 0-.859.149-1.078-.353-1.28C17.499 2.244 16.974 2 16.5 2c-.866 0-1.633.426-2.061 1.057C14.016 3.571 13.5 4.206 13.5 4.989v.263c0 .085.014.168.042.248.056.16.059.337-.048.488C13.426 6.142 13.12 6.5 12.75 6.5h-.984" />
  </svg>
);

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({ className }) => {
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  const [showThankYou, setShowThankYou] = useState(false);

  const handleFeedback = (type: 'positive' | 'negative') => {
    setFeedback(type);
    setShowThankYou(true);
    
    // Track with Google Analytics if available
    if (typeof gtag !== 'undefined') {
      gtag('event', 'feedback', {
        event_category: 'user_engagement',
        event_label: type,
        custom_parameter_1: 'json_action'
      });
    }
    
    // Hide thank you message after 3 seconds
    setTimeout(() => {
      setShowThankYou(false);
    }, 3000);
  };

  if (showThankYou) {
    return (
      <div className={`bg-slate-700/20 backdrop-blur-md p-3 rounded-md border border-slate-600/40 text-center ${className || ''}`}>
        <p className="text-sm text-green-400">Thanks for your feedback! 🙏</p>
      </div>
    );
  }

  return (
    <div className={`bg-slate-700/20 backdrop-blur-md p-3 rounded-md border border-slate-600/40 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-300">Was this helpful?</p>
        <div className="flex space-x-2">
          <button
            onClick={() => handleFeedback('positive')}
            className={`p-1.5 rounded transition-colors ${
              feedback === 'positive'
                ? 'bg-green-500/20 text-green-400'
                : 'text-slate-400 hover:text-green-400 hover:bg-green-500/10'
            }`}
            title="Yes, this was helpful"
            aria-label="Yes, this was helpful"
          >
            <ThumbsUpIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleFeedback('negative')}
            className={`p-1.5 rounded transition-colors ${
              feedback === 'negative'
                ? 'bg-red-500/20 text-red-400'
                : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10'
            }`}
            title="No, this needs improvement"
            aria-label="No, this needs improvement"
          >
            <ThumbsDownIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
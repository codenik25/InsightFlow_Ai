import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorCardProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({
  title = 'An Error Occurred',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`bg-rose-950/20 border border-rose-800/60 rounded-2xl p-5 text-rose-300 space-y-3 shadow-lg ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl shrink-0 text-rose-400">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="space-y-1 flex-1">
          <h4 className="text-sm font-bold text-white tracking-tight">{title}</h4>
          <p className="text-xs text-rose-200/90 leading-relaxed font-mono">{message}</p>
        </div>
      </div>

      {onRetry && (
        <div className="pt-2 flex justify-end border-t border-rose-900/40">
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-900/60 hover:bg-rose-800/80 text-rose-100 rounded-xl text-xs font-semibold border border-rose-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Operation</span>
          </button>
        </div>
      )}
    </div>
  );
};

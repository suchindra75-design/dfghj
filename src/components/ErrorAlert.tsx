import React from 'react';
import { AlertCircle, RefreshCw, KeyRound, WifiOff, HelpCircle, X } from 'lucide-react';

interface ErrorAlertProps {
  error: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  apiKeyConfigured?: boolean;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  error,
  onRetry,
  onDismiss,
  apiKeyConfigured,
}) => {
  const isAuthError =
    error.toLowerCase().includes('key') ||
    error.toLowerCase().includes('private') ||
    error.toLowerCase().includes('authentication') ||
    error.toLowerCase().includes('403') ||
    error.toLowerCase().includes('-1');

  const isNetworkError =
    error.toLowerCase().includes('fetch') ||
    error.toLowerCase().includes('network') ||
    error.toLowerCase().includes('timeout') ||
    error.toLowerCase().includes('unavailable');

  return (
    <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs font-mono shadow-xs relative">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded bg-rose-100 text-rose-700 shrink-0 mt-0.5">
          {isAuthError ? (
            <KeyRound className="w-4 h-4" />
          ) : isNetworkError ? (
            <WifiOff className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
        </div>

        <div className="space-y-1.5 flex-1 pr-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-rose-900 tracking-tight text-sm">
              {isAuthError
                ? 'ThingSpeak Authentication / Private Channel Error'
                : isNetworkError
                ? 'ThingSpeak Connectivity / Timeout Issue'
                : 'Telemetry Ingestion Error'}
            </span>
          </div>

          <p className="text-rose-800 leading-relaxed">
            {error}
          </p>

          {isAuthError && (
            <div className="p-2.5 rounded bg-white border border-rose-200 text-rose-900 text-[11px] space-y-1 mt-2">
              <span className="font-semibold text-rose-950 block">CONFIGURATION NOTE:</span>
              <p className="text-slate-700">
                Channel 3469764 is a private channel. If the channel is locked, configure your private ThingSpeak Read API Key via environment variables:
              </p>
              <code className="block bg-slate-50 border border-slate-200 p-1.5 rounded text-[#2563EB] font-mono">
                THINGSPEAK_READ_API_KEY="YOUR_KEY_HERE"
              </code>
              <p className="text-[#64748B]">
                In Google AI Studio, define this in the Settings &rarr; Secrets panel. The server will automatically use it without exposing it to the client.
              </p>
            </div>
          )}

          {onRetry && (
            <div className="pt-2">
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 font-medium transition-colors shadow-2xs"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Connection</span>
              </button>
            </div>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 p-1 rounded transition-colors"
            title="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

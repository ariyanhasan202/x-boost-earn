import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-[420px] px-4 pointer-events-none">
      {toasts.map((toast) => {
        let Icon = CheckCircle2;
        let bgStyle = 'bg-slate-900/90 text-white border-slate-700/50';
        let iconColor = 'text-emerald-400';

        if (toast.type === 'error') {
          Icon = AlertCircle;
          bgStyle = 'bg-rose-950/95 text-white border-rose-800/50';
          iconColor = 'text-rose-400';
        } else if (toast.type === 'info') {
          Icon = Info;
          bgStyle = 'bg-purple-950/95 text-white border-purple-800/50';
          iconColor = 'text-purple-300';
        }

        return (
          <div
            key={toast.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl backdrop-blur-md border ${bgStyle} animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-auto`}
          >
            <Icon size={18} className={`shrink-0 ${iconColor}`} />
            <p className="text-xs sm:text-sm font-medium leading-snug">{toast.message}</p>
          </div>
        );
      })}
    </div>
  );
};

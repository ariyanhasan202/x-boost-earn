import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { X, ExternalLink, Loader2, CheckCircle2, ShieldCheck, Send } from "lucide-react";

export const TaskModal: React.FC = () => {
  const { tasks, activeVerifyingTaskId, closeTaskModal, verifyTask, user } = useApp();
  const [hasVisited, setHasVisited] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!activeVerifyingTaskId) return null;

  const task = tasks.find((t) => t.id === activeVerifyingTaskId);
  if (!task) return null;

  const handleOpenLink = () => {
    setHasVisited(true);
    // Send open intent to authoritative backend for verification dwell-time tracking
    if (user?.uid) {
      fetch('/api/tasks/open-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, taskId: task.id })
      }).catch(() => {});
    }
    window.open(task.channelUrl, "_blank", "noopener,noreferrer");
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    await verifyTask(task.id);
    setIsVerifying(false);
  };

  const handleClose = () => {
    if (!isVerifying) {
      closeTaskModal();
    }
  };

  return (
    <div 
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col relative animate-in zoom-in-95 duration-150"
      >
        <button
          type="button"
          onClick={handleClose}
          disabled={isVerifying}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition disabled:opacity-40 cursor-pointer active:scale-90 z-10"
          aria-label="Close task verification dialog"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center">
            {task.iconType === "telegram" ? (
              <Send size={22} className="rotate-45" />
            ) : (
              <ShieldCheck size={24} />
            )}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base leading-tight">
              {task.title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-500">Task Reward:</span>
            <span className="font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100">
              + {task.reward.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Category:</span>
            <span className="font-semibold text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded-full text-[10px]">
              {task.categoryBadge}
            </span>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="text-xs font-semibold text-slate-700">Verification Steps:</div>
          <div className="flex items-start gap-2.5 text-xs text-slate-600">
            <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
              1
            </span>
            <div className="flex-1">
              <span>Open and join our official Telegram channel / sponsor group.</span>
            </div>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-slate-600">
            <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
              2
            </span>
            <div className="flex-1">
              <span>Return here and tap "Verify Membership" to confirm.</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleOpenLink}
            className="w-full py-3 px-4 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-xs flex items-center justify-center gap-2 transition active:scale-[0.99]"
          >
            <span>Open Channel Link</span>
            <ExternalLink size={14} />
          </button>

          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#7c25d3] via-[#b81d8f] to-[#e6327e] text-white font-bold text-sm shadow-md shadow-purple-500/25 hover:opacity-95 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isVerifying ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Verifying Telegram Status...</span>
              </>
            ) : hasVisited ? (
              <>
                <CheckCircle2 size={16} />
                <span>Verify & Claim {task.reward.toFixed(2)}</span>
              </>
            ) : (
              <span>I Have Joined - Verify Now</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

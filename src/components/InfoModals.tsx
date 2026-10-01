import React from "react";
import { useApp } from "../context/AppContext";
import {
  X,
  Send,
  ShieldAlert,
  Zap,
  Users,
  Copy,
  Share2,
  ExternalLink
} from "lucide-react";
import { APP_CONFIG } from "../config/appConfig";

export const InfoModals: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    user,
    levelDetails,
    copyReferralLink,
    addDemoBalance,
    simulateSingleReferral,
    simulateMilestoneReferrals,
    testDuplicateReferral,
    testSelfReferral,
    testDoubleDailyClaim,
  } = useApp();

  if (!activeModal) return null;

  const referralLink = APP_CONFIG.getReferralLink(user.referralCode);

  const banglaRulesList = [
    "ন্যূনতম উইথড্রয়াল অ্যামাউন্ট ১৫০০ টাকা।",
    "প্রতি ৫০০ টাকা উত্তোলনে ১০০ টাকা সার্ভিস চার্জ কর্তন করা হবে।",
    "উইথড্রয়াল রিকোয়েস্ট bKash অথবা Nagad-এ গ্রহণ করা হয়।",
    "দৈনিক রিওয়ার্ড এবং টাস্ক রিওয়ার্ড সরাসরি ব্যালেন্সে যুক্ত হয়।",
    "একই ব্যক্তি একাধিক অ্যাকাউন্ট খুললে ব্যান করা হতে পারে।",
    "অফিসিয়াল টেলিগ্রাম চ্যানেল ও সাপোর্ট গ্রুপে যুক্ত থাকা আবশ্যক।"
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-[420px] bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col relative max-h-[88vh] overflow-y-auto">
        <button
          onClick={() => setActiveModal(null)}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {activeModal === "support" && (
          <div>
            <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-4">
              <Send size={24} className="rotate-45" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Help & Support</h3>
            <p className="text-xs text-slate-500 mb-4">
              Need assistance with your account, task verification, reward claims, or payout requests?
            </p>
            <div className="space-y-3 mb-6 text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 font-medium text-slate-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Live Telegram Support: 10:00 AM - 10:00 PM (BST)
              </div>
              <p>
                Our official Telegram community and admin support can verify transaction IDs and assist with questions.
              </p>
              <div className="text-[11px] text-slate-500 font-mono bg-white p-2 rounded-lg border border-slate-200">
                Direct Contact: @Trading_usss_1
              </div>
            </div>
            <button
              onClick={() => {
                window.open("https://t.me/Trading_usss_1", "_blank", "noopener,noreferrer");
                setActiveModal(null);
              }}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-sm shadow-md hover:opacity-95 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Contact Support / Admin</span>
              <ExternalLink size={16} />
            </button>
          </div>
        )}

        {activeModal === "rules" && (
          <div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <ShieldAlert size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">App Rules</h3>
            <p className="text-xs text-slate-500 mb-4">
              গুরুত্বপূর্ণ নিয়ম ও নীতিমালা মেনে চলুন
            </p>
            <div className="space-y-2 mb-6 text-xs text-slate-700 max-h-[50vh] overflow-y-auto pr-1">
              {banglaRulesList.map((rule, index) => (
                <div key={index} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <p className="text-slate-700 leading-relaxed flex-1 text-[11px]">
                    {rule}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition cursor-pointer"
            >
              Understand & Agree
            </button>
          </div>
        )}

        {activeModal === "faucet" && (
          <div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
              <Zap size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-0.5">Referral & Level Verification</h3>
            <p className="text-xs text-slate-500 mb-3">
              Test all required referral levels, anti-duplicate validation, and daily claims.
            </p>
            <div className="space-y-3 mb-4">
              <div className="p-3 bg-purple-50/70 rounded-2xl border border-purple-100/80">
                <div className="text-[11px] font-bold text-purple-900 mb-1">Current Status</div>
                <div className="text-xs text-purple-800 flex justify-between">
                  <span>Level: <strong>{levelDetails.levelDisplay}</strong></span>
                  <span>Daily Reward: <strong>৳ {levelDetails.dailyReward}</strong></span>
                  <span>Refs: <strong>{user.totalReferrals}</strong></span>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Single Simulated Referral (+৳ 50)</label>
                <button
                  onClick={simulateSingleReferral}
                  className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Users size={14} />
                  <span>+1 Verified Referral (Adds ৳ 50)</span>
                </button>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Milestone Referral Upgrades</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button onClick={() => simulateMilestoneReferrals(40)} className="py-2 px-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition text-center cursor-pointer">LV 1 (40)</button>
                  <button onClick={() => simulateMilestoneReferrals(80)} className="py-2 px-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition text-center cursor-pointer">LV 2 (80)</button>
                  <button onClick={() => simulateMilestoneReferrals(120)} className="py-2 px-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition text-center cursor-pointer">LV 3 (120)</button>
                  <button onClick={() => simulateMilestoneReferrals(180)} className="py-2 px-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition text-center cursor-pointer">LV 4 (180)</button>
                  <button onClick={() => simulateMilestoneReferrals(240)} className="py-2 px-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition text-center cursor-pointer">LV 5 (240)</button>
                  <button onClick={() => simulateMilestoneReferrals(300)} className="py-2 px-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] transition text-center shadow-xs cursor-pointer">VIP (300)</button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Anti-Fraud & Constraint Tests</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button onClick={testDuplicateReferral} className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[10px] border border-rose-200 transition cursor-pointer">Test Duplicate</button>
                  <button onClick={testSelfReferral} className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[10px] border border-rose-200 transition cursor-pointer">Test Self-Ref</button>
                  <button onClick={testDoubleDailyClaim} className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[10px] border border-rose-200 transition cursor-pointer">Test 2x Daily</button>
                </div>
              </div>
              <div className="pt-1">
                <button onClick={() => addDemoBalance(1500)} className="w-full py-2.5 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-bold transition cursor-pointer">
                  Add ৳ 1,500 (Test Min. Payout)
                </button>
              </div>
            </div>
            <button onClick={() => setActiveModal(null)} className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition cursor-pointer">Close</button>
          </div>
        )}

        {activeModal === "share" && (
          <div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <Share2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Share Referral Link</h3>
            <p className="text-xs text-slate-500 mb-4">
              Share your link with friends to earn ৳ {APP_CONFIG.referralRewardAmount.toFixed(2)} per invite!
            </p>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 mb-4 flex items-center justify-between gap-2">
              <div className="text-xs text-slate-700 font-mono truncate flex-1">{referralLink}</div>
              <button
                onClick={copyReferralLink}
                className="p-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition shrink-0 cursor-pointer"
                aria-label="Copy link"
              >
                <Copy size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => {
                  const text = `Join me on X BOOST and get ৳ ${APP_CONFIG.referralRewardAmount.toFixed(2)} bonus! ${referralLink}`;
                  window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`, "_blank");
                }}
                className="py-3 rounded-xl bg-[#229ED9] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Send size={14} className="rotate-45" />
                <span>Telegram</span>
              </button>
              <button
                onClick={() => {
                  const text = `Join me on X BOOST and get ৳ ${APP_CONFIG.referralRewardAmount.toFixed(2)} bonus! ${referralLink}`;
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
                }}
                className="py-3 rounded-xl bg-[#25D366] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>WhatsApp</span>
              </button>
            </div>
            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition cursor-pointer"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

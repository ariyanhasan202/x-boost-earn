import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Wallet, ArrowDownToLine, Clock, Zap, AlertCircle, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { PaymentMethod } from '../types';
import { APP_CONFIG } from '../config/appConfig';

export const WithdrawScreen: React.FC = () => {
  const { user, withdrawals, submitWithdrawal, showToast } = useApp();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bkash');
  const [accountNumber, setAccountNumber] = useState('');
  const [amountStr, setAmountStr] = useState('1500');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amount = parseFloat(amountStr) || 0;
  const isBelowMin = amount > 0 && amount < APP_CONFIG.minWithdrawalAmount;

  // Dynamic formula: Every 500 withdrawal amount = 100 charge
  // Charge = Withdrawal Amount / 500 * 100
  // Total Payout / Cash In = Withdrawal Amount - Charge
  const serviceCharge = amount > 0 ? APP_CONFIG.calculateWithdrawalCharge(amount) : 0;
  const receiveAmount = amount > 0 ? APP_CONFIG.calculateUserPayout(amount) : 0;

  const handleRequestPayout = async () => {
    if (isSubmitting) return;
    if (amount < APP_CONFIG.minWithdrawalAmount) {
      showToast(`Minimum withdrawal amount is ৳ ${APP_CONFIG.minWithdrawalAmount.toFixed(0)}.`, 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await submitWithdrawal(paymentMethod, accountNumber, amount);
      if (!result.success && result.error) {
        showToast(result.error, 'error');
      } else {
        setAccountNumber('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase().trim();
    if (s === 'complete' || s === 'completed' || s === 'approved' || s === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-200">
          <CheckCircle2 size={11} />
          {status}
        </span>
      );
    }
    if (s === 'next day') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-200">
          <Clock size={11} />
          {status}
        </span>
      );
    }
    if (s === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold border border-rose-200">
          <XCircle size={11} />
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold border border-amber-200">
        <Clock size={11} />
        {status || 'Pending'}
      </span>
    );
  };

  return (
    <div className="w-full min-h-screen pb-24 bg-[#f6f7fb]">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-b-[38px] px-6 pt-7 pb-8 text-white shadow-sm bg-gradient-to-br from-[#7412d8] via-[#a31293] via-[#df1466] to-[#fa6d3d]">
        <div className="absolute -top-10 -right-10 w-60 h-60 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute top-16 right-4 w-48 h-48 rounded-full bg-pink-400/10 pointer-events-none" />
        
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold tracking-wider uppercase text-white/80">
              AVAILABLE BALANCE
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mt-0.5">
              ৳ {user.balance.toFixed(2)}
            </div>
            <div className="text-xs text-white/90 mt-1 font-semibold">
              Minimum withdrawal: ৳ 1500
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-md">
            <Wallet size={22} />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 -mt-3.5 space-y-4 z-10 relative">
        <div className="bg-white rounded-[26px] p-5 shadow-sm border border-slate-100/90 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
              <ArrowDownToLine size={20} className="text-[#7c25d3]" />
              <span>Request Payout</span>
            </div>
          </div>

          {/* Payment Method Switcher */}
          <div>
            <div className="text-xs font-bold text-slate-700 mb-2">Payment Method</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('bkash')}
                className={`py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  paymentMethod === 'bkash'
                    ? 'bg-[#e2136e] text-white shadow-md shadow-pink-600/30'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Zap size={16} className={paymentMethod === 'bkash' ? 'text-white' : 'text-[#e2136e]'} />
                <span>bKash</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('nagad')}
                className={`py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  paymentMethod === 'nagad'
                    ? 'bg-[#f7931e] text-white shadow-md shadow-amber-500/30'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                  paymentMethod === 'nagad' ? 'bg-white text-[#f7931e]' : 'bg-[#f7931e] text-white'
                }`}>
                  ৳
                </span>
                <span>Nagad</span>
              </button>
            </div>
          </div>

          {/* Account Number */}
          <div>
            <label htmlFor="account-number" className="block text-xs font-bold text-slate-700 mb-1.5">
              Account Number
            </label>
            <input
              id="account-number"
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="01XXXXXXXXX"
              maxLength={11}
              className="w-full px-4 py-3 rounded-2xl bg-[#f8f9fc] border border-slate-200/80 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 font-medium transition"
            />
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="amount-input" className="text-xs font-bold text-slate-700">Withdrawal Amount</label>
              <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                Min: ৳ 1500
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm">৳</span>
              <input
                id="amount-input"
                type="number"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                min="1500"
                step="100"
                className={`w-full pl-9 pr-4 py-3 rounded-2xl bg-[#f8f9fc] border text-sm text-slate-800 focus:outline-none font-bold transition ${
                  isBelowMin ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500' : 'border-slate-200/80 focus:border-purple-500'
                }`}
              />
            </div>
            {/* Validation Message if entered amount is below minimum */}
            {isBelowMin && (
              <div className="mt-2 text-xs font-semibold text-rose-600 flex items-center gap-1.5 bg-rose-50 p-2 rounded-xl border border-rose-100 animate-in fade-in duration-150">
                <AlertCircle size={14} className="shrink-0" />
                <span>Minimum withdrawal amount is ৳ 1500. Please enter at least ৳ 1500.</span>
              </div>
            )}
          </div>

          {/* Dynamic Withdrawal Fee Calculation Breakdown */}
          <div className="bg-[#f9fafc] rounded-2xl p-4 border border-slate-100 text-xs space-y-2.5">
            <div className="flex items-center justify-between text-slate-600">
              <span className="font-medium">Withdrawal Amount</span>
              <span className="font-bold text-slate-800 text-sm">৳ {amount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <div>
                <span className="font-medium">Service Charge</span>
                <span className="block text-[10px] text-slate-400 font-mono">(৳ 100 per ৳ 500)</span>
              </div>
              <span className="font-bold text-rose-600 text-sm">৳ {serviceCharge.toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-200/80 my-2 pt-2">
              <div className="flex items-center justify-between font-bold text-sm">
                <span className="text-slate-800">You Receive</span>
                <span className="text-emerald-600 text-base font-extrabold">৳ {receiveAmount.toFixed(2)}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                <span>Total Pay Out / Cash In</span>
                <span>Minimum withdrawal: ৳ 1500</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleRequestPayout}
            disabled={isBelowMin || amount <= 0 || isSubmitting}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#e55039] via-[#eb2f96] to-[#7c25d3] text-white font-bold text-base shadow-lg shadow-pink-500/25 hover:opacity-95 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>{isSubmitting ? 'Processing...' : `Request ${amount >= 1500 ? `৳ ${amount.toFixed(2)}` : '৳ 1500.00'}`}</span>
          </button>
        </div>

        {/* Recent Transactions */}
        <div className="pt-2">
          <div className="text-sm font-bold text-slate-800 mb-2.5">Recent Transactions</div>
          {withdrawals.length === 0 ? (
            <div className="border-2 border-dashed border-purple-200/70 rounded-2xl py-8 px-4 text-center bg-white/40">
              <p className="text-xs text-slate-400 font-medium">No withdrawal history yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {withdrawals.map((tx) => (
                <div key={tx.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs uppercase">
                      {tx.method === 'bkash' ? 'bKash' : 'Nagad'}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-xs">৳ {tx.amount.toFixed(2)} payout</div>
                      <div className="text-[11px] text-slate-400">To: {tx.accountNumber} • {tx.createdAt}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    {renderStatusBadge(tx.status)}
                    <div className="text-[11px] text-emerald-600 font-bold mt-1">
                      Net: ৳ {tx.receiveAmount.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

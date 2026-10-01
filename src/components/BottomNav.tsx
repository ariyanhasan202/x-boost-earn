import React from 'react';
import { Home, ClipboardCheck, Users, CreditCard, User } from 'lucide-react';
import { NavTab } from '../types';
import { useApp } from '../context/AppContext';

interface NavItemConfig {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'earn', label: 'Earn', icon: ClipboardCheck },
  { id: 'refer', label: 'Refer', icon: Users },
  { id: 'withdraw', label: 'Withdraw', icon: CreditCard },
  { id: 'profile', label: 'Profile', icon: User },
];

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
      <nav 
        aria-label="Bottom Navigation"
        className="w-full max-w-[500px] bg-white/95 backdrop-blur-md border-t border-slate-100/90 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] px-3 pt-2 pb-2.5 flex items-center justify-around pointer-events-auto transition-all"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex flex-col items-center justify-center flex-1 py-1 relative group transition-colors duration-150 focus:outline-none cursor-pointer"
            >
              <div className="relative">
                <Icon
                  size={23}
                  strokeWidth={isActive ? 2.3 : 1.8}
                  className={`transition-colors duration-150 ${
                    isActive ? 'text-[#7e22ce]' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#7e22ce]" />
                )}
              </div>
              <span
                className={`text-[11px] mt-1 font-medium tracking-tight transition-colors duration-150 ${
                  isActive ? 'text-[#7e22ce] font-semibold' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

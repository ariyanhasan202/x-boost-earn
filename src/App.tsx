import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { BottomNav } from './components/BottomNav';
import { ToastContainer } from './components/Toast';
import { AdModal } from './components/AdModal';
import { TaskModal } from './components/TaskModal';
import { InfoModals } from './components/InfoModals';
import { HomeScreen } from './screens/HomeScreen';
import { EarnScreen } from './screens/EarnScreen';
import { ReferScreen } from './screens/ReferScreen';
import { WithdrawScreen } from './screens/WithdrawScreen';
import { ProfileScreen } from './screens/ProfileScreen';

const MainAppContent: React.FC = () => {
  const { activeTab } = useApp();

  return (
    <div className="min-h-screen bg-[#f1f2f8] flex justify-center selection:bg-purple-500 selection:text-white">
      <main className="w-full max-w-[500px] min-h-screen bg-[#f6f7fb] relative shadow-2xl overflow-x-hidden flex flex-col">
        <div className="flex-1 w-full">
          {activeTab === 'home' && <HomeScreen />}
          {activeTab === 'earn' && <EarnScreen />}
          {activeTab === 'refer' && <ReferScreen />}
          {activeTab === 'withdraw' && <WithdrawScreen />}
          {activeTab === 'profile' && <ProfileScreen />}
        </div>
        <BottomNav />
        <ToastContainer />
        <AdModal />
        <TaskModal />
        <InfoModals />
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}

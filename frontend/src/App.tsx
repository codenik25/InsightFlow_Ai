import React, { useState } from 'react';
import { Homepage } from './components/Homepage/Homepage';
import DashboardApp from './DashboardApp';
import { AuthProvider } from './context/AuthContext';

export const App: React.FC = () => {
  const [view, setView] = useState<'homepage' | 'platform'>(() => {
    if (typeof window !== 'undefined') {
      const urlView = new URLSearchParams(window.location.search).get('view');
      if (urlView === 'homepage') return 'homepage';
      if (urlView === 'platform') return 'platform';
      const hasLaunched = localStorage.getItem('insightflow_has_launched') === 'true';
      if (hasLaunched) return 'platform';
    }
    return 'platform';
  });

  const handleLaunch = () => {
    localStorage.setItem('insightflow_has_launched', 'true');
    setView('platform');
  };

  return (
    <AuthProvider>
      {view === 'homepage' ? (
        <Homepage onLaunch={handleLaunch} />
      ) : (
        <DashboardApp />
      )}
    </AuthProvider>
  );
};

export default App;

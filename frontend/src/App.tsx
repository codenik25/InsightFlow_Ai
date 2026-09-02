import React, { useState } from 'react';
import { Homepage } from './components/Homepage/Homepage';
import DashboardApp from './DashboardApp'; // We will rename the original App content to DashboardApp

export const App: React.FC = () => {
  const [view, setView] = useState<'homepage' | 'platform'>('homepage');

  if (view === 'homepage') {
    return <Homepage onLaunch={() => setView('platform')} />;
  }

  return <DashboardApp />;
};

export default App;

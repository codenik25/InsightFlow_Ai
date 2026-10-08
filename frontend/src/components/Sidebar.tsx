// Deprecated: Navigation has moved into the primary IF Header logo control and SlideDownNavigation overlay.
// This export remains for backward-compatibility if imported.
import React from 'react';

interface SidebarProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = () => {
  return null;
};

export default Sidebar;

import React from 'react';
import { ActiveTab } from '../types';
import {
  LayoutDashboard,
  Activity,
  History,
  Table,
  FileDown,
  Settings,
} from 'lucide-react';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

const NAV_ITEMS: { id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'monitor', label: 'Live', icon: Activity },
  { id: 'historical', label: 'History', icon: History },
  { id: 'table', label: 'Table', icon: Table },
  { id: 'export', label: 'Export', icon: FileDown },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  return (
    <nav
      id="mobile-bottom-navigation"
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E2E8F0] shadow-md pb-safe select-none"
    >
      <div className="flex items-center justify-around h-14 px-1">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center h-full py-1 min-h-[44px] transition-colors relative ${
                isActive
                  ? 'text-[#2563EB] font-semibold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#2563EB] rounded-full" />
              )}
              <Icon className={`w-4 h-4 transition-transform ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[10px] font-mono tracking-tight mt-0.5 leading-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

import React from 'react';
import { ActiveTab } from '../types';
import { LayoutDashboard, Activity, History, Table, FileDown, Settings } from 'lucide-react';
import { motion } from 'motion/react';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

const NAV_ITEMS: { id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'overview', label: 'Home', icon: LayoutDashboard },
  { id: 'monitor', label: 'Live', icon: Activity },
  { id: 'historical', label: 'History', icon: History },
  { id: 'table', label: 'Table', icon: Table },
  { id: 'export', label: 'Reports', icon: FileDown },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  return (
    <nav
      id="mobile-bottom-navigation"
      aria-label="Main navigation"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-safe select-none pointer-events-none"
    >
      <div className="glass pointer-events-auto mb-2 flex items-center justify-between h-16 px-1.5 rounded-2xl ring-1 ring-[#0F172A]/[0.07] shadow-lg">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 h-12 rounded-xl transition-colors ${
                isActive ? 'text-[#4338CA]' : 'text-[#64748B] active:text-[#0B1220]'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="bottomNavPill"
                  className="absolute inset-0 rounded-xl bg-[#EEF2FF]"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                />
              )}
              <Icon className="relative w-[19px] h-[19px]" />
              <span className={`relative text-[10px] leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

import React from 'react';
import { ActiveTab, ThingSpeakChannel } from '../types';
import {
  LayoutDashboard,
  Radio,
  Calendar,
  Database,
  FileText,
  Settings,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { motion } from 'motion/react';
import { BrandMark } from './BrandMark';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  channel: ThingSpeakChannel | null;
  totalRecords: number;
  isPolling: boolean;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  channel,
  totalRecords,
  isPolling,
}) => {
  const workspace: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'monitor', label: 'Live EEG', icon: Radio },
    { id: 'historical', label: 'History', icon: Calendar },
    {
      id: 'table',
      label: 'Data Table',
      icon: Database,
      badge: totalRecords > 0 ? totalRecords.toLocaleString() : undefined,
    },
  ];
  const tools: NavItem[] = [
    { id: 'export', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        id={`nav-item-${item.id}`}
        onClick={() => setActiveTab(item.id)}
        aria-current={isActive ? 'page' : undefined}
        className={`relative w-full flex items-center justify-between h-9 px-3 text-[13px] rounded-md transition-colors duration-150 text-left group ${
          isActive ? 'text-[#312E81] font-semibold' : 'text-[#475569] font-medium hover:text-[#0B1220] hover:bg-[#F1F5F9]'
        }`}
      >
        {isActive && (
          <motion.div
            layoutId="activeSidebarIndicator"
            className="absolute inset-0 rounded-md bg-white shadow-sm ring-1 ring-[#E0E7FF]"
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
          />
        )}

        <span className="relative z-10 flex items-center gap-2.5 min-w-0">
          <Icon
            className={`w-[17px] h-[17px] shrink-0 transition-colors ${
              isActive ? 'text-[#4F46E5]' : 'text-[#94A3B8] group-hover:text-[#475569]'
            }`}
          />
          <span className="truncate">{item.label}</span>
        </span>

        {item.badge && (
          <span
            className={`relative z-10 text-[10.5px] font-mono px-1.5 py-px rounded-sm transition-colors ${
              isActive ? 'bg-[#EEF2FF] text-[#4338CA]' : 'bg-[#EEF1F5] text-[#64748B]'
            }`}
          >
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const channelId = channel?.id ?? '3469764';

  return (
    <aside
      id="desktop-sidebar"
      className="w-60 shrink-0 bg-[#F8FAFC]/80 border-r border-[#0F172A]/[0.06] flex flex-col justify-between select-none z-30 h-full"
    >
      <div>
        {/* Brand */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <BrandMark size={36} />
            <div className="min-w-0">
              <div className="text-[15px] font-semibold tracking-tight text-[#0B1220] leading-tight">
                Brainmatrix
              </div>
              <div className="text-[11px] text-[#64748B] leading-tight mt-0.5">EEG Workstation</div>
            </div>
          </div>
        </div>

        <nav className="px-3 space-y-5">
          <div>
            <div className="eyebrow px-3 pb-1.5">Workspace</div>
            <div className="space-y-0.5">{workspace.map(renderItem)}</div>
          </div>
          <div>
            <div className="eyebrow px-3 pb-1.5">Tools</div>
            <div className="space-y-0.5">{tools.map(renderItem)}</div>
          </div>
        </nav>
      </div>

      {/* Status card */}
      <div className="p-3">
        <div className="surface p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] font-medium text-[#0B1220]">
              <span className="relative flex h-2 w-2">
                {isPolling && (
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    isPolling ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              {isPolling ? 'Live sync' : 'Sync paused'}
            </span>
            <a
              href={`https://thingspeak.mathworks.com/channels/${channelId}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#94A3B8] hover:text-[#4F46E5] transition-colors"
              title="Open ThingSpeak channel"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <div className="text-[11px] text-[#64748B] font-mono">Channel #{channelId}</div>
          <div className="flex items-center gap-1.5 pt-2 border-t border-[#0F172A]/[0.06] text-[11px] text-[#64748B]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#4F46E5]" />
            <span>Research use only</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

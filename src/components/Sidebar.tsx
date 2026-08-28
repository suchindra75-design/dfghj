import React from 'react';
import { ActiveTab, ThingSpeakChannel } from '../types';
import {
  LayoutDashboard,
  Radio,
  Calendar,
  Database,
  FileText,
  Settings,
  Activity,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { motion } from 'motion/react';

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
  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'monitor', label: 'Live EEG', icon: Radio },
    { id: 'historical', label: 'Historical Data', icon: Calendar },
    { id: 'table', label: 'Data Table', icon: Database, badge: totalRecords > 0 ? totalRecords.toLocaleString() : undefined },
    { id: 'export', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      id="desktop-sidebar"
      className="w-56 shrink-0 bg-white border-r border-[#E2E8F0] flex flex-col justify-between select-none z-30 min-h-screen"
    >
      {/* Top Header Branding */}
      <div>
        <div className="px-4 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB] shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="font-mono text-[11px] font-bold tracking-wider text-[#0F172A] leading-tight">
                EEG SCIENTIFIC
              </div>
              <div className="font-mono text-[10px] text-[#64748B] tracking-wider uppercase">
                WORKSTATION
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="px-2 py-3">
          <div className="px-2 pb-1.5 text-[10px] font-mono font-semibold text-[#94A3B8] uppercase tracking-wider">
            Navigation
          </div>
          <nav className="space-y-1 relative">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-all duration-150 text-left group ${
                    isActive
                      ? 'text-[#1D4ED8] font-semibold'
                      : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {/* Smooth Active Indicator Glider */}
                  {isActive && (
                    <motion.div
                      layoutId="activeSidebarIndicator"
                      className="absolute inset-0 bg-[#EFF6FF] border-l-[3px] border-[#2563EB] rounded-md rounded-l-none z-0"
                      transition={{
                        type: 'spring',
                        stiffness: 450,
                        damping: 35,
                      }}
                    />
                  )}

                  <div className="relative z-10 flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-[#2563EB]'
                          : 'text-[#64748B] group-hover:text-[#0F172A]'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`relative z-10 text-[10px] font-mono px-1.5 py-0.2 rounded font-normal transition-colors ${
                        isActive
                          ? 'bg-[#DBEAFE] text-[#1E40AF]'
                          : 'bg-[#F1F5F9] text-[#64748B]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Sidebar Footer Info */}
      <div className="p-3 border-t border-[#E2E8F0] bg-[#F8FAFC] space-y-2 text-[11px] font-mono">
        <div className="flex items-center justify-between text-[#64748B]">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isPolling ? 'bg-[#16A34A] animate-pulse' : 'bg-[#D97706]'
              }`}
            />
            <span>CH #{channel?.id || '3469764'}</span>
          </span>
          <a
            href={`https://thingspeak.mathworks.com/channels/${channel?.id || '3469764'}`}
            target="_blank"
            rel="noreferrer"
            className="text-[#94A3B8] hover:text-[#2563EB] transition-colors"
            title="Open ThingSpeak Channel"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="text-[10px] text-[#94A3B8] flex items-center justify-between pt-1 border-t border-[#E2E8F0]">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#2563EB]" />
            <span>Non-Clinical</span>
          </span>
          <span>v2.4</span>
        </div>
      </div>
    </aside>
  );
};

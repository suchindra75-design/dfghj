import React, { useState } from 'react';
import { ThingSpeakChannel, ChannelFieldDefinition } from '../types';
import {
  Settings,
  Sliders,
  Radio,
  Clock,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Eye,
  EyeOff,
} from 'lucide-react';

interface SettingsViewProps {
  channel: ThingSpeakChannel | null;
  channels: ChannelFieldDefinition[];
  onToggleChannel: (fieldKey: string) => void;
  apiKeyConfigured: boolean;
  totalRecords: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  channel,
  channels,
  onToggleChannel,
  apiKeyConfigured,
  totalRecords,
}) => {
  const [timeDisplayMode, setTimeDisplayMode] = useState<'utc' | 'local'>('utc');
  const [voltageUnit, setVoltageUnit] = useState<'uV' | 'mV'>('uV');
  const [cacheRetention, setCacheRetention] = useState<string>('all');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const handleSavePreferences = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div id="settings-view" className="space-y-5">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
        <div>
          <h2 className="text-base font-bold text-[#0F172A] tracking-tight font-mono">
            WORKSTATION CONFIGURATION & HARDWARE SETTINGS
          </h2>
          <p className="text-xs text-[#64748B] font-mono mt-0.5">
            Configure telemetry channels, interface preferences, and connection parameters.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
            <span>Preferences updated</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Channel & Hardware Configurations */}
        <div className="lg:col-span-2 space-y-5">
          {/* Section 1: Channel Calibration & Visibility */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider font-mono">
                  ACTIVE TELEMETRY CHANNELS ({channels.filter(c => c.visible).length}/{channels.length} ENABLED)
                </h3>
              </div>
              <span className="text-[11px] font-mono text-[#64748B]">
                Toggle default plotting state
              </span>
            </div>

            <div className="border border-[#E2E8F0] rounded-lg divide-y divide-[#E2E8F0] bg-white shadow-2xs">
              {channels.map(ch => (
                <div
                  key={ch.fieldKey}
                  className="p-3 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: ch.color }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#0F172A]">
                          {ch.label}
                        </span>
                        <span className="text-[10px] font-mono text-[#64748B] px-1.5 py-0.2 rounded bg-[#F1F5F9]">
                          {ch.fieldKey}
                        </span>
                        <span className="text-[10px] font-mono text-[#2563EB] font-medium">
                          [{ch.unit}]
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748B] truncate max-w-md">
                        {ch.description}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onToggleChannel(ch.fieldKey)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
                      ch.visible
                        ? 'bg-blue-50 border-blue-200 text-[#2563EB] font-semibold'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8]'
                    }`}
                  >
                    {ch.visible ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Visible</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hidden</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Display & Unit Preferences */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider font-mono">
                DISPLAY & LOCALIZATION PREFERENCES
              </h3>
            </div>

            <div className="p-4 border border-[#E2E8F0] rounded-lg bg-white shadow-2xs space-y-4 text-xs font-mono">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[#64748B] font-semibold block">
                    TIMESTAMP DISPLAY STANDARD:
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTimeDisplayMode('utc')}
                      className={`flex-1 py-1.5 px-3 rounded border text-xs font-medium transition-colors ${
                        timeDisplayMode === 'utc'
                          ? 'bg-[#2563EB] border-[#2563EB] text-white font-semibold shadow-2xs'
                          : 'bg-white border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      UTC (Coordinated Universal Time)
                    </button>
                    <button
                      onClick={() => setTimeDisplayMode('local')}
                      className={`flex-1 py-1.5 px-3 rounded border text-xs font-medium transition-colors ${
                        timeDisplayMode === 'local'
                          ? 'bg-[#2563EB] border-[#2563EB] text-white font-semibold shadow-2xs'
                          : 'bg-white border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      Local System Clock
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#64748B] font-semibold block">
                    PRIMARY EEG VOLTAGE SCALE:
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setVoltageUnit('uV')}
                      className={`flex-1 py-1.5 px-3 rounded border text-xs font-medium transition-colors ${
                        voltageUnit === 'uV'
                          ? 'bg-[#2563EB] border-[#2563EB] text-white font-semibold shadow-2xs'
                          : 'bg-white border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      Microvolts (µV) — Default
                    </button>
                    <button
                      onClick={() => setVoltageUnit('mV')}
                      className={`flex-1 py-1.5 px-3 rounded border text-xs font-medium transition-colors ${
                        voltageUnit === 'mV'
                          ? 'bg-[#2563EB] border-[#2563EB] text-white font-semibold shadow-2xs'
                          : 'bg-white border-[#CBD5E1] text-[#334155] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      Millivolts (mV)
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E2E8F0] flex justify-end">
                <button
                  onClick={handleSavePreferences}
                  className="px-4 py-2 rounded bg-[#2563EB] hover:bg-blue-700 text-white font-semibold transition-colors shadow-2xs"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Connection & Compliance Info */}
        <div className="space-y-5">
          {/* ThingSpeak Endpoint Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider font-mono">
                THINGSPEAK CONNECTION
              </h3>
            </div>

            <div className="p-4 border border-[#E2E8F0] rounded-lg bg-white shadow-2xs space-y-3 text-xs font-mono">
              <div className="space-y-2">
                <div className="flex justify-between pb-1.5 border-b border-[#E2E8F0]">
                  <span className="text-[#64748B]">Channel ID:</span>
                  <strong className="text-[#0F172A]">{channel?.id || '3469764'}</strong>
                </div>

                <div className="flex justify-between pb-1.5 border-b border-[#E2E8F0]">
                  <span className="text-[#64748B]">Channel Name:</span>
                  <strong className="text-[#0F172A] truncate max-w-[140px]">
                    {channel?.name || 'SLEEP MONITORING'}
                  </strong>
                </div>

                <div className="flex justify-between pb-1.5 border-b border-[#E2E8F0]">
                  <span className="text-[#64748B]">Read Access:</span>
                  <span className="text-[#16A34A] font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Public Channel
                  </span>
                </div>

                <div className="flex justify-between pb-1.5 border-b border-[#E2E8F0]">
                  <span className="text-[#64748B]">Cached Samples:</span>
                  <strong className="text-[#0F172A]">{totalRecords.toLocaleString()}</strong>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#64748B]">Direct API:</span>
                  <a
                    href="https://api.thingspeak.com/channels/3469764/feeds.json?results=8000"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#2563EB] hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>feeds.json</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E2E8F0]">
                <a
                  href="https://thingspeak.mathworks.com/channels/3469764"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] text-xs font-semibold transition-colors text-center"
                >
                  <span>Open ThingSpeak Portal</span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#64748B]" />
                </a>
              </div>
            </div>
          </div>

          {/* Research Compliance Notice */}
          <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
            <div className="flex items-center gap-2 text-[#2563EB] font-mono font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>NON-CLINICAL SPECIFICATION</span>
            </div>
            <p className="text-[#64748B] text-[11px] leading-relaxed">
              This scientific software interface is engineered exclusively for academic research, biosignal processing validation, and telemetry analytics. It is not approved for patient diagnosis or clinical monitoring.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

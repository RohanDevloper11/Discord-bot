import React, { useState, useEffect } from "react";
import {
  Bot,
  Settings,
  Send,
  RefreshCw,
  Trash2,
  Users,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Lock,
  Eye,
  EyeOff,
  Radio,
  ExternalLink,
  Sliders,
  ChevronRight,
  UserCheck,
  MailWarning
} from "lucide-react";
import { DashboardData, ForwardedMessage, AnonMapping } from "./types";

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [tokenInput, setTokenInput] = useState<string>("");
  const [channelInput, setChannelInput] = useState<string>("");
  const [showToken, setShowToken] = useState<boolean>(false);

  // Simulator states
  const [simSender, setSimSender] = useState<string>("Rohan");
  const [simContent, setSimContent] = useState<string>("Hey, this anonymous NGL bot is awesome!");
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simSuccess, setSimSuccess] = useState<string | null>(null);

  // Reply states
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState<string>("");
  const [replying, setReplying] = useState<boolean>(false);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'mappings' | 'guide'>('overview');

  // Fetch status from server
  const fetchStatus = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/status");
      if (!response.ok) {
        throw new Error("Failed to fetch bot status");
      }
      const resData: DashboardData = await response.json();
      setData(resData);
      
      // Sync form fields only on initial load or if not modified yet
      if (showLoading) {
        setTokenInput(resData.config.token);
        setChannelInput(resData.config.channel);
      }
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while communicating with the server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus(true);

    // Auto-poll status every 5 seconds to get real-time Discord connections and logs
    const interval = setInterval(() => {
      fetchStatus(false);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Update configuration
  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput, channel: channelInput }),
      });
      if (!response.ok) throw new Error("Failed to update config");
      
      await fetchStatus(false);
      alert("Configuration saved! Attempting to connect/restart the Discord bot...");
    } catch (err: any) {
      alert("Error saving config: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  // Reset mappings
  const handleResetMappings = async () => {
    if (!window.confirm("Are you sure you want to reset all Anonymous user mappings? This will clear the sequence (ANON0001, etc.) and assign new sequence numbers to subsequent DMs.")) {
      return;
    }
    try {
      const response = await fetch("/api/reset-mappings", { method: "POST" });
      if (!response.ok) throw new Error("Failed to reset mappings");
      await fetchStatus();
      alert("All anonymous user mappings have been reset!");
    } catch (err: any) {
      alert("Error resetting mappings: " + err.message);
    }
  };

  // Simulate receiving DM
  const handleSimulateDM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simContent.trim()) return;

    setSimulating(true);
    setSimSuccess(null);
    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderName: simSender, content: simContent }),
      });
      if (!response.ok) throw new Error("Simulation failed");
      const res = await response.json();
      
      setSimSuccess(`Message forwarded successfully as ${res.anonId}! Check the feed below.`);
      setSimContent("");
      await fetchStatus();
      
      // Auto clear alert
      setTimeout(() => setSimSuccess(null), 5000);
    } catch (err: any) {
      alert("Simulation error: " + err.message);
    } finally {
      setSimulating(false);
    }
  };

  // Send anonymous DM reply back
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyTarget || !replyContent.trim()) return;

    setReplying(true);
    setReplySuccess(null);
    setReplyError(null);

    try {
      const response = await fetch("/api/send-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonId: replyTarget, content: replyContent }),
      });
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Failed to deliver reply");
      }

      setReplySuccess(`Anonymous reply successfully delivered to ${replyTarget}!`);
      setReplyContent("");
      await fetchStatus();
      
      // Close reply box after 3 seconds
      setTimeout(() => {
        setReplySuccess(null);
        setReplyTarget(null);
      }, 3000);
    } catch (err: any) {
      setReplyError(err.message || "Could not deliver message.");
    } finally {
      setReplying(false);
    }
  };

  // Formats date nicely
  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] font-sans">
      {/* Top Banner / Navbar */}
      <header className="border-b border-[#1E293B] bg-[#0B0F19] sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#4F46E5] rounded-xl text-white shadow-lg shadow-[#4f46e5]/20">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-[#E2E8F0] to-[#818CF8] bg-clip-text text-transparent">
                  R1gi NGL Discord Bot Manager
                </h1>
                <span className="px-2 py-0.5 bg-[#1E293B] border border-[#334155] rounded-full text-[10px] font-semibold text-[#818CF8] tracking-wider uppercase">
                  By Rohan #bralex11
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] font-medium mt-0.5">
                Anonymous DM Forwarder Dashboard • 24/7 Professional Bot State
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Real-time Status Badge */}
            {data && (
              <div className="flex items-center gap-3 bg-[#1E293B] px-4 py-2 rounded-xl border border-[#334155]">
                <div className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    data.status.status === "connected" ? "bg-emerald-400" :
                    data.status.status === "connecting" ? "bg-amber-400" : "bg-rose-400"
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    data.status.status === "connected" ? "bg-emerald-500" :
                    data.status.status === "connecting" ? "bg-amber-500" : "bg-rose-500"
                  }`}></span>
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-wider leading-none">Bot Status</p>
                  <p className="text-xs font-semibold capitalize mt-0.5 text-white">
                    {data.status.status === "connected" ? "Online" : data.status.status}
                  </p>
                </div>
              </div>
            )}

            <button
              id="refresh_btn"
              onClick={() => fetchStatus(true)}
              disabled={loading}
              className="p-2 bg-[#1E293B] hover:bg-[#334155] active:scale-95 transition-all text-[#94A3B8] hover:text-white rounded-xl border border-[#334155] disabled:opacity-50"
              title="Refresh status"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        
        {/* Error notification if server is down */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3 text-rose-200">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Dashboard sync failure</p>
              <p className="text-xs text-rose-300 mt-1">{error}</p>
              <button 
                onClick={() => fetchStatus(true)} 
                className="mt-2 text-xs font-semibold underline text-white hover:text-rose-100"
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Discord Bot Integration Alert if Token not set */}
        {data && !data.config.hasRealToken && (
          <div className="bg-[#4F46E5]/10 border border-[#4F46E5]/30 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex gap-3">
              <MailWarning className="w-6 h-6 text-[#818CF8] shrink-0" />
              <div>
                <h3 className="font-semibold text-[#E2E8F0]">Set up your real Discord Bot in 2 minutes</h3>
                <p className="text-xs text-[#94A3B8] mt-1 max-w-2xl">
                  You are currently using the interactive simulation mode. To bring this bot 24/7 live on your real Discord server, configure your Bot Token and Channel name below!
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('guide')}
              className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold rounded-lg transition-all shadow-md shadow-[#4f46e5]/20 self-start md:self-center"
            >
              Read Setup Guide
            </button>
          </div>
        )}

        {/* Dynamic Bot Error Logging if login failed */}
        {data && data.status.status === "error" && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex gap-3 text-rose-200">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Discord Bot Login Error</p>
              <p className="text-xs text-rose-300 mt-1 font-mono bg-[#0B0F19]/60 p-2 rounded border border-rose-500/20 max-w-3xl overflow-x-auto">
                {data.status.errorMsg || "Invalid Discord Token or network handshake failure."}
              </p>
              <p className="text-xs text-[#94A3B8] mt-2">
                Verify your Token in the settings below. Also make sure you have enabled all <span className="text-white font-medium">Privileged Gateway Intents</span> (Message Content, Presence, Guild Members) in the Discord Developer Portal!
              </p>
            </div>
          </div>
        )}

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Configuration & Simulators */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Quick Navigation Tabs */}
            <div className="bg-[#0B0F19] rounded-xl border border-[#1E293B] p-1 flex">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'overview' ? 'bg-[#1E293B] text-white' : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Control
              </button>
              <button
                onClick={() => setActiveTab('mappings')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'mappings' ? 'bg-[#1E293B] text-white' : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Mappings ({data?.mappings.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('guide')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'guide' ? 'bg-[#1E293B] text-white' : 'text-[#94A3B8] hover:text-[#E2E8F0]'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Setup Guide
              </button>
            </div>

            {/* TAB: overview (Controls and simulation) */}
            {activeTab === 'overview' && (
              <>
                {/* Bot Settings Card */}
                <div className="bg-[#0B0F19] rounded-xl border border-[#1E293B] overflow-hidden shadow-xl">
                  <div className="px-5 py-4 border-b border-[#1E293B] flex items-center gap-2 bg-[#0E1524]">
                    <Settings className="w-4 h-4 text-[#818CF8]" />
                    <h2 className="font-semibold text-sm text-[#F1F5F9]">Bot Credentials & Channel</h2>
                  </div>
                  <form onSubmit={handleUpdateConfig} className="p-5 space-y-4">
                    
                    {/* Bot Token */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-[#94A3B8] font-semibold flex items-center justify-between">
                        <span>Discord Bot Token</span>
                        <span className="text-[10px] text-[#4F46E5] bg-[#4F46E5]/10 px-2 py-0.5 rounded-full font-bold uppercase">Secret</span>
                      </label>
                      <div className="relative">
                        <input
                          id="token_input"
                          type={showToken ? "text" : "password"}
                          value={tokenInput}
                          onChange={(e) => setTokenInput(e.target.value)}
                          placeholder="MTA2ODQ..."
                          className="w-full bg-[#1E293B] border border-[#334155] rounded-lg pl-10 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] font-mono transition-all"
                        />
                        <div className="absolute left-3.5 top-3.5 text-[#64748B]">
                          <Lock className="w-4 h-4" />
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-3.5 top-3 text-[#64748B] hover:text-[#94A3B8] focus:outline-none"
                        >
                          {showToken ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-[#64748B]">
                        Retrieved from Discord Developer Portal &gt; Bot &gt; Token.
                      </p>
                    </div>

                    {/* Forwarding Channel */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-[#94A3B8] font-semibold flex items-center justify-between">
                        <span>Dedicated Forwarding Channel</span>
                        <span className="text-[10px] text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full font-bold uppercase">Target</span>
                      </label>
                      <div className="relative">
                        <input
                          id="channel_input"
                          type="text"
                          value={channelInput}
                          onChange={(e) => setChannelInput(e.target.value)}
                          placeholder="r1gi-ngl"
                          className="w-full bg-[#1E293B] border border-[#334155] rounded-lg pl-3 pr-3 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-all"
                        />
                      </div>
                      <p className="text-[10px] text-[#64748B]">
                        Accepts exact channel ID (recommended) or channel name (e.g. <code className="text-[#818CF8]">r1gi-ngl</code>).
                      </p>
                    </div>

                    <button
                      id="save_config_btn"
                      type="submit"
                      disabled={updating}
                      className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white rounded-lg font-semibold text-xs transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {updating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                      Save & Reconnect Bot
                    </button>
                  </form>
                </div>

                {/* Interactive DM Simulator Card */}
                <div className="bg-[#0B0F19] rounded-xl border border-[#1E293B] overflow-hidden shadow-xl">
                  <div className="px-5 py-4 border-b border-[#1E293B] flex items-center justify-between bg-[#0E1524]">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-emerald-400" />
                      <h2 className="font-semibold text-sm text-[#F1F5F9]">Interactive DM Simulator</h2>
                    </div>
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Playground</span>
                  </div>
                  <form onSubmit={handleSimulateDM} className="p-5 space-y-4">
                    <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                      DM the bot inside this browser! Simulate receiving a DM from a specific user, assign them a secure ANON sequence ID, and forward it to the active log.
                    </p>

                    {/* Sender select/input */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-[#94A3B8] font-semibold block mb-1">User Identifier</label>
                        <select
                          value={simSender}
                          onChange={(e) => setSimSender(e.target.value)}
                          className="w-full bg-[#1E293B] border border-[#334155] rounded-lg px-2.5 py-2 text-xs font-medium text-white focus:outline-none focus:border-indigo-500 transition-all"
                        >
                          <option value="Rohan">Rohan</option>
                          <option value="Ridham">Ridham</option>
                          <option value="Aman">Aman</option>
                          <option value="Sneha">Sneha</option>
                          <option value="Custom">Custom User...</option>
                        </select>
                      </div>
                      
                      {simSender === "Custom" && (
                        <div>
                          <label className="text-[11px] text-[#94A3B8] font-semibold block mb-1">Custom Discord Tag</label>
                          <input
                            type="text"
                            placeholder="username#0000"
                            onChange={(e) => setSimSender(e.target.value || "Custom")}
                            className="w-full bg-[#1E293B] border border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all"
                          />
                        </div>
                      )}
                    </div>

                    {/* Message content */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#94A3B8] font-semibold">Simulated DM Chat</label>
                      <textarea
                        value={simContent}
                        onChange={(e) => setSimContent(e.target.value)}
                        placeholder="Say something anonymous..."
                        rows={3}
                        className="w-full bg-[#1E293B] border border-[#334155] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                      />
                    </div>

                    <button
                      id="simulate_btn"
                      type="submit"
                      disabled={simulating || !simContent.trim()}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-lg font-semibold text-xs transition-all shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {simulating ? "Sending DM..." : "Send Simulated DM"}
                    </button>

                    {simSuccess && (
                      <div className="text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-2.5 rounded-lg flex items-center gap-1.5">
                        <CheckCircle className="w-4.5 h-4.5 shrink-0 text-emerald-400" />
                        <span>{simSuccess}</span>
                      </div>
                    )}
                  </form>
                </div>
              </>
            )}

            {/* TAB: mappings (Active User ANON Maps) */}
            {activeTab === 'mappings' && (
              <div className="bg-[#0B0F19] rounded-xl border border-[#1E293B] overflow-hidden shadow-xl">
                <div className="px-5 py-4 border-b border-[#1E293B] flex items-center justify-between bg-[#0E1524]">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <h2 className="font-semibold text-sm text-[#F1F5F9]">Active User Mappings</h2>
                  </div>
                  <button
                    onClick={handleResetMappings}
                    className="p-1.5 bg-[#1E293B] hover:bg-rose-500/20 text-[#94A3B8] hover:text-rose-400 rounded-lg border border-[#334155] hover:border-rose-500/30 transition-all text-[11px] flex items-center gap-1 cursor-pointer"
                    title="Reset all mappings"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Reset
                  </button>
                </div>
                
                <div className="p-4 space-y-4">
                  <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                    Mappings are dynamically assigned and cached. Each Discord User is mapped to a secure, permanent sequence code (<code className="text-white">ANONxxxx</code>) to protect their identity on the target server.
                  </p>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {data && data.mappings.length > 0 ? (
                      data.mappings.map((map) => (
                        <div
                          key={map.userId}
                          className="bg-[#1E293B]/60 hover:bg-[#1E293B] rounded-lg p-3 border border-[#334155] flex items-center justify-between transition-all"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 font-mono">
                                {map.anonId}
                              </span>
                              <span className="text-xs font-semibold text-white truncate max-w-[120px]">
                                {map.userTag}
                              </span>
                            </div>
                            <p className="text-[10px] text-[#64748B] mt-1">
                              ID: {map.userId.startsWith("sim_") ? "Simulated User" : map.userId}
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] font-bold uppercase text-indigo-400 block">Active Mapping</span>
                            <span className="text-[10px] text-[#64748B] block mt-0.5">Last msg: {formatDate(map.lastActive)}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-[#64748B] text-xs">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        No active anonymous user mappings. Send a direct message or simulate one!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: guide (Setup Guide) */}
            {activeTab === 'guide' && (
              <div className="bg-[#0B0F19] rounded-xl border border-[#1E293B] overflow-hidden shadow-xl">
                <div className="px-5 py-4 border-b border-[#1E293B] flex items-center gap-2 bg-[#0E1524]">
                  <HelpCircle className="w-4 h-4 text-[#818CF8]" />
                  <h2 className="font-semibold text-sm text-[#F1F5F9]">Discord Bot Setup Guide</h2>
                </div>
                <div className="p-5 space-y-4 text-xs text-[#94A3B8] leading-relaxed max-h-[500px] overflow-y-auto">
                  <h3 className="font-bold text-[#E2E8F0] text-sm">Step 1: Create a Discord Application</h3>
                  <p>
                    1. Go to the <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline font-semibold inline-flex items-center gap-0.5">Discord Developer Portal <ExternalLink className="w-3 h-3" /></a>.<br />
                    2. Click <strong>New Application</strong> in the top-right, type a name (e.g. "R1gi NGL") and create.<br />
                    3. Navigate to the <strong>Bot</strong> tab on the left-side menu and click <strong>Add Bot</strong>.
                  </p>

                  <h3 className="font-bold text-[#E2E8F0] text-sm">Step 2: Enable Crucial Bot Intents</h3>
                  <p>
                    Scroll down on the Bot tab to the <strong>Privileged Gateway Intents</strong> section. You <span className="text-white font-semibold">MUST</span> enable:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 mt-1 text-[#818CF8]">
                    <li><strong>Presence Intent</strong></li>
                    <li><strong>Server Members Intent</strong></li>
                    <li><strong>Message Content Intent</strong> (absolutely required to parse DMs!)</li>
                  </ul>
                  <p className="mt-1">Click <strong>Save Changes</strong> at the bottom.</p>

                  <h3 className="font-bold text-[#E2E8F0] text-sm">Step 3: Copy Your Token</h3>
                  <p>
                    1. At the top of the <strong>Bot</strong> page, click <strong>Reset Token</strong>.<br />
                    2. Copy the token generated. <span className="text-white font-semibold">Do not share this token!</span><br />
                    3. Paste it in the <strong>Discord Bot Token</strong> input field on the Control panel.
                  </p>

                  <h3 className="font-bold text-[#E2E8F0] text-sm">Step 4: Invite Bot to Your Server</h3>
                  <p>
                    1. Go to the <strong>OAuth2</strong> tab on the left menu, then select <strong>URL Generator</strong>.<br />
                    2. Under <strong>Scopes</strong>, select <code className="text-white bg-[#1E293B] px-1 rounded">bot</code>.<br />
                    3. Under <strong>Bot Permissions</strong>, select:<br />
                    <span className="text-white font-semibold">• Read Messages/View Channels</span><br />
                    <span className="text-white font-semibold">• Send Messages</span><br />
                    <span className="text-white font-semibold">• Read Message History</span><br />
                    4. Copy the generated URL at the bottom of the page and paste it into a new browser tab to invite the bot to your Discord Server.
                  </p>

                  <h3 className="font-bold text-[#E2E8F0] text-sm">Step 5: Create Forward Channel</h3>
                  <p>
                    Create a text channel on your server named exactly <code className="text-[#818CF8]">r1gi-ngl</code> (or configure a custom channel name/ID in our Settings panel). DM the bot, and it will immediately post in that channel!
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Live Bot Status & Real-time message logs */}
          <div className="lg:col-span-2 space-y-6">

            {/* Real-time Connection Meta Dashboard */}
            {data && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Bot Tag */}
                <div className="bg-[#0B0F19] rounded-xl border border-[#1E293B] p-4 flex items-center gap-4">
                  <div className="p-3 bg-[#4F46E5]/10 rounded-xl text-[#818CF8]">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Bot Profile</span>
                    <span className="text-sm font-bold text-white block truncate max-w-[160px]" title={data.status.tag || "Offline"}>
                      {data.status.tag || "Not Connected"}
                    </span>
                  </div>
                </div>

                {/* Target Channel */}
                <div className="bg-[#0B0F19] rounded-xl border border-[#1E293B] p-4 flex items-center gap-4">
                  <div className="p-3 bg-[#10B981]/10 rounded-xl text-[#10B981]">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Active Channel</span>
                    <span className="text-sm font-bold text-white block truncate max-w-[160px]">
                      {data.status.activeChannel 
                        ? `#${data.status.activeChannel.name}` 
                        : `#${data.config.channel}`}
                    </span>
                    {data.status.activeChannel && (
                      <span className="text-[9px] text-[#64748B] block truncate max-w-[160px]">
                        Guild: {data.status.activeChannel.guildName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Guilds / Latency */}
                <div className="bg-[#0B0F19] rounded-xl border border-[#1E293B] p-4 flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Gateway Metrics</span>
                    <span className="text-sm font-bold text-white block">
                      {data.status.guildsCount} Servers Joined
                    </span>
                    {data.status.status === "connected" && (
                      <span className="text-[9px] text-emerald-400 block font-semibold">
                        Ping: {data.status.latency}ms
                      </span>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Anonymous Confession Flow Log */}
            <div className="bg-[#0B0F19] rounded-2xl border border-[#1E293B] overflow-hidden shadow-2xl flex flex-col min-h-[480px]">
              
              <div className="px-6 py-4 border-b border-[#1E293B] bg-[#0E1524] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                  <h2 className="font-bold text-sm text-[#F1F5F9]">Live Anonymous Message Feed (#R1gi-NGL)</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-[#1E293B] text-[#94A3B8] px-2.5 py-1 rounded-full border border-[#334155] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                    Live Feed
                  </span>
                </div>
              </div>

              {/* Message Reply Box Overlay Drawer */}
              {replyTarget && (
                <div className="bg-[#1E1B4B]/90 border-b border-indigo-500/30 p-5 space-y-3 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-indigo-200">
                      <UserCheck className="w-4 h-4 text-indigo-400" />
                      <span>Replying back to user <strong className="text-white font-mono bg-[#0B0F19] px-2 py-0.5 rounded border border-[#334155]">{replyTarget}</strong> anonymously...</span>
                    </div>
                    <button
                      onClick={() => setReplyTarget(null)}
                      className="text-xs text-indigo-300 hover:text-white underline cursor-pointer"
                    >
                      Cancel Reply
                    </button>
                  </div>
                  
                  <form onSubmit={handleSendReply} className="flex gap-2">
                    <input
                      type="text"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder={`Type reply DM content to ${replyTarget}...`}
                      className="flex-1 bg-[#0F172A] border border-indigo-500/30 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400 transition-all"
                      required
                    />
                    <button
                      type="submit"
                      disabled={replying}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {replying ? "Sending..." : "Send DM Reply"}
                    </button>
                  </form>

                  {replySuccess && (
                    <p className="text-[11px] text-emerald-400 font-semibold">{replySuccess}</p>
                  )}
                  {replyError && (
                    <p className="text-[11px] text-rose-400 font-semibold">{replyError}</p>
                  )}
                </div>
              )}

              {/* Feed Content */}
              <div className="p-6 flex-1 overflow-y-auto space-y-4 max-h-[500px]">
                {data && data.messages.length > 0 ? (
                  data.messages.map((msg, index) => {
                    const isSystemLog = msg.anonId === "ADMIN_REPLY";
                    
                    return (
                      <div
                        key={msg.id || index}
                        className={`group relative rounded-xl p-4 border transition-all ${
                          isSystemLog 
                            ? "bg-[#1E293B]/20 border-[#334155]/40" 
                            : msg.isSimulated 
                            ? "bg-emerald-950/10 border-emerald-500/10 hover:border-emerald-500/20" 
                            : "bg-[#0F172A] border-[#1E293B] hover:border-[#334155]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isSystemLog ? (
                                <span className="text-[10px] font-bold bg-[#334155] text-[#94A3B8] px-2 py-0.5 rounded border border-[#475569] font-mono uppercase">
                                  System Reply
                                </span>
                              ) : (
                                <span className="text-xs font-bold bg-[#4F46E5]/10 text-[#818CF8] px-2 py-0.5 rounded-lg border border-[#4F46E5]/20 font-mono">
                                  {msg.anonId}
                                </span>
                              )}

                              <span className="text-[10px] text-[#64748B] font-mono">
                                {formatDate(msg.timestamp)}
                              </span>

                              {msg.isSimulated && (
                                <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-mono">
                                  Simulated
                                </span>
                              )}

                              {/* Admin reference tag for dashboard owner to monitor users */}
                              {msg.userTag && (
                                <span className="text-[10px] text-[#475569] bg-[#1E293B]/40 px-1.5 py-0.2 rounded group-hover:text-[#94A3B8] transition-all">
                                  Ref: {msg.userTag}
                                </span>
                              )}
                            </div>

                            <div className="text-sm text-[#E2E8F0] mt-2.5 font-sans leading-relaxed break-words whitespace-pre-wrap">
                              {isSystemLog ? (
                                <span className="text-[#94A3B8] italic">{msg.content}</span>
                              ) : (
                                msg.content
                              )}
                            </div>
                          </div>

                          {/* Quick Admin Action: Reply back directly to user! */}
                          {!isSystemLog && !msg.anonId.startsWith("ADMIN") && (
                            <button
                              onClick={() => {
                                setReplyTarget(msg.anonId);
                                setReplyContent("");
                              }}
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all px-3 py-1.5 bg-[#1E293B] hover:bg-[#334155] text-[#94A3B8] hover:text-white rounded-lg border border-[#334155] text-[11px] font-semibold flex items-center gap-1 shrink-0 self-start shadow-sm cursor-pointer"
                              title={`Anonymously reply back to DM thread`}
                            >
                              <Send className="w-3 h-3" />
                              Reply
                            </button>
                          )}
                        </div>

                        {/* Speech Bubble Arrow Accent */}
                        <div className="absolute top-4 -left-1.5 w-3 h-3 bg-[#0B0F19] rotate-45 border-l border-b border-[#1E293B] group-hover:border-[#334155] transition-all hidden md:block"></div>
                      </div>
                    );
                  })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center py-16 text-[#64748B]">
                    <div className="p-4 bg-[#1E293B]/40 rounded-full text-[#64748B] mb-3">
                      <MessageSquare className="w-8 h-8 opacity-40" />
                    </div>
                    <p className="text-sm font-semibold text-[#94A3B8]">Confession feed is quiet</p>
                    <p className="text-xs text-[#64748B] mt-1 max-w-sm">
                      DMs received by the bot will be anonymized and logged here in real-time. Use the DM Simulator on the left to write a test confession!
                    </p>
                  </div>
                )}
              </div>

              {/* Feed Footer Summary */}
              <div className="px-6 py-4 bg-[#0B0F19] border-t border-[#1E293B] text-xs text-[#64748B] flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>Auto-refresh active (5s intervals)</span>
                <span className="font-mono">
                  Total confessions logged: {data?.messages.filter(m => m.anonId !== "ADMIN_REPLY").length || 0}
                </span>
              </div>

            </div>

          </div>

        </div>

      </main>

      {/* Applet Design Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-10 border-t border-[#1E293B] text-center text-xs text-[#64748B] space-y-2">
        <p className="font-semibold text-[#94A3B8]">R1gi NGL Discord Bot Manager Dashboard</p>
        <p>Built with React, Express and Discord.js • Created by Rohan #bralex11</p>
      </footer>
    </div>
  );
}

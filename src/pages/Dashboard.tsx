import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  Send, Users, MousePointer2, AlertTriangle, Play,
  XCircle, Info, Shield, LayoutDashboard, FileText, BarChart3, Activity, Download, Trash2, KeyRound, Map, X
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const customIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// FIX: removed unused "Plus" import
import { PHISHING_TEMPLATES } from '../constants';
import landingLogoImg from '../assets/images/PHISHGUARD.png';
import logoImg from '../assets/images/PHISHGUARD (1).png';

export default function Dashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSim, setNewSim] = useState({ name: '', emails: '', templateIdx: 0 });
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [toastMessage, setToastMessage] = useState<{message: string, type: 'error' | 'success'} | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mapView, setMapView] = useState<{lat: number, lon: number, email: string} | null>(null);

  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const apiFetch = async (url: string, options: any = {}) => {
    const token = localStorage.getItem('token');
    const headers = { ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem('token');
      setIsLoggedIn(false);
      throw new Error('Unauthorized');
    }
    return res;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.token);
        setIsLoggedIn(true);
        fetchStats();
      } else {
        setLoginError('Invalid password');
      }
    } catch (err) {
      setLoginError('Server error during login');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
  };

  useEffect(() => {
    if (isLoggedIn) {
      setLoading(true);
      fetchStats();

      // Poll every 5 seconds for real-time location and click updates
      const interval = setInterval(() => {
         fetchStats(false); // pass flag to avoid loading screen flicker
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  const fetchStats = async (showLoading = true) => {
    if (showLoading) setFetchError(null);
    try {
      const res = await apiFetch(`/api/stats?t=${Date.now()}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      if (err.message !== 'Unauthorized') {
        console.error("Failed to fetch stats", err);
        setFetchError(err.message || "Failed to load dashboard data. Is the server running?");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    const emails = newSim.emails.split(',').map(e => e.trim()).filter(e => e !== '');
    
    try {
      const simResponse = await apiFetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulationId: `sim_${Date.now()}`,
          name: newSim.name,
          targetEmails: emails,
          templateIdx: newSim.templateIdx,
          template: PHISHING_TEMPLATES[newSim.templateIdx]
        })
      });
      
      if (simResponse.ok) {
        const responseData = await simResponse.json();
        const failures = responseData.results?.filter((r: any) => r.status === 'failed') || [];
        
        if (failures.length > 0) {
          showToast(`Some or all emails failed to send. Error from mail server: ${failures[0].error}`, 'error');
        } else {
          showToast(`Successfully launched campaign to ${emails.length} targets!`, 'success');
        }
        
        setIsModalOpen(false);
        setNewSim({ name: '', emails: '', templateIdx: 0 });
        fetchStats();
      } else {
        const errorData = await simResponse.json();
        showToast(`Failed to launch protocol: ${errorData.error}`);
      }
    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.message !== 'Unauthorized') {
        showToast(`Error launching protocol: ${err.message}`);
      }
    }
  };

  const handleDeleteSimulation = async (id: string, name: string) => {
    try {
      const res = await apiFetch(`/api/simulations/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast(`Campaign "${name}" deleted.`, 'success');
        fetchStats();
      } else {
        const errorData = await res.json();
        showToast(`Failed to delete campaign: ${errorData.error}`);
      }
    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.message !== 'Unauthorized') {
        showToast(`Error deleting campaign: ${err}`);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportRiskReport = () => {
    if (!stats?.atRisk || stats.atRisk.length === 0) {
      showToast("No risk data to export.");
      return;
    }
    const header = "Email,Click Count\n";
    const rows = stats.atRisk.map((p: any) => `"${p.email}",${p.clicks}`).join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phishguard-risk-report-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isLoggedIn) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 font-sans px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-emerald-900/10 opacity-50 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900/20 via-slate-950 to-slate-950"></div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="relative z-10 bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-sm"
        >
          <div className="flex flex-col flex-1 items-center gap-3 mb-8 text-center">
            <img src={logoImg} alt="PhishGuard" className="w-56 h-auto object-contain mx-auto" />
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">Admin Authentication</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Passkey"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-medium transition-all"
                  required
                />
              </div>
            </div>
            {loginError && <p className="text-rose-400 text-[10px] uppercase tracking-widest font-bold text-center">{loginError}</p>}
            <button
              type="submit"
              className="w-full flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-[0.2em] py-3 rounded-lg transition-all shadow-xl shadow-emerald-600/20 mt-2"
            >
              Verify Identity
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-emerald-400 font-mono">
      <div className="flex flex-col items-center gap-4">
        <Activity className="animate-pulse" size={48} />
        <span className="tracking-widest uppercase text-xs">Initializing Secure Environment...</span>
      </div>
    </div>
  );

  // FIX: show error screen if stats fetch failed
  if (fetchError) return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-center px-4">
      <div className="flex flex-col items-center gap-4">
        <AlertTriangle className="text-rose-500" size={48} />
        <h2 className="text-slate-100 font-bold text-lg">Failed to load dashboard</h2>
        <p className="text-slate-400 text-sm max-w-sm">{fetchError}</p>
        <button
          onClick={() => { setLoading(true); fetchStats(); }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded uppercase tracking-widest transition-all"
        >
          Retry
        </button>
      </div>
    </div>
  );

  const totalSent = stats?.simulations?.reduce((acc: number, s: any) => acc + s.total_sent, 0) || 0;
  const totalClicks = stats?.simulations?.reduce((acc: number, s: any) => acc + s.clicks, 0) || 0;
  const avgCtr = totalSent > 0 ? (totalClicks / totalSent) * 100 : 0;

  // FIX: derive Risk Score dynamically from avgCtr instead of hardcoding "High"
  const riskScore = avgCtr === 0 ? 'N/A' : avgCtr > 20 ? 'Critical' : avgCtr > 10 ? 'High' : avgCtr > 5 ? 'Medium' : 'Low';
  const riskTrend = avgCtr === 0 ? 'No data yet' : avgCtr > 10 ? 'Attention Required' : 'Within Threshold';

  return (
    <div className="flex h-screen w-full bg-slate-950 font-sans overflow-hidden border-t-4 border-emerald-600 relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50">
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`px-4 py-3 rounded shadow-lg border ${
              toastMessage.type === 'error' ? 'bg-rose-950/80 border-rose-500/50 text-rose-200' : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
            } flex items-center gap-3 backdrop-blur-sm max-w-sm`}
          >
            {toastMessage.type === 'error' ? <AlertTriangle size={16} className="text-rose-400" /> : <Shield size={16} className="text-emerald-400" />}
            <span className="text-sm font-medium leading-tight">{toastMessage.message}</span>
            <button onClick={() => setToastMessage(null)} className="ml-2 hover:opacity-75">
              <XCircle size={16} />
            </button>
          </motion.div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <img src={landingLogoImg} alt="PhishGuard" className="w-48 h-auto object-contain" />
          </div>
          <nav className="space-y-1.5">
            {[
              { icon: LayoutDashboard, label: 'Dashboard' },
              { icon: Play, label: 'Simulations' },
              { icon: FileText, label: 'Templates' },
              { icon: Users, label: 'Employees' },
              { icon: BarChart3, label: 'Analytics' },
              { icon: Map, label: 'Live Map' },
            ].map((item) => (
              <button 
                key={item.label}
                onClick={() => setActiveTab(item.label)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === item.label 
                    ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/5' 
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-slate-800 space-y-4">
          <button onClick={handleLogout} className="w-full px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-rose-400 hover:bg-slate-800/50 rounded transition-colors text-left">
            Logout Session
          </button>
          <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2.5">System Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></div>
              <span className="text-xs text-slate-300 font-medium tracking-tight">Active & Secure</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-slate-800 px-8 flex items-center justify-between bg-slate-900/40 backdrop-blur-md sticky top-0 z-10">
          <div>
            <h1 className="text-slate-100 font-bold text-sm tracking-tight">Security Simulation Dashboard</h1>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-0.5">Global Infrastructure Control</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black rounded uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 border border-emerald-400/20"
            >
              New Simulation
            </button>
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
              <Users size={16} />
            </div>
          </div>
        </header>

        {/* Content Container */}
        <div className="p-6 md:p-8 flex-1 overflow-auto bg-slate-950/50">
          {activeTab === 'Dashboard' ? (
            <>
              {/* Stats Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  // FIX: removed hardcoded "+12% from avg" trend
                  { label: 'Total Sent', value: totalSent, icon: Send, color: 'text-emerald-400', bg: 'bg-emerald-500/10', trend: `${stats?.simulations?.length || 0} campaigns` },
                  { label: 'Total Clicks', value: totalClicks, icon: MousePointer2, color: 'text-rose-400', bg: 'bg-rose-500/10', trend: `${avgCtr.toFixed(1)}% CTR` },
                  { label: 'Reported', value: 0, icon: Shield, color: 'text-emerald-400', bg: 'bg-emerald-500/10', trend: 'N/A' },
                  // FIX: dynamic risk score derived from actual CTR data
                  { label: 'Risk Score', value: riskScore, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', trend: riskTrend },
                ].map((stat, i) => (
                  <motion.div 
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-slate-900 border border-slate-800/80 p-5 rounded-xl transition-all hover:border-slate-700 group shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                        <stat.icon size={18} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <p className="text-2xl font-mono font-bold text-slate-100">{stat.value}</p>
                      <p className={`text-[10px] font-bold ${stat.color} opacity-80 uppercase tracking-tighter`}>{stat.trend}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-12 gap-6 mb-6">
                {/* Detailed Logs Section */}
                <section className="col-span-12 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <h2 className="text-slate-100 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                      <Activity size={14} className="text-emerald-500" />
                      Live Event Stream (Click & Location History)
                    </h2>
                  </div>
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-slate-500 text-[9px] uppercase font-bold tracking-widest border-b border-slate-800 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-3">Timestamp</th>
                          <th className="px-6 py-3">Target Email</th>
                          <th className="px-6 py-3">IP Address</th>
                          <th className="px-6 py-3">Device / Location Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {stats?.recentLogs?.map((log: any) => (
                          <tr key={log.id} className="hover:bg-slate-800/30 transition-colors group">
                            <td className="px-6 py-3 text-mono text-slate-500 text-xs whitespace-nowrap">
                              {new Date(log.clicked_at).toLocaleString()}
                            </td>
                            <td className="px-6 py-3 font-semibold text-rose-400 text-xs">{log.employee_email}</td>
                            <td className="px-6 py-3 text-mono text-slate-400 text-xs">{log.ip}</td>
                            <td className="px-6 py-3 text-xs text-slate-400 max-w-md truncate">
                              {log.user_agent?.includes('| Location:') ? (
                                <>
                                  {log.user_agent.split('| Location: ')[0]} 
                                  <button 
                                    onClick={() => {
                                      const locStr = log.user_agent.split('| Location: ')[1].trim();
                                      const [lat, lon] = locStr.split(',').map(Number);
                                      if (!isNaN(lat) && !isNaN(lon)) {
                                          setMapView({ lat, lon, email: log.employee_email });
                                      }
                                    }}
                                    className="ml-2 inline-flex items-center text-emerald-400 hover:text-emerald-300 gap-1 bg-emerald-500/10 px-2 py-0.5 rounded uppercase tracking-widest text-[9px] font-bold transition-colors cursor-pointer border border-emerald-500/20"
                                  >
                                    <Map size={10} /> View Map
                                  </button>
                                </>
                              ) : (
                                log.user_agent
                              )}
                            </td>
                          </tr>
                        ))}
                        {(!stats?.recentLogs || stats.recentLogs.length === 0) && (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-slate-500 text-xs uppercase tracking-widest font-bold">
                              No interaction logs recorded yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <div className="grid grid-cols-12 gap-6">
                {/* Chart Section */}
                <section className="col-span-12 lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
                  <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <h2 className="text-slate-100 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                      <Activity size={14} className="text-emerald-500" />
                      Interaction Metrics
                    </h2>
                    <div className="flex gap-1">
                       <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                       <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                    </div>
                  </div>
                  <div className="p-6 h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.simulations || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis 
                          dataKey="name" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                          stroke="#64748b" 
                          tick={{ fill: '#64748b' }}
                        />
                        <YAxis 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                          stroke="#64748b"
                          tick={{ fill: '#64748b' }}
                        />
                        <Tooltip 
                          cursor={{ fill: '#1e293b', opacity: 0.4 }}
                          contentStyle={{ 
                            backgroundColor: '#0f172a', 
                            borderRadius: '8px', 
                            border: '1px solid #1e293b',
                            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                            padding: '10px'
                          }}
                          itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                          labelStyle={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}
                        />
                        <Bar dataKey="ctr" fill="#6366f1" radius={[2, 2, 0, 0]} name="CTR %" barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="border-t border-slate-800 flex-1">
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-slate-500 text-[9px] uppercase font-bold tracking-widest border-b border-slate-800">
                        <tr>
                          <th className="px-6 py-3">Campaign Entity</th>
                          <th className="px-6 py-3">Total Sent</th>
                          <th className="px-6 py-3">User Actions</th>
                          <th className="px-6 py-3">CTR Rate</th>
                          <th className="px-6 py-3 text-right">Status</th>
                          <th className="px-6 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {stats?.simulations?.map((sim: any) => (
                          <tr key={sim.id} className="hover:bg-slate-800/30 transition-colors group">
                            <td className="px-6 py-3 font-semibold text-slate-300 text-xs">{sim.name}</td>
                            <td className="px-6 py-3 text-mono text-slate-500 text-xs">{sim.total_sent}</td>
                            <td className="px-6 py-3 text-mono text-slate-500 text-xs">{sim.clicks}</td>
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(sim.ctr, 100)}%` }} />
                                </div>
                                <span className={`text-[10px] font-mono font-bold ${
                                  sim.ctr > 15 ? 'text-rose-400' : 'text-emerald-400'
                                }`}>
                                  {sim.ctr.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-3 text-right">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-tighter">
                                Active
                              </span>
                            </td>
                            <td className="px-6 py-3 text-right">
                              {deletingId === sim.id ? (
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-[10px] text-rose-500 font-bold uppercase">Confirm?</span>
                                  <button onClick={() => handleDeleteSimulation(sim.id, sim.name)} className="text-white bg-rose-600 hover:bg-rose-500 px-2 py-0.5 rounded text-[10px] font-bold">Yes</button>
                                  <button onClick={() => setDeletingId(null)} className="text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded text-[10px] font-bold">No</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeletingId(sim.id)}
                                  className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                                  title="Delete Campaign"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Sidebar Data Section */}
                <aside className="col-span-12 lg:col-span-4 space-y-6">
                  <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                      <h2 className="text-slate-100 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                        <AlertTriangle size={14} className="text-rose-500" />
                        High Risk Entities
                      </h2>
                    </div>
                    <div className="p-4 space-y-3">
                      {stats?.atRisk?.map((person: any) => (
                        <div key={person.email} className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-slate-800/50 group hover:border-rose-500/30 transition-all">
                          <div className="overflow-hidden">
                            <p className="text-xs font-bold text-slate-300 truncate tracking-tight">{person.email}</p>
                            <p className="text-[10px] font-mono text-slate-500 uppercase mt-0.5">{person.clicks} Breach Interactions</p>
                          </div>
                          <div className="bg-rose-500/10 text-rose-500 p-1.5 rounded border border-rose-500/20 group-hover:scale-110 transition-transform">
                            <Info size={14} />
                          </div>
                        </div>
                      ))}
                      {(!stats?.atRisk || stats.atRisk.length === 0) && (
                        <div className="text-center py-10">
                          <Shield className="mx-auto text-slate-800 mb-2" size={32} />
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">No Violations Logged</p>
                        </div>
                      )}
                    </div>
                    <div className="px-5 py-3 bg-slate-950/50 border-t border-slate-800">
                      {/* FIX: implemented CSV export handler */}
                      <button
                        onClick={handleExportRiskReport}
                        className="w-full flex items-center justify-center gap-2 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-widest"
                      >
                        <Download size={12} />
                        Export Risk Assessment Report
                      </button>
                    </div>
                  </section>

                  {/* Education Module Info */}
                  <section className="bg-emerald-600/5 border border-emerald-500/20 rounded-xl p-5 relative overflow-hidden group">
                     <div className="relative z-10">
                       <h3 className="text-slate-100 font-bold text-sm mb-2 flex items-center gap-2">
                         <FileText size={16} className="text-emerald-500" />
                         Education Feed
                       </h3>
                       <p className="text-xs text-slate-500 leading-relaxed mb-4">
                         All users redirected to the &quot;PhishAware&quot; page are tracked here for remedial training.
                       </p>
                       {/* FIX: removed hardcoded 65% — show actual click count instead */}
                       <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">
                         {totalClicks} users redirected to training
                       </p>
                     </div>
                     <BarChart3 className="absolute -right-4 -bottom-4 w-24 h-24 text-emerald-500/5 group-hover:scale-110 transition-transform" />
                  </section>
                </aside>
              </div>
            </>
          ) : activeTab === 'Live Map' ? (
             <div className="flex-1 w-full h-[calc(100vh-120px)] relative border border-slate-800 rounded-xl overflow-hidden bg-slate-900 shadow-xl">
                 <div className="absolute top-4 left-4 z-[400] bg-slate-950/80 backdrop-blur border border-emerald-500/30 px-4 py-2 rounded-lg text-xs tracking-widest font-bold uppercase text-slate-200">
                    Live Geolocation Tracking
                 </div>
                 {(() => {
                   const logsWithLocation = stats?.recentLogs?.filter((l: any) => l.user_agent?.includes('| Location:')) || [];
                   if (logsWithLocation.length === 0) {
                     return (
                       <div className="flex flex-col items-center justify-center h-full text-center">
                         <Map className="w-16 h-16 text-slate-700 mb-4" />
                         <h2 className="text-xl font-bold text-slate-300 tracking-tight">No Location Data</h2>
                         <p className="text-xs text-slate-500 uppercase tracking-widest mt-2">Waiting for interaction logs...</p>
                       </div>
                     );
                   }
                   
                   // Center on the most recent log
                   const latestLog = logsWithLocation[0];
                   const latestLocStr = latestLog.user_agent.split('| Location: ')[1].trim();
                   const [centerLat, centerLon] = latestLocStr.split(',').map(Number);
                   
                   const uniqueLogsMap = new window.Map();
                   logsWithLocation.forEach((log: any) => {
                      if (!uniqueLogsMap.has(log.employee_email)) {
                         uniqueLogsMap.set(log.employee_email, log);
                      }
                   });
                   const uniqueLogs = Array.from(uniqueLogsMap.values());

                   return (
                      <MapContainer center={[centerLat, centerLon]} zoom={3} className="w-full h-full absolute inset-0 z-0">
                        <TileLayer
                          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        {uniqueLogs.map((log: any) => {
                          const locStr = log.user_agent.split('| Location: ')[1].trim();
                          const [lat, lon] = locStr.split(',').map(Number);
                          if (isNaN(lat) || isNaN(lon)) return null;
                          return (
                            <Marker key={log.employee_email} position={[lat, lon]} icon={customIcon}>
                              <Popup>
                                <div className="font-mono text-xs uppercase tracking-tight text-center">
                                  <strong className="text-emerald-600 font-bold">{log.employee_email}</strong><br/>
                                  <span className="text-slate-500">{new Date(log.clicked_at).toLocaleString()}</span><br/>
                                </div>
                              </Popup>
                            </Marker>
                          );
                        })}
                      </MapContainer>
                   );
                 })()}
             </div>
          ) : (
             <div className="flex flex-col items-center justify-center h-full text-center">
               <Shield className="w-16 h-16 text-emerald-500/20 mb-4" />
               <h2 className="text-xl font-bold text-slate-300 tracking-tight">{activeTab}</h2>
               <p className="text-xs text-slate-500 uppercase tracking-widest mt-2">Section Under Development</p>
             </div>
          )}
        </div>
      </main>

      {/* New Simulation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-800 overflow-hidden"
          >
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-100">Initialize Campaign</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                aria-label="Close modal"
              >
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateSimulation} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2">Campaign Identifier</label>
                <input 
                  required
                  type="text" 
                  value={newSim.name}
                  onChange={e => setNewSim({...newSim, name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-950 rounded-lg border border-slate-800 text-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-medium transition-all"
                  placeholder="Q2 SECURITY-DRIVE"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2">Target Node Emails (comma-separated)</label>
                <textarea 
                  required
                  value={newSim.emails}
                  onChange={e => setNewSim({...newSim, emails: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-950 rounded-lg border border-slate-800 text-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-medium h-24 resize-none transition-all"
                  placeholder="employee@secure-corp.com, other@secure-corp.com"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2">Select Phish-Vector Template</label>
                <div className="grid grid-cols-1 gap-2">
                  {PHISHING_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={tmpl.name}
                      type="button"
                      onClick={() => setNewSim({...newSim, templateIdx: idx})}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        newSim.templateIdx === idx 
                          ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500 shadow-lg shadow-emerald-500/10' 
                          : 'border-slate-800 hover:border-slate-700 bg-slate-950/20'
                      }`}
                    >
                      <p className="text-xs font-black text-slate-200 uppercase tracking-tighter">{tmpl.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">{tmpl.subject}</p>
                    </button>
                  ))}
                </div>
              </div>
              <button 
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-[0.2em] py-4 rounded-xl transition-all shadow-xl shadow-emerald-600/20 border border-emerald-400/20 mt-4"
              >
                Launch Protocol
              </button>
            </form>
          </motion.div>
        </div>
      )}
      {/* Interactive Map Modal */}
      {mapView && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 lg:p-8">
            <div className="flex flex-col w-full h-full max-w-6xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
                  <h3 className="text-slate-100 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                    <Map size={16} className="text-emerald-500" />
                    Tracking Coordinate Signature: <span className="text-emerald-400 lowercase border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded">{mapView.email}</span>
                  </h3>
                  <button onClick={() => setMapView(null)} className="text-slate-500 hover:text-rose-400 transition-colors p-2 rounded hover:bg-slate-800">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 w-full relative bg-slate-950">
                    <MapContainer key={`modal-${mapView.lat}-${mapView.lon}`} center={[mapView.lat, mapView.lon]} zoom={15} className="w-full h-full absolute inset-0">
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      />
                      <Marker position={[mapView.lat, mapView.lon]} icon={customIcon}>
                        <Popup>
                          <div className="font-mono text-xs uppercase tracking-tight text-center">
                            <strong className="text-emerald-600 font-bold">{mapView.email}</strong><br/>
                            <span className="text-slate-500">Lat: {mapView.lat}</span><br/>
                            <span className="text-slate-500">Lon: {mapView.lon}</span>
                          </div>
                        </Popup>
                      </Marker>
                    </MapContainer>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

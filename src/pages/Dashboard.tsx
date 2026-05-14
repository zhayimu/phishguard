import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  Send, Users, MousePointer2, AlertTriangle, Play,
  XCircle, Info, Shield, LayoutDashboard, FileText, BarChart3, Activity, Download
} from 'lucide-react';
// FIX: removed unused "Plus" import
import { PHISHING_TEMPLATES } from '../constants';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // FIX: added error state for user-facing feedback
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSim, setNewSim] = useState({ name: '', emails: '', templateIdx: 0 });
  const [activeTab, setActiveTab] = useState('Dashboard');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setFetchError(null);
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      console.error("Failed to fetch stats", err);
      // FIX: show error to the user instead of silently failing
      setFetchError(err.message || "Failed to load dashboard data. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    const emails = newSim.emails.split(',').map(e => e.trim()).filter(e => e !== '');
    
    try {
      const simResponse = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulationId: `sim_${Date.now()}`,
          name: newSim.name,
          targetEmails: emails,
          template: PHISHING_TEMPLATES[newSim.templateIdx]
        })
      });
      
      if (simResponse.ok) {
        const responseData = await simResponse.json();
        const failures = responseData.results?.filter((r: any) => r.status === 'failed') || [];
        
        if (failures.length > 0) {
          alert(`Some or all emails failed to send. Error from mail server: ${failures[0].error}`);
        } else {
          alert(`Successfully launched campaign to ${emails.length} targets!`);
        }
        
        setIsModalOpen(false);
        setNewSim({ name: '', emails: '', templateIdx: 0 });
        fetchStats();
      } else {
        const errorData = await simResponse.json();
        alert(`Failed to launch protocol: ${errorData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Error launching protocol: ${err}`);
    }
  };

  // FIX: implement CSV export for risk assessment report
  const handleExportRiskReport = () => {
    if (!stats?.atRisk || stats.atRisk.length === 0) {
      alert("No risk data to export.");
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

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-indigo-400 font-mono">
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
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded uppercase tracking-widest transition-all"
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
    <div className="flex h-screen w-full bg-slate-950 font-sans overflow-hidden border-t-4 border-indigo-600">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-slate-100 font-black tracking-tighter text-xl uppercase italic">PhishGuard</span>
          </div>
          <nav className="space-y-1.5">
            {[
              { icon: LayoutDashboard, label: 'Dashboard' },
              { icon: Play, label: 'Simulations' },
              { icon: FileText, label: 'Templates' },
              { icon: Users, label: 'Employees' },
              { icon: BarChart3, label: 'Analytics' },
            ].map((item) => (
              <button 
                key={item.label}
                onClick={() => setActiveTab(item.label)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === item.label 
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-sm shadow-indigo-500/5' 
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-slate-800">
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
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 border border-indigo-400/20"
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
                  { label: 'Total Sent', value: totalSent, icon: Send, color: 'text-indigo-400', bg: 'bg-indigo-500/10', trend: `${stats?.simulations?.length || 0} campaigns` },
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

              <div className="grid grid-cols-12 gap-6">
                {/* Chart Section */}
                <section className="col-span-12 lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
                  <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <h2 className="text-slate-100 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                      <Activity size={14} className="text-indigo-500" />
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
                                  <div className="bg-indigo-500 h-full" style={{ width: `${Math.min(sim.ctr, 100)}%` }} />
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
                        className="w-full flex items-center justify-center gap-2 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"
                      >
                        <Download size={12} />
                        Export Risk Assessment Report
                      </button>
                    </div>
                  </section>

                  {/* Education Module Info */}
                  <section className="bg-indigo-600/5 border border-indigo-500/20 rounded-xl p-5 relative overflow-hidden group">
                     <div className="relative z-10">
                       <h3 className="text-slate-100 font-bold text-sm mb-2 flex items-center gap-2">
                         <FileText size={16} className="text-indigo-500" />
                         Education Feed
                       </h3>
                       <p className="text-xs text-slate-500 leading-relaxed mb-4">
                         All users redirected to the &quot;PhishAware&quot; page are tracked here for remedial training.
                       </p>
                       {/* FIX: removed hardcoded 65% — show actual click count instead */}
                       <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">
                         {totalClicks} users redirected to training
                       </p>
                     </div>
                     <BarChart3 className="absolute -right-4 -bottom-4 w-24 h-24 text-indigo-500/5 group-hover:scale-110 transition-transform" />
                  </section>
                </aside>
              </div>
            </>
          ) : (
             <div className="flex flex-col items-center justify-center h-full text-center">
               <Shield className="w-16 h-16 text-indigo-500/20 mb-4" />
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
                  className="w-full px-4 py-2.5 bg-slate-950 rounded-lg border border-slate-800 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-medium transition-all"
                  placeholder="Q2 SECURITY-DRIVE"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2">Target Node Emails (comma-separated)</label>
                <textarea 
                  required
                  value={newSim.emails}
                  onChange={e => setNewSim({...newSim, emails: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-950 rounded-lg border border-slate-800 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-medium h-24 resize-none transition-all"
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
                          ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500 shadow-lg shadow-indigo-500/10' 
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
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-[0.2em] py-4 rounded-xl transition-all shadow-xl shadow-indigo-600/20 border border-indigo-400/20 mt-4"
              >
                Launch Protocol
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

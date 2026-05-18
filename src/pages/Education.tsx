import React from 'react';
import { motion } from 'motion/react';
import { 
  ShieldAlert, ExternalLink, BookOpen, CheckCircle, 
  Search, Flag, MousePointer, Mail, Shield
} from 'lucide-react';
// FIX: removed unused imports AlertCircle and Info

export default function Education() {
  const redFlags = [
    {
      title: "Suspicious Sender Address",
      description: "Always verify the sender's full email address. Attackers often spoof names like 'IT Support' but use invalid domains.",
      icon: Mail,
      tag: "IDENTITY"
    },
    {
      title: "Urgent or Threatening Tone",
      description: "Phrases like 'Action Required' or '24 hours remaining' are designed to bypass your critical thinking.",
      icon: ShieldAlert,
      tag: "URGENCY"
    },
    {
      title: "Mismatched Links",
      description: "Hover over any button or link to see the actual URL. If it doesn't match the company domain, don't click.",
      icon: MousePointer,
      tag: "INTEGRITY"
    },
    {
      title: "Generic Greetings",
      description: "Legitimate corporate communications usually address you by name, not 'Dear User'.",
      icon: Search,
      tag: "PATTERN"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 selection:bg-rose-500/30">
      <div className="max-w-4xl mx-auto">
        {/* Warning Header — FIX: removed duplicate overflow-hidden */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800 mb-10 relative"
        >
          {/* Scanning line animation */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.8)] animate-scan z-20" />
          
          <div className="bg-rose-950/30 border-b border-rose-500/20 p-10 text-center relative overflow-hidden">
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-rose-500/10 blur-[80px] rounded-full" />
            <div className="inline-flex items-center justify-center p-5 bg-rose-500/10 border border-rose-500/30 rounded-2xl mb-6 relative z-10">
              <ShieldAlert size={48} className="text-rose-500" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black mb-3 uppercase tracking-tighter text-white relative z-10 italic">Incident logged.</h1>
            <p className="text-xl text-rose-400 font-bold uppercase tracking-widest opacity-80 relative z-10">Simulation Protocol: Compromised</p>
          </div>
          
          <div className="p-10 md:p-14 text-center">
            <p className="text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto mb-10">
              This was a <span className="text-emerald-400 font-black uppercase tracking-tighter italic mr-1 text-xl">Simulated attack</span>.
              In a real-world scenario, your corporate credentials could have been harvested.
              But don't worry—your station is secure.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 px-5 py-3 rounded-xl shadow-sm">
                <CheckCircle size={18} className="text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data Integrity Intact</span>
              </div>
              <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 px-5 py-3 rounded-xl shadow-sm">
                <CheckCircle size={18} className="text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Malware Sweep Clean</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Breakdown Section */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-10 justify-center">
             <div className="h-[1px] w-12 bg-slate-800" />
             <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em]">Detection Vectors</h2>
             <div className="h-[1px] w-12 bg-slate-800" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {redFlags.map((flag, i) => (
              <motion.div 
                key={flag.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex gap-5 hover:border-emerald-500/30 transition-all group overflow-hidden relative"
              >
                <div className="shrink-0 relative z-10">
                  <div className="p-3 bg-slate-950 border border-slate-800 text-emerald-400 rounded-lg group-hover:text-emerald-300 transition-colors">
                    <flag.icon size={20} />
                  </div>
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase tracking-tighter">{flag.tag}</span>
                    <h3 className="font-bold text-slate-200 text-sm tracking-tight">{flag.title}</h3>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{flag.description}</p>
                </div>
                <div className="absolute -right-2 -bottom-2 text-slate-800/10 text-4xl font-black select-none uppercase tracking-tighter italic">{flag.tag}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Resources */}
        <section className="bg-emerald-600 rounded-2xl p-10 md:p-14 text-white overflow-hidden relative shadow-2xl shadow-emerald-600/20">
          <div className="relative z-10 max-w-xl">
            <h2 className="text-3xl font-black mb-4 uppercase tracking-tighter leading-none italic">Armor up your skills.</h2>
            <p className="text-emerald-100 mb-10 text-lg font-medium opacity-90">
              Cybersecurity is everyone's responsibility. Boost your defense intuition with our verified intel modules.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a href="#" className="flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10 group">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-lg text-white group-hover:scale-110 transition-transform"><BookOpen size={18} /></div>
                  <span className="text-xs font-black uppercase tracking-widest">Phish Intel</span>
                </div>
                <ExternalLink size={14} className="opacity-50" />
              </a>
              <a href="#" className="flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/10 group">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-lg text-white group-hover:scale-110 transition-transform"><Flag size={18} /></div>
                  <span className="text-xs font-black uppercase tracking-widest">Report Vector</span>
                </div>
                <ExternalLink size={14} className="opacity-50" />
              </a>
            </div>
          </div>
          <Shield size={240} className="absolute -right-20 -bottom-20 text-white/5 rotate-12" strokeWidth={1} />
        </section>

        <footer className="mt-16 text-center">
          <div className="h-[1px] w-24 bg-slate-800 mx-auto mb-6" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600">PhishGuardian Security Protocol v4.2.0</p>
        </footer>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scan {
          animation: scan 4s linear infinite;
        }
      `}</style>
    </div>
  );
}

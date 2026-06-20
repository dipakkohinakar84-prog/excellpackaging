import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from './pocketbase';
import { WorkOrder, Notice } from './types';
import { RefreshCw, Maximize2, Minimize2, Pause, Play, ArrowLeft, Megaphone, Plus, X, Trash2, ListChecks, Clock, PlayCircle } from 'lucide-react';

interface Props {
  loggedInUser?: { username: string; department: string } | null;
  liveScreenUser?: any;
  onBack?: () => void;
}

interface PageDef {
  key: string;
  label: string;
  status: string;
  icon: React.ReactNode;
  accent: string;
  dotColor: string;
}

const PAGES: PageDef[] = [
  { key: 'wip', label: 'Work In Progress', status: 'Work Started', icon: <PlayCircle size={22} />, accent: 'text-yellow-400', dotColor: 'bg-yellow-400' },
  { key: 'qc', label: 'Ready For QC', status: 'Ready for QC', icon: <ListChecks size={22} />, accent: 'text-green-400', dotColor: 'bg-green-400' },
  { key: 'pending', label: 'Pending Orders', status: 'Not Started', icon: <Clock size={22} />, accent: 'text-slate-100', dotColor: 'bg-slate-100' },
];

const DEPT_COLUMNS = [
  { key: 'Wood_Work', label: 'Wood Work', color: 'text-amber-300', border: 'border-l-amber-500/60', dot: 'bg-amber-400/70' },
  { key: 'Corrugation', label: 'Corrugation', color: 'text-blue-300', border: 'border-l-blue-500/60', dot: 'bg-blue-400/70' },
];

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatElapsed(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const ts = new Date(dateStr).getTime();
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 0) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs < 24) return `${hrs}h ${remMins}m`;
  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return `${days}d ${remHrs}h`;
}

const LiveScreen: React.FC<Props> = ({ loggedInUser, liveScreenUser, onBack }) => {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [playing, setPlaying] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [showNoticeManager, setShowNoticeManager] = useState(false);
  const [newNoticeText, setNewNoticeText] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [tick, setTick] = useState(0);
  const rotateRef = useRef<ReturnType<typeof setInterval>>();
  const prevPageCountRef = useRef(0);
  const [badgePop, setBadgePop] = useState(false);

  const activeNotices = useMemo(() => notices.filter(n => n.is_active), [notices]);

  const fetchData = useCallback(async () => {
    const [woRes, noticeRes] = await Promise.all([
      supabase.from('work_orders').select('*').limit(200),
      supabase.from('notices').select('*').order('created_at', { ascending: false }),
    ]);
    if (!woRes.error && woRes.data) {
      const sorted = (woRes.data as WorkOrder[]).sort((a, b) => {
        const pa = a.status === 'Work Started' ? 0 : a.status === 'Ready for QC' ? 1 : a.status === 'Not Started' ? 2 : 3;
        const pb = b.status === 'Work Started' ? 0 : b.status === 'Ready for QC' ? 1 : b.status === 'Not Started' ? 2 : 3;
        if (pa !== pb) return pa - pb;
        return b.id > a.id ? 1 : -1;
      });
      setOrders(sorted);
    }
    if (!noticeRes.error && noticeRes.data) setNotices((noticeRes.data as Notice[]).filter(n => n.is_active));
  }, []);

  const pageOrders = useMemo(() => {
    const page = PAGES[currentPage];
    return orders.filter(o => o.status === page.status);
  }, [orders, currentPage]);

  const columnOrders = useMemo(() => {
    const grouped: Record<string, WorkOrder[]> = { Wood_Work: [], Corrugation: [] };
    pageOrders.forEach(wo => {
      const depts = wo.assigned_departments || [];
      const match = DEPT_COLUMNS.find(col => depts.includes(col.key));
      if (match) grouped[match.key].push(wo);
    });
    return grouped;
  }, [pageOrders]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel('live-screen-wo-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'work_orders' }, () => { fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  useEffect(() => {
    const iv = setInterval(() => { if (playing) { fetchData(); setTick(t => t + 1); } }, 30000);
    return () => clearInterval(iv);
  }, [playing, fetchData]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (rotateRef.current) clearInterval(rotateRef.current);
    if (playing) {
      rotateRef.current = setInterval(() => {
        setCurrentPage(p => (p + 1) % PAGES.length);
      }, 12000);
    }
    return () => { if (rotateRef.current) clearInterval(rotateRef.current); };
  }, [playing]);

  useEffect(() => {
    if (pageOrders.length !== prevPageCountRef.current) {
      prevPageCountRef.current = pageOrders.length;
      setBadgePop(true);
      const t = setTimeout(() => setBadgePop(false), 400);
      return () => clearTimeout(t);
    }
  }, [pageOrders.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleAddNotice = async () => {
    const text = newNoticeText.trim();
    if (!text) return;
    const { error } = await supabase.from('notices').insert({ message: text, is_active: true });
    if (!error) { setNewNoticeText(''); fetchData(); }
  };

  const handleDeleteNotice = async (id: number | string) => {
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (!error) fetchData();
  };

  const page = PAGES[currentPage];

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      <style>{`
        @keyframes marqueeScroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .marquee-track{display:flex;white-space:nowrap;animation:marqueeScroll var(--marquee-duration,30s) linear infinite}
        .row-hover:hover{background:rgba(30,41,59,0.4)}
        .scrollbar-thin::-webkit-scrollbar{width:4px}
        .scrollbar-thin::-webkit-scrollbar-track{background:transparent}
        .scrollbar-thin::-webkit-scrollbar-thumb{background:#334155;border-radius:4px}
        @keyframes fadeSlideIn{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes pulseSlow{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes pop{0%{transform:scale(1)}40%{transform:scale(1.25)}60%{transform:scale(0.9)}100%{transform:scale(1)}}
        .animate-fade-in{animation:fadeSlideIn .35s ease-out}
        .animate-pulse-slow{animation:pulseSlow 3s ease-in-out infinite}
        .animate-pop{animation:pop .35s ease-out}
      `}</style>

      {/* Notice Marquee */}
      {activeNotices.length > 0 && (
        <div className="shrink-0 mx-4 mt-3 mb-1 overflow-hidden rounded-lg bg-gradient-to-r from-amber-500/15 via-yellow-500/15 to-amber-500/15 border border-amber-500/20 h-8 flex items-center" style={{ maskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)' }}>
          <div className="marquee-track flex items-center h-full" style={{ '--marquee-duration': `${Math.max(15, activeNotices.length * 8)}s` } as React.CSSProperties}>
            {[...Array(4)].flatMap(() => activeNotices).map((notice, i) => (
              <span key={`${notice.id}-${i}`} className="inline-flex items-center gap-2 mx-6 text-amber-300/80 font-bold text-sm tracking-wide">
                <Megaphone size={14} className="text-amber-400/60 shrink-0" fill="currentColor" />
                {notice.message}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top Controls */}
      <div className="shrink-0 px-4 pt-3 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="px-2 py-1.5 rounded-lg bg-white/5 text-gray-500 hover:bg-white/10 text-xs font-bold">
              <ArrowLeft size={15} />
            </button>
          )}
          <span className="text-[11px] font-semibold text-gray-600 tracking-wider">
            {liveScreenUser ? `Live: ${liveScreenUser.username}` : loggedInUser ? `ERP: ${loggedInUser.username}` : 'Live Screen'}
          </span>
          {loggedInUser && (
            <button onClick={() => setShowNoticeManager(true)} className="px-2 py-1.5 rounded-lg bg-amber-500/10 text-amber-400/70 hover:bg-amber-500/20 text-[11px] font-bold flex items-center gap-1">
              <Megaphone size={12} /> Notice
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setPlaying(!playing)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-all">
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button onClick={toggleFullscreen} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-all">
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onClick={() => { fetchData(); setTick(t => t + 1); }} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-all">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 flex flex-col min-h-0 px-4 pt-1 pb-1">
        {/* Page Header */}
        <div className="shrink-0 flex items-center justify-center pb-2 border-b border-slate-800/60 mb-2 relative">
          <div className="flex items-center gap-2.5">
            <span className={page.accent}>{page.icon}</span>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{page.label}</h1>
            <span className={`px-2.5 py-1 rounded-full text-sm font-bold ${page.accent} bg-white/5 ${badgePop ? 'animate-pop' : ''}`}>
              {pageOrders.length}
            </span>
          </div>
          <div className="absolute right-0 text-sm font-bold text-gray-500 tabular-nums">{formatDate(new Date())}</div>
        </div>

        {/* Order Columns */}
        <div key={currentPage} className="flex-1 flex flex-col min-h-0 animate-fade-in">
        {pageOrders.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-gray-600 text-lg font-semibold flex flex-col items-center gap-2">
              <span className={page.accent}>{page.icon}</span>
              <span>No {page.label.toLowerCase()}.</span>
            </div>
          </div>
        ) : (
          (() => {
            const rowColor = page.key === 'wip' ? 'text-yellow-300' : page.key === 'qc' ? 'text-green-300' : 'text-white';
            const rowColorMuted = page.key === 'wip' ? 'text-yellow-300/70' : page.key === 'qc' ? 'text-green-300/70' : 'text-white/70';
            const rowDot = page.key === 'wip' ? 'bg-yellow-400/70' : page.key === 'qc' ? 'bg-green-400/70' : 'bg-white/70';
            const rowBorder = page.key === 'wip' ? 'border-l-yellow-500/60' : page.key === 'qc' ? 'border-l-green-500/60' : 'border-l-white/60';
            return (
          <div className="flex-1 grid grid-cols-2 gap-3 min-h-0 overflow-hidden">
            {DEPT_COLUMNS.map(col => {
              const colOrders = columnOrders[col.key];
              return (
                <div key={col.key} className="flex flex-col min-h-0 rounded-xl border border-slate-800/30 bg-[#0b1220]/60 overflow-hidden">
                  {/* Column Header */}
                  <div className="shrink-0 flex items-center justify-center gap-2 px-4 py-3 border-b border-slate-800/40">
                    <span className={`w-3 h-3 rounded-full ${rowDot}`} />
                    <span className={`text-2xl font-black ${rowColor}`}>{col.label}</span>
                    <span className="px-2 py-0.5 rounded text-sm font-bold bg-white/5 text-gray-400">{colOrders.length}</span>
                  </div>
                  {/* Column Body */}
                  <div className="flex-1 overflow-y-auto scrollbar-thin">
                    {colOrders.length === 0 ? (
                      <div className="flex items-center justify-center h-full py-12 text-gray-600 text-sm font-semibold">No orders</div>
                    ) : (
                      colOrders.map((wo, idx) => (
                        <div key={wo.id} style={{ animation: `fadeSlideIn 0.35s ease-out ${idx * 60}ms both` }} className={`px-4 py-4 row-hover transition-colors border-t border-slate-800/30 first:border-t-0 border-l-[3px] ${rowBorder}`}>
                          <div className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded-full shrink-0 ${rowDot}`} />
                            <span className="text-xl font-bold text-gray-500 shrink-0 w-16 tabular-nums">#{wo.id}</span>
                            <div className="flex-1 min-w-0">
                              <div className={`text-2xl font-bold truncate leading-tight ${rowColor}`}>{wo.customer}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                               <div className={`text-xl ${rowColor} font-bold truncate leading-tight`}>{wo.job_details}</div>
                            </div>
                            <div className={`text-2xl font-semibold tabular-nums shrink-0 ${rowColor}`}>{wo.qty}</div>
                            <div className={`text-lg font-bold font-mono tabular-nums shrink-0 w-28 text-right ${rowColor}`}>{wo.etd}</div>
                          </div>
                          <div className="flex items-center justify-end gap-1.5 mt-1 pr-1">
                            <Clock size={16} className="text-gray-600 animate-pulse-slow" />
                            <span className="text-base font-bold tabular-nums text-gray-500 animate-pulse-slow">{formatElapsed((wo as any).updated_at)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
            );
          })()
        )}
        </div>

        {/* Page Dots */}
        <div className="shrink-0 flex items-center justify-center gap-3 pt-3 pb-2">
          {PAGES.map((p, i) => (
            <button
              key={p.key}
              onClick={() => setCurrentPage(i)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                i === currentPage ? `${p.dotColor} scale-125` : 'bg-slate-700 hover:bg-slate-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Notice Manager Modal */}
      {showNoticeManager && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md mx-4 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-black text-lg flex items-center gap-2"><Megaphone size={18} className="text-amber-400" /> Manage Notices</h3>
              <button onClick={() => setShowNoticeManager(false)} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
            </div>
            <div className="flex gap-2 mb-4">
              <input value={newNoticeText} onChange={e => setNewNoticeText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddNotice(); }} placeholder="Type a notice message..." className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm outline-none placeholder:text-gray-500" />
              <button onClick={handleAddNotice} className="px-3 py-2 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 flex items-center gap-1"><Plus size={15} /> Add</button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {notices.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No notices yet.</p>
              ) : (
                notices.map(notice => (
                  <div key={notice.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${notice.is_active ? 'bg-green-400' : 'bg-gray-600'}`} />
                      <span className="text-white/90 text-sm truncate">{notice.message}</span>
                    </div>
                    <button onClick={() => handleDeleteNotice(notice.id)} className="text-red-400 hover:text-red-300 p-1 shrink-0 ml-2"><Trash2 size={14} /></button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveScreen;

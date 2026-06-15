import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './pocketbase';
import { WorkOrder, DailyTask } from './types';
import { Monitor, RefreshCw, ListTodo, ClipboardList, Maximize2, Minimize2, Pause, Play, ArrowLeft, Megaphone, Plus, X, Trash2 } from 'lucide-react';
import { Notice } from './types';

interface Props {
  loggedInUser?: { username: string; department: string } | null;
  liveScreenUser?: any;
  onBack?: () => void;
}

const statusBg: Record<string, string> = {
  'Not Started': 'bg-gray-600',
  'Work Started': 'bg-blue-600',
  'Ready for QC': 'bg-yellow-500',
  'QC Approved': 'bg-green-500',
  'Ready for despatch': 'bg-purple-500',
  'Dispatched': 'bg-indigo-500',
  'Delivered': 'bg-emerald-500',
  'Cancelled': 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  'in progress': 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const priorityLabels: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const priorityBorder: Record<string, string> = {
  low: 'bg-gray-500',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

const LiveScreen: React.FC<Props> = ({ loggedInUser, liveScreenUser, onBack }) => {
  const [mode, setMode] = useState<'orders' | 'tasks'>('orders');
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [transitioning, setTransitioning] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [showNoticeManager, setShowNoticeManager] = useState(false);
  const [newNoticeText, setNewNoticeText] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const pageIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const items = mode === 'orders' ? orders : tasks;
  const perPage = 4;
  const pages: (WorkOrder | DailyTask)[][] = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  const currentSet = pages[page] || [];

  const fetchData = useCallback(async () => {
    const [woRes, taskRes, noticeRes] = await Promise.all([
      supabase.from('work_orders').select('*').limit(50),
      supabase.from('daily_tasks').select('*').limit(50),
      supabase.from('notices').select('*').order('created_at', { ascending: false }),
    ]);
    if (!woRes.error && woRes.data) setOrders((woRes.data as WorkOrder[]).sort((a, b) => (b.id > a.id ? 1 : -1)));
    if (!taskRes.error && taskRes.data) setTasks((taskRes.data as DailyTask[]).sort((a, b) => (b.id > a.id ? 1 : -1)));
    if (!noticeRes.error && noticeRes.data) setNotices((noticeRes.data as Notice[]).filter(n => n.is_active));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const iv = setInterval(() => { if (playing) fetchData(); }, 30000);
    return () => clearInterval(iv);
  }, [playing, fetchData]);

  useEffect(() => {
    if (pageIntervalRef.current) clearInterval(pageIntervalRef.current);
    if (playing && pages.length > 1) {
      pageIntervalRef.current = setInterval(() => {
        setTransitioning(true);
        setTimeout(() => {
          setPage(prev => (prev + 1) % pages.length);
          setTransitioning(false);
        }, 400);
      }, speed * 1000);
    }
    return () => { if (pageIntervalRef.current) clearInterval(pageIntervalRef.current); };
  }, [playing, pages.length, speed]);

  const handleModeSwitch = (newMode: 'orders' | 'tasks') => {
    if (newMode === mode) return;
    setTransitioning(true);
    setTimeout(() => {
      setMode(newMode);
      setPage(0);
      setTransitioning(false);
    }, 300);
  };

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
    if (!error) {
      setNewNoticeText('');
      fetchData();
    }
  };

  const handleDeleteNotice = async (id: number | string) => {
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (!error) fetchData();
  };

  const activeNotices = notices.filter(n => n.is_active);

  const renderOrderCard = (wo: WorkOrder) => (
    <div className="h-full bg-slate-900/70 backdrop-blur border border-slate-700/40 rounded-2xl p-5 flex flex-col relative overflow-hidden shadow-lg shadow-black/20">
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${statusBg[wo.status] || 'bg-gray-600'}`} />
      <div className="flex items-start justify-between mb-1">
        <span className="text-base font-bold text-white/50">ORDER #{wo.id}</span>
        <span className={`px-4 py-1.5 rounded-full text-xl font-black tracking-wide ${statusBg[wo.status] || 'bg-gray-600'} text-white shrink-0 ml-2`}>{wo.status}</span>
      </div>
      <p className="text-2xl font-black text-white mb-2">{wo.customer}</p>
      <p className="text-lg font-semibold text-white/80 line-clamp-3 mb-auto">{wo.job_details}</p>
      <div className="mt-4 flex gap-2 flex-wrap">
        {(wo.assigned_departments || []).map(dept => {
          const ds = (wo.department_statuses || []).find(s => s.department === dept);
          const done = ds?.status === 'Completed' || ds?.status === 'QC Approved';
          const started = ds?.status && ds.status !== 'Not Started';
          return (
            <div key={dept} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${done ? 'bg-green-500/20 text-green-400' : started ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-white/40'}`}>
              <span className={`w-2 h-2 rounded-full ${done ? 'bg-green-400' : started ? 'bg-yellow-400 animate-pulse' : 'bg-white/20'}`} />
              {dept.replace(/_/g, ' ')}
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-sm font-semibold text-white/30">Qty: {wo.qty}</div>
    </div>
  );

  const renderTaskCard = (task: DailyTask) => (
    <div className="h-full bg-slate-900/70 backdrop-blur border border-slate-700/40 rounded-2xl p-5 flex flex-col relative overflow-hidden shadow-lg shadow-black/20">
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${priorityBorder[task.priority] || 'bg-blue-500'}`} />
      <span className="text-xl font-black text-white/90 mb-2">{task.title}</span>
      {task.description && <p className="text-base text-white/50 line-clamp-3 mb-auto">{task.description}</p>}
      <div className="mt-4 flex items-center gap-4 text-sm text-white/40">
        <span className="flex items-center gap-1.5">Assigned: {task.assignee}</span>
        {task.due_date && <span className="flex items-center gap-1.5">Due: {task.due_date}</span>}
      </div>
      <div className="mt-3 flex gap-2">
        <span className={`px-3 py-1 rounded-full text-xs font-black ${priorityBg(task.priority)} text-white`}>{priorityLabels[task.priority] || task.priority}</span>
        <span className={`px-3 py-1 rounded-full text-xs font-black ${taskStatusBg(task.status)} text-white`}>{statusLabels[task.status] || task.status}</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      <style>{`
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeScaleOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.92); }
        }
        @keyframes marqueeScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .card-enter { animation: fadeScaleIn 0.45s ease-out both; }
        .card-exit { animation: fadeScaleOut 0.35s ease-in both; }
        .marquee-track { display: flex; white-space: nowrap; animation: marqueeScroll var(--marquee-duration, 30s) linear infinite; }
      `}</style>

      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between no-print">
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="px-2 py-1.5 rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 text-xs font-bold mr-1">
              <ArrowLeft size={14}/>
            </button>
          )}
          <Monitor size={20} className="text-blue-400" />
          <span className="text-blue-400 font-bold text-sm tracking-widest">LIVE</span>
          <span className="text-gray-600 text-xs font-semibold ml-2">{items.length} items</span>
          {loggedInUser && (
            <button onClick={() => setShowNoticeManager(true)} className="ml-2 px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-xs font-bold flex items-center gap-1.5">
              <Megaphone size={13} /> Notices
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => handleModeSwitch('orders')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'orders' ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}>
            <ClipboardList size={14} className="inline mr-1"/> Orders
          </button>
          <button onClick={() => handleModeSwitch('tasks')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'tasks' ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}>
            <ListTodo size={14} className="inline mr-1"/> Tasks
          </button>
          <select value={speed} onChange={e => setSpeed(Number(e.target.value))} className="px-2 py-1.5 rounded-lg bg-white/10 text-gray-400 text-xs font-bold outline-none">
            <option value="5">5s</option>
            <option value="10">10s</option>
            <option value="15">15s</option>
          </select>
          <button onClick={() => setPlaying(!playing)} className="px-3 py-1.5 rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 text-xs font-bold">
            {playing ? <Pause size={14}/> : <Play size={14}/>}
          </button>
          <button onClick={toggleFullscreen} className="px-3 py-1.5 rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 text-xs font-bold">
            {fullscreen ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}
          </button>
          <button onClick={() => { fetchData(); }} className="px-3 py-1.5 rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 text-xs font-bold">
            <RefreshCw size={14}/>
          </button>
        </div>
      </div>

      {activeNotices.length > 0 && (
        <div className="relative z-10 mt-16 mx-4 mb-0 overflow-hidden rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-500/30 h-10 flex items-center" style={{ maskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)' }}>
          <div className="marquee-track flex items-center h-full" style={{ '--marquee-duration': `${Math.max(15, activeNotices.length * 8)}s` } as React.CSSProperties}>
            {[...Array(4)].flatMap(() => activeNotices).map((notice, i) => (
              <span key={`${notice.id}-${i}`} className="inline-flex items-center gap-3 mx-8 text-amber-300 font-bold text-lg tracking-wide">
                <Megaphone size={18} className="text-amber-400 shrink-0" fill="currentColor" />
                {notice.message}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center p-6">
        {items.length === 0 ? (
          <div className="text-gray-500 text-2xl font-semibold flex flex-col items-center gap-3">
            <Monitor size={48} className="text-gray-600" />
            <span>No {mode === 'orders' ? 'orders' : 'tasks'} to display.</span>
          </div>
        ) : (
          <div className={`w-full h-full grid grid-cols-2 gap-4 content-center ${transitioning ? 'card-exit' : ''}`}>
            {currentSet.map((item: any, i) => (
              <div key={item.id} className="card-enter" style={{ animationDelay: `${i * 100}ms` }}>
                {mode === 'orders' ? renderOrderCard(item as WorkOrder) : renderTaskCard(item as DailyTask)}
              </div>
            ))}
            {Array.from({ length: perPage - currentSet.length }).map((_, i) => (
              <div key={`empty-${i}`} className="rounded-2xl border border-dashed border-slate-800/50 flex items-center justify-center text-slate-700 text-sm font-semibold">
                &nbsp;
              </div>
            ))}
          </div>
        )}
      </div>

      {pages.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {pages.map((_, i) => (
            <div key={i} className={`rounded-full transition-all duration-300 ${i === page ? 'w-6 h-2.5 bg-blue-400' : 'w-2.5 h-2.5 bg-white/20'}`} />
          ))}
        </div>
      )}

      <div className="absolute bottom-4 right-4 text-[10px] text-gray-600 font-semibold">
        {liveScreenUser ? `Live: ${liveScreenUser.username}` : loggedInUser ? `ERP: ${loggedInUser.username}` : 'Live Screen'}
      </div>

      {showNoticeManager && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md mx-4 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-black text-lg flex items-center gap-2"><Megaphone size={18} className="text-amber-400" /> Manage Notices</h3>
              <button onClick={() => setShowNoticeManager(false)} className="text-gray-500 hover:text-gray-300"><X size={18}/></button>
            </div>
            <div className="flex gap-2 mb-4">
              <input value={newNoticeText} onChange={e => setNewNoticeText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddNotice(); }} placeholder="Type a notice message..." className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm outline-none placeholder:text-gray-500" />
              <button onClick={handleAddNotice} className="px-3 py-2 rounded-lg bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 flex items-center gap-1"><Plus size={15}/> Add</button>
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
                    <button onClick={() => handleDeleteNotice(notice.id)} className="text-red-400 hover:text-red-300 p-1 shrink-0 ml-2"><Trash2 size={14}/></button>
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

function priorityBg(p: string) {
  switch (p) {
    case 'low': return 'bg-gray-500';
    case 'medium': return 'bg-blue-500';
    case 'high': return 'bg-orange-500';
    case 'urgent': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}

function taskStatusBg(s: string) {
  switch (s) {
    case 'pending': return 'bg-yellow-500';
    case 'in progress': return 'bg-blue-500';
    case 'completed': return 'bg-green-500';
    case 'cancelled': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}

export default LiveScreen;

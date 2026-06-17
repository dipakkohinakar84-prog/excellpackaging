import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from './pocketbase';
import { WorkOrder, DailyTask, Notice } from './types';
import { Search, RefreshCw, Maximize2, Minimize2, Pause, Play, ArrowLeft, Megaphone, Plus, X, Trash2, ListTodo, ClipboardList } from 'lucide-react';

interface Props {
  loggedInUser?: { username: string; department: string } | null;
  liveScreenUser?: any;
  onBack?: () => void;
}

const statusBadgeColors: Record<string, string> = {
  'Not Started': 'bg-gray-500/20 text-gray-400',
  'Work Started': 'bg-blue-500/20 text-blue-400',
  'Ready for QC': 'bg-amber-500/20 text-amber-400',
  'QC Approved': 'bg-green-500/20 text-green-400',
  'Ready for despatch': 'bg-purple-500/20 text-purple-400',
  'Dispatched': 'bg-indigo-500/20 text-indigo-400',
  'Delivered': 'bg-emerald-500/20 text-emerald-400',
  'Cancelled': 'bg-red-500/20 text-red-400',
};

const statusBorderColors: Record<string, string> = {
  'Not Started': 'border-l-gray-500',
  'Work Started': 'border-l-blue-500',
  'Ready for QC': 'border-l-amber-500',
  'QC Approved': 'border-l-green-500',
  'Ready for despatch': 'border-l-purple-500',
  'Dispatched': 'border-l-indigo-500',
  'Delivered': 'border-l-emerald-500',
  'Cancelled': 'border-l-red-500',
};

const orderStatusPriority: Record<string, number> = {
  'Work Started': 0,
  'Ready for QC': 1,
  'Not Started': 2,
  'QC Approved': 3,
  'Ready for despatch': 4,
  'Dispatched': 5,
  'Delivered': 6,
  'Cancelled': 7,
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
  low: 'border-l-gray-500',
  medium: 'border-l-blue-500',
  high: 'border-l-orange-500',
  urgent: 'border-l-red-500',
};

const taskStatusPriority: Record<string, number> = {
  'in progress': 0,
  pending: 1,
  completed: 2,
  cancelled: 3,
};

function priorityBg(p: string) {
  switch (p) {
    case 'low': return 'bg-gray-500/20 text-gray-400';
    case 'medium': return 'bg-blue-500/20 text-blue-400';
    case 'high': return 'bg-orange-500/20 text-orange-400';
    case 'urgent': return 'bg-red-500/20 text-red-400';
    default: return 'bg-gray-500/20 text-gray-400';
  }
}

function taskStatusBg(s: string) {
  switch (s) {
    case 'pending': return 'bg-gray-500/20 text-gray-400';
    case 'in progress': return 'bg-blue-500/20 text-blue-400';
    case 'completed': return 'bg-green-500/20 text-green-400';
    case 'cancelled': return 'bg-red-500/20 text-red-400';
    default: return 'bg-gray-500/20 text-gray-400';
  }
}

interface KpiCard { label: string; value: number; color: string; }

function getAge(createdAt: string | undefined): string {
  if (!createdAt) return '--:--';
  const created = new Date(createdAt).getTime();
  if (isNaN(created)) return '--:--';
  const diff = Date.now() - created;
  if (diff < 0) return '00:00';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function isAging(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  return !isNaN(created) && (Date.now() - created) > 7200000;
}

const LiveScreen: React.FC<Props> = ({ loggedInUser, liveScreenUser, onBack }) => {
  const [mode, setMode] = useState<'orders' | 'tasks'>('orders');
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [playing, setPlaying] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [showNoticeManager, setShowNoticeManager] = useState(false);
  const [newNoticeText, setNewNoticeText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderFilterTab, setOrderFilterTab] = useState('All');
  const [taskFilterTab, setTaskFilterTab] = useState('All');
  const [tick, setTick] = useState(0);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const activeNotices = useMemo(() => notices.filter(n => n.is_active), [notices]);

  const fetchData = useCallback(async () => {
    const [woRes, taskRes, noticeRes] = await Promise.all([
      supabase.from('work_orders').select('*').limit(200),
      supabase.from('daily_tasks').select('*').limit(200),
      supabase.from('notices').select('*').order('created_at', { ascending: false }),
    ]);
    if (!woRes.error && woRes.data) setOrders((woRes.data as WorkOrder[]).sort((a, b) => {
      const pa = orderStatusPriority[a.status] ?? 99;
      const pb = orderStatusPriority[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return b.id > a.id ? 1 : -1;
    }));
    if (!taskRes.error && taskRes.data) setTasks((taskRes.data as DailyTask[]).sort((a, b) => {
      const pa = taskStatusPriority[a.status] ?? 99;
      const pb = taskStatusPriority[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return b.id > a.id ? 1 : -1;
    }));
    if (!noticeRes.error && noticeRes.data) setNotices((noticeRes.data as Notice[]).filter(n => n.is_active));
  }, []);

  const orderTabDefs = useMemo(() => {
    const counts: Record<string, number> = { All: orders.length };
    orders.forEach(o => {
      if (o.status === 'Work Started') counts['In Production'] = (counts['In Production'] || 0) + 1;
      else if (o.status === 'Ready for QC') counts['Ready For QC'] = (counts['Ready For QC'] || 0) + 1;
      else if (o.status === 'Not Started') counts['Pending'] = (counts['Pending'] || 0) + 1;
      else if (o.status === 'Cancelled') counts['Blocked'] = (counts['Blocked'] || 0) + 1;
    });
    return [
      { key: 'All', label: 'All', count: orders.length },
      { key: 'Ready For QC', label: 'QC', count: counts['Ready For QC'] || 0, color: 'text-amber-400' },
      { key: 'In Production', label: 'Production', count: counts['In Production'] || 0, color: 'text-blue-400' },
      { key: 'Pending', label: 'Pending', count: counts['Pending'] || 0, color: 'text-gray-400' },
      { key: 'Blocked', label: 'Blocked', count: counts['Blocked'] || 0, color: 'text-red-400' },
    ].filter(t => t.key === 'All' || t.count > 0);
  }, [orders]);

  const taskTabDefs = useMemo(() => {
    const counts: Record<string, number> = { All: tasks.length };
    tasks.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return [
      { key: 'All', label: 'All', count: tasks.length },
      { key: 'pending', label: 'Pending', count: counts['pending'] || 0, color: 'text-gray-400' },
      { key: 'in progress', label: 'In Progress', count: counts['in progress'] || 0, color: 'text-blue-400' },
      { key: 'completed', label: 'Completed', count: counts['completed'] || 0, color: 'text-green-400' },
      { key: 'cancelled', label: 'Cancelled', count: counts['cancelled'] || 0, color: 'text-red-400' },
    ].filter(t => t.key === 'All' || t.count > 0);
  }, [tasks]);

  const kpiCards: KpiCard[] = useMemo(() => {
    if (mode === 'tasks') return [];
    const readyQC = orders.filter(o => o.status === 'Ready for QC').length;
    const inProd = orders.filter(o => o.status === 'Work Started').length;
    const pending = orders.filter(o => o.status === 'Not Started').length;
    const blocked = orders.filter(o => o.status === 'Cancelled').length;
    const aging = orders.filter(o => isAging(o.created_at) && o.status !== 'Delivered' && o.status !== 'Cancelled').length;
    return [
      { label: 'READY FOR QC', value: readyQC, color: 'text-amber-400' },
      { label: 'IN PRODUCTION', value: inProd, color: 'text-blue-400' },
      { label: 'PENDING', value: pending, color: 'text-gray-400' },
      { label: 'BLOCKED', value: blocked, color: 'text-red-400' },
      { label: 'AGING > 2H', value: aging, color: 'text-orange-400' },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, mode, tick]);

  const orderStatusFilterMap: Record<string, string | undefined> = {
    All: undefined,
    'Ready For QC': 'Ready for QC',
    'In Production': 'Work Started',
    Pending: 'Not Started',
    Blocked: 'Cancelled',
  };

  const filteredOrders = useMemo(() => {
    let result = orders;
    const statusFilter = orderStatusFilterMap[orderFilterTab];
    if (statusFilter) result = result.filter(o => o.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o =>
        String(o.id).includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.job_details.toLowerCase().includes(q)
      );
    }
    return result;
  }, [orders, orderFilterTab, searchQuery]);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (taskFilterTab !== 'All') result = result.filter(t => t.status === taskFilterTab);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        String(t.id).includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tasks, taskFilterTab, searchQuery]);

  const items = mode === 'orders' ? filteredOrders : filteredTasks;
  const currentCount = items.length;

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const iv = setInterval(() => { if (playing) { fetchData(); setTick(t => t + 1); } }, 30000);
    return () => clearInterval(iv);
  }, [playing, fetchData]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    if (playing && tableRef.current) {
      scrollIntervalRef.current = setInterval(() => {
        const el = tableRef.current;
        if (!el) return;
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll <= 0) return;
        if (el.scrollTop >= maxScroll - 2) {
          el.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          el.scrollBy({ top: 1, behavior: 'smooth' });
        }
      }, 300);
    }
    return () => { if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current); };
  }, [playing, currentCount]);

  const handleModeSwitch = (newMode: 'orders' | 'tasks') => {
    setMode(newMode);
    setSearchQuery('');
    setOrderFilterTab('All');
    setTaskFilterTab('All');
    if (tableRef.current) tableRef.current.scrollTo({ top: 0, behavior: 'smooth' });
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
    if (!error) { setNewNoticeText(''); fetchData(); }
  };

  const handleDeleteNotice = async (id: number | string) => {
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (!error) fetchData();
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      <style>{`
        @keyframes marqueeScroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .marquee-track{display:flex;white-space:nowrap;animation:marqueeScroll var(--marquee-duration,30s) linear infinite}
        .table-header{background:#0f172a;position:sticky;top:0;z-index:5}
        .row{border-bottom:1px solid rgba(30,41,59,0.5)}
        .row:hover{background:rgba(30,41,59,0.4)}
        .scrollbar-thin::-webkit-scrollbar{width:4px}
        .scrollbar-thin::-webkit-scrollbar-track{background:transparent}
        .scrollbar-thin::-webkit-scrollbar-thumb{background:#334155;border-radius:4px}
      `}</style>

      {activeNotices.length > 0 && (
        <div className="shrink-0 mx-4 mt-3 mb-2 overflow-hidden rounded-lg bg-gradient-to-r from-amber-500/15 via-yellow-500/15 to-amber-500/15 border border-amber-500/20 h-8 flex items-center" style={{ maskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)' }}>
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

      <div className="shrink-0 px-4 pt-3 pb-2 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <button onClick={onBack} className="px-2 py-1.5 rounded-lg bg-white/5 text-gray-500 hover:bg-white/10 text-xs font-bold">
                <ArrowLeft size={15}/>
              </button>
            )}
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight shrink-0">
              {mode === 'orders' ? 'LIVE ORDERS' : 'LIVE TASKS'}
              <span className="text-gray-500 font-bold ml-1.5">({items.length})</span>
            </h1>
            {loggedInUser && (
              <button onClick={() => setShowNoticeManager(true)} className="px-2 py-1.5 rounded-lg bg-amber-500/10 text-amber-400/70 hover:bg-amber-500/20 text-[11px] font-bold flex items-center gap-1">
                <Megaphone size={12} /> Notice
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 flex-wrap">
            <button onClick={() => handleModeSwitch('orders')} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${mode === 'orders' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
              <ClipboardList size={13} className="inline mr-1"/> Orders
            </button>
            <button onClick={() => handleModeSwitch('tasks')} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${mode === 'tasks' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
              <ListTodo size={13} className="inline mr-1"/> Tasks
            </button>
            <button onClick={() => setPlaying(!playing)} className="px-2.5 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 text-[11px] font-bold">
              {playing ? <Pause size={13}/> : <Play size={13}/>}
            </button>
            <button onClick={toggleFullscreen} className="px-2.5 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 text-[11px] font-bold">
              {fullscreen ? <Minimize2 size={13}/> : <Maximize2 size={13}/>}
            </button>
            <button onClick={() => fetchData()} className="px-2.5 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 text-[11px] font-bold">
              <RefreshCw size={13}/>
            </button>
          </div>
        </div>

        {mode === 'orders' && kpiCards.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {kpiCards.map(kpi => (
              <div key={kpi.label} className="bg-[#0f172a]/80 border border-slate-800/60 rounded-lg px-3 py-2.5">
                <div className="text-[9px] sm:text-[10px] font-bold text-gray-500 tracking-wider truncate">{kpi.label}</div>
                <div className={`text-lg sm:text-xl font-black mt-0.5 ${kpi.color}`}>{kpi.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={`Search ${mode === 'orders' ? 'orders' : 'tasks'}...`} className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-[#0f172a] border border-slate-800 text-white text-xs outline-none focus:border-slate-600 placeholder:text-gray-600" />
          </div>
          <div className="flex gap-1 overflow-x-auto scrollbar-thin">
            {(mode === 'orders' ? orderTabDefs : taskTabDefs).map(tab => (
              <button key={tab.key} onClick={() => mode === 'orders' ? setOrderFilterTab(tab.key) : setTaskFilterTab(tab.key)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                  (mode === 'orders' ? orderFilterTab : taskFilterTab) === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#0f172a] border border-slate-800 text-gray-400 hover:border-slate-600'
                }`}
              >
                {tab.label} <span className="opacity-60">({tab.count})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-600 text-lg font-semibold flex flex-col items-center gap-2">
            <ClipboardList size={36} className="text-gray-700" />
            <span>No {mode === 'orders' ? 'orders' : 'tasks'} found.</span>
          </div>
        </div>
      ) : mode === 'orders' ? (
        <div className="flex-1 flex flex-col mx-2 sm:mx-4 mb-3 overflow-hidden rounded-lg sm:rounded-xl border border-slate-800/60 bg-[#0b1220]/80">
          <div className="overflow-x-auto scrollbar-thin">
            <div className="min-w-[700px]">
              <div className="table-header grid grid-cols-[60px_1fr_1fr_100px_50px_120px_65px_95px_70px] gap-0 px-3 sm:px-4 py-2 text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <div>ID</div><div>Customer</div><div>Job</div><div className="hidden sm:block">Dept</div><div>Qty</div><div>Status</div><div className="hidden sm:block">Age</div><div className="hidden md:block">Assigned</div><div className="hidden md:block">Action</div>
              </div>
              <div ref={tableRef} className="overflow-y-auto scrollbar-thin" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                {filteredOrders.map(wo => (
                  <div key={wo.id} className={`row grid grid-cols-[60px_1fr_1fr_100px_50px_120px_65px_95px_70px] gap-0 px-3 sm:px-4 py-2 sm:py-2.5 items-center border-l-2 ${statusBorderColors[wo.status] || 'border-l-transparent'}`}>
                    <div className="text-[11px] sm:text-xs font-bold text-gray-500">#{wo.id}</div>
                    <div className="text-xs sm:text-sm font-bold text-white truncate">{wo.customer}</div>
                    <div className="text-[11px] sm:text-xs text-gray-300 truncate">{wo.job_details}</div>
                    <div className="text-[10px] sm:text-[11px] text-gray-500 truncate hidden sm:block">{(wo.assigned_departments || []).slice(0, 2).join(', ').replace(/_/g, ' ')}</div>
                    <div className="text-[11px] sm:text-xs font-semibold text-gray-400">{wo.qty}</div>
                    <div><span className={`inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold ${statusBadgeColors[wo.status] || 'bg-gray-500/20 text-gray-400'}`}>{wo.status}</span></div>
                    <div className={`text-[10px] sm:text-xs font-mono font-bold hidden sm:block ${isAging(wo.created_at) && wo.status !== 'Delivered' && wo.status !== 'Cancelled' ? 'text-orange-400' : 'text-gray-500'}`}>{getAge(wo.created_at)}</div>
                    <div className="text-[10px] sm:text-xs text-gray-500 truncate hidden md:block">&mdash;</div>
                    <div className="hidden md:block"><span className="inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold bg-blue-600/20 text-blue-400">Open</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col mx-2 sm:mx-4 mb-3 overflow-hidden rounded-lg sm:rounded-xl border border-slate-800/60 bg-[#0b1220]/80">
          <div className="overflow-x-auto scrollbar-thin">
            <div className="min-w-[600px]">
              <div className="table-header grid grid-cols-[55px_1fr_1fr_85px_110px_105px_85px_65px] gap-0 px-3 sm:px-4 py-2 text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <div>ID</div><div>Title</div><div className="hidden sm:block">Desc</div><div>Priority</div><div>Status</div><div>Assignee</div><div className="hidden sm:block">Due</div><div className="hidden md:block">Action</div>
              </div>
              <div ref={tableRef} className="overflow-y-auto scrollbar-thin" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                {filteredTasks.map(task => (
                  <div key={task.id} className={`row grid grid-cols-[55px_1fr_1fr_85px_110px_105px_85px_65px] gap-0 px-3 sm:px-4 py-2 sm:py-2.5 items-center border-l-2 ${priorityBorder[task.priority] || 'border-l-transparent'}`}>
                    <div className="text-[11px] sm:text-xs font-bold text-gray-500">#{task.id}</div>
                    <div className="text-xs sm:text-sm font-bold text-white truncate">{task.title}</div>
                    <div className="text-[11px] sm:text-xs text-gray-400 truncate hidden sm:block">{task.description || '—'}</div>
                    <div><span className={`inline-block px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold ${priorityBg(task.priority)}`}>{priorityLabels[task.priority] || task.priority}</span></div>
                    <div><span className={`inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold ${taskStatusBg(task.status)}`}>{statusLabels[task.status] || task.status}</span></div>
                    <div className="text-[11px] sm:text-xs text-gray-400 truncate">{task.assignee}</div>
                    <div className="text-[11px] sm:text-xs text-gray-500 hidden sm:block">{task.due_date || '—'}</div>
                    <div className="hidden md:block"><span className="inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-[10px] font-bold bg-blue-600/20 text-blue-400">Open</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="shrink-0 flex items-center justify-between px-4 pb-2 text-[10px] text-gray-600 font-semibold">
        <span>{liveScreenUser ? `Live: ${liveScreenUser.username}` : loggedInUser ? `ERP: ${loggedInUser.username}` : 'Live Screen'}</span>
        <span>{mode === 'orders' ? `${orders.length} total orders` : `${tasks.length} total tasks`}</span>
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

export default LiveScreen;

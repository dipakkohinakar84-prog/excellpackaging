import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './pocketbase';
import { WorkOrder, DailyTask } from './types';
import { Monitor, RefreshCw, ListTodo, ClipboardList, Maximize2, Minimize2, Pause, Play, ArrowLeft } from 'lucide-react';

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

const LiveScreen: React.FC<Props> = ({ loggedInUser, liveScreenUser, onBack }) => {
  const [mode, setMode] = useState<'orders' | 'tasks'>('orders');
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const items = mode === 'orders' ? orders : tasks;
  const current = items[index] || null;

  const fetchData = useCallback(async () => {
    const [woRes, taskRes] = await Promise.all([
      supabase.from('work_orders').select('*').limit(50),
      supabase.from('daily_tasks').select('*').limit(50),
    ]);
    if (!woRes.error && woRes.data) setOrders((woRes.data as WorkOrder[]).sort((a, b) => (b.id > a.id ? 1 : -1)));
    if (!taskRes.error && taskRes.data) setTasks((taskRes.data as DailyTask[]).sort((a, b) => (b.id > a.id ? 1 : -1)));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const iv = setInterval(() => { if (playing) fetchData(); }, 30000);
    return () => clearInterval(iv);
  }, [playing, fetchData]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (playing && items.length > 0) {
      intervalRef.current = setInterval(() => {
        setIndex(prev => (prev + 1) % items.length);
      }, 6000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, items.length, mode]);

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

  const renderOrder = (wo: WorkOrder) => (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12 text-center">
      <div className="text-5xl font-black text-white/90 mb-4">ORDER #{wo.id}</div>
      <div className="text-2xl font-bold text-white/80 mb-6 max-w-3xl leading-snug">{wo.job_details}</div>
      <div className="flex items-center gap-4 mb-8">
        <span className="text-lg font-semibold text-gray-400">{wo.customer}</span>
        <span className="text-gray-600">|</span>
        <span className="text-lg font-semibold text-gray-400">Qty: {wo.qty}</span>
      </div>
      <div className={`px-6 py-2 rounded-full text-lg font-black ${statusBg[wo.status] || 'bg-gray-600'} text-white`}>{wo.status}</div>
      {(wo.assigned_departments || []).length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {(wo.assigned_departments || []).map(dept => {
            const ds = (wo.department_statuses || []).find(s => s.department === dept);
            return (
              <div key={dept} className="px-4 py-1.5 rounded-lg bg-white/10 text-white/80 text-sm font-semibold">
                {dept.replace(/_/g, ' ')}
                {ds && <span className="ml-2 text-white/50">- {ds.status}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderTask = (task: DailyTask) => (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12 text-center">
      <div className="text-4xl font-black text-white/90 mb-4">{task.title}</div>
      {task.description && <div className="text-xl text-white/70 mb-6 max-w-3xl">{task.description}</div>}
      <div className="flex items-center gap-4 mb-6 text-lg">
        <span className="text-gray-400">Assigned: {task.assignee}</span>
        {task.due_date && <><span className="text-gray-600">|</span><span className="text-gray-400">Due: {task.due_date}</span></>}
      </div>
      <div className="flex gap-3">
        <span className={`px-5 py-1.5 rounded-full text-base font-black ${priorityBg(task.priority)} text-white`}>{task.priority}</span>
        <span className={`px-5 py-1.5 rounded-full text-base font-black ${taskStatusBg(task.status)} text-white`}>{task.status}</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
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
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => { setMode('orders'); setIndex(0); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'orders' ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}>
            <ClipboardList size={14} className="inline mr-1"/> Orders
          </button>
          <button onClick={() => { setMode('tasks'); setIndex(0); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'tasks' ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}>
            <ListTodo size={14} className="inline mr-1"/> Tasks
          </button>
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

      <div className="flex-1 flex items-center justify-center">
        {items.length === 0 ? (
          <div className="text-gray-400 text-xl font-semibold">No {mode === 'orders' ? 'orders' : 'tasks'} to display.</div>
        ) : mode === 'orders' && current ? (
          renderOrder(current as WorkOrder)
        ) : mode === 'tasks' && current ? (
          renderTask(current as DailyTask)
        ) : null}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
        {items.slice(0, Math.min(items.length, 20)).map((_, i) => (
          <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === index ? 'bg-blue-400 scale-125' : 'bg-white/20'}`} />
        ))}
      </div>

      <div className="absolute bottom-4 right-4 text-[10px] text-gray-600 font-semibold">
        {liveScreenUser ? `Live: ${liveScreenUser.username}` : loggedInUser ? `ERP: ${loggedInUser.username}` : 'Live Screen'}
      </div>
    </div>
  );
};

function priorityBg(p: string) {
  switch (p) {
    case 'Low': return 'bg-gray-500';
    case 'Medium': return 'bg-blue-500';
    case 'High': return 'bg-orange-500';
    case 'Urgent': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}

function taskStatusBg(s: string) {
  switch (s) {
    case 'Pending': return 'bg-yellow-500';
    case 'In Progress': return 'bg-blue-500';
    case 'Completed': return 'bg-green-500';
    case 'Cancelled': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}

export default LiveScreen;

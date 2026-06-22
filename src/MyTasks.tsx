import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './pocketbase';
import { DailyTask, User } from './types';
import { Calendar, User as UserIcon, CheckCircle2, Circle, ClipboardList, Search } from 'lucide-react';

interface Props {
  loggedInUser: User;
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
};

const priorityLabels: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const MyTasks: React.FC<Props> = ({ loggedInUser }) => {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('daily_tasks')
      .select('*')
      .eq('assignee', loggedInUser.username)
      .limit(200);
    if (!error && data) {
      setTasks((data as DailyTask[]).sort((a, b) => (b.id > a.id ? 1 : -1)));
    }
    setLoading(false);
  }, [loggedInUser.username]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const toggleComplete = async (task: DailyTask) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await supabase.from('daily_tasks').update({ status: newStatus }).eq('id', task.id);
    fetchTasks();
  };

  const matchesSearch = (t: DailyTask) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
  };

  const matchesDate = (t: DailyTask) => {
    return filterByDate(t.due_date || null, dateFilter, customFrom, customTo);
  };

  const visibleTasks = (showCompleted
    ? tasks.filter(t => t.status === 'completed')
    : tasks.filter(t => t.status !== 'completed')
  ).filter(matchesSearch).filter(matchesDate);

  const pendingCount = tasks.filter(t => t.status !== 'completed').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search my tasks..." className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button onClick={() => setShowCompleted(false)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!showCompleted ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Active ({pendingCount})</button>
          <button onClick={() => setShowCompleted(true)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showCompleted ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Completed ({completedCount})</button>
        </div>
        <select value={dateFilter} onChange={e => { setDateFilter(e.target.value); if (e.target.value !== 'custom') { setCustomFrom(''); setCustomTo(''); } }} className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Dates</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="custom">Custom</option>
        </select>
        {dateFilter === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-white" />
            <span className="text-gray-500 text-xs">to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-white" />
          </>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm font-bold text-gray-500">Loading...</div>
      ) : visibleTasks.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="mb-3 flex justify-center">
            {showCompleted ? (
              <ClipboardList size={40} className="text-gray-300" />
            ) : (
              <CheckCircle2 size={40} className="text-gray-300" />
            )}
          </div>
          <p className="text-sm font-semibold">
            {showCompleted ? 'No completed tasks yet.' : 'No pending tasks! All caught up.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleTasks.map(task => {
            const isComplete = task.status === 'completed';
            return (
              <div
                key={task.id}
                className={`bg-white border rounded-xl p-3.5 shadow-sm transition-all ${
                  isComplete ? 'border-gray-100 opacity-70' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleComplete(task)}
                    className="mt-0.5 shrink-0 text-gray-500 hover:text-indigo-600 transition-colors"
                  >
                    {isComplete ? (
                      <CheckCircle2 size={20} className="text-green-500" />
                    ) : (
                      <Circle size={20} />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`font-bold text-sm ${
                        isComplete ? 'text-gray-500 line-through' : 'text-gray-800'
                      }`}
                    >
                      {task.title}
                    </h3>
                    {task.description && (
                      <p
                        className={`text-xs font-semibold mt-0.5 ${
                          isComplete ? 'text-gray-300' : 'text-gray-500'
                        }`}
                      >
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          priorityColors[task.priority] || priorityColors.medium
                        }`}
                      >
                        {priorityLabels[task.priority] || task.priority}
                      </span>
                      {task.due_date && (
                        <span
                          className={`flex items-center gap-1 text-[10px] font-semibold ${
                            isComplete ? 'text-gray-300' : 'text-gray-500'
                          }`}
                        >
                          <Calendar size={10} /> {task.due_date}
                        </span>
                      )}
                      <span
                        className={`flex items-center gap-1 text-[10px] font-semibold ${
                          isComplete ? 'text-gray-300' : 'text-gray-500'
                        }`}
                      >
                        <UserIcon size={10} /> by {task.created_by}
                      </span>
                      {isComplete && (
                        <span className="text-[10px] font-bold text-green-600">Completed</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyTasks;

function filterByDate(dateStr: string | null, filter: string, customFrom: string, customTo: string): boolean {
  if (filter === 'all' || !dateStr) return true;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const normalize = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  if (filter === 'today') return normalize(d).getTime() === today.getTime();
  if (filter === 'week') {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return normalize(d) >= startOfWeek && normalize(d) <= endOfWeek;
  }
  if (filter === 'month') return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  if (filter === 'custom' && customFrom && customTo) {
    const from = normalize(new Date(customFrom));
    const to = normalize(new Date(customTo));
    return normalize(d) >= from && normalize(d) <= to;
  }
  return true;
}

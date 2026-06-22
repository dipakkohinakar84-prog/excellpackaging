import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './pocketbase';
import { DailyTask, User } from './types';
import { Plus, Trash2, Edit3, Calendar, User as UserIcon, AlertCircle, Search } from 'lucide-react';

interface Props {
  loggedInUser: User;
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'in progress': 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

const tabColors: Record<string, string> = {
  All: 'bg-slate-900 text-white',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'in progress': 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

const changeBtnColors: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 border-yellow-200',
  'in progress': 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200',
  completed: 'bg-green-50 text-green-600 hover:bg-green-100 border-green-200',
  cancelled: 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200',
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

const allStatuses = ['pending', 'in progress', 'completed', 'cancelled'];

const DailyTasks: React.FC<Props> = ({ loggedInUser }) => {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<DailyTask | null>(null);
  const [form, setForm] = useState({ title: '', description: '', assignee: '', due_date: '', priority: 'medium' });
  const [formError, setFormError] = useState('');
  const [filter, setFilter] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const normUserDept = normalizeDepartment(loggedInUser.department);
  const isOffice = normUserDept === 'Office';

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('daily_tasks').select('*').limit(200);
    if (!error && data) setTasks((data as DailyTask[]).sort((a, b) => (b.id > a.id ? 1 : -1)));
    setLoading(false);
  }, []);

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase.from('users').select('*');
    if (data) setUsers(data as User[]);
  }, []);

  useEffect(() => { fetchTasks(); fetchUsers(); }, [fetchTasks, fetchUsers]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.assignee.trim()) {
      setFormError('Title and Assignee are required.');
      return;
    }
    setFormError('');
    let res;
    if (editingTask) {
      res = await supabase.from('daily_tasks').update({ ...form }).eq('id', editingTask.id);
    } else {
      res = await supabase.from('daily_tasks').insert({ ...form, status: 'pending', created_by: loggedInUser.username });
    }
    if (res.error) { setFormError(res.error.message); return; }
    if (!editingTask) {
      // Clear assignee and due_date after creation for convenience
      setForm({ title: '', description: '', assignee: '', due_date: '', priority: 'medium' });
    }
    setShowForm(false);
    setEditingTask(null);
    fetchTasks();
  };

  const handleEdit = (task: DailyTask) => {
    setForm({ title: task.title, description: task.description || '', assignee: task.assignee, due_date: task.due_date || '', priority: task.priority });
    setEditingTask(task);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this task?')) return;
    await supabase.from('daily_tasks').delete().eq('id', id);
    fetchTasks();
  };

  const handleStatusChange = async (id: number, status: string) => {
    await supabase.from('daily_tasks').update({ status }).eq('id', id);
    fetchTasks();
  };

  const matchesSearch = (t: DailyTask) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q) || t.assignee.toLowerCase().includes(q);
  };

  const matchesDate = (t: DailyTask) => {
    return filterByDate(t.due_date || null, dateFilter, customFrom, customTo);
  };

  const filtered = (filter === 'All' ? tasks : tasks.filter(t => t.status === filter)).filter(matchesSearch).filter(matchesDate);
  const visibleTasks = isOffice ? filtered : filtered.filter(t => t.assignee === loggedInUser.username);

  const groupedUsers = users.reduce<Record<string, User[]>>((acc, u) => {
    const dept = normalizeDepartment(u.department) || 'Other';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(u);
    return acc;
  }, {});
  const sortedGroups = Object.entries(groupedUsers).sort(([a], [b]) => a.localeCompare(b));

  const statuses = ['All', ...allStatuses];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search tasks..." className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {statuses.map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filter === s ? tabColors[s] : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}>{statusLabels[s] || s}</button>
        ))}
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
        {isOffice && (
          <button onClick={() => { setEditingTask(null); setForm({ title: '', description: '', assignee: '', due_date: '', priority: 'medium' }); setShowForm(true); }} className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 flex items-center gap-2">
            <Plus size={14}/> ADD TASK
          </button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full space-y-4">
            <h2 className="font-black text-gray-800 text-lg">{editingTask ? 'Edit Task' : 'New Task'}</h2>
            {formError && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-semibold">{formError}</div>}
            <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Task title *" className="w-full px-3 py-2.5 border rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Description" rows={5} className="w-full px-3 py-2.5 border rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
            <div className="grid grid-cols-2 gap-2">
              <select value={form.assignee} onChange={e => setForm({...form, assignee: e.target.value})} className="w-full px-3 py-2.5 border rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select user...</option>
                {sortedGroups.map(([dept, deptUsers]) => (
                  <optgroup key={dept} label={dept.replace(/_/g, ' ')}>
                    {deptUsers.map(u => (
                      <option key={u.id} value={u.username}>{u.username}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="w-full px-3 py-2.5 border rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className="w-full px-3 py-2.5 border rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500">
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowForm(false); setEditingTask(null); }} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700">{editingTask ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-sm font-bold text-gray-500">Loading...</div>
      ) : visibleTasks.length === 0 ? (
        <div className="text-center py-10 text-sm font-bold text-gray-500">{isOffice ? 'No tasks found.' : 'No tasks assigned to you.'}</div>
      ) : (
        <div className="grid gap-2.5">
          {visibleTasks.map(task => (
            <div key={task.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-gray-800 text-sm">{task.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${priorityColors[task.priority] || priorityColors.medium}`}>{priorityLabels[task.priority] || task.priority}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${statusColors[task.status] || statusColors.pending}`}>{statusLabels[task.status] || task.status}</span>
                  </div>
                  {task.description && <p className="text-xs text-gray-500 font-semibold mb-2 line-clamp-2">{task.description}</p>}
                  <div className="flex items-center gap-3 text-[10px] text-gray-500 font-semibold">
                    <span className="flex items-center gap-1"><UserIcon size={12}/> {task.assignee}</span>
                    {task.due_date && <span className="flex items-center gap-1"><Calendar size={12}/> {task.due_date}</span>}
                    <span>by {task.created_by}</span>
                  </div>
                </div>
                {isOffice && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleEdit(task)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"><Edit3 size={14}/></button>
                    <button onClick={() => handleDelete(task.id)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={14}/></button>
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 mt-3 pt-3 border-t border-gray-100">
                {allStatuses.filter(s => s !== task.status).map(s => (
                  <button key={s} onClick={() => handleStatusChange(task.id, s)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${changeBtnColors[s]}`}>{statusLabels[s]}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function normalizeDepartment(d: string) {
  return d?.replace(/\s+/g, '_').trim() || '';
}

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

export default DailyTasks;

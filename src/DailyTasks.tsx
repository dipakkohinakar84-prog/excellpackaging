import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './pocketbase';
import { DailyTask, User } from './types';
import { Plus, Trash2, Edit3, Calendar, User as UserIcon, AlertCircle } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<DailyTask | null>(null);
  const [form, setForm] = useState({ title: '', description: '', assignee: '', due_date: '', priority: 'medium' });
  const [formError, setFormError] = useState('');
  const [filter, setFilter] = useState('All');

  const normUserDept = normalizeDepartment(loggedInUser.department);
  const isOffice = normUserDept === 'Office';

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('daily_tasks').select('*').limit(200);
    if (!error && data) setTasks((data as DailyTask[]).sort((a, b) => (b.id > a.id ? 1 : -1)));
    setLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

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

  const filtered = filter === 'All' ? tasks : tasks.filter(t => t.status === filter);

  const statuses = ['All', ...allStatuses];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-gray-800">Daily Tasks</h1>
        {isOffice && (
          <button onClick={() => { setEditingTask(null); setForm({ title: '', description: '', assignee: '', due_date: '', priority: 'medium' }); setShowForm(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all flex items-center gap-2">
            <Plus size={16}/> ADD TASK
          </button>
        )}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {statuses.map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filter === s ? tabColors[s] : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}>{statusLabels[s] || s}</button>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full space-y-4">
            <h2 className="font-black text-gray-800 text-lg">{editingTask ? 'Edit Task' : 'New Task'}</h2>
            {formError && <div className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-semibold">{formError}</div>}
            <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Task title *" className="w-full px-3 py-2.5 border rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Description" rows={5} className="w-full px-3 py-2.5 border rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
            <div className="grid grid-cols-2 gap-2">
              <input value={form.assignee} onChange={e => setForm({...form, assignee: e.target.value})} placeholder="Assign to" className="w-full px-3 py-2.5 border rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
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
        <div className="text-center py-10 text-sm font-semibold text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-sm font-semibold text-gray-400">No tasks found.</div>
      ) : (
        <div className="grid gap-2.5">
          {filtered.map(task => (
            <div key={task.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-gray-800 text-sm">{task.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${priorityColors[task.priority] || priorityColors.medium}`}>{priorityLabels[task.priority] || task.priority}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${statusColors[task.status] || statusColors.pending}`}>{statusLabels[task.status] || task.status}</span>
                  </div>
                  {task.description && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>}
                  <div className="flex items-center gap-3 text-[10px] text-gray-400 font-semibold">
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

export default DailyTasks;

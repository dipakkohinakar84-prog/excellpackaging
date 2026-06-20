import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './pocketbase';
import { DailyTask, User } from './types';
import { Calendar, User as UserIcon, CheckCircle2, Circle, ClipboardList } from 'lucide-react';

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

  const visibleTasks = showCompleted
    ? tasks.filter(t => t.status === 'completed')
    : tasks.filter(t => t.status !== 'completed');

  const pendingCount = tasks.filter(t => t.status !== 'completed').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-gray-800">My Tasks</h1>

      {/* Toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setShowCompleted(false)}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            !showCompleted ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Active ({pendingCount})
        </button>
        <button
          onClick={() => setShowCompleted(true)}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            showCompleted ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Completed ({completedCount})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm font-semibold text-gray-400">Loading...</div>
      ) : visibleTasks.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
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
                    className="mt-0.5 shrink-0 text-gray-400 hover:text-indigo-600 transition-colors"
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
                        isComplete ? 'text-gray-400 line-through' : 'text-gray-800'
                      }`}
                    >
                      {task.title}
                    </h3>
                    {task.description && (
                      <p
                        className={`text-xs mt-0.5 ${
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
                            isComplete ? 'text-gray-300' : 'text-gray-400'
                          }`}
                        >
                          <Calendar size={10} /> {task.due_date}
                        </span>
                      )}
                      <span
                        className={`flex items-center gap-1 text-[10px] font-semibold ${
                          isComplete ? 'text-gray-300' : 'text-gray-400'
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

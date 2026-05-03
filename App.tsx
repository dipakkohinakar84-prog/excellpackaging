import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Users, 
  Building2, 
  UserCircle, 
  Package, 
  Settings, 
  ClipboardList, 
  Clock, 
  Menu, 
  X, 
  Search, 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  AlertCircle,
  ChevronLeft,
  LayoutDashboard,
  Info,
  Save,
  Briefcase,
  MapPin,
  Phone,
  Mail,
  Tag,
  Layers,
  Component as ComponentIcon,
  Loader2,
  Printer,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  RefreshCw,
  UserPlus,
  Check,
  AlertTriangle,
  Terminal,
  Copy,
  ExternalLink,
  LogIn,
  LogOut,
  ChevronRight,
  ListPlus,
  Database,
  Hash,
  FileText,
  GanttChartSquare,
  Calculator,
  Image as ImageIcon,
  Hammer
} from 'lucide-react';
import { AppView, User, Customer, Item, WorkOrder, Department, WOStatus, ChildItem } from './types';
import { supabase } from './supabase';
import { canAccessView, filterWorkOrdersByDepartment, sendNotification, requestNotificationPermission, normalizeDepartment } from './utils';
import DepartmentStatusTracker from './DepartmentStatusTracker';

// --- Global UI Components ---

const Badge: React.FC<{ children: React.ReactNode; color?: string; className?: string }> = ({ children, color = 'blue', className = "" }) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    gray: 'bg-gray-100 text-gray-700',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${colors[color] || colors.blue} ${className}`}>{children}</span>;
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'Ready for despatch': return <Badge color="green">{status}</Badge>;
    case 'Work Started': return <Badge color="blue">{status}</Badge>;
    case 'Ready for QC': return <Badge color="purple">{status}</Badge>;
    case 'QC Approved': return <Badge color="green">{status}</Badge>;
    case 'Not Started': return <Badge color="gray">{status}</Badge>;
    case 'Cancelled': return <Badge color="red">{status}</Badge>;
    default: return <Badge color="gray">{status}</Badge>;
  }
};

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 ${className}`}>{children}</div>
);

const LoadingState: React.FC<{ message?: string }> = ({ message = "Syncing with cloud..." }) => (
  <div className="flex flex-col items-center justify-center py-20 text-gray-400 animate-in fade-in duration-500">
    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
    <p className="font-medium">{message}</p>
  </div>
);

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 max-h-[85vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Helper Functions ---

/**
 * Robustly parses assigned_departments from DB.
 * Handles: Postgres array strings '{A,B}', JSON arrays '["A","B"]', double encoded JSON strings, and comma-separated strings.
 */
const parseAssignedDepartments = (val: any): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  
  let str = String(val).trim();
  
  // Handle Postgres Array Syntax {A,B}
  if (str.startsWith('{') && str.endsWith('}')) {
    return str.slice(1, -1).split(',').map(s => s.trim().replace(/^"|"$/g, ''));
  }

  // Handle JSON
  if (str.startsWith('[') || str.startsWith('"')) {
    try {
      let parsed = JSON.parse(str);
      
      // Handle double encoded string like "\"[\"Dept\"]\""
      if (typeof parsed === 'string') {
         try {
            const secondParse = JSON.parse(parsed);
            if (Array.isArray(secondParse)) return secondParse.map(String);
         } catch(e) {
            // It was just a regular string inside quotes
            return [parsed];
         }
         return [parsed];
      }
      
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch (e) {
      // JSON parse failed, proceed to comma check
    }
  }
  
  // Fallback: comma separated string
  if (str.includes(',')) {
    return str.split(',').map(s => s.trim());
  }
  
  // Single value
  return [str];
};

// --- Login View ---

const Login: React.FC<{ onLogin: (user: User) => void }> = ({ onLogin }) => {
  const [mobile, setMobile] = useState('');
  const [passkey, setPasskey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: sbError } = await supabase
        .from('users')
        .select('*')
        .eq('mobile', mobile)
        .eq('passkey', passkey)
        .single();

      if (sbError) {
        if (sbError.code === 'PGRST116') {
          setError('Invalid mobile number or passkey.');
        } else {
          setError(sbError.message);
        }
      } else if (data) {
        onLogin(data);
      }
    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>
      
      <div className="max-w-md w-full relative">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/20">
            <Package size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-2">EXCELL PACKAGING</h1>
          <p className="text-slate-400 font-medium">Enterprise Resource Planning</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={18} />
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Registered Mobile</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  required
                  type="text"
                  placeholder="98XXXXXXXX"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Access Passkey</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  required
                  type="password"
                  placeholder="••••••••"
                  value={passkey}
                  onChange={e => setPasskey(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-50 disabled:bg-blue-600/50 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-3 group"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  SIGN IN <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
          
          <div className="mt-8 text-center">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Authorized Access Only</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Database Setup View ---

const DatabaseSetup: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const repairSql = `-- 1. Create dedicated Child Items table
CREATE TABLE IF NOT EXISTS child_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_item_id BIGINT REFERENCES items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qty_per_master INTEGER DEFAULT 1,
  departments TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Add Drawing Image Support to Items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS drawing_image_url TEXT;

-- 3. Ensure 'departments' on items is an array
DO $$ 
BEGIN 
  IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'departments') = 'text' THEN
    ALTER TABLE items ALTER COLUMN departments TYPE TEXT[] USING array[departments];
  END IF;
END $$;

-- 4. Add 'assigned_departments' and 'department_statuses' to work_orders
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS assigned_departments TEXT[] DEFAULT '{}';
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS department_statuses JSONB DEFAULT '[]';

-- 5. Ensure 'assigned_departments' on work_orders is an array
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'assigned_departments') AND (SELECT data_type FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'assigned_departments') = 'text' THEN
    ALTER TABLE work_orders ALTER COLUMN assigned_departments TYPE TEXT[] USING array[assigned_departments];
  END IF;
END $$;
`;

  const copySql = () => {
    navigator.clipboard.writeText(repairSql);
    alert("SQL copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white overflow-y-auto">
      <div className="max-w-3xl w-full space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/20 mb-6">
            <Database size={40} />
          </div>
          <h1 className="text-4xl font-black tracking-tighter">Database Setup Required</h1>
          <p className="text-slate-400 text-lg">Initialize your Supabase tables to support drawings and new tracking features.</p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 bg-slate-950 flex justify-between items-center border-b border-white/5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Repair Script</span>
            <button onClick={copySql} className="flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">
              <Copy size={14} /> COPY SQL
            </button>
          </div>
          <pre className="p-6 text-xs font-mono text-green-400 overflow-x-auto leading-relaxed">
            {repairSql}
          </pre>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-white/5 rounded-xl text-sm">
            <Info className="text-blue-400 shrink-0" size={20} />
            <p className="text-slate-300">
              Paste the script above into your <b>Supabase SQL Editor</b> and click <b>Run</b>. 
            </p>
          </div>
          <button onClick={onRetry} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all flex items-center justify-center gap-3">
            REFRESH APP <RefreshCw size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Dashboard View ---

const Dashboard: React.FC<{ user: User; setView: (v: AppView) => void; onError: () => void }> = ({ user, setView, onError }) => {
  const [counts, setCounts] = useState({ users: 0, depts: 0, customers: 0, items: 0, wos: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [users, depts, customers, items, wos] = await Promise.all([
          supabase.from('users').select('*', { count: 'exact', head: true }),
          supabase.from('departments').select('*', { count: 'exact', head: true }),
          supabase.from('customers').select('*', { count: 'exact', head: true }),
          supabase.from('items').select('*', { count: 'exact', head: true }),
          supabase.from('work_orders').select('*', { count: 'exact', head: true }),
        ]);
        
        // Simple health check
        const { error: childError } = await supabase.from('child_items').select('id', { count: 'exact', head: true }).limit(1);

        if (users.error?.code === '42P01' || childError?.code === '42P01') { 
          onError(); 
          return; 
        }

        setCounts({
          users: users.count || 0,
          depts: depts.count || 0,
          customers: customers.count || 0,
          items: items.count || 0,
          wos: wos.count || 0,
        });
      } catch (err) {
        console.error("Dashboard count fetch failed", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCounts();
  }, [onError]);

  if (loading) return <LoadingState />;

  const stats = [
    { label: 'Users', count: counts.users, icon: Users, view: 'users' as AppView, color: 'blue' },
    { label: 'Departments', count: counts.depts, icon: Building2, view: 'departments' as AppView, color: 'purple' },
    { label: 'Customers', count: counts.customers, icon: UserCircle, view: 'customers' as AppView, color: 'green' },
    { label: 'Item Master', count: counts.items, icon: Package, view: 'items' as AppView, color: 'orange' },
    { label: 'Work Orders', count: counts.wos, icon: ClipboardList, view: 'work-orders' as AppView, color: 'indigo' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">Welcome, {user.username}</h1>
          <p className="text-gray-500 font-medium">{user.department} | {user.level.split('-')[1]}</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Live Cloud Sync</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <button
            key={stat.label}
            onClick={() => setView(stat.view)}
            className="group relative bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all text-left overflow-hidden"
          >
            <div className={`p-3 rounded-xl bg-${stat.color}-50 text-${stat.color}-600 mb-4 inline-block`}>
              <stat.icon size={24} />
            </div>
            <div className="flex justify-between items-end">
              <h3 className="text-gray-500 font-bold uppercase text-[10px] tracking-wider">{stat.label}</h3>
              <span className="text-3xl font-black text-gray-800">{stat.count}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// --- User Management ---

const UserList: React.FC<{ onError: () => void }> = ({ onError }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const initialFormData = { username: '', email: '', mobile: '', passkey: '', department: '', level: '3-Staff' };
  const [formData, setFormData] = useState(initialFormData);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: userData, error: userError } = await supabase.from('users').select('*').order('id', { ascending: false });
      const { data: deptData } = await supabase.from('departments').select('*').order('name');
      
      if (userError?.code === '42P01') { onError(); return; }
      if (userData) setUsers(userData);
      if (deptData) setDepartments(deptData);
    } catch (e) { onError(); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.department) { alert("Please select a department."); return; }
    setIsSubmitting(true);
    
    let result;
    if (editingUser) {
      result = await supabase.from('users').update(formData).eq('id', editingUser.id);
    } else {
      result = await supabase.from('users').insert([formData]);
    }

    const { error } = result;
    if (error) alert(error.message);
    else { 
      setIsModalOpen(false); 
      setFormData(initialFormData); 
      setEditingUser(null);
      fetchData(); 
    }
    setIsSubmitting(false);
  };

  const handleDeleteUser = async (id: number) => {
    if (confirm("Are you sure you want to delete this user?")) {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) {
        alert("Error deleting user: " + error.message);
      } else {
        fetchData();
      }
    }
  };

  if (loading && users.length === 0) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black">User Access Control</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-colors">
          <Plus size={18} /> Add User
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
        <input placeholder="Search users by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border rounded-xl outline-none" />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser ? "Edit User" : "New User"}>
        <form onSubmit={handleSaveUser} className="space-y-4">
          <input required placeholder="Name" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          <input required type="email" placeholder="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
             <input required placeholder="Mobile" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
             <input required type="password" placeholder="Passkey" value={formData.passkey} onChange={e => setFormData({...formData, passkey: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <select required value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl">
                <option value="">Dept</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
             </select>
             <select value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl">
                <option value="1-Manager">Manager</option>
                <option value="2-Supervisor">Supervisor</option>
                <option value="3-Staff">Staff</option>
                <option value="4-Quality">Quality Control</option>
             </select>
          </div>
          <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-xl font-black">{isSubmitting ? 'Saving...' : 'Save User'}</button>
        </form>
      </Modal>

      <Card className="p-0 overflow-hidden shadow-md">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
            <tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Contact</th><th className="px-6 py-4">Dept</th><th className="px-6 py-4">Actions</th></tr>
          </thead>
          <tbody className="divide-y">
            {users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-bold">{u.username}</td>
                <td className="px-6 py-4">{u.mobile}</td>
                <td className="px-6 py-4"><Badge color="purple">{u.department}</Badge></td>
                <td className="px-6 py-4">
                  <button onClick={() => { setEditingUser(u); setFormData(u); setIsModalOpen(true); }} className="text-blue-600 mr-2 hover:bg-blue-50 p-2 rounded-lg transition-colors inline-block"><Edit size={16} /></button>
                  <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors inline-block"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

// --- Department Management ---

const DepartmentList: React.FC<{ onError: () => void }> = ({ onError }) => {
  const [data, setData] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', incharge: '', supervisor: '', info: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.from('departments').select('*').order('name');
      if (error?.code === '42P01') { onError(); return; }
      if (res) setData(res);
    } catch (e) { onError(); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('departments').insert([formData]);
    if (error) alert(error.message);
    else { 
      setIsModalOpen(false); 
      setFormData({ name: '', incharge: '', supervisor: '', info: '' }); 
      fetchData(); 
    }
  };

  if (loading && data.length === 0) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black text-gray-800">Departments</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-purple-700 transition-colors">
          <Plus size={18} /> Add Dept
        </button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Department">
        <form onSubmit={handleSave} className="space-y-4">
          <input required placeholder="Department Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="In-charge" value={formData.incharge} onChange={e => setFormData({...formData, incharge: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
            <input placeholder="Supervisor" value={formData.supervisor} onChange={e => setFormData({...formData, supervisor: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          </div>
          <textarea placeholder="Description" value={formData.info} onChange={e => setFormData({...formData, info: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          <button type="submit" className="w-full py-4 bg-purple-600 text-white rounded-xl font-black shadow-lg">Register Department</button>
        </form>
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map(d => (
          <Card key={d.id} className="hover:border-purple-200 transition-all border-l-4 border-l-purple-500">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-black text-gray-800">{d.name}</h3>
              <button onClick={async () => { if(confirm("Delete?")) { await supabase.from('departments').delete().eq('id', d.id); fetchData(); } }} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
            </div>
            <div className="space-y-2 mt-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-bold text-[10px] uppercase tracking-wider">In-charge</span>
                <span className="font-bold text-gray-700">{d.incharge || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-bold text-[10px] uppercase tracking-wider">Supervisor</span>
                <span className="font-bold text-gray-700">{d.supervisor || 'N/A'}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// --- Customer Management ---

const CustomerManagement: React.FC<{ onError: () => void }> = ({ onError }) => {
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', proprietor: '', address: '', city: '', contact: '', email: '', gst: '', type: 'Direct', reference: '', remarks: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.from('customers').select('*').order('name');
      if (error?.code === '42P01') { onError(); return; }
      if (res) setData(res);
    } catch (e) { onError(); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('customers').insert([formData]);
    if (error) alert(error.message);
    else { 
      setIsModalOpen(false); 
      setFormData({ name: '', proprietor: '', address: '', city: '', contact: '', email: '', gst: '', type: 'Direct', reference: '', remarks: '' }); 
      fetchData(); 
    }
  };

  if (loading && data.length === 0) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black text-gray-800">Customers</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-green-700 transition-colors">
          <Plus size={18} /> Add Client
        </button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Customer">
        <form onSubmit={handleSave} className="space-y-4">
          <input required placeholder="Company Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Proprietor" value={formData.proprietor} onChange={e => setFormData({...formData, proprietor: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
            <input placeholder="Contact" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          </div>
          <input placeholder="GST Number" value={formData.gst} onChange={e => setFormData({...formData, gst: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          <textarea placeholder="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          <button type="submit" className="w-full py-4 bg-green-600 text-white rounded-xl font-black shadow-lg">Save Customer</button>
        </form>
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map(c => (
          <Card key={c.id} className="relative group hover:border-green-200 transition-all">
            <div className="flex justify-between items-start mb-4 pr-10">
              <div>
                <h3 className="text-lg font-black text-gray-800 leading-tight">{c.name}</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                   <MapPin size={10} /> {c.city || 'Location N/A'}
                </p>
              </div>
              <Badge color="green">{c.type}</Badge>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2"><Phone size={14} className="text-green-500" /> {c.contact || 'No phone'}</div>
              <div className="flex items-center gap-2"><Mail size={14} className="text-blue-500" /> {c.email || 'No email'}</div>
              <div className="flex items-center gap-2 font-mono text-[10px] bg-gray-100 px-2 py-1 rounded inline-flex mt-2">
                 <Tag size={12} /> GST: {c.gst || 'N/A'}
              </div>
            </div>
            <button onClick={async () => { if(confirm("Delete?")) { await supabase.from('customers').delete().eq('id', c.id); fetchData(); } }} className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-red-300 hover:text-red-500 transition-all bg-red-50 rounded-lg"><Trash2 size={16} /></button>
          </Card>
        ))}
      </div>
    </div>
  );
};

// --- Item Master ---

const ItemList: React.FC<{ onError: () => void }> = ({ onError }) => {
  const [data, setData] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChildModalOpen, setIsChildModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [itemChildren, setItemChildren] = useState<ChildItem[]>([]);
  
  const [formData, setFormData] = useState<{
    name: string, 
    customer_name: string, 
    drawing_no: string, 
    drawing_image_url: string,
    departments: string[]
  }>({ 
    name: '', customer_name: '', drawing_no: '', drawing_image_url: '', departments: [] 
  });

  const [childFormData, setChildFormData] = useState({ name: '', qty: 1, selectedDepts: [] as string[] });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: itemsRes, error: itemsErr } = await supabase.from('items').select('*').order('id', { ascending: false });
      const { data: custRes } = await supabase.from('customers').select('*').order('name');
      const { data: deptRes } = await supabase.from('departments').select('*').order('name');
      
      if (itemsErr?.code === '42P01') { onError(); return; }
      if (itemsRes) setData(itemsRes);
      if (custRes) setCustomers(custRes);
      if (deptRes) setDepartments(deptRes);
    } catch (e) { onError(); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const fetchChildren = async (parentId: number) => {
    const { data } = await supabase.from('child_items').select('*').eq('parent_item_id', parentId);
    if (data) setItemChildren(data.map(d => ({ 
        id: d.id, 
        name: d.name, 
        departments: d.departments, 
        qtyPerMaster: d.qty_per_master 
    })));
  };

  const handleDeptToggle = (name: string) => {
    setFormData(prev => ({
      ...prev,
      departments: prev.departments.includes(name) ? prev.departments.filter(d => d !== name) : [...prev.departments, name]
    }));
  };

  const handleChildDeptToggle = (name: string) => {
    setChildFormData(prev => ({
      ...prev,
      selectedDepts: prev.selectedDepts.includes(name) ? prev.selectedDepts.filter(d => d !== name) : [...prev.selectedDepts, name]
    }));
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    
    const { error } = await supabase.from('child_items').insert([{
      parent_item_id: selectedItem.id,
      name: childFormData.name,
      qty_per_master: childFormData.qty,
      departments: childFormData.selectedDepts
    }]);

    if (error) alert(error.message);
    else {
      setChildFormData({ name: '', qty: 1, selectedDepts: [] });
      fetchChildren(selectedItem.id);
    }
  };

  if (loading && data.length === 0) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black text-gray-800">Item Master</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:bg-orange-700 transition-colors"><Plus size={18} /></button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Item">
        <form onSubmit={async (e) => { 
          e.preventDefault(); 
          const { error } = await supabase.from('items').insert([formData]); 
          if(error) alert(error.message);
          else {
            setIsModalOpen(false); 
            setFormData({ name: '', customer_name: '', drawing_no: '', drawing_image_url: '', departments: [] });
            fetchData(); 
          }
        }} className="space-y-4">
           <select required value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl">
              <option value="">Select Client</option>
              {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
           </select>
           <input required placeholder="Item Name / Assembly" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input required placeholder="Drawing No." value={formData.drawing_no} onChange={e => setFormData({...formData, drawing_no: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
              <input placeholder="Drawing Image URL (Link)" value={formData.drawing_image_url} onChange={e => setFormData({...formData, drawing_image_url: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Process Routing (Depts)</label>
              <div className="flex flex-wrap gap-2">
                {departments.map(d => (
                  <button key={d.id} type="button" onClick={() => handleDeptToggle(d.name)} className={`px-2 py-1 text-[10px] font-black border rounded-lg transition-all ${formData.departments.includes(d.name) ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-50 text-gray-400'}`}>{d.name}</button>
                ))}
              </div>
           </div>
           <button type="submit" className="w-full py-4 bg-orange-600 text-white rounded-xl font-black shadow-lg">Register Item Master</button>
        </form>
      </Modal>

      <Modal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} title="Drawing Preview">
         {selectedItem?.drawing_image_url ? (
            <div className="flex flex-col items-center gap-4">
               <img src={selectedItem.drawing_image_url} alt="Drawing" className="max-w-full h-auto rounded-xl border shadow-xl" />
               <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{selectedItem.name} ({selectedItem.drawing_no})</p>
            </div>
         ) : (
            <div className="p-20 text-center text-gray-300 italic">No drawing image link provided.</div>
         )}
      </Modal>

      <Modal isOpen={isChildModalOpen} onClose={() => setIsChildModalOpen(false)} title="Sub-Components">
        <div className="space-y-6">
           <div className="space-y-2">
              {itemChildren.map(child => (
                <div key={child.id} className="p-3 bg-gray-50 rounded-xl flex justify-between items-center border">
                   <div>
                      <span className="font-bold">{child.name}</span>
                      <Badge color="orange" className="ml-2">Qty/Unit: {child.qtyPerMaster}</Badge>
                   </div>
                   <button onClick={async () => { await supabase.from('child_items').delete().eq('id', child.id); fetchChildren(selectedItem!.id); }} className="text-red-300 p-1 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>
                </div>
              ))}
           </div>
           <div className="p-4 bg-gray-50 rounded-2xl space-y-4 border border-indigo-100">
              <label className="text-[10px] font-black uppercase text-indigo-600">Quick Add Component</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                 <input className="md:col-span-2 px-4 py-3 rounded-xl border" placeholder="Name" value={childFormData.name} onChange={e => setChildFormData({...childFormData, name: e.target.value})} />
                 <input className="px-4 py-3 rounded-xl border font-black" type="number" value={childFormData.qty} onChange={e => setChildFormData({...childFormData, qty: parseInt(e.target.value) || 1})} />
              </div>
              <div className="flex flex-wrap gap-2">
                  {departments.map(d => (
                    <button key={d.id} type="button" onClick={() => handleChildDeptToggle(d.name)} className={`px-2 py-1 text-[8px] font-black border rounded-lg ${childFormData.selectedDepts.includes(d.name) ? 'bg-indigo-600 text-white' : 'bg-white'}`}>{d.name}</button>
                  ))}
              </div>
              <button onClick={handleAddChild} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black shadow-md hover:bg-indigo-700 transition-colors">Add Component</button>
           </div>
        </div>
      </Modal>

      <Card className="p-0 overflow-hidden shadow-md">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
            <tr>
              <th className="px-6 py-4">Item Name</th>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">Drawing No</th>
              <th className="px-6 py-4">Depts</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map(c => (
              <tr key={c.id} className="hover:bg-indigo-50/20 transition-colors">
                <td className="px-6 py-4 font-bold text-indigo-700">{c.name}</td>
                <td className="px-6 py-4">{c.customer_name}</td>
                <td className="px-6 py-4 font-mono text-xs">{c.drawing_no}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {c.departments?.map((d: string) => <Badge key={d} color="gray">{d}</Badge>)}
                  </div>
                </td>
                <td className="px-6 py-4 text-right flex gap-2 justify-end">
                   <button onClick={() => { setSelectedItem(c); fetchChildren(c.id); setIsChildModalOpen(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Manage Components"><Layers size={16}/></button>
                   {c.drawing_image_url && <button onClick={() => { setSelectedItem(c); setIsImageModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="View Drawing"><ImageIcon size={16}/></button>}
                   <button onClick={async () => { if(confirm("Delete Item?")) { await supabase.from('items').delete().eq('id', c.id); fetchData(); } }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

// --- Child Item List View ---

const ChildItemListView: React.FC<{ onError: () => void }> = ({ onError }) => {
  const [data, setData] = useState<any[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [masterSearch, setMasterSearch] = useState('');
  const [formData, setFormData] = useState({ name: '', qty: 1, selectedMasters: [] as number[], selectedDepts: [] as string[] });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase
        .from('child_items')
        .select(`
          id,
          name,
          qty_per_master,
          departments,
          parent_item_id,
          items (
            id,
            name,
            customer_name
          )
        `)
        .order('name');
      
      const { data: itemRes } = await supabase.from('items').select('*').order('name');
      const { data: deptRes } = await supabase.from('departments').select('*').order('name');
      
      if (error?.code === '42P01') { onError(); return; }
      if (res) setData(res);
      if (itemRes) setItems(itemRes);
      if (deptRes) setDepartments(deptRes);
    } catch (e) { onError(); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.selectedMasters.length === 0) { alert("Select at least one Master Item."); return; }
    
    for (const masterId of formData.selectedMasters) {
        await supabase.from('child_items').insert([{
            parent_item_id: masterId,
            name: formData.name,
            qty_per_master: formData.qty,
            departments: formData.selectedDepts
        }]);
    }
    
    setIsModalOpen(false);
    setFormData({ name: '', qty: 1, selectedMasters: [], selectedDepts: [] });
    setMasterSearch('');
    fetchData();
  };

  const filteredItems = useMemo(() => {
    return items.filter(m => 
      m.name.toLowerCase().includes(masterSearch.toLowerCase()) || 
      m.customer_name.toLowerCase().includes(masterSearch.toLowerCase())
    );
  }, [items, masterSearch]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-gray-800">Component Inventory</h2>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Global view of all sub-components</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-colors">
          <Plus size={18} /> New Global Part
        </button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Sub-Component Globally">
         <form onSubmit={handleAddGlobal} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input required className="md:col-span-2 px-4 py-4 rounded-2xl border bg-gray-50" placeholder="Part Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                <input required type="number" className="px-4 py-4 rounded-2xl border font-black bg-gray-50 text-center" value={formData.qty} onChange={e => setFormData({...formData, qty: parseInt(e.target.value) || 1})} />
            </div>
            
            <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Select Master Items ({formData.selectedMasters.length} selected)</label>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                        type="text" 
                        placeholder="Search master items..." 
                        value={masterSearch}
                        onChange={e => setMasterSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                <div className="max-h-40 overflow-y-auto border-2 rounded-2xl p-2 space-y-1">
                    {filteredItems.map(m => (
                        <button key={m.id} type="button" onClick={() => setFormData(p => ({...p, selectedMasters: p.selectedMasters.includes(m.id) ? p.selectedMasters.filter(x => x !== m.id) : [...p.selectedMasters, m.id]}))} className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all mt-1 ${formData.selectedMasters.includes(m.id) ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 border'}`}>
                            {m.name} ({m.customer_name})
                        </button>
                    ))}
                    {filteredItems.length === 0 && (
                        <div className="p-4 text-center text-xs text-gray-400 italic">No master items match your search.</div>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <label className="text-[10px] font-black uppercase text-gray-400 w-full ml-1">Responsible Departments</label>
                {departments.map(d => (
                    <button key={d.id} type="button" onClick={() => setFormData(p => ({...p, selectedDepts: p.selectedDepts.includes(d.name) ? p.selectedDepts.filter(x => x !== d.name) : [...p.selectedDepts, d.name]}))} className={`px-3 py-2 text-[10px] font-black border rounded-xl ${formData.selectedDepts.includes(d.name) ? 'bg-indigo-600 text-white' : 'bg-white'}`}>
                        {d.name}
                    </button>
                ))}
            </div>
            <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-colors">Generate Component Links</button>
         </form>
      </Modal>

      <Card className="p-0 overflow-hidden shadow-md">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
            <tr>
              <th className="px-6 py-4">Component Name</th>
              <th className="px-6 py-4">Parent Assembly</th>
              <th className="px-6 py-4 text-center">Qty/Unit</th>
              <th className="px-6 py-4">Depts</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map(c => (
              <tr key={c.id} className="hover:bg-indigo-50/20 transition-colors">
                <td className="px-6 py-4 font-bold text-indigo-700">{c.name}</td>
                <td className="px-6 py-4">
                  <div className="font-bold text-gray-800">{c.items?.name || 'Unknown Item'}</div>
                  <div className="text-[10px] text-gray-400 uppercase font-black tracking-tighter">{c.items?.customer_name}</div>
                </td>
                <td className="px-6 py-4 text-center font-black">{c.qty_per_master}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {c.departments?.map((d: string) => <Badge key={d} color="gray">{d}</Badge>)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

// --- Worker Dashboard ---

const WorkerDashboard: React.FC<{ onError: () => void; onView: (id: number) => void; loggedInUser: User }> = ({ onError, onView, loggedInUser }) => {
  const [data, setData] = useState<(WorkOrder & { itemInfo?: Item })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: woRes, error: woErr } = await supabase.from('work_orders').select('*').order('id', { ascending: false });
        const { data: itemRes } = await supabase.from('items').select('*').order('name');

        if (woErr?.code === '42P01') { onError(); return; }

        if (woRes && itemRes) {
          const enriched = woRes.map(wo => {
            const departments = parseAssignedDepartments(wo.assigned_departments);
            return {
              ...wo,
              itemInfo: itemRes.find(i => i.name === wo.job_details),
              assigned_departments: departments,
            };
          });

          // New Robust Filtering
          const filteredData = filterWorkOrdersByDepartment(enriched, loggedInUser);
          setData(filteredData);
        }
      } catch (e) { onError(); }
      setLoading(false);
    };
    fetchData();
  }, [loggedInUser]);

  const filteredOrders = useMemo(() => {
    if (!searchQuery) return data;
    const lowerCaseQuery = searchQuery.toLowerCase();
    return data.filter(wo =>
      wo.customer.toLowerCase().includes(lowerCaseQuery) ||
      wo.job_details.toLowerCase().includes(lowerCaseQuery)
    );
  }, [data, searchQuery]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="text-2xl font-black text-gray-800">{loggedInUser.department.replace(/_/g, ' ')} Dashboard</h1>
        <p className="text-gray-500 text-sm">Manage your department's active work orders.</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Search jobs..." 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)} 
          className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" 
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredOrders.map(wo => (
          <div 
            key={wo.id} 
            onClick={() => onView(wo.id)}
            className="group bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4 relative shadow-sm hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer"
          >
            <div className="flex justify-between items-start">
               <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-1 rounded-lg bg-gray-100 text-[10px] font-black text-gray-500">#{wo.id}</span>
                    <StatusBadge status={wo.status} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 leading-tight">{wo.job_details}</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{wo.customer}</p>
               </div>
               <div className="text-right">
                  <div className="text-xl font-black text-blue-600">{wo.qty} <span className="text-[10px] text-gray-400">PCS</span></div>
               </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
               <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                  <Clock size={14} className="text-orange-500"/> Due: {wo.etd || 'TBD'}
               </div>
               <ChevronRight size={20} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
            </div>
          </div>
        ))}
        {filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
             <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4"><CheckCircle2 size={32} className="text-gray-300"/></div>
             <p className="text-gray-400 font-medium">No pending work orders found for your department.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Work Order Management ---

const WorkOrderList: React.FC<{ onError: () => void; onView: (id: number) => void; loggedInUser: User }> = ({ onError, onView, loggedInUser }) => {
  const [data, setData] = useState<(WorkOrder & { itemInfo?: Item })[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]); 
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); 
  
  const [formData, setFormData] = useState({ 
    customer: '', 
    job_details: '', 
    qty: 1, 
    etd: '', 
    drawing: '', 
    status: 'Not Started' as WOStatus,
    assigned_departments: [] as string[] 
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: woRes, error: woErr } = await supabase.from('work_orders').select('*').order('id', { ascending: false });
      
      const { data: itemRes } = await supabase.from('items').select('*').order('name');
      const { data: custRes } = await supabase.from('customers').select('*').order('name');
      const { data: deptRes } = await supabase.from('departments').select('*').order('name'); 
      
      if (woErr?.code === '42P01') { onError(); return; }
      
      if (woRes && itemRes) {
        const enriched = woRes.map(wo => {
          const departments = parseAssignedDepartments(wo.assigned_departments);
          return {
            ...wo,
            itemInfo: itemRes.find(i => i.name === wo.job_details),
            assigned_departments: departments,
          };
        });

        // Use new Filtering Logic
        const filteredData = filterWorkOrdersByDepartment(enriched, loggedInUser);
        
        setData(filteredData);
        setItems(itemRes);
        if (custRes) setCustomers(custRes);
        if (deptRes) setDepartments(deptRes); 
      }
    } catch (e) { onError(); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [loggedInUser]); // Re-fetch data if user changes

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const initialStatuses = (formData.assigned_departments || []).map(dept => ({
          department: dept,
          status: 'Not Started',
          updated_at: new Date().toISOString(),
          updated_by: loggedInUser.username
      }));

      const woData = { ...formData, department_statuses: initialStatuses };

      const { error } = await supabase.from('work_orders').insert([woData]);
      
      if (error) {
        alert(error.message);
      } else { 
        if (formData.assigned_departments && formData.assigned_departments.length > 0) {
            sendNotification('New Work Order', `Work Order: ${formData.job_details}`, formData.assigned_departments);
        }
        setIsModalOpen(false); 
        setFormData({ 
          customer: '', job_details: '', qty: 1, etd: '', drawing: '', status: 'Not Started' as WOStatus, assigned_departments: [] 
        }); 
        fetchData(); 
      }
    } catch (err) {
      console.error(err);
    } finally {
        setLoading(false);
    }
  };

  const toggleDeptSelection = (deptName: string) => {
    setFormData(prev => ({
      ...prev,
      assigned_departments: prev.assigned_departments.includes(deptName)
        ? prev.assigned_departments.filter(d => d !== deptName)
        : [...prev.assigned_departments, deptName]
    }));
  };

  const filteredOrders = useMemo(() => {
    if (!searchQuery) return data;
    const lowerCaseQuery = searchQuery.toLowerCase();
    return data.filter(wo =>
      wo.customer.toLowerCase().includes(lowerCaseQuery) ||
      wo.job_details.toLowerCase().includes(lowerCaseQuery)
    );
  }, [data, searchQuery]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-black text-gray-800 tracking-tight">Work Orders</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 hover:scale-105 hover:bg-blue-500 transition-all">
          <Plus size={20} /> New Order
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Search by customer or job details..." 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)} 
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
        />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Work Order">
        <form onSubmit={handleSave} className="space-y-4">
           <div>
             <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block tracking-widest">Customer</label>
             <select required value={formData.customer} onChange={e => setFormData({...formData, customer: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all">
                <option value="">Select Customer</option>
                {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
             </select>
           </div>
           <div>
             <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block tracking-widest">Item Master</label>
             <select required value={formData.job_details} onChange={e => {
               const itm = items.find(i => i.name === e.target.value);
               setFormData({
                 ...formData, 
                 job_details: e.target.value, 
                 drawing: itm?.drawing_no || '', 
                 assigned_departments: itm?.departments || [] // Auto-fill departments from item
               });
             }} className="w-full px-4 py-3 bg-gray-50 border rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all">
                <option value="">Select Item Master</option>
                {items.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
             </select>
           </div>
           
           <div>
             <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Involved Departments</label>
             <div className="flex flex-wrap gap-2">
                {departments.map(d => (
                  <button 
                    key={d.id} 
                    type="button" 
                    onClick={() => toggleDeptSelection(d.name)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${formData.assigned_departments.includes(d.name) ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-400 border-gray-100 hover:border-blue-200'}`}
                  >
                    {d.name.replace(/_/g, ' ')}
                  </button>
                ))}
             </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block tracking-widest">Quantity</label>
               <input required type="number" placeholder="Qty" value={formData.qty} onChange={e => setFormData({...formData, qty: parseInt(e.target.value) || 1})} className="w-full px-4 py-3 bg-gray-50 border rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all" />
             </div>
             <div>
               <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block tracking-widest">Estimated Date</label>
               <input required type="date" value={formData.etd} onChange={e => setFormData({...formData, etd: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all" />
             </div>
           </div>
           <button type="submit" className="w-full py-4 mt-2 bg-blue-600 text-white rounded-2xl font-black shadow-lg uppercase tracking-widest text-xs transition-all hover:bg-blue-700 active:scale-95">SUBMIT ORDER</button>
        </form>
      </Modal>

      <Modal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} title="Drawing Preview">
         <div className="flex flex-col items-center">
            {selectedImageUrl ? (
               <img src={selectedImageUrl} alt="Drawing" className="max-w-full h-auto rounded-xl border shadow-xl" />
            ) : (
               <p className="text-gray-400 italic py-10">No image available.</p>
            )}
         </div>
      </Modal>

      <div className="grid grid-cols-1 gap-4">
        {filteredOrders.map(wo => ( // Use filteredOrders here
          <div 
            key={wo.id} 
            className="group bg-white rounded-3xl border border-gray-100 p-6 flex flex-col md:flex-row gap-6 relative shadow-sm hover:shadow-xl hover:border-blue-100 transition-all"
          >
            <div className="flex items-center justify-center">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xs font-black border border-blue-100 shrink-0">
                #{wo.id}
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <h3 className="text-xl font-black text-slate-800 leading-tight">{wo.job_details}</h3>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-tighter">{wo.customer}</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                 {(wo.assigned_departments || []).map(d => <Badge key={d} color="indigo" className="!text-[9px]">{d.replace(/_/g, ' ')}</Badge>)}
                 {(!wo.assigned_departments || wo.assigned_departments.length === 0) && <span className="text-[9px] text-gray-300 italic font-bold">No Departments Assigned</span>}
              </div>

              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DRW</span>
                    <span className="text-xs font-mono font-bold text-slate-600">{wo.drawing || wo.itemInfo?.drawing_no || 'TBD'}</span>
                 </div>
                 {wo.itemInfo?.drawing_image_url && (
                    <button 
                      onClick={() => { setSelectedImageUrl(wo.itemInfo!.drawing_image_url!); setIsImageModalOpen(true); }}
                      className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-sm ring-1 ring-slate-100 bg-blue-50 flex items-center justify-center text-blue-500 hover:scale-110 transition-transform"
                    >
                       <ImageIcon size={18} />
                    </button>
                 )}
              </div>

              <div className="flex gap-8 pt-2">
                 <div>
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block mb-0.5">QTY</span>
                    <span className="text-lg font-black text-slate-700">{wo.qty}</span>
                 </div>
                 <div>
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block mb-0.5">ETD</span>
                    <span className="text-sm font-black text-orange-600 flex items-center gap-1.5"><Clock size={12}/> {wo.etd || 'TBD'}</span>
                 </div>
              </div>
            </div>

            <div className="flex flex-col items-end justify-between py-1">
              <StatusBadge status={wo.status} />
              <button 
                onClick={() => onView(wo.id)} 
                className="p-3 bg-gray-50 rounded-2xl text-gray-300 group-hover:text-blue-500 group-hover:bg-blue-50 transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        ))}
        {filteredOrders.length === 0 && <div className="p-20 text-center text-gray-300 italic">No matching work orders found.</div>}
      </div>
    </div>
  );
};

// --- Work Order Details ---

const WODetails: React.FC<{ id: number; onBack: () => void; loggedInUser: User }> = ({ id, onBack, loggedInUser }) => {
  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWO = useCallback(async () => {
    const { data } = await supabase.from('work_orders').select('*').eq('id', id).single();
    if (data) {
      const departments = parseAssignedDepartments(data.assigned_departments);
      
      // Access Control
      const normUserDept = normalizeDepartment(loggedInUser.department);
      const isOfficeOrQuality = normUserDept === 'Office' || normUserDept === 'Quality_Control';
      const isAssigned = departments.some(d => normalizeDepartment(d) === normUserDept);

      if (isOfficeOrQuality || isAssigned) {
        setWo({ ...data, assigned_departments: departments });
      } else {
        console.warn(`[WODetails] Access denied for order ID: ${id}. User ${loggedInUser.department} is not authorized.`);
        setWo(null); 
      }
    }
    setLoading(false);
  }, [id, loggedInUser]);

  useEffect(() => {
    fetchWO();
  }, [fetchWO]);

  const updateStatus = async (newStatus: WOStatus) => {
    // Legacy support for manual overall status override
    const { error } = await supabase.from('work_orders').update({ status: newStatus }).eq('id', id);
    if (!error && wo) setWo({ ...wo, status: newStatus });
  };

  if (loading) return <LoadingState />;
  if (!wo) return <div className="p-20 text-center font-black text-red-500">Order not found or you do not have permission to view it.</div>;

  const normUserDept = normalizeDepartment(loggedInUser.department);
  const isOffice = normUserDept === 'Office';

  const allowedStatuses: WOStatus[] = ['Not Started', 'Work Started', 'Ready for QC', 'Ready for despatch', 'Cancelled'];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <button onClick={onBack} className="flex items-center gap-2 text-[10px] font-black text-gray-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">
        <ChevronLeft size={16}/> Back
      </button>
      
      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <Card className="p-8 border-t-8 border-t-indigo-600">
             <div className="flex justify-between items-start mb-8">
                <div>
                   <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-[10px] font-black tracking-widest border border-indigo-100">ORDER-#{wo.id}</span>
                   <h1 className="text-3xl font-black text-gray-800 mt-4 mb-2">{wo.job_details}</h1>
                   <p className="text-lg font-bold text-gray-400 uppercase tracking-tight">{wo.customer}</p>
                </div>
                <StatusBadge status={wo.status} />
             </div>
             
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 py-8 border-y border-gray-50">
                <div>
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Batch Size</label>
                   <p className="text-2xl font-black text-indigo-600">{wo.qty} <span className="text-xs text-gray-400 font-bold">PCS</span></p>
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1">Delivery ETD</label>
                   <p className="text-sm font-black text-orange-600 flex items-center gap-2"><Clock size={14}/> {wo.etd || 'N/A'}</p>
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1">Blueprint Ref</label>
                   <p className="text-sm font-mono font-bold bg-gray-50 px-2 py-1 rounded inline-block">{wo.drawing || 'NO DRAWING'}</p>
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1">QC/Ready Date</label>
                   <p className="text-sm font-black text-green-600">{wo.ready_date || 'IN PROGRESS'}</p>
                </div>
             </div>

             <div className="mt-8">
                <DepartmentStatusTracker
                  workOrderId={wo.id}
                  assignedDepartments={wo.assigned_departments || []}
                  departmentStatuses={wo.department_statuses || []}
                  loggedInUser={loggedInUser}
                  onStatusUpdate={async (department, status, qcStatus) => {
                    try {
                      const existingStatuses = wo.department_statuses || [];
                      const updatedStatuses = existingStatuses.map(ds => 
                        normalizeDepartment(ds.department) === normalizeDepartment(department)
                          ? { ...ds, status: status as any, qc_status: qcStatus as any, updated_at: new Date().toISOString(), updated_by: loggedInUser.username }
                          : ds
                      );
                      
                      // If not present, add it
                      if (!updatedStatuses.find(ds => normalizeDepartment(ds.department) === normalizeDepartment(department))) {
                        updatedStatuses.push({
                          department: department,
                          status: status as any,
                          qc_status: qcStatus as any,
                          updated_at: new Date().toISOString(),
                          updated_by: loggedInUser.username
                        });
                      }
                      
                      // Logic: If all assigned departments are 'QC Approved', main status becomes 'QC Approved'
                      // Note: We need to ensure we check *all* assigned departments.
                      const allDepartments = wo.assigned_departments || [];
                      const allApproved = allDepartments.length > 0 && allDepartments.every(dept => {
                          const ds = updatedStatuses.find(s => normalizeDepartment(s.department) === normalizeDepartment(dept));
                          return ds?.qc_status === 'QC Approved';
                      });

                      const newOverallStatus = allApproved ? 'QC Approved' : wo.status;
                      
                      await supabase.from('work_orders').update({ department_statuses: updatedStatuses, status: newOverallStatus }).eq('id', wo.id);
                      fetchWO();
                    } catch (err) {
                      console.error('Status update failed:', err);
                    }
                  }}
                />
             </div>
          </Card>

          {isOffice && (
            <Card className="p-8">
               <h3 className="font-black text-gray-800 text-sm uppercase tracking-widest mb-6 flex items-center gap-2">
                  <RefreshCw size={18} className="text-indigo-600"/> Force Update Status (Office Only)
               </h3>
               <div className="flex flex-wrap gap-3">
                  {allowedStatuses.map(s => (
                    <button 
                      key={s} 
                      onClick={() => updateStatus(s)}
                      className={`px-6 py-3 rounded-2xl text-xs font-black transition-all ${wo.status === s ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/30 ring-2 ring-indigo-300 ring-offset-2' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                    >
                      {s.toUpperCase()}
                    </button>
                  ))}
               </div>
            </Card>
          )}
        </div>

        <div className="w-full xl:w-80 space-y-6">
           <Card className="bg-slate-900 text-white p-8 border-0 shadow-2xl">
              <h3 className="font-black text-lg mb-6 flex items-center gap-3 text-blue-400">Controls</h3>
              <div className="space-y-3">
                 <button className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-3 border border-white/5">
                    <Printer size={18}/> PRINT JOB CARD
                 </button>
                 {isOffice && (
                   <button onClick={async () => { if(confirm("Delete Order?")) { await supabase.from('work_orders').delete().eq('id', id); onBack(); } }} className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-3 border border-red-500/20 mt-4">
                      <Trash2 size={18}/> DELETE ORDER
                   </button>
                 )}
              </div>
           </Card>
        </div>
      </div>
    </div>
  );
};

// --- Production Planning ---

const ProductionPlanList: React.FC<{ onError: () => void; onGenerate: (id: number) => void; loggedInUser: User }> = ({ onError, onGenerate, loggedInUser }) => {
  const [data, setData] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch ALL orders first to perform robust client-side filtering
        const { data: woRes } = await supabase.from('work_orders').select('*').order('id', { ascending: false });

        if (woRes) {
             const normUserDept = normalizeDepartment(loggedInUser.department);
             const isOfficeOrQuality = normUserDept === 'Office' || normUserDept === 'Quality_Control';
             
             const accessibleOrders = woRes.filter(wo => {
                if (isOfficeOrQuality) return true;
                const departments = parseAssignedDepartments(wo.assigned_departments);
                // Check if user's normalized department is in the order's normalized department list
                return departments.some(d => normalizeDepartment(d) === normUserDept);
             });
             
             setData(accessibleOrders);
        }
      } catch (e) { onError(); }
      setLoading(false);
    };
    fetchData();
  }, [loggedInUser]); // Re-fetch data if user changes

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Production Planning</h2>
          <p className="text-gray-500 font-medium">Select an order to generate material requirements and job card.</p>
        </div>
      </div>

      <Card className="p-0 overflow-hidden shadow-lg border-2 border-indigo-50">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#0f172a] text-white text-[10px] font-black uppercase tracking-widest">
            <tr><th className="px-6 py-5">Order ID</th><th className="px-6 py-5">Client</th><th className="px-6 py-5">Target Item</th><th className="px-6 py-5 text-right">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map(wo => (
              <tr key={wo.id} className="hover:bg-indigo-50/30 group transition-all">
                <td className="px-6 py-4 font-black text-indigo-600">#{wo.id}</td>
                <td className="px-6 py-4 font-bold text-gray-800">{wo.customer}</td>
                <td className="px-6 py-4">
                  <div className="text-xs font-bold text-gray-700">{wo.job_details}</div>
                  <Badge color="orange" className="mt-1">Qty: {wo.qty}</Badge>
                </td>
                <td className="px-6 py-4 text-right">
                   <button 
                    onClick={() => onGenerate(wo.id)} 
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center gap-2 ml-auto shadow-md hover:scale-105 transition-all"
                   >
                     <Calculator size={14} /> Generate Plan
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

// --- Plan Generator (The Document) ---

const PlanGenerator: React.FC<{ id: number; onBack: () => void }> = ({ id, onBack }) => {
  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [components, setComponents] = useState<ChildItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const { data: woData } = await supabase.from('work_orders').select('*').eq('id', id).single();
      if (woData) {
        setWo(woData);
        const { data: itemData } = await supabase.from('items').select('*').eq('name', woData.job_details).single();
        if (itemData) {
          setItem(itemData);
          const { data: compData } = await supabase.from('child_items').select('*').eq('parent_item_id', itemData.id);
          if (compData) {
            setComponents(compData.map(d => ({
              id: d.id,
              name: d.name,
              qtyPerMaster: d.qty_per_master,
              departments: d.departments
            })));
          }
        }
      }
      setLoading(false);
    };
    fetchAll();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <LoadingState message="Calculating Material Requirements..." />;
  if (!wo) return <div className="p-20 text-center font-bold text-red-500">Work Order Not Found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center gap-2 font-black text-xs uppercase text-gray-400 hover:text-indigo-600 transition-colors">
          <ChevronLeft size={16}/> Back to Planning
        </button>
        <button 
          onClick={handlePrint} 
          className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-3 shadow-xl hover:scale-105 transition-all"
        >
          <Printer size={18} /> GENERATE PDF / PRINT
        </button>
      </div>

      <div className="print-area bg-white p-10 rounded-[2rem] shadow-2xl border-2 border-indigo-50 min-h-[11in] animate-in fade-in zoom-in duration-300">
         <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8 mb-8">
            <div className="space-y-1">
               <h1 className="text-5xl font-black tracking-tighter text-slate-900 uppercase">Production Plan</h1>
               <p className="text-slate-400 font-black tracking-widest text-xs uppercase">Manufacturing Order & Job Card</p>
            </div>
            <div className="text-right">
               <div className="text-4xl font-black text-indigo-600">#{wo.id}</div>
               <div className="text-[10px] font-black uppercase text-slate-400 mt-1">Order Identifier</div>
            </div>
         </div>

         <div className="grid grid-cols-2 gap-12 mb-12">
            <div className="space-y-6">
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Customer / Project</label>
                  <p className="text-2xl font-black text-slate-800">{wo.customer}</p>
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Main Assembly Name</label>
                  <p className="text-xl font-bold text-slate-700">{wo.job_details}</p>
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Drawing No.</label>
                  <p className="font-mono font-bold bg-slate-100 px-3 py-1 rounded inline-block text-slate-600">{wo.drawing || 'N/A'}</p>
               </div>
            </div>
            <div className="bg-indigo-50 rounded-[2rem] p-8 space-y-6 border border-indigo-100">
               <div>
                  <label className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Batch Quantity</label>
                  <div className="text-6xl font-black text-indigo-700">{wo.qty} <span className="text-lg font-medium opacity-60">Units</span></div>
               </div>
               <div className="flex justify-between border-t border-indigo-200 pt-6">
                  <div>
                    <label className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Plan Date</label>
                    <p className="font-bold text-slate-700">{new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <label className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Target Delivery</label>
                    <p className="font-bold text-orange-600">{wo.etd}</p>
                  </div>
               </div>
            </div>
         </div>

         <div className="mb-10">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 border-b pb-2">Bill of Materials (Required Components)</h3>
            <div className="overflow-hidden rounded-2xl border-2 border-slate-100">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                     <tr>
                        <th className="px-6 py-4">Component Name</th>
                        <th className="px-6 py-4 text-center">Qty / Unit</th>
                        <th className="px-6 py-4 text-right">TOTAL REQUIRED</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {components.map((comp, idx) => (
                        <tr key={idx} className="group">
                           <td className="px-6 py-5 font-bold text-slate-700">{comp.name}</td>
                           <td className="px-6 py-5 text-center text-slate-400 font-bold">{comp.qtyPerMaster || 1}</td>
                           <td className="px-6 py-5 text-right">
                              <span className="text-xl font-black text-indigo-600">{(comp.qtyPerMaster || 1) * wo.qty}</span>
                              <span className="ml-1 text-[10px] font-bold text-slate-400">PCS</span>
                           </td>
                        </tr>
                     ))}
                     {components.length === 0 && (
                        <tr>
                           <td colSpan={3} className="px-6 py-12 text-center text-slate-300 italic">No sub-components defined for this item master.</td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>

         <div className="grid grid-cols-3 gap-6 pt-12 mt-auto border-t border-dashed border-slate-300">
            <div className="text-center space-y-12">
               <div className="h-20 border-b border-slate-200"></div>
               <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Authorized Signatory</p>
            </div>
            <div className="text-center space-y-12">
               <div className="h-20 border-b border-slate-200"></div>
               <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Production In-charge</p>
            </div>
            <div className="text-center space-y-12">
               <div className="h-20 border-b border-slate-200"></div>
               <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Store / Issue Manager</p>
            </div>
         </div>
         
         <div className="mt-8 text-center no-print">
            <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">© 2024 Excell Packaging ERP Systems | Digital Job Card</p>
         </div>
      </div>
    </div>
  );
};

// --- App Root ---
const App: React.FC = () => {
  const [view, setView] = useState<AppView>('dashboard');
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [dbReady, setDbReady] = useState(true);

  // Define role and department constants
  const OFFICE_MANAGER_LEVEL = '1-Manager';
  const OFFICE_STAFF_LEVEL = '3-Staff';
  const QUALITY_DEPT = 'Quality_Control';
  const OFFICE_DEPT = 'Office';

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('excell_erp_user');
    if (saved) setLoggedInUser(JSON.parse(saved));
  }, []);

  const handleLogin = (u: User) => { 
    setLoggedInUser(u); 
    localStorage.setItem('excell_erp_user', JSON.stringify(u)); 
    
    // Redirect logic
    const normDept = normalizeDepartment(u.department);
    if (normDept === 'Office' || normDept === 'Quality_Control') {
      setView('dashboard'); 
    } else {
      setView('worker-dashboard'); // Workers go to specific dashboard
    }
  };
  const handleLogout = () => { setLoggedInUser(null); localStorage.removeItem('excell_erp_user'); };

  const canAccess = useCallback((user: User, targetView: AppView): boolean => {
    return canAccessView(user, targetView);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'worker-dashboard', label: 'My Jobs', icon: Hammer }, // Worker only
    { id: 'users', label: 'Users', icon: Users },
    { id: 'departments', label: 'Depts', icon: Building2 },
    { id: 'customers', label: 'Clients', icon: UserCircle },
    { id: 'items', label: 'Items', icon: Package },
    { id: 'work-orders', label: 'Orders', icon: ClipboardList },
    { id: 'child-items', label: 'Components', icon: Layers },
    { id: 'production-plan', label: 'Prod Plan', icon: FileText, highlight: true },
  ].filter(item => loggedInUser && canAccess(loggedInUser, item.id as AppView));

  if (!dbReady) return <DatabaseSetup onRetry={() => setDbReady(true)} />;
  if (!loggedInUser) return <Login onLogin={handleLogin} />;

  const renderContent = () => {
    const onError = () => setDbReady(false);

    // Initial check for unauthorized view access
    if (!canAccess(loggedInUser, view)) {
      const normDept = normalizeDepartment(loggedInUser.department);
      if (normDept === 'Office' || normDept === 'Quality_Control') {
        setView('dashboard');
      } else {
        setView('worker-dashboard');
      }
      return <LoadingState message="Access Denied. Redirecting..." />;
    }

    switch (view) {
      case 'dashboard': return <Dashboard user={loggedInUser} setView={setView} onError={onError} />;
      case 'worker-dashboard': return <WorkerDashboard onError={onError} onView={id => { (window as any)._id = id; setView('wo-details'); }} loggedInUser={loggedInUser} />;
      case 'users': return <UserList onError={onError} />;
      case 'departments': return <DepartmentList onError={onError} />;
      case 'customers': return <CustomerManagement onError={onError} />;
      case 'items': return <ItemList onError={onError} />;
      case 'child-items': return <ChildItemListView onError={onError} />;
      case 'work-orders': return <WorkOrderList onError={onError} onView={id => { (window as any)._id = id; setView('wo-details'); }} loggedInUser={loggedInUser} />;
      case 'wo-details': return <WODetails id={(window as any)._id} onBack={() => {
         const normDept = normalizeDepartment(loggedInUser.department);
         if (normDept === 'Office' || normDept === 'Quality_Control') {
            setView('work-orders');
         } else {
            setView('worker-dashboard');
         }
      }} loggedInUser={loggedInUser} />;
      case 'production-plan': return <ProductionPlanList onError={onError} onGenerate={id => { (window as any)._id = id; setView('plan-generator'); }} loggedInUser={loggedInUser} />;
      case 'plan-generator': return <PlanGenerator id={(window as any)._id} onBack={() => setView('production-plan')} />;
      default: return <Dashboard user={loggedInUser} setView={setView} onError={onError} />;
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50 overflow-x-hidden">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .lg\\:ml-64 { margin-left: 0 !important; }
          body { background: white !important; }
          .print-area { 
            box-shadow: none !important; 
            border: none !important; 
            padding: 0 !important; 
            margin: 0 !important;
            width: 100% !important;
          }
          main { padding: 0 !important; }
        }
      `}</style>

      <aside className="hidden lg:flex w-64 bg-[#0f172a] flex-col fixed h-full z-40 no-print">
        <div className="p-8 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white shadow-lg"><Package size={20}/></div>
          <span className="text-white font-black tracking-widest text-lg">EXCELL</span>
        </div>
        <nav className="flex-1 p-4 space-y-1 mt-4">
          {navItems.map(item => (
            <button 
              key={item.id} 
              onClick={() => setView(item.id as AppView)} 
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === item.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40' : item.highlight ? 'text-indigo-400 hover:bg-slate-800 border border-indigo-500/30' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <item.icon size={20} className={view === item.id ? 'text-white' : item.highlight ? 'text-indigo-400' : 'text-slate-500'} /> {item.label}
            </button>
          ))}
        </nav>
        <div className="p-6">
          <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-red-400 hover:bg-red-900/10 text-sm group transition-colors">
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" /> Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen">
         <header className="lg:hidden flex justify-between items-center h-16 bg-white border-b px-6 sticky top-0 z-30 no-print">
            <div className="flex items-center gap-2"><Package className="text-blue-600" size={24}/><span className="font-black tracking-widest">EXCELL</span></div>
            <button onClick={handleLogout} className="text-red-500 p-2"><LogOut size={20}/></button>
         </header>
         <div className="p-4 md:p-10 max-w-7xl mx-auto w-full flex-1">{renderContent()}</div>
      </main>
    </div>
  );
};

export default App;
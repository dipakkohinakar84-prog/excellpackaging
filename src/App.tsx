import React, { useState, useEffect, useCallback, useMemo, useRef, useDeferredValue } from 'react';
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
  Hammer,
  List,
  LayoutGrid,
  CheckSquare,
  Square,
  Truck,
  Bell,
  Upload
} from 'lucide-react';
import { AppView, User, Customer, Item, WorkOrder, Department, WOStatus, ChildItem } from './types';
import { supabase, supabaseAnonKey } from './supabase';
import { canAccessView, filterWorkOrdersByDepartment, getQCApprovalProgress, sendNotification, normalizeDepartment } from './utils';
import DepartmentStatusTracker from './DepartmentStatusTracker';
import { getCachedData, invalidateCachedData, primeCachedData } from './dataCache';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type AppHistoryState = {
  __app: true;
  view: AppView;
  payload?: {
    id?: number;
    ids?: number[];
    customPlan?: any;
  };
};

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

const StatusBadge: React.FC<{ status: WOStatus }> = ({ status }) => {
  const styles: Record<WOStatus, { bg: string; text: string; label: string }> = {
    'Not Started': { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Not Started' },
    'Work Started': { bg: 'bg-blue-100', text: 'text-blue-600', label: 'In Progress' },
    'Ready for QC': { bg: 'bg-yellow-100', text: 'text-yellow-600', label: 'Ready for QC' },
    'QC Approved': { bg: 'bg-green-100', text: 'text-green-600', label: 'QC Approved' },
    'Ready for despatch': { bg: 'bg-purple-100', text: 'text-purple-600', label: 'Ready for Despatch' },
    'Dispatched': { bg: 'bg-indigo-100', text: 'text-indigo-600', label: 'Dispatched' },
    'Delivered': { bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Delivered' },
    'Cancelled': { bg: 'bg-red-100', text: 'text-red-600', label: 'Cancelled' }
  };
  
  const style = styles[status] || styles['Not Started'];
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
};

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`bg-white rounded-[18px] shadow-[0_1px_3px_rgba(15,23,42,0.14)] border border-slate-200/80 p-4 ${className}`}>{children}</div>
);

const LoadingState: React.FC<{ message?: string }> = ({ message = "Loading..." }) => (
  <div className="flex flex-col items-center justify-center py-20 text-gray-400 animate-in fade-in duration-500">
    <div className="mb-5 grid w-full max-w-sm gap-2 px-8">
      <div className="erp-skeleton h-3 rounded-full" />
      <div className="erp-skeleton h-3 w-4/5 rounded-full" />
      <div className="erp-skeleton h-3 w-2/3 rounded-full" />
    </div>
    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{message}</p>
  </div>
);

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidthClassName?: string }> = ({ isOpen, onClose, title, children, maxWidthClassName = 'max-w-2xl' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxWidthClassName} overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] sm:max-h-[90vh]`}>
        <div className="px-4 sm:px-6 py-4 border-b flex justify-between items-center gap-3 bg-gray-50/50 flex-shrink-0">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 break-words">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Helper Functions ---

const parseAssignedDepartments = (val: any): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  
  let str = String(val).trim();
  
  if (str.startsWith('{') && str.endsWith('}')) {
    return str.slice(1, -1).split(',').map(s => s.trim().replace(/^"|"$/g, ''));
  }

  if (str.startsWith('[') || str.startsWith('"')) {
    try {
      let parsed = JSON.parse(str);
      if (typeof parsed === 'string') {
         try {
            const secondParse = JSON.parse(parsed);
            if (Array.isArray(secondParse)) return secondParse.map(String);
         } catch(e) {
            return [parsed];
         }
         return [parsed];
      }
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch (e) {}
  }
  
  if (str.includes(',')) {
    return str.split(',').map(s => s.trim());
  }
  
  return [str];
};

const normalizeDuplicateKey = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

const normalizeMobileNumber = (value: string) => value.replace(/\D/g, '');

type CustomPlanComponent = {
  component_type?: 'component' | 'item';
  component_id?: string;
  component_name: string;
  departments: string[];
  qty_per_item: number;
  total_qty: number;
};

type CustomPlanItem = {
  local_id: string;
  item_id?: number;
  item_name: string;
  drawing_no: string;
  item_qty: number;
  components: CustomPlanComponent[];
};

const makeLocalId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const isInvolvingDepartment = (departmentName: string) => {
  const norm = normalizeDepartment(departmentName);
  return norm !== 'Office' && norm !== 'Quality_Control' && norm !== 'Dispatch';
};

const PLAN_DEPARTMENT_COLUMNS = ['Wood_Work', 'Corrugation', 'Trading_Consumables'];

type BomRowType = 'component' | 'item';

type BomSelectionRow = {
  id: string | number;
  type: BomRowType;
  name: string;
  qty: number | '';
  departments: string[];
  drawing_no?: string;
};

const getBomChildType = (child: any): BomRowType => child?.type === 'item' ? 'item' : 'component';

const isSameBomReference = (a: Pick<BomSelectionRow, 'id' | 'type'>, b: Pick<BomSelectionRow, 'id' | 'type'>) => (
  a.type === b.type && String(a.id) === String(b.id)
);

const itemContainsItem = (items: Item[], sourceItemId: number, targetItemId: number, visited = new Set<number>()): boolean => {
  if (sourceItemId === targetItemId) return true;
  if (visited.has(sourceItemId)) return false;
  visited.add(sourceItemId);

  const sourceItem = items.find(item => Number(item.id) === Number(sourceItemId));
  if (!sourceItem || !Array.isArray(sourceItem.children)) return false;

  return sourceItem.children.some((child: any) => {
    if (getBomChildType(child) !== 'item') return false;
    const childItemId = Number(child.id);
    return childItemId === targetItemId || itemContainsItem(items, childItemId, targetItemId, visited);
  });
};

const toBomSelectionRow = (child: any): BomSelectionRow => ({
  id: child.id,
  type: getBomChildType(child),
  name: child.name,
  qty: Math.max(1, Number(child.qtyPerMaster) || 1),
  departments: Array.isArray(child.departments) ? child.departments : [],
  drawing_no: child.drawing_no,
});

const toStoredBomChild = (row: BomSelectionRow) => ({
  id: row.id,
  type: row.type,
  name: row.name,
  qtyPerMaster: Number(row.qty) > 0 ? Number(row.qty) : 1,
  departments: row.departments,
  ...(row.type === 'item' && row.drawing_no ? { drawing_no: row.drawing_no } : {}),
});

const addExpandedBomComponents = (
  target: any[],
  items: Item[],
  children: any[],
  multiplier: number,
  visited = new Set<number>(),
) => {
  children.forEach((child: any) => {
    const qty = Math.max(1, Number(child.qtyPerMaster) || 1) * multiplier;

    if (getBomChildType(child) === 'item') {
      const childItemId = Number(child.id);
      if (!Number.isFinite(childItemId) || visited.has(childItemId)) return;

      const nestedItem = items.find(item => Number(item.id) === childItemId);
      if (!nestedItem || !Array.isArray(nestedItem.children) || nestedItem.children.length === 0) {
        target.push({ ...child, type: 'item', totalQty: qty });
        return;
      }

      const nextVisited = new Set(visited);
      nextVisited.add(childItemId);
      addExpandedBomComponents(target, items, nestedItem.children, qty, nextVisited);
      return;
    }

    target.push({ ...child, type: 'component', totalQty: qty });
  });
};

const collectItemBomDepartments = (items: Item[], item: Item | undefined, visited = new Set<number>()): string[] => {
  if (!item || visited.has(Number(item.id))) return [];
  visited.add(Number(item.id));

  const departments = new Set<string>();
  const addDepartments = (values: any) => {
    if (!Array.isArray(values)) return;
    values
      .map((department: string) => normalizeDepartment(department))
      .filter(isInvolvingDepartment)
      .forEach((department: string) => departments.add(department));
  };

  addDepartments(item.departments);

  (item.children || []).forEach((child: any) => {
    addDepartments(child.departments);

    if (getBomChildType(child) === 'item') {
      const nestedItem = items.find(candidate => Number(candidate.id) === Number(child.id));
      collectItemBomDepartments(items, nestedItem, visited).forEach(department => departments.add(department));
    }
  });

  return Array.from(departments);
};

const collectDirectWorkDepartments = (item: Item | undefined): string[] => {
  if (!item) return [];
  const departments = new Set<string>();
  const addDepartments = (values: any) => {
    if (!Array.isArray(values)) return;
    values
      .map((department: string) => normalizeDepartment(department))
      .filter(isInvolvingDepartment)
      .forEach((department: string) => departments.add(department));
  };

  addDepartments(item.departments);
  (item.children || [])
    .filter((child: any) => getBomChildType(child) === 'component')
    .forEach((child: any) => addDepartments(child.departments));

  return Array.from(departments);
};

const makeDepartmentStatuses = (departments: string[], username: string) => departments.map(dept => ({
  department: dept,
  status: 'Not Started',
  updated_at: new Date().toISOString(),
  updated_by: username,
}));

const getBomParentReferences = (items: Item[], childType: BomRowType, childId: string | number) => {
  const childIdText = String(childId);

  return items.filter(item => (item.children || []).some((child: any) => (
    getBomChildType(child) === childType && String(child.id) === childIdText
  )));
};

const buildBomReferenceIndex = (items: Item[]) => {
  const componentParents = new Map<string, Item[]>();
  const itemParents = new Map<string, Item[]>();

  items.forEach(parent => {
    (parent.children || []).forEach((child: any) => {
      const target = getBomChildType(child) === 'item' ? itemParents : componentParents;
      const key = String(child.id);
      target.set(key, [...(target.get(key) || []), parent]);
    });
  });

  return { componentParents, itemParents };
};

const alertBomDeleteBlocked = (rowName: string, parents: Item[]) => {
  const parentNames = parents.map(parent => parent.name).slice(0, 8).join('\n- ');
  const extraCount = Math.max(0, parents.length - 8);
  alert(`Cannot delete "${rowName}" because it is used in parent BOM(s).\n\nFirst remove it from:\n- ${parentNames}${extraCount > 0 ? `\n...and ${extraCount} more` : ''}`);
};

const loadCachedCollection = async <T,>(collection: string, sortField = 'name', limit?: number): Promise<T[]> => {
  const key = `collection:${collection}:${sortField}:${limit || 'all'}`;
  return getCachedData(key, async () => {
    let query = supabase.from(collection).select('*').order(sortField, { ascending: sortField !== 'id' });
    if (limit) query = query.limit(limit) as any;
    const { data } = await query;
    return (data || []) as T[];
  });
};

const primeCachedCollection = (collection: string, sortField = 'name', limit?: number) => {
  const key = `collection:${collection}:${sortField}:${limit || 'all'}`;
  primeCachedData(key, async () => {
    let query = supabase.from(collection).select('*').order(sortField, { ascending: sortField !== 'id' });
    if (limit) query = query.limit(limit) as any;
    const { data } = await query;
    return data || [];
  });
};

const invalidateCollectionCache = (collection: string) => invalidateCachedData(`collection:${collection}`);

const STATUS_FILTER_ORDER: WOStatus[] = [
  'Not Started',
  'Work Started',
  'Ready for QC',
  'QC Approved',
  'Ready for despatch',
  'Dispatched',
  'Delivered',
  'Cancelled'
];

const sortStatuses = (statuses: string[]): string[] => {
  return [...statuses].sort((a, b) => {
    const aIndex = STATUS_FILTER_ORDER.indexOf(a as WOStatus);
    const bIndex = STATUS_FILTER_ORDER.indexOf(b as WOStatus);
    const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    return safeA - safeB;
  });
};

const LIST_PAGE_SIZE = 35;

const getPageSlice = <T,>(rows: T[], page: number, pageSize: number) => {
  const safePageSize = Math.max(pageSize, 1);
  const totalPages = Math.max(1, Math.ceil(rows.length / safePageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * safePageSize;
  const endIndex = startIndex + safePageSize;

  return {
    pageRows: rows.slice(startIndex, endIndex),
    totalPages,
    safePage,
    totalRows: rows.length,
    startIndex,
  };
};

const PaginationBar: React.FC<{
  page: number;
  totalPages: number;
  totalRows: number;
  startIndex: number;
  pageRowsCount: number;
  onPageChange: (page: number) => void;
}> = ({ page, totalPages, totalRows, startIndex, pageRowsCount, onPageChange }) => {
  if (totalRows <= LIST_PAGE_SIZE) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-gray-50/90 border-t border-gray-100">
      <span className="text-xs font-semibold text-gray-500 text-center sm:text-left">
        Showing {startIndex + 1}-{startIndex + pageRowsCount} of {totalRows}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-700 disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-xs font-black text-gray-500 min-w-[70px] text-center">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-700 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
};

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
};

const isConfiguredVapidKey = (key?: string) => {
  if (!key) return false;
  if (key.includes('your_') || key.includes('replace_')) return false;
  return key.length > 40;
};

const registerBackgroundPushForUser = async (user: User) => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications are not supported in this browser');
    return;
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!isConfiguredVapidKey(vapidPublicKey)) {
    console.warn('VITE_VAPID_PUBLIC_KEY is missing or still a placeholder. Background push disabled.');
    return;
  }

  if (Notification.permission === 'denied') {
    console.warn('Notification permission denied by user');
    return;
  }

  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    } catch (error: any) {
      throw new Error(
        'Push service registration failed. Check that VITE_VAPID_PUBLIC_KEY is a real generated public key, the site is running on localhost or HTTPS, and browser push services are not blocked.'
      );
    }
  }

  const json = subscription.toJSON();

  await supabase.from('push_subscriptions').upsert(
    {
      endpoint: subscription.endpoint,
      user_id: user.id,
      username: user.username,
      department: normalizeDepartment(user.department),
      p256dh: json.keys?.p256dh || null,
      auth: json.keys?.auth || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );
};

const sendBackgroundPushEvent = async (params: {
  title: string;
  body: string;
  departments: string[];
  workOrderId?: number;
  actor?: string;
}) => {
  try {
    const normalizedDepartments: string[] = [
      ...new Set(
        (params.departments || [])
          .map((d: string) => normalizeDepartment(d))
          .filter((d: string) => !!d)
      )
    ];

    if (normalizedDepartments.length === 0) return;

    const pushApiUrl = import.meta.env.VITE_PUSH_API_URL as string | undefined;
    if (!pushApiUrl || pushApiUrl.includes('127.0.0.1') || pushApiUrl.includes('localhost')) {
      if (import.meta.env.DEV) console.warn('VITE_PUSH_API_URL is not configured for this environment. Background push skipped.');
      return;
    }

    const response = await fetch(pushApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ ...params, departments: normalizedDepartments }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'unknown error');
      console.error('Background push HTTP error:', response.status, errBody);
      return;
    }

    const result = await response.json().catch(() => null);
    if (result && result.targets === 0) {
      console.warn('Push sent with zero targets for departments:', normalizedDepartments);
    }
  } catch (error) {
    console.error('Background push request failed:', error);
  }
};

// --- Login View ---

const Login: React.FC<{ onLogin: (user: User) => void }> = ({ onLogin }) => {
  const [mobile, setMobile] = useState('');
  const [passkey, setPasskey] = useState('');
  const [showPasskey, setShowPasskey] = useState(false);
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
    <div className="min-h-screen overflow-hidden bg-[#f4f4f4] text-slate-900 lg:grid lg:grid-cols-2">
      <style>{`
        @keyframes loginFloat { 0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); } 50% { transform: translate3d(0, -18px, 0) rotate(4deg); } }
        @keyframes loginDrift { 0% { transform: translateX(-8%) rotate(-4deg); } 100% { transform: translateX(8%) rotate(4deg); } }
        @keyframes loginPulse { 0%, 100% { opacity: .35; transform: scale(.95); } 50% { opacity: .9; transform: scale(1.05); } }
        @media (prefers-reduced-motion: reduce) { .login-animate { animation: none !important; } }
      `}</style>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 lg:px-8">
        <div className="w-full max-w-[430px] overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.14)]">
          <div className="px-8 pb-8 pt-14 sm:px-10">
            <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-[24px] bg-[#0176d3] text-white shadow-lg shadow-blue-200">
              <Package size={38} strokeWidth={2.2} />
            </div>
            <h1 className="mt-8 text-center text-[28px] font-normal tracking-tight text-[#032d60]">Enter your Passkey</h1>
            <div className="mt-8 flex items-center gap-3 text-sm font-medium text-slate-700">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#032d60] via-[#0176d3] to-emerald-400 text-white">
                <Package size={20} />
              </div>
              <span>{mobile || 'Registered mobile user'}</span>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {error && (
                <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Registered Mobile</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    required
                    type="text"
                    inputMode="tel"
                    placeholder="98XXXXXXXX"
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    className="w-full rounded-md border border-slate-400 bg-white py-2.5 pl-10 pr-3 font-mono text-sm text-slate-900 outline-none transition-all focus:border-[#0176d3] focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Passkey</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    required
                    type={showPasskey ? 'text' : 'password'}
                    placeholder="Enter passkey"
                    value={passkey}
                    onChange={e => setPasskey(e.target.value)}
                    className="w-full rounded-md border border-slate-400 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-900 outline-none transition-all focus:border-[#0176d3] focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasskey(prev => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                    aria-label={showPasskey ? 'Hide passkey' : 'Show passkey'}
                  >
                    {showPasskey ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#0176d3] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b5cab] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <>Log In <LogIn size={17} /></>}
              </button>
            </form>
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-8 py-7 text-center sm:px-10">
            <div className="text-xs font-medium text-slate-500">Authorized Excell Packaging users only</div>
          </div>
        </div>
      </section>

      <section className="relative hidden min-h-screen overflow-hidden bg-gradient-to-br from-[#0b2ee8] via-[#123ec5] to-[#0622a8] px-10 py-9 text-white lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.22),transparent_28%),radial-gradient(circle_at_78%_55%,rgba(59,130,246,0.55),transparent_30%)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:44px_44px]" />

        <div className="relative z-10 max-w-4xl">
          <p className="text-sm font-bold tracking-wide text-blue-100">Cloud ERP | Excell Packaging</p>
          <h2 className="mt-5 max-w-3xl text-[52px] font-black leading-[1.05] tracking-tight xl:text-[64px]">
            Control every order from planning to dispatch.
          </h2>
          <p className="mt-7 max-w-3xl text-xl font-medium leading-8 text-blue-50/90">
            Real-time production visibility, department queues, QC approvals, alerts, and dispatch tracking in one secure workspace.
          </p>
        </div>

        <div className="relative z-10 mt-12 h-[430px] max-w-4xl overflow-hidden rounded-[34px] border border-white/20 bg-white/10 shadow-2xl shadow-blue-950/40 backdrop-blur-sm">
          <div className="absolute left-10 top-10 h-24 w-24 rounded-[28px] border border-white/20 bg-white/15 login-animate" style={{ animation: 'loginFloat 5.5s ease-in-out infinite' }}>
            <Package className="m-7 text-white" size={40} />
          </div>
          <div className="absolute right-12 top-16 h-28 w-28 rounded-full bg-cyan-300/80 blur-sm login-animate" style={{ animation: 'loginPulse 4.5s ease-in-out infinite' }} />
          <div className="absolute left-32 top-36 h-56 w-[38rem] rounded-[999px] bg-gradient-to-r from-cyan-300 via-yellow-300 to-red-400 opacity-90 login-animate" style={{ animation: 'loginDrift 7s ease-in-out infinite alternate' }} />
          <div className="absolute bottom-[-74px] right-[-42px] h-72 w-[42rem] rotate-[-7deg] rounded-[44px] border-[10px] border-white/30 bg-slate-950/80 shadow-2xl">
            <div className="grid h-full grid-cols-3 gap-4 p-8">
              {['Planning', 'QC', 'Dispatch'].map((label, index) => (
                <div key={label} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                  <div className="h-3 w-16 rounded-full bg-blue-300" />
                  <div className="mt-5 h-20 rounded-2xl bg-white/15" />
                  <div className="mt-4 text-sm font-black text-white">{label}</div>
                  <div className="mt-2 h-2 rounded-full bg-white/15">
                    <div className="h-2 rounded-full bg-emerald-300" style={{ width: `${55 + index * 14}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute left-[40%] top-24 text-6xl font-light text-white/80 login-animate" style={{ animation: 'loginFloat 4s ease-in-out infinite' }}>+</div>
          <div className="absolute right-[33%] top-36 h-10 w-10 rotate-45 rounded-lg bg-cyan-200 login-animate" style={{ animation: 'loginPulse 3.8s ease-in-out infinite' }} />
        </div>
      </section>
    </div>
  );
};

// --- Database Setup View ---

const DatabaseSetup: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const repairSql = `-- 1. Create dedicated Child Items table (Component Library)
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

-- 3. Add JSONB Children column to Items for BOM
ALTER TABLE items ADD COLUMN IF NOT EXISTS children JSONB DEFAULT '[]'::jsonb;

-- 4. Ensure 'departments' on items is an array
DO $$ 
BEGIN 
  IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'departments') = 'text' THEN
    ALTER TABLE items ALTER COLUMN departments TYPE TEXT[] USING array[departments];
  END IF;
END $$;

-- 5. Add 'assigned_departments' and 'department_statuses' to work_orders
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS assigned_departments TEXT[] DEFAULT '{}';
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS department_statuses JSONB DEFAULT '[]';

-- 6. Ensure 'assigned_departments' on work_orders is an array
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'assigned_departments') AND (SELECT data_type FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'assigned_departments') = 'text' THEN
    ALTER TABLE work_orders ALTER COLUMN assigned_departments TYPE TEXT[] USING array[assigned_departments];
  END IF;
END $$;

-- 7. Make parent_item_id nullable for library items
ALTER TABLE child_items ALTER COLUMN parent_item_id DROP NOT NULL;

-- 8. Update Work Order status check to include dispatch statuses
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;
ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check CHECK (status IN (
  'Not Started',
  'Work Started', 
  'Ready for QC',
  'QC Approved',
  'Ready for despatch',
  'Dispatched',
  'Delivered',
  'Cancelled'
));

-- 9. Add qty_dispatched column
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS qty_dispatched INTEGER DEFAULT 0;

-- 10. Add dispatch invoice/vehicle columns on work orders
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS last_invoice_no TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS last_vehicle_no TEXT;

-- 11. Add vehicle number on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_number TEXT;

-- 12. Create dispatch logs table
CREATE TABLE IF NOT EXISTS dispatch_logs (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  dispatch_qty INTEGER NOT NULL,
  invoice_no TEXT NOT NULL,
  vehicle_no TEXT NOT NULL,
  dispatched_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Notification audit table
CREATE TABLE IF NOT EXISTS notification_events (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  actor TEXT,
  departments TEXT[] NOT NULL DEFAULT '{}',
  work_order_id BIGINT,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  targets INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_events ADD COLUMN IF NOT EXISTS actor TEXT;
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
          <p className="text-slate-400 text-lg">Initialize your Supabase tables to support drawings, BOMs, and new tracking features.</p>
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
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsWindow, setAnalyticsWindow] = useState<'today' | '7d' | '30d' | '90d' | 'custom'>('30d');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [users, depts, customers, items, wos, woRows, childCheck] = await Promise.all([
          supabase.from('users').select('*', { count: 'exact', head: true }),
          supabase.from('departments').select('*', { count: 'exact', head: true }),
          supabase.from('customers').select('*', { count: 'exact', head: true }),
          supabase.from('items').select('*', { count: 'exact', head: true }),
          supabase.from('work_orders').select('*', { count: 'exact', head: true }),
          loadCachedCollection<WorkOrder>('work_orders', 'id', 500),
          supabase.from('child_items').select('id', { count: 'exact', head: true }).limit(1),
        ]);

        if (users.error?.code === '42P01' || childCheck.error?.code === '42P01') {
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

        if (woRows) {
          setOrders(woRows.map((wo: any) => ({
            ...wo,
            assigned_departments: parseAssignedDepartments(wo.assigned_departments),
            department_statuses: Array.isArray(wo.department_statuses) ? wo.department_statuses : [],
          })));
        }
      } catch (err) {
        console.error('Dashboard fetch failed', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCounts();
  }, [onError]);

  const analyticsOrders = useMemo(() => {
    const now = new Date();
    const minDate = new Date();
    let maxDate: Date | null = null;

    if (analyticsWindow === 'today') {
      minDate.setHours(0, 0, 0, 0);
      maxDate = new Date();
      maxDate.setHours(23, 59, 59, 999);
    } else if (analyticsWindow === '7d') {
      minDate.setDate(now.getDate() - 7);
    } else if (analyticsWindow === '30d') {
      minDate.setDate(now.getDate() - 30);
    } else if (analyticsWindow === '90d') {
      minDate.setDate(now.getDate() - 90);
    }

    const customFrom = customFromDate ? new Date(`${customFromDate}T00:00:00`) : null;
    const customTo = customToDate ? new Date(`${customToDate}T23:59:59`) : null;

    const getOrderDate = (wo: any): Date | null => {
      if (wo.created_at) {
        const created = new Date(wo.created_at);
        if (!Number.isNaN(created.getTime())) return created;
      }
      if (wo.etd) {
        const etd = new Date(`${wo.etd}T12:00:00`);
        if (!Number.isNaN(etd.getTime())) return etd;
      }
      return null;
    };

    return orders.filter(wo => {
      const orderDate = getOrderDate(wo);

      if (analyticsWindow === 'custom') {
        if (!customFrom && !customTo) return true;
        if (!orderDate) return false;
        if (customFrom && orderDate < customFrom) return false;
        if (customTo && orderDate > customTo) return false;
        return true;
      }

      if (!orderDate) return false;
      if (orderDate < minDate) return false;
      if (maxDate && orderDate > maxDate) return false;
      return true;
    });
  }, [orders, analyticsWindow, customFromDate, customToDate]);

  const kpis = useMemo(() => {
    const totalOrders = analyticsOrders.length;
    const openOrders = analyticsOrders.filter(wo => !['Delivered', 'Cancelled'].includes(wo.status)).length;
    const deliveredOrders = analyticsOrders.filter(wo => wo.status === 'Delivered').length;
    const overdue = analyticsOrders.filter(wo => {
      if (!wo.etd) return false;
      const etd = new Date(`${wo.etd}T12:00:00`);
      return !Number.isNaN(etd.getTime()) && etd < new Date() && !['Delivered', 'Cancelled'].includes(wo.status);
    }).length;
    return { totalOrders, openOrders, deliveredOrders, overdue };
  }, [analyticsOrders]);

  const statusDistribution = useMemo(() => {
    const map = new Map<string, number>();
    analyticsOrders.forEach(wo => {
      const key = wo.status || 'Unknown';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([status, count]) => ({
      status,
      count,
      pct: analyticsOrders.length > 0 ? Math.round((count / analyticsOrders.length) * 100) : 0,
    })).sort((a, b) => b.count - a.count);
  }, [analyticsOrders]);

  const chartPalette = ['#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6'];

  const statusChart = useMemo(() => {
    return statusDistribution.slice(0, 8).map((row, index) => ({
      ...row,
      color: chartPalette[index % chartPalette.length],
    }));
  }, [statusDistribution]);

  const pieGradient = useMemo(() => {
    if (statusChart.length === 0) return 'conic-gradient(#e5e7eb 0% 100%)';
    let start = 0;
    const segments: string[] = [];
    statusChart.forEach(row => {
      const end = Math.min(100, start + row.pct);
      segments.push(`${row.color} ${start}% ${end}%`);
      start = end;
    });
    if (start < 100) segments.push(`#e5e7eb ${start}% 100%`);
    return `conic-gradient(${segments.join(', ')})`;
  }, [statusChart]);

  const departmentWorkload = useMemo(() => {
    const map = new Map<string, { dept: string; orders: number; qty: number }>();
    analyticsOrders.forEach(wo => {
      const depts = Array.isArray(wo.assigned_departments) ? wo.assigned_departments : [];
      depts.forEach((d: string) => {
        const dept = normalizeDepartment(d).replace(/_/g, ' ');
        const row = map.get(dept) || { dept, orders: 0, qty: 0 };
        row.orders += 1;
        row.qty += Number(wo.qty) || 0;
        map.set(dept, row);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.orders - a.orders).slice(0, 6);
  }, [analyticsOrders]);

  const maxDeptOrders = useMemo(() => Math.max(1, ...departmentWorkload.map(row => row.orders)), [departmentWorkload]);

  if (loading) return <LoadingState />;

  const stats = [
    { label: 'Users', count: counts.users, icon: Users, view: 'users' as AppView, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Departments', count: counts.depts, icon: Building2, view: 'departments' as AppView, tone: 'bg-violet-50 text-violet-600' },
    { label: 'Customers', count: counts.customers, icon: UserCircle, view: 'customers' as AppView, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Item Master', count: counts.items, icon: Package, view: 'items' as AppView, tone: 'bg-amber-50 text-amber-600' },
    { label: 'Work Orders', count: counts.wos, icon: ClipboardList, view: 'work-orders' as AppView, tone: 'bg-indigo-50 text-indigo-600' },
  ];

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="erp-stagger grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {stats.map((stat) => (
          <button
            key={stat.label}
            onClick={() => setView(stat.view)}
            className="group relative bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all duration-200 text-left overflow-hidden min-h-[104px] active:scale-[0.99]"
          >
            <div className={`p-2.5 rounded-xl mb-3 inline-flex ${stat.tone}`}>
              <stat.icon size={18} />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-gray-500 font-bold uppercase text-[10px] tracking-wider">{stat.label}</h3>
              <span className="text-2xl font-black text-gray-800 leading-none">{stat.count}</span>
            </div>
          </button>
        ))}
      </div>

      <Card className="space-y-3 rounded-3xl sm:rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Analytics</h3>
            <p className="text-xs text-gray-500 font-semibold">Simple visual overview for the selected time window.</p>
          </div>
          <button onClick={() => setView('reports')} className="w-full sm:w-auto px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-black">Open Full Reports</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="inline-flex bg-gray-100 rounded-lg p-1 col-span-2 sm:col-span-1 flex-wrap">
            {(['today', '7d', '30d', '90d', 'custom'] as const).map(w => (
              <button key={w} onClick={() => setAnalyticsWindow(w)} className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-black ${analyticsWindow === w ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>{w.toUpperCase()}</button>
            ))}
          </div>
          <div className="sm:col-span-2 text-[11px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
            Window Orders: <span className="font-black text-gray-700">{analyticsOrders.length}</span>
          </div>
        </div>
        {analyticsWindow === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="date"
              value={customFromDate}
              onChange={e => setCustomFromDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"
            />
            <input
              type="date"
              value={customToDate}
              onChange={e => setCustomToDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"
            />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Card className="p-3"><div className="text-[10px] uppercase font-black text-gray-400">Open Orders</div><div className="text-2xl font-black text-blue-700 mt-1">{kpis.openOrders}</div></Card>
        <Card className="p-3"><div className="text-[10px] uppercase font-black text-gray-400">Overdue</div><div className="text-2xl font-black text-red-600 mt-1">{kpis.overdue}</div></Card>
        <Card className="p-3"><div className="text-[10px] uppercase font-black text-gray-400">Delivered</div><div className="text-2xl font-black text-emerald-700 mt-1">{kpis.deliveredOrders}</div></Card>
        <Card className="p-3"><div className="text-[10px] uppercase font-black text-gray-400">Total (Window)</div><div className="text-2xl font-black text-indigo-700 mt-1">{kpis.totalOrders}</div></Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Card className="space-y-3">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Order Status Share</h3>
          {statusChart.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div className="relative w-44 h-44 mx-auto">
                <div className="w-full h-full rounded-full" style={{ background: pieGradient }} />
                <div className="absolute inset-9 rounded-full bg-white border border-gray-100 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-gray-400 font-black uppercase">Orders</span>
                  <span className="text-xl font-black text-gray-800 leading-none">{kpis.totalOrders}</span>
                </div>
              </div>
              <div className="space-y-2">
                {statusChart.map(row => (
                  <div key={row.status} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                      <span className="font-semibold text-gray-700 truncate">{row.status}</span>
                    </div>
                    <span className="font-black text-gray-600 whitespace-nowrap">{row.count} ({row.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400 italic text-sm">No order data available for this window.</div>
          )}
        </Card>

        <Card className="space-y-3">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Department Load</h3>
          <div className="space-y-2.5">
            {departmentWorkload.map(row => (
              <div key={row.dept}>
                <div className="flex items-center justify-between text-[11px] font-semibold text-gray-600 mb-1">
                  <span className="truncate pr-2">{row.dept}</span>
                  <span className="font-black text-gray-700">{row.orders}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.max(8, (row.orders / maxDeptOrders) * 100)}%` }} />
                </div>
                <div className="mt-1 text-[10px] font-semibold text-gray-500">Qty: {row.qty}</div>
              </div>
            ))}
            {departmentWorkload.length === 0 && <div className="text-xs text-gray-400 italic">No department data for this window.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
};

// --- Dispatch Dashboard ---

const DispatchDashboard: React.FC<{ onError: () => void; onView: (id: number) => void; loggedInUser: User }> = ({ onError, onView, loggedInUser }) => {
  const [data, setData] = useState<(WorkOrder & { itemInfo?: Item })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [vehicleOptions, setVehicleOptions] = useState<string[]>([]);
  const [isDispatchMetaModalOpen, setIsDispatchMetaModalOpen] = useState(false);
  const [dispatchMeta, setDispatchMeta] = useState({ invoiceNo: '', vehicleNo: '' });
  const [isSubmittingDispatch, setIsSubmittingDispatch] = useState(false);
  
  // Track selected orders and their dispatch quantities using Record to be TS friendly
  const [selectedOrders, setSelectedOrders] = useState<Record<number, number>>({});
  const [dispatchMode, setDispatchMode] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [woResult, itemRes, usersRes] = await Promise.all([
        supabase.from('work_orders').select('*').order('id', { ascending: false }),
        loadCachedCollection<Item>('items'),
        loadCachedCollection<User>('users', 'id', 200),
      ]);
      const { data: woRes, error: woErr } = woResult;

      if (woErr?.code === '42P01') { onError(); return; }

      if (woRes && itemRes) {
        const itemsByName = new Map(itemRes.map(item => [item.name, item]));
        const enriched = woRes.map(wo => ({
          ...wo,
          itemInfo: itemsByName.get(wo.job_details),
          qty_dispatched: wo.qty_dispatched ?? 0,
        }));

        // Show orders that are QC Approved, Ready for despatch, or already in dispatch process
        const dispatchOrders = enriched.filter(wo => 
          wo.status === 'QC Approved' || // Added this condition
          wo.status === 'Ready for despatch' || 
          wo.status === 'Dispatched' || 
          wo.status === 'Delivered'
        );

        setData(dispatchOrders);

        const dispatchVehicles = (usersRes || [])
          .filter((u: any) => normalizeDepartment(u.department) === 'Dispatch' && (u.vehicle_number || '').trim() !== '')
          .map((u: any) => String(u.vehicle_number).trim());
        setVehicleOptions(Array.from(new Set(dispatchVehicles)));
      }
    } catch (e) { 
      console.error('Error fetching dispatch orders:', e);
      onError(); 
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleOrderSelection = (orderId: number, maxQty: number) => {
    setSelectedOrders(prev => {
      const newSelected = { ...prev };
      if (newSelected[orderId]) {
        delete newSelected[orderId];
      } else {
        newSelected[orderId] = maxQty; // Default to full quantity
      }
      return newSelected;
    });
  };

  const updateDispatchQty = (orderId: number, qty: number, maxQty: number) => {
    const validQty = Math.max(0, Math.min(qty, maxQty)); // Between 0 and max
    setSelectedOrders(prev => ({
      ...prev,
      [orderId]: validQty
    }));
  };

  const submitBulkDispatch = async () => {
    if (isSubmittingDispatch) return;

    const invoiceNo = dispatchMeta.invoiceNo.trim();
    const vehicleNo = dispatchMeta.vehicleNo.trim();

    if (!invoiceNo) {
      alert('Invoice number is required');
      return;
    }
    if (!vehicleNo) {
      alert('Vehicle number is required');
      return;
    }

    if (Object.keys(selectedOrders).length === 0) {
      alert('Please select at least one order');
      return;
    }

    const invalidOrders = Object.entries(selectedOrders).filter(([_, qty]) => (qty as number) <= 0);
    if (invalidOrders.length > 0) {
      alert('Please enter valid quantities for all selected orders');
      return;
    }

    const selectedOrdersSnapshot = { ...selectedOrders };
    const selectedOrderCount = Object.keys(selectedOrdersSnapshot).length;
    const dispatchedOrderIds = Object.keys(selectedOrdersSnapshot).map(id => `#${id}`).join(', ');

    setIsSubmittingDispatch(true);

    try {
      setIsDispatchMetaModalOpen(false);

      const failedIds: number[] = [];

      await Promise.all(Object.entries(selectedOrdersSnapshot).map(async ([orderIdStr, dispatchQty]) => {
        const orderId = parseInt(orderIdStr);
        const order = data.find(wo => wo.id === orderId);
        if (!order) return;

        const currentDispatched = order.qty_dispatched ?? 0;
        const newDispatched = currentDispatched + dispatchQty;
        const remaining = order.qty - newDispatched;

        const newStatus: WOStatus = remaining === 0 ? 'Delivered' : 'Dispatched';

        const { error } = await supabase
          .from('work_orders')
          .update({
            qty_dispatched: newDispatched,
            status: newStatus,
            last_invoice_no: invoiceNo,
            last_vehicle_no: vehicleNo,
          })
          .eq('id', orderId);

        if (error) {
          console.error('Error updating order:', orderId, error);
          failedIds.push(orderId);
          return;
        }

        const { error: logError } = await supabase.from('dispatch_logs').insert([{
          work_order_id: orderId,
          dispatch_qty: dispatchQty,
          invoice_no: invoiceNo,
          vehicle_no: vehicleNo,
          dispatched_by: loggedInUser.username,
        }]);

        if (logError) {
          console.error('Dispatch log insert failed:', logError);
        }
      }));

      await fetchData();

      setSelectedOrders({});
      setDispatchMode(false);
      setDispatchMeta({ invoiceNo: '', vehicleNo: '' });

      if (failedIds.length > 0) {
        alert(`Some orders failed to dispatch: ${failedIds.map(id => `#${id}`).join(', ')}. Others were dispatched successfully.`);
        return;
      }

      await sendBackgroundPushEvent({
        title: 'Order Dispatched',
        body: `Orders ${dispatchedOrderIds}\nInvoice ${invoiceNo} | Vehicle ${vehicleNo}`,
        departments: ['Office'],
        actor: loggedInUser.username,
      });

      alert(`Successfully dispatched ${selectedOrderCount} order(s)`);
    } catch (err) {
      console.error('Dispatch error:', err);
      setIsDispatchMetaModalOpen(true);
      alert('Failed to dispatch orders');
    } finally {
      setIsSubmittingDispatch(false);
    }
  };

  const handleBulkDispatch = () => {
    if (Object.keys(selectedOrders).length === 0) {
      alert('Please select at least one order');
      return;
    }

    setDispatchMeta({ invoiceNo: '', vehicleNo: vehicleOptions[0] || '' });
    setIsDispatchMetaModalOpen(true);
  };

  const filteredOrders = useMemo(() => {
    const statusFiltered = statusFilter === 'All' ? data : data.filter(wo => wo.status === statusFilter);
    if (!deferredSearchQuery) return statusFiltered;
    const lowerQuery = deferredSearchQuery.toLowerCase();
    return statusFiltered.filter(wo =>
      wo.id.toString().includes(lowerQuery) ||
      wo.customer.toLowerCase().includes(lowerQuery) ||
      wo.job_details.toLowerCase().includes(lowerQuery)
    );
  }, [data, deferredSearchQuery, statusFilter]);

  const statusOptions = useMemo(() => {
    const uniqueStatuses = Array.from(new Set(data.map(wo => wo.status)));
    return sortStatuses(uniqueStatuses);
  }, [data]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, data.length]);

  const { pageRows: paginatedOrders, totalPages, safePage, totalRows, startIndex } = useMemo(
    () => getPageSlice(filteredOrders, page, LIST_PAGE_SIZE),
    [filteredOrders, page]
  );

  const getRemainingQty = (wo: WorkOrder) => {
    return wo.qty - (wo.qty_dispatched || 0);
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6 custom-bom-print">
      <div className="sticky top-16 md:top-0 z-20 bg-gray-50/95 backdrop-blur px-1 py-2 rounded-xl border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <h2 className="text-2xl font-black text-gray-800">Dispatch Dashboard</h2>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {!dispatchMode && (
            <button
              onClick={() => setDispatchMode(true)}
              className="flex-1 md:flex-none px-4 py-2 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
            >
              <Package size={20} />
              Bulk Dispatch
            </button>
          )}
          {dispatchMode && (
            <>
              <button
                onClick={() => {
                  setDispatchMode(false);
                  setSelectedOrders({});
                }}
                className="flex-1 md:flex-none px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDispatch}
                disabled={Object.keys(selectedOrders).length === 0}
                className="flex-1 md:flex-none px-4 py-2 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={20} />
                Dispatch ({Object.keys(selectedOrders).length})
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by order, customer, or job..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="w-full pl-12 pr-4 py-3 bg-white border rounded-xl" 
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="w-full px-4 py-3 bg-white border rounded-xl text-sm font-semibold text-gray-700"
        >
          <option value="All">All Statuses</option>
          {statusOptions.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      <Modal isOpen={isDispatchMetaModalOpen} onClose={() => { if (!isSubmittingDispatch) setIsDispatchMetaModalOpen(false); }} title="Dispatch Details">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1 tracking-widest">Invoice Number</label>
            <input
              value={dispatchMeta.invoiceNo}
              onChange={e => setDispatchMeta(prev => ({ ...prev, invoiceNo: e.target.value }))}
              placeholder="Enter invoice number"
              disabled={isSubmittingDispatch}
              className="w-full px-4 py-3 bg-gray-50 border rounded-xl"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1 tracking-widest">Vehicle Number</label>
            <div className="space-y-2">
              <select
                value={dispatchMeta.vehicleNo}
                onChange={e => setDispatchMeta(prev => ({ ...prev, vehicleNo: e.target.value }))}
                disabled={isSubmittingDispatch}
                className="w-full px-4 py-3 bg-gray-50 border rounded-xl"
              >
                <option value="">Select Vehicle</option>
                {vehicleOptions.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <input
                value={dispatchMeta.vehicleNo}
                onChange={e => setDispatchMeta(prev => ({ ...prev, vehicleNo: e.target.value }))}
                placeholder="Or type vehicle number"
                disabled={isSubmittingDispatch}
                className="w-full px-4 py-3 bg-gray-50 border rounded-xl"
              />
            </div>
          </div>

          <button
            onClick={submitBulkDispatch}
            disabled={isSubmittingDispatch}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-black disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmittingDispatch ? 'Dispatching...' : 'Confirm Dispatch'}
          </button>
        </div>
      </Modal>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {dispatchMode && (
                  <th className="px-4 py-3 w-12">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded"
                      checked={paginatedOrders.length > 0 && paginatedOrders.every(wo => (selectedOrders[wo.id] as number) > 0 && getRemainingQty(wo) > 0)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newSelected: Record<number, number> = {};
                          paginatedOrders.forEach(wo => {
                            const remaining = getRemainingQty(wo);
                            if (remaining > 0) {
                              newSelected[wo.id] = remaining;
                            }
                          });
                          setSelectedOrders(newSelected);
                        } else {
                          setSelectedOrders({});
                        }
                      }}
                    />
                  </th>
                )}
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase text-gray-400 whitespace-nowrap">Order #</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase text-gray-400 whitespace-nowrap">Customer</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase text-gray-400 whitespace-nowrap">Job Details</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase text-gray-400 whitespace-nowrap">Total Qty</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase text-gray-400 whitespace-nowrap">Dispatched</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase text-gray-400 whitespace-nowrap">Remaining</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase text-gray-400 whitespace-nowrap">Invoice</th>
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase text-gray-400 whitespace-nowrap">Vehicle</th>
                {dispatchMode && (
                  <th className="px-6 py-3 text-left text-[10px] font-black uppercase text-gray-400 whitespace-nowrap">Dispatch Qty</th>
                )}
                <th className="px-6 py-3 text-left text-[10px] font-black uppercase text-gray-400 whitespace-nowrap">Status</th>
                <th className="px-6 py-3 text-right text-[10px] font-black uppercase text-gray-400 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map(wo => {
                const remaining = getRemainingQty(wo);
                const isSelected = selectedOrders[wo.id] !== undefined;
                const canDispatch = remaining > 0;

                return (
                  <tr 
                    key={wo.id}
                    className={`border-b transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    {dispatchMode && (
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded"
                          checked={isSelected}
                          disabled={!canDispatch}
                          onChange={() => toggleOrderSelection(wo.id, remaining)}
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className="text-blue-600 font-bold">#{wo.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800">{wo.customer}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-700">{wo.job_details}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-800">{wo.qty}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-blue-600">{wo.qty_dispatched || 0}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`font-bold ${remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        {remaining}
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className="text-xs font-bold text-gray-600">{wo.last_invoice_no || '-'}</span></td>
                    <td className="px-6 py-4"><span className="text-xs font-bold text-gray-600">{wo.last_vehicle_no || '-'}</span></td>
                    {dispatchMode && (
                      <td className="px-6 py-4">
                        {isSelected ? (
                          <input
                            type="number"
                            min="1"
                            max={remaining}
                            value={selectedOrders[wo.id]}
                            onChange={(e) => updateDispatchQty(wo.id, parseInt(e.target.value) || 0, remaining)}
                            className="w-20 px-2 py-1 border rounded-lg text-center font-bold"
                          />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <StatusBadge status={wo.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <button 
                          onClick={() => onView(wo.id)} 
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye size={16}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={dispatchMode ? 12 : 11} className="px-6 py-12 text-center text-gray-400 italic">
                    No orders for dispatch
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden p-2 space-y-2">
          {dispatchMode && paginatedOrders.length > 0 && (
            <button
              onClick={() => {
                const allSelectableSelected = paginatedOrders
                  .filter(wo => getRemainingQty(wo) > 0)
                  .every(wo => selectedOrders[wo.id] !== undefined);

                if (allSelectableSelected) {
                  setSelectedOrders({});
                  return;
                }

                const nextSelected: Record<number, number> = {};
                paginatedOrders.forEach(wo => {
                  const remaining = getRemainingQty(wo);
                  if (remaining > 0) {
                    nextSelected[wo.id] = remaining;
                  }
                });
                setSelectedOrders(nextSelected);
              }}
              className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 bg-gray-50"
            >
              {paginatedOrders.filter(wo => getRemainingQty(wo) > 0).every(wo => selectedOrders[wo.id] !== undefined) ? 'Unselect Page' : 'Select Page'}
            </button>
          )}

          {paginatedOrders.map(wo => {
            const remaining = getRemainingQty(wo);
            const isSelected = selectedOrders[wo.id] !== undefined;
            const canDispatch = remaining > 0;

            return (
              <div key={wo.id} className={`rounded-xl border px-3 py-2 ${isSelected ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black text-blue-600">#{wo.id}</div>
                    <div className="font-black text-gray-800 leading-tight text-xs mt-0.5">{wo.job_details}</div>
                    <div className="text-[11px] font-semibold text-gray-500 mt-0.5">{wo.customer}</div>
                  </div>
                  <StatusBadge status={wo.status} />
                </div>

                <div className="grid grid-cols-3 gap-1.5 mt-2 text-center">
                  <div className="bg-gray-50 rounded-lg py-1">
                    <div className="text-[9px] font-black text-gray-400 uppercase">Total</div>
                    <div className="font-black text-gray-800 text-xs">{wo.qty}</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg py-1">
                    <div className="text-[9px] font-black text-blue-400 uppercase">Done</div>
                    <div className="font-black text-blue-600 text-xs">{wo.qty_dispatched || 0}</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg py-1">
                    <div className="text-[9px] font-black text-orange-400 uppercase">Left</div>
                    <div className="font-black text-orange-600 text-xs">{remaining}</div>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
                  <div className="bg-gray-50 rounded-lg px-2 py-1">
                    <span className="font-black text-gray-400 uppercase">Inv</span>
                    <div className="font-bold text-gray-700 truncate">{wo.last_invoice_no || '-'}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-2 py-1">
                    <span className="font-black text-gray-400 uppercase">Vehicle</span>
                    <div className="font-bold text-gray-700 truncate">{wo.last_vehicle_no || '-'}</div>
                  </div>
                </div>

                {dispatchMode && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded"
                      checked={isSelected}
                      disabled={!canDispatch}
                      onChange={() => toggleOrderSelection(wo.id, remaining)}
                    />
                    <span className="text-xs font-semibold text-gray-600 flex-1">Include</span>
                    {isSelected && (
                      <input
                        type="number"
                        min="1"
                        max={remaining}
                        value={selectedOrders[wo.id]}
                        onChange={(e) => updateDispatchQty(wo.id, parseInt(e.target.value) || 0, remaining)}
                        className="w-16 px-2 py-1 border rounded-lg text-center font-bold text-xs"
                      />
                    )}
                  </div>
                )}

                <button
                  onClick={() => onView(wo.id)}
                  className="mt-2 w-full py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold"
                >
                  View Details
                </button>
              </div>
            );
          })}

          {filteredOrders.length === 0 && (
            <div className="py-8 text-center text-gray-400 italic text-sm">No orders for dispatch</div>
          )}
        </div>

        <PaginationBar
          page={safePage}
          totalPages={totalPages}
          totalRows={totalRows}
          startIndex={startIndex}
          pageRowsCount={paginatedOrders.length}
          onPageChange={setPage}
        />
      </div>

      {dispatchMode && Object.keys(selectedOrders).length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-black text-gray-800 mb-4">Dispatch Summary</h3>
          <div className="space-y-2">
            {Object.entries(selectedOrders).map(([orderIdStr, qty]) => {
              const orderId = parseInt(orderIdStr);
              const order = data.find(wo => wo.id === orderId);
              if (!order) return null;
              return (
                <div key={orderId} className="flex justify-between items-center py-2 border-b border-blue-200 last:border-0">
                  <div>
                    <span className="font-bold text-gray-700">Order #{orderId}</span>
                    <span className="text-gray-500 ml-2">- {order.customer}</span>
                  </div>
                  <div className="font-black text-blue-600">
                    {qty} / {getRemainingQty(order)} units
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="flex justify-between items-center">
              <span className="font-black text-gray-800">Total Orders:</span>
              <span className="font-black text-blue-600 text-xl">{Object.keys(selectedOrders).length}</span>
            </div>
          </div>
        </div>
      )}
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
  
  const initialFormData = { username: '', email: '', mobile: '', vehicle_number: '', passkey: '', department: '', level: '3-Staff' };
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
    const mobileKey = normalizeMobileNumber(formData.mobile);
    if (!mobileKey) { alert("Please enter a valid mobile number."); return; }
    const duplicateUser = users.find(existingUser =>
      normalizeMobileNumber(existingUser.mobile || '') === mobileKey &&
      (!editingUser || Number(existingUser.id) !== Number(editingUser.id))
    );
    if (duplicateUser) {
      alert(`A user with mobile number ${formData.mobile} already exists: ${duplicateUser.username}.`);
      return;
    }
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

  const filteredUsers = useMemo(
    () => users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase())),
    [users, searchQuery]
  );

  if (loading && users.length === 0) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black">User Access Control</h2>
        <button
          onClick={() => { setEditingUser(null); setFormData(initialFormData); setIsModalOpen(true); }}
          aria-label="Add User"
          title="Add User"
          className="w-10 h-10 sm:w-auto sm:h-auto bg-blue-600 text-white sm:px-4 sm:py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Add User</span>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
        <input placeholder="Search users by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border rounded-xl outline-none" />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingUser(null); setFormData(initialFormData); }} title={editingUser ? "Edit User" : "New User"}>
        <form onSubmit={handleSaveUser} className="space-y-4">
          <input required placeholder="Name" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          <input required type="email" placeholder="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <input required placeholder="Mobile" value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
             <input placeholder="Vehicle Number (Optional)" value={formData.vehicle_number || ''} onChange={e => setFormData({...formData, vehicle_number: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
             <input required type="password" placeholder="Passkey" value={formData.passkey} onChange={e => setFormData({...formData, passkey: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
              <tr><th className="px-6 py-4 whitespace-nowrap">Name</th><th className="px-6 py-4 whitespace-nowrap">Contact</th><th className="px-6 py-4 whitespace-nowrap">Vehicle</th><th className="px-6 py-4 whitespace-nowrap">Dept</th><th className="px-6 py-4 whitespace-nowrap">Actions</th></tr>
            </thead>
            <tbody className="divide-y">
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold">{u.username}</td>
                  <td className="px-6 py-4">{u.mobile}</td>
                  <td className="px-6 py-4 text-xs font-bold text-gray-600">{u.vehicle_number || '-'}</td>
                  <td className="px-6 py-4"><Badge color="purple">{u.department}</Badge></td>
                  <td className="px-6 py-4">
                    <button onClick={() => { setEditingUser(u); setFormData(u); setIsModalOpen(true); }} className="text-blue-600 mr-2 hover:bg-blue-50 p-2 rounded-lg transition-colors inline-block"><Edit size={16} /></button>
                    <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors inline-block"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400 italic">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden p-2 space-y-2">
          {filteredUsers.map(u => (
            <div key={u.id} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-black text-gray-800 text-sm break-words">{u.username}</div>
                  <div className="text-[11px] text-gray-500 font-semibold mt-0.5 break-all">{u.email}</div>
                </div>
                <Badge color="purple">{u.department}</Badge>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-semibold text-gray-600">
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-2 py-1.5">Mobile: <span className="text-gray-800">{u.mobile || '-'}</span></div>
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-2 py-1.5">Vehicle: <span className="text-gray-800">{u.vehicle_number || '-'}</span></div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setEditingUser(u); setFormData(u); setIsModalOpen(true); }}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-2 py-2 text-[11px] font-black text-blue-700"
                >
                  <Edit size={14} /> Edit
                </button>
                <button
                  onClick={() => handleDeleteUser(u.id)}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-red-50 px-2 py-2 text-[11px] font-black text-red-600"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="py-8 text-center text-gray-400 italic text-sm">No users found.</div>
          )}
        </div>
      </Card>
    </div>
  );
};

// --- Department Management ---

const DepartmentList: React.FC<{ onError: () => void }> = ({ onError }) => {
  const [data, setData] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState({ name: '', incharge: '', supervisor: '', info: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await loadCachedCollection<Department>('departments');
      setData(res);
    } catch (e) { onError(); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = editingDepartment
      ? await supabase.from('departments').update(formData).eq('id', editingDepartment.id)
      : await supabase.from('departments').insert([formData]);
    const { error } = result;
    if (error) alert(error.message);
    else { 
      setIsModalOpen(false); 
      setEditingDepartment(null);
      setFormData({ name: '', incharge: '', supervisor: '', info: '' }); 
      invalidateCollectionCache('departments');
      fetchData(); 
    }
  };

  if (loading && data.length === 0) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black text-gray-800">Departments</h2>
        <button onClick={() => { setEditingDepartment(null); setFormData({ name: '', incharge: '', supervisor: '', info: '' }); setIsModalOpen(true); }} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-purple-700 transition-colors">
          <Plus size={18} /> <span className="hidden sm:inline">Add Dept</span><span className="sm:hidden">Add</span>
        </button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingDepartment(null); }} title={editingDepartment ? "Edit Department" : "New Department"}>
        <form onSubmit={handleSave} className="space-y-4">
          <input required placeholder="Department Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="In-charge" value={formData.incharge} onChange={e => setFormData({...formData, incharge: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
            <input placeholder="Supervisor" value={formData.supervisor} onChange={e => setFormData({...formData, supervisor: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          </div>
          <textarea placeholder="Description" value={formData.info} onChange={e => setFormData({...formData, info: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          <button type="submit" className="w-full py-4 bg-purple-600 text-white rounded-xl font-black shadow-lg">{editingDepartment ? 'Save Department' : 'Register Department'}</button>
        </form>
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map(d => (
          <Card key={d.id} className="hover:border-purple-200 transition-all border-l-4 border-l-purple-500">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-black text-gray-800">{d.name}</h3>
              <div className="flex gap-1">
                <button onClick={() => { setEditingDepartment(d); setFormData({ name: d.name, incharge: d.incharge || '', supervisor: d.supervisor || '', info: d.info || '' }); setIsModalOpen(true); }} className="text-blue-500 hover:text-blue-700 transition-colors"><Edit size={16} /></button>
                <button onClick={async () => { if(confirm("Delete?")) { await supabase.from('departments').delete().eq('id', d.id); invalidateCollectionCache('departments'); fetchData(); } }} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
              </div>
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
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: '', proprietor: '', address: '', city: '', contact: '', email: '', gst: '', type: 'Direct', reference: '', remarks: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [res, itemRes] = await Promise.all([
        loadCachedCollection<Customer>('customers'),
        loadCachedCollection<Item>('items'),
      ]);
      setData(res);
      setItems(itemRes);
    } catch (e) { onError(); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const oldCustomerName = editingCustomer?.name || '';
    const result = editingCustomer
      ? await supabase.from('customers').update(formData).eq('id', editingCustomer.id)
      : await supabase.from('customers').insert([formData]);
    const { error } = result;
    if (error) alert(error.message);
    else { 
      if (editingCustomer && normalizeDuplicateKey(oldCustomerName) !== normalizeDuplicateKey(formData.name)) {
        const linkedItems = items.filter(item => normalizeDuplicateKey(item.customer_name || '') === normalizeDuplicateKey(oldCustomerName));
        for (const item of linkedItems) {
          await supabase.from('items').update({ customer_name: formData.name }).eq('id', item.id);
        }
      }
      setIsModalOpen(false); 
      setEditingCustomer(null);
      setFormData({ name: '', proprietor: '', address: '', city: '', contact: '', email: '', gst: '', type: 'Direct', reference: '', remarks: '' }); 
      invalidateCollectionCache('customers');
      invalidateCollectionCache('items');
      fetchData(); 
    }
  };

  const deleteCustomer = async (customer: Customer) => {
    const customerKey = normalizeDuplicateKey(customer.name || '');
    const linkedItems = items.filter(item => normalizeDuplicateKey(item.customer_name || '') === customerKey);

    if (linkedItems.length > 0) {
      const itemNames = linkedItems.map(item => item.name).slice(0, 8).join('\n- ');
      const extraCount = Math.max(0, linkedItems.length - 8);
      alert(`Cannot delete "${customer.name}" because item master records exist for this client.\n\nFirst delete or move these item(s):\n- ${itemNames}${extraCount > 0 ? `\n...and ${extraCount} more` : ''}`);
      return;
    }

    if (confirm("Delete?")) {
      await supabase.from('customers').delete().eq('id', customer.id);
      invalidateCollectionCache('customers');
      fetchData();
    }
  };

  if (loading && data.length === 0) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black text-gray-800">Customers</h2>
        <button onClick={() => { setEditingCustomer(null); setFormData({ name: '', proprietor: '', address: '', city: '', contact: '', email: '', gst: '', type: 'Direct', reference: '', remarks: '' }); setIsModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-green-700 transition-colors">
          <Plus size={18} /> <span className="hidden sm:inline">Add Client</span><span className="sm:hidden">Add</span>
        </button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingCustomer(null); }} title={editingCustomer ? "Edit Customer" : "New Customer"}>
        <form onSubmit={handleSave} className="space-y-4">
          <input required placeholder="Company Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Proprietor" value={formData.proprietor} onChange={e => setFormData({...formData, proprietor: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
            <input placeholder="Contact" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          </div>
          <input type="email" placeholder="Email Address" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          <input placeholder="GST Number" value={formData.gst} onChange={e => setFormData({...formData, gst: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          <textarea placeholder="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
          <button type="submit" className="w-full py-4 bg-green-600 text-white rounded-xl font-black shadow-lg">{editingCustomer ? 'Update Customer' : 'Save Customer'}</button>
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
            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button onClick={() => { setEditingCustomer(c); setFormData({ name: c.name || '', proprietor: c.proprietor || '', address: c.address || '', city: c.city || '', contact: c.contact || '', email: c.email || '', gst: c.gst || '', type: c.type || 'Direct', reference: c.reference || '', remarks: c.remarks || '' }); setIsModalOpen(true); }} className="p-2 text-blue-500 hover:text-blue-700 bg-blue-50 rounded-lg"><Edit size={16} /></button>
              <button onClick={() => deleteCustomer(c)} className="p-2 text-red-300 hover:text-red-500 bg-red-50 rounded-lg"><Trash2 size={16} /></button>
            </div>
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
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChildModalOpen, setIsChildModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  
  // Selection / Data for Modals
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [allLibraryComponents, setAllLibraryComponents] = useState<any[]>([]); // From child_items table
  
  // Component Management States
  const [componentSearch, setComponentSearch] = useState('');
  const [newComponentNames, setNewComponentNames] = useState('');
  const [isAddingComponents, setIsAddingComponents] = useState(false);
  const [newComponentDepartments, setNewComponentDepartments] = useState<string[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<BomSelectionRow[]>([]);

  // Form Data
  const [formData, setFormData] = useState<{
    name: string, 
    customer_name: string, 
    drawing_no: string, 
    departments: string[]
  }>({ 
    name: '', customer_name: '', drawing_no: '', departments: [] 
  });
  const [itemRows, setItemRows] = useState<Array<{ name: string; drawing_no: string; drawing_file: File | null }>>([{ name: '', drawing_no: '', drawing_file: null }]);

  const involvingDepartments = useMemo(
    () => departments.filter(d => isInvolvingDepartment(d.name)),
    [departments]
  );
  const bomReferenceIndex = useMemo(() => buildBomReferenceIndex(data), [data]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [itemsRes, custRes, deptRes] = await Promise.all([
        loadCachedCollection<Item>('items', 'id'),
        loadCachedCollection<Customer>('customers'),
        loadCachedCollection<Department>('departments'),
      ]);
      setData([...itemsRes].sort((a, b) => Number(b.id) - Number(a.id)));
      setCustomers(custRes);
      setDepartments(deptRes);
    } catch (e) { onError(); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Fetch library components when modal opens
  const openComponentManager = async (item: Item) => {
    setSelectedItem(item);
    
    // 1. Load existing components for this item (from items.children JSONB)
    const existing = (item.children || []).map(toBomSelectionRow);
    setSelectedComponents(existing);

    // 2. Fetch all available components from Library (child_items table)
    const { data: libraryData } = await supabase.from('child_items').select('*');
    
    if (libraryData) {
      const distinct = libraryData.reduce((acc: any[], current) => {
        const x = acc.find(item => item.name === current.name);
        if (!x) {
          return acc.concat([current]);
        } else {
          return acc;
        }
      }, []);
      setAllLibraryComponents(distinct);
    }
    
    setComponentSearch('');
    setNewComponentNames('');
    setNewComponentDepartments(item.departments?.length ? item.departments : []);
    setIsChildModalOpen(true);
  };

  const handleDeptToggle = (name: string) => {
    setFormData(prev => ({
      ...prev,
      departments: prev.departments.includes(name) ? prev.departments.filter(d => d !== name) : [...prev.departments, name]
    }));
  };

  const resetItemForm = () => {
    setFormData({ name: '', customer_name: '', drawing_no: '', departments: [] });
    setItemRows([{ name: '', drawing_no: '', drawing_file: null }]);
  };

  const updateItemRow = (index: number, field: 'name' | 'drawing_no', value: string) => {
    setItemRows(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };

  const updateItemDrawingFile = (index: number, file: File | null) => {
    setItemRows(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, drawing_file: file } : row));
  };

  const addItemRow = () => {
    setItemRows(prev => [...prev, { name: '', drawing_no: '', drawing_file: null }]);
  };

  const removeItemRow = (index: number) => {
    setItemRows(prev => prev.length === 1 ? [{ name: '', drawing_no: '', drawing_file: null }] : prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const openEditItem = (item: Item) => {
    setEditingItem(item);
    setFormData({ name: item.name || '', customer_name: item.customer_name || '', drawing_no: item.drawing_no || '', departments: item.departments || [] });
    setItemRows([{ name: item.name || '', drawing_no: item.drawing_no || '', drawing_file: null }]);
    setIsModalOpen(true);
  };

  const updateItemReferencesInBoms = async (item: Item, nextData: { name: string; drawing_no: string; departments: string[] }) => {
    const parents = getBomParentReferences(data, 'item', item.id);
    for (const parent of parents) {
      const nextChildren = (parent.children || []).map((child: any) => (
        getBomChildType(child) === 'item' && String(child.id) === String(item.id)
          ? { ...child, name: nextData.name, drawing_no: nextData.drawing_no, departments: nextData.departments }
          : child
      ));
      await supabase.from('items').update({ children: nextChildren }).eq('id', parent.id);
    }
  };

  const filteredComponents = allLibraryComponents.filter(c => 
    c.name.toLowerCase().includes(componentSearch.toLowerCase()) ||
    (c.departments || []).some((d: string) => d.toLowerCase().includes(componentSearch.toLowerCase()))
  );

  const filteredBomItems = data.filter(item => {
    if (!selectedItem || item.id === selectedItem.id) return false;
    if (itemContainsItem(data, item.id, selectedItem.id)) return false;
    if (selectedComponents.some(component => component.type === 'item' && String(component.id) === String(item.id))) return false;

    const query = componentSearch.trim().toLowerCase();
    if (!query) return true;
    return item.name.toLowerCase().includes(query) ||
      (item.customer_name || '').toLowerCase().includes(query) ||
      (item.drawing_no || '').toLowerCase().includes(query) ||
      (item.departments || []).some((d: string) => d.toLowerCase().includes(query));
  });

  const availableBomRows = [
    ...filteredComponents.map(component => ({ kind: 'component' as const, row: component })),
    ...filteredBomItems.map(item => ({ kind: 'item' as const, row: item })),
  ];

  const addComponentToSelection = (component: any) => {
    const nextRow: BomSelectionRow = {
      id: component.id,
      type: 'component',
      name: component.name,
      qty: 1,
      departments: component.departments || []
    };
    if (!selectedComponents.find(c => isSameBomReference(c, nextRow))) {
      setSelectedComponents([...selectedComponents, {
        id: component.id,
        type: 'component',
        name: component.name,
        qty: 1,
        departments: component.departments || []
      }]);
    }
  };

  const addItemToSelection = (item: Item) => {
    if (!selectedItem) return;
    if (item.id === selectedItem.id || itemContainsItem(data, item.id, selectedItem.id)) {
      alert('This item cannot be added because it would create a circular BOM.');
      return;
    }

    const nextRow: BomSelectionRow = {
      id: item.id,
      type: 'item',
      name: item.name,
      qty: 1,
      departments: item.departments || [],
      drawing_no: item.drawing_no,
    };
    if (!selectedComponents.find(component => isSameBomReference(component, nextRow))) {
      setSelectedComponents(prev => [...prev, nextRow]);
    }
  };

  const addMissingComponentsFromSearch = async () => {
    const names = Array.from(new Set(newComponentNames
      .split(/[\n,;]+/)
      .map(name => name.trim())
      .filter(Boolean)
      .map(name => name.replace(/\s+/g, ' '))));

    if (names.length === 0) {
      alert('Type one or more component names first. Use comma or new line for bulk add.');
      return;
    }

    if (newComponentDepartments.length === 0) {
      alert('Please select at least one department for the new component(s).');
      return;
    }

    const existingKeys = new Set(allLibraryComponents.map(component => normalizeDuplicateKey(component.name || '')));
    const selectedKeys = new Set(selectedComponents.map(component => normalizeDuplicateKey(component.name || '')));
    const namesToCreate = names.filter(name => !existingKeys.has(normalizeDuplicateKey(name)));
    const existingToSelect = allLibraryComponents.filter(component => names.some(name => normalizeDuplicateKey(name) === normalizeDuplicateKey(component.name || '')));

    if (namesToCreate.length === 0 && existingToSelect.length === 0) {
      alert('All typed components are already selected or unavailable.');
      return;
    }

    setIsAddingComponents(true);
    try {
      const createdComponents: any[] = [];
      if (namesToCreate.length > 0) {
        const { data: createdRows, error } = await supabase.from('child_items').insert(namesToCreate.map(name => ({
          name,
          departments: newComponentDepartments,
          qty_per_master: 0,
          parent_item_id: null,
        })));

        if (error) {
          alert(`Failed to add components: ${error.message}`);
          return;
        }

        createdComponents.push(...((createdRows || []) as any[]));
      }

      const nextComponents = [...existingToSelect, ...createdComponents];
      setAllLibraryComponents(prev => [...prev, ...createdComponents]);
      setSelectedComponents(prev => {
        const next = [...prev];
        for (const component of nextComponents) {
          if (!selectedKeys.has(normalizeDuplicateKey(component.name || '')) && !next.find(row => normalizeDuplicateKey(row.name) === normalizeDuplicateKey(component.name || ''))) {
            next.push({ id: component.id, type: 'component', name: component.name, qty: 1, departments: component.departments || newComponentDepartments });
          }
        }
        return next;
      });
      setComponentSearch('');
      setNewComponentNames('');
    } finally {
      setIsAddingComponents(false);
    }
  };

  const updateComponentQty = (index: number, value: string) => {
    const updated = [...selectedComponents];
    updated[index].qty = value === '' ? '' : Math.max(1, Number(value));
    setSelectedComponents(updated);
  };

  const removeComponentFromSelection = (index: number) => {
    setSelectedComponents(selectedComponents.filter((_, i) => i !== index));
  };

  const toggleNewComponentDepartment = (deptName: string) => {
    setNewComponentDepartments(prev => prev.includes(deptName) ? prev.filter(name => name !== deptName) : [...prev, deptName]);
  };

  const saveComponentsToItem = async () => {
    if (!selectedItem) return;

    const componentsToSave = selectedComponents.map(toStoredBomChild);
    
    const { error } = await supabase
      .from('items')
      .update({ children: componentsToSave })
      .eq('id', selectedItem.id);
      
    if (error) {
      alert("Failed to save components: " + error.message);
    } else {
      setIsChildModalOpen(false);
      setSelectedComponents([]);
      invalidateCollectionCache('items');
      fetchData(); 
    }
  };

  const deleteItem = async (item: Item) => {
    const parentReferences = (bomReferenceIndex.itemParents.get(String(item.id)) || []).filter(parent => parent.id !== item.id);
    if (parentReferences.length > 0) {
      alertBomDeleteBlocked(item.name, parentReferences);
      return;
    }

    if (confirm("Delete Item?")) {
      await supabase.from('items').delete().eq('id', item.id);
      invalidateCollectionCache('items');
      fetchData();
    }
  };

  if (loading && data.length === 0) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black text-gray-800">Item Master</h2>
        <button onClick={() => { setEditingItem(null); resetItemForm(); setIsModalOpen(true); }} className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:bg-orange-700 transition-colors"><Plus size={18} /></button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(null); }} title={editingItem ? "Edit Item" : "New Item"}>
        <form onSubmit={async (e) => { 
          e.preventDefault(); 
          const customerKey = normalizeDuplicateKey(formData.customer_name);
          const validRows = itemRows
            .map(row => ({
              name: row.name.trim().replace(/\s+/g, ' '),
              drawing_no: row.drawing_no.trim(),
              drawing_file: row.drawing_file,
            }))
            .filter(row => row.name || row.drawing_no || row.drawing_file);

          if (validRows.length === 0) {
            alert('Please add at least one item row.');
            return;
          }

          const incompleteRows = validRows.filter(row => !row.name || !row.drawing_no);
          if (incompleteRows.length > 0) {
            alert('Each item row needs an item name and drawing number.');
            return;
          }

          if (formData.departments.length === 0) {
            alert('Please select at least one department for this item.');
            return;
          }

          const duplicateInForm = !editingItem && validRows.find((row, index) => validRows.findIndex(other => normalizeDuplicateKey(other.name) === normalizeDuplicateKey(row.name)) !== index);
          if (duplicateInForm) {
            alert(`Item "${duplicateInForm.name}" is repeated in this form.`);
            return;
          }

          const duplicateExisting = validRows.find(row => data.some(item =>
            normalizeDuplicateKey(item.name || '') === normalizeDuplicateKey(row.name) &&
            normalizeDuplicateKey(item.customer_name || '') === customerKey &&
            (!editingItem || Number(item.id) !== Number(editingItem.id))
          ));
          if (duplicateExisting) {
            alert(`Item "${duplicateExisting.name}" already exists for ${formData.customer_name}.`);
            return;
          }

          const rowsToInsert = validRows.map(row => ({
            name: row.name,
            customer_name: formData.customer_name,
            drawing_no: row.drawing_no,
            drawing_image_url: '',
            drawing_file: row.drawing_file || undefined,
            departments: formData.departments,
          }));
          const result = editingItem
            ? await supabase.from('items').update(rowsToInsert[0]).eq('id', editingItem.id)
            : await supabase.from('items').insert(rowsToInsert);
          const { error } = result; 
          if(error) alert(error.message);
          else {
            if (editingItem) await updateItemReferencesInBoms(editingItem, { name: rowsToInsert[0].name, drawing_no: rowsToInsert[0].drawing_no, departments: formData.departments });
            setIsModalOpen(false); 
            setEditingItem(null);
            resetItemForm();
            invalidateCollectionCache('items');
            fetchData(); 
          }
        }} className="space-y-4">
           <select required value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl">
              <option value="">Select Client</option>
              {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
           </select>
           <div className="space-y-3 rounded-2xl border border-orange-100 bg-orange-50/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-orange-600">Items</div>
                  <div className="text-[11px] font-semibold text-gray-400">Add item masters one by one in rows.</div>
                </div>
                {!editingItem && <button type="button" onClick={addItemRow} className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs font-black text-orange-700 hover:bg-orange-100"><Plus size={14} /> Add another item</button>}
              </div>
              <div className="space-y-2">
                {itemRows.map((row, index) => (
                  <div key={index} className="rounded-xl border border-orange-100 bg-white p-3 shadow-sm">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                      <span>Item {index + 1}</span>
                      {!editingItem && <button type="button" onClick={() => removeItemRow(index)} className="text-red-400 hover:text-red-600">Remove</button>}
                    </div>
                    <input required={index === 0} placeholder="Item Name / Assembly" value={row.name} onChange={e => updateItemRow(index, 'name', e.target.value)} className="mb-2 w-full px-4 py-3 bg-gray-50 border rounded-xl" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input required={index === 0} placeholder="Drawing No." value={row.drawing_no} onChange={e => updateItemRow(index, 'drawing_no', e.target.value)} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
                      <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-xl border bg-gray-50 px-4 py-3 text-sm font-bold text-gray-500 hover:bg-orange-50">
                        <span className="min-w-0 truncate">{row.drawing_file ? row.drawing_file.name : 'Upload drawing PDF/file'}</span>
                        <Upload size={16} className="flex-shrink-0 text-orange-600" />
                        <input type="file" accept="application/pdf,image/*" onChange={e => updateItemDrawingFile(index, e.target.files?.[0] || null)} className="hidden" />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Process Routing (Depts)</label>
              <div className="flex flex-wrap gap-2">
                {involvingDepartments.map(d => (
                  <button key={d.id} type="button" onClick={() => handleDeptToggle(d.name)} className={`px-2 py-1 text-[10px] font-black border rounded-lg transition-all ${formData.departments.includes(d.name) ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-50 text-gray-400'}`}>{d.name}</button>
                ))}
              </div>
           </div>
            <button type="submit" className="w-full py-4 bg-orange-600 text-white rounded-xl font-black shadow-lg">{editingItem ? 'Save Item' : 'Register Item Master'}</button>
        </form>
      </Modal>

      <Modal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} title="Drawing PDF Preview">
         {selectedItem?.drawing_image_url ? (
            <div className="flex flex-col items-center gap-4">
               <iframe src={selectedItem.drawing_image_url} title="Drawing PDF" className="w-full h-[70vh] rounded-xl border shadow-xl bg-white" />
               <a href={selectedItem.drawing_image_url} target="_blank" rel="noreferrer" className="text-xs font-black text-blue-600 hover:text-blue-700 uppercase tracking-wider">Open PDF in new tab</a>
               <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{selectedItem.name} ({selectedItem.drawing_no})</p>
            </div>
         ) : (
            <div className="p-20 text-center text-gray-300 italic">No drawing PDF link provided.</div>
         )}
      </Modal>

      <Modal isOpen={isChildModalOpen} onClose={() => setIsChildModalOpen(false)} title={`Components: ${selectedItem?.name}`} maxWidthClassName="max-w-6xl">
        <div className="grid h-[calc(90vh-150px)] min-h-0 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
            <h4 className="font-bold text-blue-800 mb-3 text-sm flex items-center gap-2">
               <Layers size={16}/> Selected Components ({selectedComponents.length})
            </h4>
            
            {selectedComponents.length > 0 ? (
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
                {selectedComponents.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-white border border-blue-100 rounded-xl shadow-sm">
                    <div className="flex-1">
                       <span className="font-bold text-gray-800 text-sm block">{item.name}</span>
                       <Badge color={item.type === 'item' ? 'indigo' : 'blue'}>{item.type === 'item' ? 'Item' : 'Component'}</Badge>
                       <div className="flex gap-1 mt-1">
                          {(item.departments || []).map((d: string) => (
                             <span key={d} className="text-[9px] text-gray-400 font-bold uppercase">{d}</span>
                          ))}
                       </div>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border">
                       <span className="text-[9px] font-black text-gray-400 pl-2">QTY</span>
                       <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={e => updateComponentQty(idx, e.target.value)}
                        onBlur={e => { if (!e.target.value) updateComponentQty(idx, '1'); }}
                        className="w-12 px-1 py-1 bg-white text-center font-bold border rounded outline-none text-sm"
                      />
                    </div>
                    <button
                      onClick={() => removeComponentFromSelection(idx)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
               <div className="text-center py-8 text-blue-300 text-sm font-medium">No components selected for this item.</div>
            )}
            <button
              onClick={saveComponentsToItem}
              className="w-full py-4 bg-green-600 text-white rounded-xl font-black shadow-lg hover:bg-green-700 transition-all flex justify-center items-center gap-2"
            >
              <Save size={18} /> Save BOM
            </button>
          </div>

          <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-hidden">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text"
                placeholder="Search library components..."
                value={componentSearch}
                onChange={e => {
                  const nextSearch = e.target.value;
                  setComponentSearch(nextSearch);
                  setNewComponentNames(prev => (!prev.trim() || prev === componentSearch) ? nextSearch : prev);
                }}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${componentSearch.trim() && filteredComponents.length === 0 ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] xl:gap-6' : ''}`}>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-[10px] font-black uppercase text-gray-400 tracking-widest">Available Components & Items</div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 space-y-1">
                  {availableBomRows.map(({ kind, row }) => (
                    <div key={`${kind}-${row.id}`} className="flex items-center justify-between p-3 border border-transparent hover:border-gray-200 hover:bg-gray-50 rounded-lg group transition-all">
                      <div className="flex-1">
                        <div className="font-bold text-gray-800 text-sm">{row.name}</div>
                        {kind === 'item' && <div className="text-[10px] font-semibold text-gray-400 truncate">{row.customer_name} {row.drawing_no ? `| ${row.drawing_no}` : ''}</div>}
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge color={kind === 'item' ? 'indigo' : 'blue'}>{kind === 'item' ? 'Item' : 'Component'}</Badge>
                          {(row.departments || []).map((d: string) => <Badge key={d} color="gray">{d}</Badge>)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => kind === 'item' ? addItemToSelection(row as Item) : addComponentToSelection(row)}
                        className={`p-2 text-white rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95 ${kind === 'item' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  ))}
                  {availableBomRows.length === 0 && (
                     <div className="p-6 text-center text-sm font-semibold text-gray-400">No matching components or items found.</div>
                   )}
                </div>
            </div>
            </div>

          {componentSearch.trim() && filteredComponents.length === 0 && (
            <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div>
                <div className="text-base font-black text-gray-800">New Standard Component</div>
                <div className="mt-1 text-xs font-semibold text-gray-400">Add one or many components to the library and this BOM.</div>
              </div>
              <div>
                <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Component name</label>
                <textarea
                  value={newComponentNames}
                  onChange={e => setNewComponentNames(e.target.value)}
                  placeholder="e.g., Foam Insert, Plastic Corner Guard"
                  className="h-20 w-full resize-none rounded-2xl border bg-gray-50 px-4 py-3 text-sm font-semibold outline-none transition-all focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-3 ml-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Related departments (select at least one)</label>
                <div className="flex flex-wrap gap-2">
                  {involvingDepartments.map(department => (
                    <button
                      key={department.id}
                      type="button"
                      onClick={() => toggleNewComponentDepartment(department.name)}
                      className={`rounded-xl border px-4 py-3 text-xs font-bold transition-all ${newComponentDepartments.includes(department.name) ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >
                      {department.name}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={addMissingComponentsFromSearch}
                disabled={!newComponentNames.trim() || isAddingComponents || newComponentDepartments.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-sm font-black text-white shadow-xl transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Plus size={16} /> {isAddingComponents ? 'Adding...' : 'Add to Library'}
              </button>
            </div>
          )}
          </div>
          </div>
        </div>
      </Modal>

      <Card className="p-0 overflow-hidden shadow-md">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Item Name</th>
                <th className="px-6 py-4 whitespace-nowrap">Customer</th>
                <th className="px-6 py-4 whitespace-nowrap">Drawing No</th>
                <th className="px-6 py-4 whitespace-nowrap">Depts</th>
                <th className="px-6 py-4 text-right whitespace-nowrap">Actions</th>
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
                    <button onClick={() => openComponentManager(c)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg relative group" title="Manage Components">
                        <Layers size={16}/>
                        {(c.children?.length || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-white">
                              {c.children?.length}
                          </span>
                        )}
                    </button>
                    <button onClick={() => openEditItem(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit Item"><Edit size={16}/></button>
                    {c.drawing_image_url && <button onClick={() => { setSelectedItem(c); setIsImageModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="View Drawing PDF"><FileText size={16}/></button>}
                    <button onClick={() => deleteItem(c)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">No items found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden p-2 space-y-2">
          {data.map(c => (
            <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-black text-indigo-700 text-sm leading-tight break-words">{c.name}</div>
                  <div className="text-[11px] font-semibold text-gray-500 mt-1 break-words">{c.customer_name}</div>
                </div>
                <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-600 whitespace-nowrap">
                  {c.drawing_no}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {c.departments && c.departments.length > 0 ? (
                  c.departments.map((d: string) => <Badge key={d} color="gray">{d}</Badge>)
                ) : (
                  <span className="text-[11px] font-semibold text-gray-400">No departments</span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                <button
                  onClick={() => openComponentManager(c)}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-50 px-2 py-2 text-[11px] font-black text-indigo-700"
                >
                  <Layers size={14} />
                  BOM
                  {(c.children?.length || 0) > 0 && (
                    <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[9px] text-white">{c.children?.length}</span>
                  )}
                </button>

                <button
                  onClick={() => openEditItem(c)}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-2 py-2 text-[11px] font-black text-blue-700"
                >
                  <Edit size={14} /> Edit
                </button>

                <button
                  onClick={() => {
                    if (c.drawing_image_url) {
                      setSelectedItem(c);
                      setIsImageModalOpen(true);
                    }
                  }}
                  disabled={!c.drawing_image_url}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-2 py-2 text-[11px] font-black text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FileText size={14} /> PDF
                </button>

                <button
                  onClick={async () => {
                    deleteItem(c);
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-red-50 px-2 py-2 text-[11px] font-black text-red-600"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}

          {data.length === 0 && (
            <div className="py-8 text-center text-gray-400 italic text-sm">No items found.</div>
          )}
        </div>
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
  const [editingComponent, setEditingComponent] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [componentNameRows, setComponentNameRows] = useState<Array<{ name: string; departments: string[] }>>([{ name: '', departments: [] }]);

  const involvingDepartments = useMemo(
    () => departments.filter(d => isInvolvingDepartment(d.name)),
    [departments]
  );
  const bomReferenceIndex = useMemo(() => buildBomReferenceIndex(items), [items]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [res, deptRes, itemRes] = await Promise.all([
        loadCachedCollection<any>('child_items'),
        loadCachedCollection<Department>('departments'),
        loadCachedCollection<Item>('items'),
      ]);
      setData(res);
      setDepartments(deptRes);
      setItems(itemRes);
    } catch (e) { onError(); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = componentNameRows
      .map(row => ({
        name: row.name.trim().replace(/\s+/g, ' '),
        departments: row.departments,
      }))
      .filter(row => row.name);

    if (validRows.length === 0) {
      alert('Please enter at least one component name.');
      return;
    }

    const missingDepartmentRow = validRows.find(row => row.departments.length === 0);
    if (missingDepartmentRow) {
      alert(`Please select at least one department for "${missingDepartmentRow.name}".`);
      return;
    }

    const repeatedRow = validRows.find((row, index) => validRows.findIndex(other => normalizeDuplicateKey(other.name) === normalizeDuplicateKey(row.name)) !== index);
    if (repeatedRow) {
      alert(`Component "${repeatedRow.name}" is repeated in this form.`);
      return;
    }

    const existingKeys = new Set(data.map(component => normalizeDuplicateKey(component.name || '')));
    const duplicateNames = validRows
      .filter(row => existingKeys.has(normalizeDuplicateKey(row.name)) && (!editingComponent || normalizeDuplicateKey(row.name) !== normalizeDuplicateKey(editingComponent.name || '')))
      .map(row => row.name);
    const rowsToCreate = editingComponent ? validRows : validRows.filter(row => !existingKeys.has(normalizeDuplicateKey(row.name)));

    if (duplicateNames.length > 0 && editingComponent) {
      alert(`Component already exists: ${duplicateNames.join(', ')}`);
      return;
    }

    if (rowsToCreate.length === 0) {
      alert(`All entered components already exist: ${duplicateNames.join(', ')}`);
      return;
    }
    
    const payloadRows = rowsToCreate.map(row => ({
      name: row.name,
      departments: row.departments,
      qty_per_master: 0,
      parent_item_id: null
    }));
    const result = editingComponent
      ? await supabase.from('child_items').update({ name: payloadRows[0].name, departments: payloadRows[0].departments }).eq('id', editingComponent.id)
      : await supabase.from('child_items').insert(payloadRows);
    const { error } = result;
    
    if (error) {
       console.error(error);
       alert("Error: " + error.message);
    } else {
       if (editingComponent) {
         const parentReferences = getBomParentReferences(items, 'component', editingComponent.id);
         for (const parent of parentReferences) {
           const nextChildren = (parent.children || []).map((child: any) => (
             getBomChildType(child) === 'component' && String(child.id) === String(editingComponent.id)
               ? { ...child, name: payloadRows[0].name, departments: payloadRows[0].departments }
               : child
           ));
           await supabase.from('items').update({ children: nextChildren }).eq('id', parent.id);
         }
       }
       if (duplicateNames.length > 0) alert(`Added ${rowsToCreate.length} component(s). Skipped duplicate(s): ${duplicateNames.join(', ')}`);
       setIsModalOpen(false);
       setEditingComponent(null);
       setComponentNameRows([{ name: '', departments: [] }]);
       invalidateCollectionCache('child_items');
       invalidateCollectionCache('items');
       fetchData();
    }
  };

  const updateComponentNameRow = (index: number, value: string) => {
    setComponentNameRows(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, name: value } : row));
  };

  const addComponentNameRow = () => {
    setComponentNameRows(prev => [...prev, { name: '', departments: [] }]);
  };

  const removeComponentNameRow = (index: number) => {
    setComponentNameRows(prev => prev.length === 1 ? [{ name: '', departments: [] }] : prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const toggleDepartment = (index: number, deptName: string) => {
     setComponentNameRows(prev => prev.map((row, rowIndex) => {
       if (rowIndex !== index) return row;
       return {
         ...row,
         departments: row.departments.includes(deptName)
           ? row.departments.filter(d => d !== deptName)
           : [...row.departments, deptName]
       };
     }));
  };

  const departmentOptions = useMemo(() => {
    const uniqueDepartments = new Set<string>();
    data.forEach(component => {
      (component.departments || []).forEach((dept: string) => uniqueDepartments.add(String(dept)));
    });
    return Array.from(uniqueDepartments).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredComponents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return data.filter(component => {
      const componentName = String(component.name || '').toLowerCase();
      const componentDepartments = (component.departments || []).map((dept: string) => String(dept));

      const matchesSearch =
        !query ||
        componentName.includes(query) ||
        componentDepartments.some((dept: string) => dept.toLowerCase().includes(query));

      const matchesDepartment =
        departmentFilter === 'All' || componentDepartments.includes(departmentFilter);

      return matchesSearch && matchesDepartment;
    });
  }, [data, searchQuery, departmentFilter]);

  const deleteComponent = async (component: any) => {
    const parentReferences = bomReferenceIndex.componentParents.get(String(component.id)) || [];
    if (parentReferences.length > 0) {
      alertBomDeleteBlocked(component.name, parentReferences);
      return;
    }

    if (confirm("Delete this component from library?")) {
      await supabase.from('child_items').delete().eq('id', component.id);
      invalidateCollectionCache('child_items');
      fetchData();
    }
  };

  const openEditComponent = (component: any) => {
    setEditingComponent(component);
    setComponentNameRows([{ name: component.name || '', departments: Array.isArray(component.departments) ? component.departments : [] }]);
    setIsModalOpen(true);
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-black text-gray-800 leading-tight">Component Library</h2>
          <p className="hidden sm:block text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Manage standard parts and sub-assemblies</p>
        </div>
        <button
          onClick={() => { setEditingComponent(null); setComponentNameRows([{ name: '', departments: [] }]); setIsModalOpen(true); }}
          aria-label="Add Component"
          title="Add Component"
          className="w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap text-xs sm:text-sm shrink-0"
        >
          <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
          <span className="hidden sm:inline">Add Component</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search components or departments..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        <select
          value={departmentFilter}
          onChange={e => setDepartmentFilter(e.target.value)}
          className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All Departments</option>
          {departmentOptions.map(dept => (
            <option key={dept} value={dept}>{dept.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingComponent(null); }} title={editingComponent ? "Edit Component" : "New Standard Component"}>
         <form onSubmit={handleSubmit} className="space-y-6">
             <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest ml-1">Component Name</label>
               <div className="space-y-2">
                  {componentNameRows.map((row, index) => (
                    <div key={index} className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <input
                          required={index === 0}
                          className="w-full px-4 py-4 rounded-2xl border bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          placeholder={index === 0 ? 'e.g., Foam Insert' : 'Another component name'}
                          value={row.name}
                          onChange={e => updateComponentNameRow(index, e.target.value)}
                        />
                        <button type="button" onClick={() => removeComponentNameRow(index)} className="p-3 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove component row">
                          <X size={18} />
                        </button>
                      </div>
                      <div className="mt-3">
                        <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Departments for this component</label>
                        <div className="flex flex-wrap gap-2">
                          {involvingDepartments.map(d => (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => toggleDepartment(index, d.name)}
                              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${row.departments.includes(d.name) ? 'bg-indigo-600 text-white shadow-lg border-indigo-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                            >
                              {d.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
               </div>
                {!editingComponent && <button type="button" onClick={addComponentNameRow} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">
                  <Plus size={14} /> Add another component
                </button>}
             </div>
            
            <button type="submit" disabled={!componentNameRows.some(row => row.name.trim()) || componentNameRows.some(row => row.name.trim() && row.departments.length === 0)} className="w-full py-5 bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-colors">
               {editingComponent ? 'Save Component' : 'Add to Library'}
            </button>
         </form>
      </Modal>

      <Card className="p-0 overflow-hidden shadow-md">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Component Name</th>
                <th className="px-6 py-4 whitespace-nowrap">Depts</th>
                <th className="px-6 py-4 text-center whitespace-nowrap w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredComponents.map(c => (
                <tr key={c.id} className="hover:bg-indigo-50/20 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-800">{c.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(c.departments || []).map((d: string) => <Badge key={d} color="gray">{d}</Badge>)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => openEditComponent(c)} 
                      className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                    >
                        <Edit size={16}/>
                    </button>
                    <button 
                      onClick={() => deleteComponent(c)} 
                      className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                        <Trash2 size={16}/>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredComponents.length === 0 && (
                <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic">
                      {data.length === 0 ? 'Library is empty. Add standard components to get started.' : 'No components match the current search/filter.'}
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden p-2 space-y-2">
          {filteredComponents.map(c => (
            <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-black text-gray-800 text-sm leading-tight break-words">{c.name}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(c.departments || []).length > 0 ? (
                      (c.departments || []).map((d: string) => <Badge key={d} color="gray">{d}</Badge>)
                    ) : (
                      <span className="text-[11px] font-semibold text-gray-400">No departments</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => openEditComponent(c)}
                  className="shrink-0 p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                  title="Edit component"
                  aria-label="Edit component"
                >
                  <Edit size={16} />
                </button>

                <button
                  onClick={async () => {
                    deleteComponent(c);
                  }}
                  className="shrink-0 p-2 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  title="Delete component"
                  aria-label="Delete component"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          {filteredComponents.length === 0 && (
            <div className="py-10 text-center text-gray-400 italic text-sm">
              {data.length === 0 ? 'Library is empty. Add standard components to get started.' : 'No components match the current search/filter.'}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

// --- Worker Dashboard ---

const WorkerDashboard: React.FC<{ onError: () => void; onView: (id: number) => void; loggedInUser: User }> = ({ onError, onView, loggedInUser }) => {
  const [data, setData] = useState<(WorkOrder & { itemInfo?: Item })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [woResult, itemRes] = await Promise.all([
          supabase.from('work_orders').select('*').order('id', { ascending: false }),
          loadCachedCollection<Item>('items'),
        ]);
        const { data: woRes, error: woErr } = woResult;

        if (woErr?.code === '42P01') { onError(); return; }

        if (woRes && itemRes) {
          const itemsByName = new Map(itemRes.map(item => [item.name, item]));
          const enriched = woRes.map(wo => {
            const departments = parseAssignedDepartments(wo.assigned_departments);
            return {
              ...wo,
              itemInfo: itemsByName.get(wo.job_details),
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
    const statusFiltered = statusFilter === 'All' ? data : data.filter(wo => wo.status === statusFilter);
    if (!deferredSearchQuery) return statusFiltered;
    const lowerCaseQuery = deferredSearchQuery.toLowerCase();
    return statusFiltered.filter(wo =>
      wo.id.toString().includes(lowerCaseQuery) ||
      wo.customer.toLowerCase().includes(lowerCaseQuery) ||
      wo.job_details.toLowerCase().includes(lowerCaseQuery)
    );
  }, [data, deferredSearchQuery, statusFilter]);

  const statusOptions = useMemo(() => {
    const uniqueStatuses = Array.from(new Set(data.map(wo => wo.status)));
    return sortStatuses(uniqueStatuses);
  }, [data]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, data.length]);

  const { pageRows: paginatedOrders, totalPages, safePage, totalRows, startIndex } = useMemo(
    () => getPageSlice(filteredOrders, page, LIST_PAGE_SIZE),
    [filteredOrders, page]
  );

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      <div className="rounded-[20px] bg-white p-3 sm:p-5 text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.12)] border border-slate-200 flex flex-col gap-1 sm:gap-2 mb-3 sm:mb-6">
        <div className="md:hidden text-[10px] font-black uppercase tracking-widest text-blue-700">Production Queue</div>
        <h1 className="text-lg md:text-2xl font-black text-slate-900 md:text-gray-800">{loggedInUser.department.replace(/_/g, ' ')} Dashboard</h1>
        <p className="hidden md:block text-slate-600 md:text-gray-500 text-sm">Manage your department's active work orders.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by order, customer, or job..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="w-full pl-12 pr-4 py-2.5 sm:py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="w-full px-4 py-2.5 sm:py-4 bg-white border border-gray-200 rounded-2xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All Statuses</option>
          {statusOptions.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
        {paginatedOrders.map(wo => (
          <div 
            key={wo.id} 
            onClick={() => onView(wo.id)}
            className="group bg-white rounded-2xl sm:rounded-xl border border-gray-100 p-3 sm:p-3 space-y-1.5 sm:space-y-2 shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] font-black text-indigo-600">#{wo.id}</span>
                  {wo.order_type === 'suborder' && <Badge color="purple" className="!text-[8px]">Suborder Of #{wo.parent_work_order_id || '-'}</Badge>}
                </div>
                <h3 className="text-xs font-black text-slate-800 leading-tight mt-0.5 line-clamp-1 md:line-clamp-2">{wo.job_details}</h3>
                <p className="hidden md:block text-[10px] font-bold text-gray-400 uppercase">{wo.customer}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={wo.status} />
                {getQCApprovalProgress(wo) === 'partial' && <Badge color="orange">Partially Approved</Badge>}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-bold text-gray-600">
              <span>QTY: <span className="text-slate-800">{wo.qty}</span></span>
              <span className="text-orange-600">ETD: {wo.etd || 'TBD'}</span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="hidden md:inline text-[9px] font-black text-gray-300 uppercase">DRW</span>
                <span className="text-[10px] font-bold text-slate-500 truncate md:hidden">{wo.customer}</span>
                <span className="hidden md:inline text-[10px] font-mono font-bold text-slate-500 truncate">{wo.drawing || wo.itemInfo?.drawing_no || 'TBD'}</span>
              </div>
              <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
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

      <PaginationBar
        page={safePage}
        totalPages={totalPages}
        totalRows={totalRows}
        startIndex={startIndex}
        pageRowsCount={paginatedOrders.length}
        onPageChange={setPage}
      />
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
  const [statusFilter, setStatusFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [page, setPage] = useState(1);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [viewMode, setViewMode] = useState<'table' | 'card'>(() => (
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'card' : 'table'
  ));

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewMode('card');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const normalizedUserDept = normalizeDepartment(loggedInUser.department);
  const isOfficeUser = normalizedUserDept === 'Office';
  const canFilterByDepartment = isOfficeUser || normalizedUserDept === 'Quality_Control' || normalizedUserDept === 'Dispatch';
  const involvingDepartments = useMemo(
    () => departments.filter(d => isInvolvingDepartment(d.name)),
    [departments]
  );
  
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
      const [woResult, itemRes, custRes, deptRes] = await Promise.all([
        supabase.from('work_orders').select('*').order('id', { ascending: false }),
        loadCachedCollection<Item>('items'),
        loadCachedCollection<Customer>('customers'),
        loadCachedCollection<Department>('departments'),
      ]);
      const { data: woRes, error: woErr } = woResult;
      
      if (woErr?.code === '42P01') { onError(); return; }
      
      if (woRes && itemRes) {
        const itemsByName = new Map(itemRes.map(item => [item.name, item]));
        const enriched = woRes.map(wo => {
          const departments = parseAssignedDepartments(wo.assigned_departments);
          return {
            ...wo,
            itemInfo: itemsByName.get(wo.job_details),
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

  const createSubordersForItem = async (params: {
    parentWorkOrderId: number;
    currentItem: Item;
    currentQty: number;
    rootItemName: string;
    customer: string;
    etd: string;
    visited?: Set<number>;
  }) => {
    const visited = params.visited || new Set<number>();
    if (visited.has(Number(params.currentItem.id))) return;
    visited.add(Number(params.currentItem.id));

    const itemChildren = (params.currentItem.children || []).filter((child: any) => getBomChildType(child) === 'item');

    await Promise.all(itemChildren.map(async (child: any) => {
      const childItem = items.find(item => Number(item.id) === Number(child.id));
      if (!childItem || visited.has(Number(childItem.id))) return;

      const childQtyPerParent = Math.max(1, Number(child.qtyPerMaster) || 1);
      const suborderQty = Math.max(1, Number(params.currentQty) || 1) * childQtyPerParent;
      const directDepartments = collectDirectWorkDepartments(childItem);
      const assignedDepartments = directDepartments.length > 0 ? directDepartments : collectItemBomDepartments(items, childItem);

      if (assignedDepartments.length === 0) return;

      const { data: insertedSuborder, error: suborderError } = await supabase
        .from('work_orders')
        .insert([{
          order_type: 'suborder',
          parent_work_order_id: params.parentWorkOrderId,
          parent_item_name: params.rootItemName,
          source_item_id: childItem.id,
          source_child_qty: childQtyPerParent,
          customer: params.customer,
          job_details: childItem.name,
          drawing: childItem.drawing_no || '',
          qty: suborderQty,
          etd: params.etd,
          status: 'Not Started',
          assigned_departments: assignedDepartments,
          department_statuses: makeDepartmentStatuses(assignedDepartments, loggedInUser.username),
        }])
        .select('id, job_details, assigned_departments')
        .single();

      if (suborderError) {
        alert(`Parent order was created, but suborder for ${childItem.name} failed: ${suborderError.message}`);
        return;
      }

      if (insertedSuborder) {
        invalidateCollectionCache('work_orders');
        void Promise.all(assignedDepartments.map(dept => sendBackgroundPushEvent({
            title: 'New Suborder Assigned',
            body: `Parent WO #${params.parentWorkOrderId} | Suborder #${insertedSuborder.id} | ${dept.replace(/_/g, ' ')}\n${childItem.name}`.trim(),
            departments: [dept],
            workOrderId: insertedSuborder.id,
            actor: loggedInUser.username,
          }))).catch(error => console.error('Suborder notification failed:', error));

        await createSubordersForItem({
          ...params,
          parentWorkOrderId: insertedSuborder.id,
          currentItem: childItem,
          currentQty: suborderQty,
          visited: new Set(visited),
        });
      }
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedOrderItem = items.find(item => (
        item.name === formData.job_details &&
        item.customer_name?.trim().toLowerCase() === formData.customer.trim().toLowerCase()
      ));
      const directOrderDepartments = collectDirectWorkDepartments(selectedOrderItem);
      const autoAssignedDepartments = directOrderDepartments.length > 0 ? directOrderDepartments : collectItemBomDepartments(items, selectedOrderItem);
      const sanitizedAssignedDepartments: string[] = [
        ...new Set(
          ([...formData.assigned_departments, ...autoAssignedDepartments] as string[])
            .map((d: string) => normalizeDepartment(d))
            .filter((d: string) => isInvolvingDepartment(d))
        )
      ];

      if (sanitizedAssignedDepartments.length === 0) {
        alert('Please select at least one involving department.');
        setLoading(false);
        return;
      }

      const initialStatuses = makeDepartmentStatuses(sanitizedAssignedDepartments, loggedInUser.username);

      const woData = {
        ...formData,
        order_type: 'parent',
        parent_work_order_id: null,
        parent_item_name: '',
        source_item_id: selectedOrderItem?.id,
        source_child_qty: 1,
        assigned_departments: sanitizedAssignedDepartments,
        department_statuses: initialStatuses
      };

      const { data: insertedOrder, error } = await supabase
        .from('work_orders')
        .insert([woData])
        .select('id, job_details, assigned_departments')
        .single();
      
      if (error) {
        alert(error.message);
      } else {
        invalidateCollectionCache('work_orders');
        if (insertedOrder && sanitizedAssignedDepartments.length > 0) {
            sendNotification('New Work Order', `Work Order: ${formData.job_details}`, sanitizedAssignedDepartments);
            void Promise.all(sanitizedAssignedDepartments.map(dept => sendBackgroundPushEvent({
                title: 'New Work Assigned',
                body: `Order #${insertedOrder.id} | ${dept.replace(/_/g, ' ')}\n${formData.job_details}`.trim(),
                departments: [dept],
                workOrderId: insertedOrder.id,
                actor: loggedInUser.username,
              }))).catch(error => console.error('Work order notification failed:', error));

            if (selectedOrderItem) {
              await createSubordersForItem({
                parentWorkOrderId: insertedOrder.id,
                currentItem: selectedOrderItem,
                currentQty: Number(formData.qty) || 1,
                rootItemName: selectedOrderItem.name,
                customer: formData.customer,
                etd: formData.etd,
              });
            }
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
    const statusFiltered = statusFilter === 'All' ? data : data.filter(wo => wo.status === statusFilter);

    const departmentFiltered = canFilterByDepartment && departmentFilter !== 'All'
      ? statusFiltered.filter(wo => (wo.assigned_departments || []).some(dept => normalizeDepartment(dept) === normalizeDepartment(departmentFilter)))
      : statusFiltered;

    if (!deferredSearchQuery) return departmentFiltered;
    const lowerCaseQuery = deferredSearchQuery.toLowerCase();
    return departmentFiltered.filter(wo =>
      wo.id.toString().includes(lowerCaseQuery) ||
      wo.customer.toLowerCase().includes(lowerCaseQuery) ||
      wo.job_details.toLowerCase().includes(lowerCaseQuery) ||
      (wo.drawing || '').toLowerCase().includes(lowerCaseQuery)
    );
  }, [data, deferredSearchQuery, statusFilter, departmentFilter, canFilterByDepartment]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, departmentFilter, data.length]);

  const { pageRows: paginatedOrders, totalPages, safePage, totalRows, startIndex } = useMemo(
    () => getPageSlice(filteredOrders, page, LIST_PAGE_SIZE),
    [filteredOrders, page]
  );

  const statusOptions = useMemo(() => {
    if (isOfficeUser) {
      return STATUS_FILTER_ORDER;
    }

    const uniqueStatuses = Array.from(new Set(data.map(wo => wo.status)));
    return sortStatuses(uniqueStatuses);
  }, [data, isOfficeUser]);

  const departmentOptions = useMemo(() => {
    const departmentsFromOrders = data.flatMap(wo => wo.assigned_departments || []);
    return Array.from(new Set(departmentsFromOrders)).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const customerFilteredItems = useMemo(() => {
    const selectedCustomer = formData.customer.trim().toLowerCase();
    if (!selectedCustomer) return [] as Item[];

    return items.filter(item => item.customer_name?.trim().toLowerCase() === selectedCustomer);
  }, [items, formData.customer]);

  useEffect(() => {
    if (!formData.job_details) return;

    const selectedStillValid = customerFilteredItems.some(item => item.name === formData.job_details);
    if (selectedStillValid) return;

    setFormData(prev => ({
      ...prev,
      job_details: '',
      drawing: '',
      assigned_departments: [],
    }));
  }, [customerFilteredItems, formData.job_details]);

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      <div className="sticky top-16 md:top-0 z-20 bg-white/95 md:bg-gray-50/95 backdrop-blur px-3 md:px-1 py-3 md:py-2 rounded-3xl md:rounded-xl border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4 shadow-sm md:shadow-none">
        <div className="flex items-center justify-between w-full md:w-auto gap-2">
          <div>
            <div className="md:hidden text-[10px] font-black uppercase tracking-widest text-blue-600">Factory Queue</div>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight">Work Orders</h2>
          </div>
          <Badge color="blue" className="md:hidden">{totalRows} Total</Badge>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
            {/* View Toggle */}
            <div className="hidden sm:flex bg-white rounded-xl p-1 border border-gray-200 shadow-sm">
                <button 
                    onClick={() => setViewMode('table')} 
                    className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                    title="List View"
                >
                    <List size={20} />
                </button>
                <button 
                    onClick={() => setViewMode('card')} 
                    className={`p-2 rounded-lg transition-all ${viewMode === 'card' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                    title="Card View"
                >
                    <LayoutGrid size={20} />
                </button>
            </div>

            <div className="relative flex-1 min-w-0 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search order, customer, job, drawing..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
              />
            </div>

            {isOfficeUser && (
              <button
                onClick={() => setIsModalOpen(true)}
                aria-label="New Order"
                title="New Order"
                className="w-11 h-11 sm:w-auto sm:h-auto bg-blue-600 text-white sm:px-6 sm:py-2.5 rounded-2xl sm:rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 hover:scale-105 hover:bg-blue-500 transition-all"
              >
                <Plus size={20} />
                <span className="hidden sm:inline">New Order</span>
              </button>
            )}
        </div>
      </div>

      <div className="mb-3 sm:mb-6">
        <details className="md:hidden rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <summary className="list-none cursor-pointer flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span>Filters</span>
            <span className="text-blue-600">{statusFilter !== 'All' || departmentFilter !== 'All' ? 'Active' : 'Open'}</span>
          </summary>
          <div className="mt-2 grid gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full min-w-0 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              {statusOptions.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            {canFilterByDepartment && (
              <select
                value={departmentFilter}
                onChange={e => setDepartmentFilter(e.target.value)}
                className="w-full min-w-0 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All">All Departments</option>
                {departmentOptions.map(dept => (
                  <option key={dept} value={dept}>{dept.replace(/_/g, ' ')}</option>
                ))}
              </select>
            )}
          </div>
        </details>

        <div className={`hidden md:grid gap-2 ${canFilterByDepartment ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full min-w-0 px-3 sm:px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Statuses</option>
            {statusOptions.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          {canFilterByDepartment && (
            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              className="w-full min-w-0 px-3 sm:px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Departments</option>
              {departmentOptions.map(dept => (
                <option key={dept} value={dept}>{dept.replace(/_/g, ' ')}</option>
              ))}
            </select>
          )}
        </div>
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
                const itm = customerFilteredItems.find(i => i.name === e.target.value);
                setFormData({
                  ...formData, 
                  job_details: e.target.value, 
                  drawing: itm?.drawing_no || '', 
                  assigned_departments: collectDirectWorkDepartments(itm).length > 0 ? collectDirectWorkDepartments(itm) : collectItemBomDepartments(items, itm)
                });
              }} disabled={!formData.customer} className="w-full px-4 py-3 bg-gray-50 border rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                 <option value="">{formData.customer ? 'Select Item Master' : 'Select Customer First'}</option>
                 {customerFilteredItems.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
              </select>
            </div>
           
           <div>
             <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Involved Departments</label>
             <div className="mb-2 text-[10px] font-semibold text-gray-400">Auto-selected from parent item and nested item BOM. You can add extra departments if needed.</div>
             <div className="flex flex-wrap gap-2">
                {involvingDepartments.map(d => (
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

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <Modal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} title="Drawing PDF Preview">
         <div className="flex flex-col items-center">
            {selectedImageUrl ? (
               <div className="w-full space-y-3">
                 <iframe src={selectedImageUrl} title="Drawing PDF" className="w-full h-[55vh] sm:h-[70vh] rounded-xl border shadow-xl bg-white" />
                 <div className="flex justify-center">
                   <a href={selectedImageUrl} target="_blank" rel="noreferrer" className="text-xs font-black text-blue-600 hover:text-blue-700 uppercase tracking-wider">Open PDF in new tab</a>
                 </div>
               </div>
            ) : (
               <p className="text-gray-400 italic py-10">No drawing PDF available.</p>
            )}
         </div>
      </Modal>

      {viewMode === 'table' ? (
        <Card className="hidden md:block p-0 overflow-x-auto shadow-md border border-gray-100">
                <table className="w-full min-w-[1550px] text-left text-sm">
                    <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-2 whitespace-nowrap">Order #</th>
                            <th className="px-4 py-2 whitespace-nowrap">Customer</th>
                            <th className="px-4 py-2 whitespace-nowrap">Job Details</th>
                            <th className="px-4 py-2 whitespace-nowrap">Drawing</th>
                            <th className="px-4 py-2 whitespace-nowrap">Qty</th>
                            <th className="px-4 py-2 whitespace-nowrap">ETD</th>
                            <th className="px-4 py-2 whitespace-nowrap">Status</th>
                            <th className="px-4 py-2 whitespace-nowrap">Depts</th>
                            <th className="px-4 py-2 text-right whitespace-nowrap">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {paginatedOrders.map(wo => (
                            <tr 
                                key={wo.id} 
                                onClick={() => onView(wo.id)} 
                                className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                            >
                                <td className="px-4 py-2 font-black text-indigo-600 text-xs whitespace-nowrap">
                                  <div>#{wo.id}</div>
                                  {wo.order_type === 'suborder' && <Badge color="purple" className="!text-[8px]">Suborder Of #{wo.parent_work_order_id || '-'}</Badge>}
                                </td>
                                <td className="px-4 py-2 font-bold text-gray-700 text-xs whitespace-nowrap">{wo.customer}</td>
                                <td className="px-4 py-2 font-medium text-gray-800 text-xs whitespace-nowrap">
                                  <div>{wo.job_details}</div>
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs text-gray-500 font-bold">{wo.drawing || wo.itemInfo?.drawing_no || 'TBD'}</span>
                                        {wo.itemInfo?.drawing_image_url && (
                                                <button 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setSelectedImageUrl(wo.itemInfo!.drawing_image_url!); 
                                                        setIsImageModalOpen(true); 
                                                    }}
                                                    className="text-blue-400 hover:text-blue-600 transition-colors"
                                                    title="View Drawing PDF"
                                                >
                                                    <FileText size={14} />
                                                </button>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-2 font-bold text-xs whitespace-nowrap">{wo.qty}</td>
                                <td className="px-4 py-2 text-xs font-bold text-orange-600 whitespace-nowrap">{wo.etd || 'TBD'}</td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <StatusBadge status={wo.status} />
                                    {getQCApprovalProgress(wo) === 'partial' && <Badge color="orange">Partially Approved</Badge>}
                                  </div>
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                    <div className="flex flex-nowrap gap-1">
                                        {(wo.assigned_departments || []).map(d => <Badge key={d} color="indigo" className="!text-[9px]">{d.replace(/_/g, ' ')}</Badge>)}
                                    </div>
                                </td>
                                <td className="px-4 py-2 text-right whitespace-nowrap">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onView(wo.id); }}
                                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                        title="View Details"
                                    >
                                        <Eye size={16}/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            {filteredOrders.length === 0 && <div className="p-12 text-center text-gray-400 italic">No matching work orders found.</div>}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 md:gap-3">
            {paginatedOrders.map(wo => (
            <div 
                key={wo.id} 
                className="group bg-white rounded-2xl md:rounded-xl border border-gray-100 p-3 md:p-3 space-y-1.5 md:space-y-2 shadow-sm hover:shadow-md hover:border-blue-100 transition-all active:scale-[0.99]"
            >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] font-black text-indigo-600">#{wo.id}</span>
                      {wo.order_type === 'suborder' && <Badge color="purple" className="!text-[8px]">Suborder Of #{wo.parent_work_order_id || '-'}</Badge>}
                    </div>
                    <h3 className="text-xs font-black text-slate-800 leading-tight mt-0.5 line-clamp-1 md:line-clamp-2">{wo.job_details}</h3>
                    <p className="hidden md:block text-[10px] font-bold text-gray-400 uppercase">{wo.customer}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={wo.status} />
                    {getQCApprovalProgress(wo) === 'partial' && <Badge color="orange">Partially Approved</Badge>}
                  </div>
                </div>

                <div className="hidden md:flex flex-wrap gap-1">
                  {(wo.assigned_departments || []).slice(0, 3).map(d => (
                    <Badge key={d} color="indigo" className="!text-[8px]">{d.replace(/_/g, ' ')}</Badge>
                  ))}
                  {(wo.assigned_departments || []).length > 3 && (
                    <Badge color="gray" className="!text-[8px]">+{(wo.assigned_departments || []).length - 3}</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold text-gray-600">
                  <span>QTY: <span className="text-slate-800">{wo.qty}</span></span>
                  <span className="text-orange-600">ETD: {wo.etd || 'TBD'}</span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[9px] font-black text-gray-300 uppercase md:inline hidden">DRW</span>
                    <span className="text-[10px] font-bold text-slate-500 truncate md:hidden">{wo.customer}</span>
                    <span className="hidden md:inline text-[10px] font-mono font-bold text-slate-500 truncate">{wo.drawing || wo.itemInfo?.drawing_no || 'TBD'}</span>
                    {wo.itemInfo?.drawing_image_url && (
                      <button
                        onClick={() => { setSelectedImageUrl(wo.itemInfo!.drawing_image_url!); setIsImageModalOpen(true); }}
                        className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center text-blue-500"
                        title="View Drawing PDF"
                      >
                        <FileText size={12} />
                      </button>
                    )}
                  </div>
                  <button 
                    onClick={() => onView(wo.id)} 
                    className="p-1.5 bg-gray-50 rounded-md text-gray-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition-all"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
            </div>
            ))}
            {filteredOrders.length === 0 && <div className="p-10 md:p-20 text-center text-gray-300 italic">No matching work orders found.</div>}
        </div>
      )}

      <PaginationBar
        page={safePage}
        totalPages={totalPages}
        totalRows={totalRows}
        startIndex={startIndex}
        pageRowsCount={paginatedOrders.length}
        onPageChange={setPage}
      />
    </div>
  );
};

// --- Work Order Details ---

const WODetails: React.FC<{ id: number; onBack: () => void; loggedInUser: User }> = ({ id, onBack, loggedInUser }) => {
  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusActionKey, setStatusActionKey] = useState<string | null>(null);

  const fetchWO = useCallback(async () => {
    const { data } = await supabase.from('work_orders').select('*').eq('id', id).single();
    if (data) {
      const departments = parseAssignedDepartments(data.assigned_departments);
      
      // Access Control
      const normUserDept = normalizeDepartment(loggedInUser.department);
      const qcApprovalProgress = getQCApprovalProgress({ ...data, assigned_departments: departments });
      const isOfficeOrDispatch = normUserDept === 'Office' || normUserDept === 'Dispatch';
      const isQC = normUserDept === 'Quality_Control';
      const isAssigned = departments.some(d => normalizeDepartment(d) === normUserDept);
      const isRestrictedByFullQCApproval = qcApprovalProgress === 'full' && (isQC || isAssigned);

      if (isOfficeOrDispatch || (!isRestrictedByFullQCApproval && (isQC || isAssigned))) {
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
    if (isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    setStatusActionKey(`overall-${newStatus}`);
    try {
      const { error } = await supabase.from('work_orders').update({ status: newStatus }).eq('id', id);
      if (!error && wo) setWo({ ...wo, status: newStatus });
      if (error) alert('Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
      setStatusActionKey(null);
    }
  };

  if (loading) return <LoadingState />;
  if (!wo) return <div className="p-20 text-center font-black text-red-500">Order not found or you do not have permission to view it.</div>;

  const normUserDept = normalizeDepartment(loggedInUser.department);
  const isOffice = normUserDept === 'Office';

  const allowedStatuses: WOStatus[] = ['Not Started', 'Work Started', 'Ready for QC', 'Ready for despatch', 'Cancelled'];

  return (
    <div className="space-y-3 sm:space-y-4 max-[375px]:space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
      <button onClick={onBack} className="flex items-center gap-2 max-[375px]:gap-1.5 text-[10px] max-[375px]:text-[9px] font-black text-slate-300 md:text-gray-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">
        <ChevronLeft size={16}/> Back
      </button>
       
      <div className="flex flex-col xl:flex-row gap-4 max-[375px]:gap-3">
        <div className="flex-1 space-y-4">
          <Card className="p-3 md:p-5 max-[375px]:p-3 border-t-0 md:border-t-4 md:border-t-indigo-600 rounded-3xl md:rounded-xl overflow-hidden relative">
             <div className="md:hidden absolute inset-x-0 top-0 h-1.5 bg-blue-600" />
             <div className="flex flex-col md:flex-row justify-between items-start mb-3 md:mb-5 max-[375px]:mb-3 gap-2 md:gap-3 max-[375px]:gap-2">
                 <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-indigo-50 text-indigo-600 px-3 max-[375px]:px-2 py-1 rounded-full md:rounded-lg text-[10px] max-[375px]:text-[9px] font-black tracking-widest border border-indigo-100">ORDER-#{wo.id}</span>
                      {wo.order_type === 'suborder' && <Badge color="purple">Suborder Of #{wo.parent_work_order_id || '-'}</Badge>}
                    </div>
                    <h1 className="text-lg md:text-2xl max-[375px]:text-base font-black text-gray-800 mt-2 mb-1 break-words leading-tight line-clamp-2">{wo.job_details}</h1>
                    {wo.parent_work_order_id && <p className="text-[10px] font-black text-purple-500 uppercase tracking-wider">Parent Item: {wo.parent_item_name || 'Parent Item'}</p>}
                    <p className="text-xs md:text-base max-[375px]:text-[11px] font-bold text-gray-400 uppercase tracking-tight">{wo.customer}</p>
                 </div>
                 <StatusBadge status={wo.status} />
              </div>
               
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 max-[375px]:gap-2 py-2 md:py-4 border-y border-gray-100">
                 <div className="rounded-2xl bg-gray-50 p-2.5 md:bg-transparent md:p-0 md:rounded-none">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Batch Size</label>
                    <p className="text-base md:text-xl max-[375px]:text-base font-black text-indigo-600">{wo.qty} <span className="text-[10px] text-gray-400 font-bold">PCS</span></p>
                 </div>
                 <div className="rounded-2xl bg-orange-50 p-2.5 md:bg-transparent md:p-0 md:rounded-none">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1">Delivery ETD</label>
                    <p className="text-xs font-black text-orange-600 flex items-center gap-1"><Clock size={12}/> {wo.etd || 'N/A'}</p>
                 </div>
                 <div className="hidden md:block col-span-2 lg:col-span-1 rounded-2xl bg-gray-50 p-3 md:bg-transparent md:p-0 md:rounded-none">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1">Blueprint Ref</label>
                    <p className="text-xs font-mono font-bold bg-gray-50 px-2 py-1 rounded inline-block break-all">{wo.drawing || 'NO DRAWING'}</p>
                 </div>
                 <div className="hidden md:block col-span-2 lg:col-span-1 rounded-2xl bg-emerald-50 p-3 md:bg-transparent md:p-0 md:rounded-none">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest block mb-1">QC/Ready Date</label>
                    <p className="text-xs font-black text-green-600">{wo.ready_date || 'IN PROGRESS'}</p>
                </div>
             </div>

             <div className="mt-4 max-[375px]:mt-3">
                 <DepartmentStatusTracker
                   workOrderId={wo.id}
                   assignedDepartments={wo.assigned_departments || []}
                   departmentStatuses={wo.department_statuses || []}
                   loggedInUser={loggedInUser}
                   isBusy={isUpdatingStatus}
                   busyDepartmentKey={statusActionKey?.startsWith('dept-') ? statusActionKey.replace('dept-', '') : null}
                   onStatusUpdate={async (department, status, qcStatus) => {
                     if (isUpdatingStatus) return;
                     try {
                       setIsUpdatingStatus(true);
                       setStatusActionKey(`dept-${normalizeDepartment(department)}`);
                       const existingStatuses = wo.department_statuses || [];
                      const previousDeptStatus = existingStatuses.find(ds => normalizeDepartment(ds.department) === normalizeDepartment(department));
                      const previousStatus = previousDeptStatus?.status;
                      const previousQCStatus = previousDeptStatus?.qc_status;
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
                      const wasAllApproved = allDepartments.length > 0 && allDepartments.every(dept => {
                          const ds = existingStatuses.find(s => normalizeDepartment(s.department) === normalizeDepartment(dept));
                          return ds?.qc_status === 'QC Approved';
                      });
                      const allApproved = allDepartments.length > 0 && allDepartments.every(dept => {
                          const ds = updatedStatuses.find(s => normalizeDepartment(s.department) === normalizeDepartment(dept));
                          return ds?.qc_status === 'QC Approved';
                      });

                      const newOverallStatus = allApproved ? 'QC Approved' : wo.status;
                      const optimisticWo = { ...wo, department_statuses: updatedStatuses, status: newOverallStatus };
                      setWo(optimisticWo);
                      
                      const { error } = await supabase.from('work_orders').update({ department_statuses: updatedStatuses, status: newOverallStatus }).eq('id', wo.id);
                      if (error) throw error;
                      invalidateCollectionCache('work_orders');

                      const notificationTasks: Promise<any>[] = [];

                      if (status === 'Work Started' && previousStatus !== 'Work Started') {
                        notificationTasks.push(sendBackgroundPushEvent({
                          title: 'Work Started',
                          body: `Order #${wo.id} | ${department.replace(/_/g, ' ')}\nProduction has started`,
                          departments: ['Office'],
                          workOrderId: wo.id,
                          actor: loggedInUser.username,
                        }));
                      }

                      if (status === 'Ready for QC' && previousStatus !== 'Ready for QC') {
                        notificationTasks.push(sendBackgroundPushEvent({
                          title: 'QC Check Required',
                          body: `Order #${wo.id} | ${department.replace(/_/g, ' ')}\nReady for quality approval`,
                          departments: ['Quality_Control'],
                          workOrderId: wo.id,
                          actor: loggedInUser.username,
                        }));
                      }

                      if ((qcStatus === 'QC Approved' || qcStatus === 'QC Denied') && previousQCStatus !== qcStatus) {
                        notificationTasks.push(sendBackgroundPushEvent({
                          title: qcStatus,
                          body: `Order #${wo.id} | ${department.replace(/_/g, ' ')}\n${qcStatus}`,
                          departments: [department],
                          workOrderId: wo.id,
                          actor: loggedInUser.username,
                        }));
                      }

                      if (!wasAllApproved && allApproved && newOverallStatus === 'QC Approved') {
                        notificationTasks.push(sendBackgroundPushEvent({
                          title: 'Dispatch Ready',
                          body: `Order #${wo.id}\nQC approved. Ready for dispatch`,
                          departments: ['Dispatch'],
                          workOrderId: wo.id,
                          actor: loggedInUser.username,
                        }));
                      }

                      if (notificationTasks.length > 0) {
                        void Promise.all(notificationTasks).catch(error => {
                          console.error('Status notification failed:', error);
                        });
                      }
                     } catch (err) {
                       console.error('Status update failed:', err);
                       setWo(wo);
                       alert('Failed to update status');
                     } finally {
                       setIsUpdatingStatus(false);
                       setStatusActionKey(null);
                     }
                   }}
                 />
             </div>
          </Card>

          {isOffice && (
            <>
              <Card className="hidden md:block p-5 max-[375px]:p-3.5">
                 <h3 className="font-black text-gray-800 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                    <RefreshCw size={18} className="text-indigo-600"/> Force Update Status (Office Only)
                 </h3>
                 <div className="flex flex-wrap gap-2">
                    {allowedStatuses.map(s => (
                     <button 
                        key={s} 
                        onClick={() => updateStatus(s)}
                        disabled={isUpdatingStatus}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all disabled:opacity-50 ${wo.status === s ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                      >
                        {statusActionKey === `overall-${s}` ? 'UPDATING...' : s.toUpperCase()}
                      </button>
                    ))}
                  </div>
              </Card>

              <details className="md:hidden bg-white border border-gray-200 rounded-2xl p-3">
                <summary className="list-none cursor-pointer flex items-center justify-between text-xs font-black uppercase tracking-widest text-gray-600">
                  <span>Force Update Status</span>
                  <span className="text-indigo-600">Open</span>
                </summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  {allowedStatuses.map(s => (
                    <button
                      key={s}
                      onClick={() => updateStatus(s)}
                      disabled={isUpdatingStatus}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black transition-all disabled:opacity-50 ${wo.status === s ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-500'}`}
                    >
                      {statusActionKey === `overall-${s}` ? 'UPDATING...' : s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </details>
            </>
          )}
        </div>

        <div className="w-full xl:w-72 space-y-4 max-[375px]:space-y-3">
           <Card className="hidden xl:block bg-slate-900 text-white p-5 border-0 shadow-xl">
              <h3 className="font-black text-base mb-3 flex items-center gap-2 text-blue-400">Controls</h3>
              <div className="space-y-2">
                 <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-2 border border-white/5">
                    <Printer size={18}/> PRINT JOB CARD
                 </button>
                 {isOffice && (
                   <button onClick={async () => { if(confirm("Delete Order?")) { await supabase.from('work_orders').delete().eq('id', id); onBack(); } }} className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-2 border border-red-500/20 mt-2">
                      <Trash2 size={18}/> DELETE ORDER
                   </button>
                 )}
              </div>
           </Card>

           <details className="xl:hidden bg-slate-900 text-white rounded-2xl p-4 border border-slate-700">
             <summary className="list-none cursor-pointer flex items-center justify-between text-xs font-black uppercase tracking-widest text-blue-300">
               <span>Quick Controls</span>
               <span>Open</span>
             </summary>
             <div className="mt-3 space-y-3">
               <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-3 border border-white/10">
                 <Printer size={16}/> PRINT JOB CARD
               </button>
               {isOffice && (
                 <button onClick={async () => { if(confirm("Delete Order?")) { await supabase.from('work_orders').delete().eq('id', id); onBack(); } }} className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-3 border border-red-500/20">
                   <Trash2 size={16}/> DELETE ORDER
                 </button>
               )}
             </div>
           </details>
        </div>
      </div>
    </div>
  );
};

// --- Custom BOM Planning ---

const CustomBOMPlanView: React.FC<{ onError: () => void }> = ({ onError }) => {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allComponents, setAllComponents] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  const [selectedCompany, setSelectedCompany] = useState('');
  const [planName, setPlanName] = useState('');
  const [planItems, setPlanItems] = useState<CustomPlanItem[]>([]);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);

  const [componentPicker, setComponentPicker] = useState<Record<string, string>>({});
  const [newComponent, setNewComponent] = useState({ name: '', departments: [] as string[] });
  const [isComponentModalOpen, setIsComponentModalOpen] = useState(false);
  const [selectedSavedPlanId, setSelectedSavedPlanId] = useState<number | null>(null);
  const [bomMode, setBomMode] = useState<'unsaved' | 'saved'>('unsaved');
  const [bomSearchQuery, setBomSearchQuery] = useState('');
  const [bomCompanyFilter, setBomCompanyFilter] = useState('All');
  const [componentItem, setComponentItem] = useState<Item | null>(null);
  const [componentSearchQuery, setComponentSearchQuery] = useState('');
  const [bomNewComponentNames, setBomNewComponentNames] = useState('');
  const [bomNewComponentDepartments, setBomNewComponentDepartments] = useState<string[]>([]);
  const [isAddingBomComponent, setIsAddingBomComponent] = useState(false);
  const [componentRows, setComponentRows] = useState<BomSelectionRow[]>([]);
  const involvingDepartments = useMemo(
    () => departments.filter(d => isInvolvingDepartment(d.name)),
    [departments]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [custRes, itemRes, compRes, deptRes, plansRes] = await Promise.all([
        supabase.from('customers').select('*').order('name'),
        supabase.from('items').select('*').order('name'),
        supabase.from('child_items').select('*').order('name'),
        supabase.from('departments').select('*').order('name'),
        supabase.from('custom_bom_plans').select('*').order('updated_at', { ascending: false }),
      ]);

      if (custRes.data) setCustomers(custRes.data as any);
      if (itemRes.data) setItems(itemRes.data as any);
      if (compRes.data) setAllComponents(compRes.data as any);
      if (deptRes.data) setDepartments(deptRes.data as any);
      if (plansRes.data) setPlans(plansRes.data as any);
    } catch (e) {
      onError();
    }
    setLoading(false);
  }, [onError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const pendingPlan = (window as any)._customPlanForEdit;
    if (pendingPlan && Array.isArray(pendingPlan.plan_items)) {
      editPlan(pendingPlan);
      if ((window as any)._openComponentModal) {
        setIsComponentModalOpen(true);
      }
      delete (window as any)._customPlanForEdit;
      delete (window as any)._openComponentModal;
    }
  }, [plans]);

  const customerItems = useMemo(() => {
    if (!selectedCompany) return [] as Item[];
    const target = selectedCompany.trim().toLowerCase();
    return items.filter(it => it.customer_name?.trim().toLowerCase() === target);
  }, [items, selectedCompany]);

  const buildDefaultComponentsFromItem = (item: Item, itemQty: number): CustomPlanComponent[] => {
    return Array.isArray(item.children)
      ? item.children.map((c: any) => ({
          component_type: getBomChildType(c),
          component_id: String(c.id || ''),
          component_name: c.name,
          departments: Array.isArray(c.departments) ? c.departments : [],
          qty_per_item: Math.max(1, Number(c.qtyPerMaster) || 1),
          total_qty: Math.max(1, Number(itemQty) || 1) * Math.max(1, Number(c.qtyPerMaster) || 1),
        }))
      : [];
  };

  const unsavedRows = useMemo(() => {
    return items
      .filter((it: Item) => !Array.isArray(it.children) || it.children.length === 0)
      .map((it: Item) => ({
        item_id: it.id,
        item_name: it.name,
        company_name: it.customer_name,
        default_qty: 1,
        item_ref: it,
      }))
      .sort((a, b) => a.company_name.localeCompare(b.company_name) || a.item_name.localeCompare(b.item_name));
  }, [items]);

  const savedRows = useMemo(() => {
    return items
      .filter((it: Item) => Array.isArray(it.children) && it.children.length > 0)
      .map((it: Item) => ({
        item_id: it.id,
        item_name: it.name,
        company_name: it.customer_name,
        default_qty: 1,
        components_count: it.children?.length || 0,
        item_ref: it,
      }))
      .sort((a, b) => a.company_name.localeCompare(b.company_name) || a.item_name.localeCompare(b.item_name));
  }, [items]);

  const companyOptions = useMemo(() => {
    const fromUnsaved = unsavedRows.map(r => r.company_name);
    const fromSaved = savedRows.map(r => r.company_name);
    return Array.from(new Set([...fromUnsaved, ...fromSaved])).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [unsavedRows, savedRows]);

  const filteredUnsavedRows = useMemo(() => {
    const query = bomSearchQuery.trim().toLowerCase();
    return unsavedRows.filter(row => {
      const companyMatch = bomCompanyFilter === 'All' || row.company_name === bomCompanyFilter;
      if (!companyMatch) return false;
      if (!query) return true;
      return row.item_name.toLowerCase().includes(query) || row.company_name.toLowerCase().includes(query);
    });
  }, [unsavedRows, bomSearchQuery, bomCompanyFilter]);

  const filteredSavedRows = useMemo(() => {
    const query = bomSearchQuery.trim().toLowerCase();
    return savedRows.filter(row => {
      const companyMatch = bomCompanyFilter === 'All' || row.company_name === bomCompanyFilter;
      if (!companyMatch) return false;
      if (!query) return true;
      return row.item_name.toLowerCase().includes(query) || row.company_name.toLowerCase().includes(query);
    });
  }, [savedRows, bomSearchQuery, bomCompanyFilter]);

  const resetBuilder = () => {
    setEditingPlanId(null);
    setSelectedSavedPlanId(null);
    setSelectedCompany('');
    setPlanName('');
    setPlanItems([]);
    setComponentPicker({});
  };

  const recalculateItem = (item: CustomPlanItem): CustomPlanItem => {
    return {
      ...item,
      components: item.components.map(c => ({
        ...c,
        qty_per_item: Math.max(1, Number(c.qty_per_item) || 1),
        total_qty: Math.max(1, Number(item.item_qty) || 1) * Math.max(1, Number(c.qty_per_item) || 1),
      })),
    };
  };

  const addPlanItem = () => {
    setPlanItems(prev => ([
      ...prev,
      {
        local_id: makeLocalId(),
        item_name: '',
        drawing_no: '',
        item_qty: 1,
        components: [],
      }
    ]));
  };

  const removePlanItem = (localId: string) => {
    setPlanItems(prev => prev.filter(it => it.local_id !== localId));
  };

  const onSelectItem = (localId: string, itemName: string) => {
    const selected = customerItems.find(i => i.name === itemName);
    setPlanItems(prev => prev.map(it => {
      if (it.local_id !== localId) return it;

      const baseQty = Math.max(1, Number(it.item_qty) || 1);
      const defaultComponents = selected ? buildDefaultComponentsFromItem(selected, baseQty) : [];

      return {
        ...it,
        item_id: selected?.id,
        item_name: itemName,
        drawing_no: selected?.drawing_no || '',
        components: defaultComponents,
      };
    }));
  };

  const onItemQtyChange = (localId: string, qty: number) => {
    const safeQty = Math.max(1, Number(qty) || 1);
    setPlanItems(prev => prev.map(it => it.local_id === localId ? recalculateItem({ ...it, item_qty: safeQty }) : it));
  };

  const addComponentToItem = (localId: string, componentId: string) => {
    const comp = allComponents.find(c => String(c.id) === componentId);
    if (!comp) return;

    setPlanItems(prev => prev.map(it => {
      if (it.local_id !== localId) return it;
      if (it.components.some(c => c.component_name === comp.name)) return it;

      const updated = {
        ...it,
        components: [
          ...it.components,
          {
            component_id: String(comp.id),
            component_name: comp.name,
            departments: Array.isArray(comp.departments) ? comp.departments : [],
            qty_per_item: 1,
            total_qty: Math.max(1, Number(it.item_qty) || 1),
          }
        ]
      };
      return recalculateItem(updated);
    }));

    setComponentPicker(prev => ({ ...prev, [localId]: '' }));
  };

  const updateComponentQtyPerItem = (localId: string, componentName: string, qtyPerItem: number) => {
    setPlanItems(prev => prev.map(it => {
      if (it.local_id !== localId) return it;
      const updated = {
        ...it,
        components: it.components.map(c => c.component_name === componentName ? { ...c, qty_per_item: Math.max(1, Number(qtyPerItem) || 1) } : c),
      };
      return recalculateItem(updated);
    }));
  };

  const removeComponent = (localId: string, componentName: string) => {
    setPlanItems(prev => prev.map(it => {
      if (it.local_id !== localId) return it;
      return {
        ...it,
        components: it.components.filter(c => c.component_name !== componentName),
      };
    }));
  };

  const savePlan = async () => {
    if (!selectedCompany) {
      alert('Please select company name');
      return;
    }
    if (!planName.trim()) {
      alert('Please enter plan name');
      return;
    }

    const validItems = planItems.filter(it => it.item_name.trim() !== '');
    if (validItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    const payload = {
      company_name: selectedCompany,
      plan_name: planName.trim(),
      plan_items: validItems,
      updated_at: new Date().toISOString(),
      created_by: JSON.parse(localStorage.getItem('excell_erp_user') || '{}')?.username || 'Office',
    };

    const result = editingPlanId
      ? await supabase.from('custom_bom_plans').update(payload).eq('id', editingPlanId)
      : await supabase.from('custom_bom_plans').insert([payload]);

    if (result.error) {
      alert(result.error.message);
      return;
    }

    alert(editingPlanId ? 'BOM updated successfully' : 'BOM created successfully');
    resetBuilder();
    fetchData();
  };

  const createBomFromUnsavedRow = (row: { item_id: number; item_name: string; company_name: string; default_qty: number; item_ref: Item; }) => {
    openItemBomComponentDialog(row.item_ref);
  };

  const openItemBomComponentDialog = (item: Item) => {
    setComponentItem(item);
    setComponentRows((item.children || []).map(toBomSelectionRow));
    setComponentSearchQuery('');
    setBomNewComponentNames('');
    setBomNewComponentDepartments(item.departments?.length ? item.departments : []);
  };

  const addLibraryComponentToItemBom = (component: any) => {
    setComponentRows(prev => {
      const nextRow: BomSelectionRow = {
        id: String(component.id || ''),
        type: 'component',
        name: component.name,
        qty: 1,
        departments: Array.isArray(component.departments) ? component.departments : [],
      };
      if (prev.some(row => isSameBomReference(row, nextRow))) return prev;
      return [...prev, nextRow];
    });
  };

  const filteredItemBomItems = useMemo(() => {
    if (!componentItem) return [] as Item[];
    const query = componentSearchQuery.trim().toLowerCase();

    return items.filter(item => {
      if (item.id === componentItem.id) return false;
      if (itemContainsItem(items, item.id, componentItem.id)) return false;
      if (componentRows.some(row => row.type === 'item' && String(row.id) === String(item.id))) return false;
      if (!query) return true;

      return item.name.toLowerCase().includes(query) ||
        (item.customer_name || '').toLowerCase().includes(query) ||
        (item.drawing_no || '').toLowerCase().includes(query) ||
        (item.departments || []).some((dept: string) => dept.toLowerCase().includes(query));
    });
  }, [items, componentItem, componentRows, componentSearchQuery]);

  const addItemToItemBom = (item: Item) => {
    if (!componentItem) return;
    if (item.id === componentItem.id || itemContainsItem(items, item.id, componentItem.id)) {
      alert('This item cannot be added because it would create a circular BOM.');
      return;
    }

    const nextRow: BomSelectionRow = {
      id: item.id,
      type: 'item',
      name: item.name,
      qty: 1,
      departments: item.departments || [],
      drawing_no: item.drawing_no,
    };

    setComponentRows(prev => prev.some(row => isSameBomReference(row, nextRow)) ? prev : [...prev, nextRow]);
  };

  const updateItemBomQty = (index: number, value: string) => {
    setComponentRows(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, qty: value === '' ? '' : Math.max(1, Number(value)) } : row));
  };

  const toggleBomNewComponentDepartment = (deptName: string) => {
    setBomNewComponentDepartments(prev => prev.includes(deptName) ? prev.filter(name => name !== deptName) : [...prev, deptName]);
  };

  const addBomComponentsToLibrary = async () => {
    const names = Array.from(new Set(bomNewComponentNames
      .split(/[\n,;]+/)
      .map(name => name.trim().replace(/\s+/g, ' '))
      .filter(Boolean)));

    if (names.length === 0) {
      alert('Type one or more component names first.');
      return;
    }

    if (bomNewComponentDepartments.length === 0) {
      alert('Please select at least one department for the new component(s).');
      return;
    }

    const existingKeys = new Set(allComponents.map(component => normalizeDuplicateKey(component.name || '')));
    const selectedKeys = new Set(componentRows.map(component => normalizeDuplicateKey(component.name || '')));
    const namesToCreate = names.filter(name => !existingKeys.has(normalizeDuplicateKey(name)));
    const existingToSelect = allComponents.filter(component => names.some(name => normalizeDuplicateKey(name) === normalizeDuplicateKey(component.name || '')));

    if (namesToCreate.length === 0 && existingToSelect.length === 0) {
      alert('All typed components are already selected or unavailable.');
      return;
    }

    setIsAddingBomComponent(true);
    try {
      const createdComponents: any[] = [];
      if (namesToCreate.length > 0) {
        const { data: createdRows, error } = await supabase.from('child_items').insert(namesToCreate.map(name => ({
          name,
          departments: bomNewComponentDepartments,
          qty_per_master: 0,
          parent_item_id: null,
        })));

        if (error) {
          alert(error.message);
          return;
        }

        createdComponents.push(...((createdRows || []) as any[]));
        setAllComponents(prev => [...prev, ...createdComponents]);
      }

      const nextComponents = [...existingToSelect, ...createdComponents];
      setComponentRows(prev => {
        const next = [...prev];
        for (const component of nextComponents) {
          if (!selectedKeys.has(normalizeDuplicateKey(component.name || '')) && !next.find(row => normalizeDuplicateKey(row.name) === normalizeDuplicateKey(component.name || ''))) {
            next.push({ id: String(component.id || ''), type: 'component', name: component.name, qty: 1, departments: component.departments || bomNewComponentDepartments });
          }
        }
        return next;
      });
      setComponentSearchQuery('');
      setBomNewComponentNames('');
    } finally {
      setIsAddingBomComponent(false);
    }
  };

  const saveItemBomComponents = async () => {
    if (!componentItem) return;
    if (componentRows.length === 0) {
      alert('Please add at least one component before saving BOM.');
      return;
    }

    const children = componentRows.map(toStoredBomChild);

    const { error } = await supabase.from('items').update({ children }).eq('id', componentItem.id);
    if (error) {
      alert(error.message);
      return;
    }

    setComponentItem(null);
    setComponentRows([]);
    setBomMode('saved');
    fetchData();
  };

  const editPlan = (plan: any) => {
    setEditingPlanId(plan.id);
    setSelectedSavedPlanId(plan.id);
    setSelectedCompany(plan.company_name || '');
    setPlanName(plan.plan_name || '');

    const itemsFromDb = Array.isArray(plan.plan_items) ? plan.plan_items : [];
    setPlanItems(itemsFromDb.map((it: any) => recalculateItem({
      local_id: it.local_id || makeLocalId(),
      item_id: it.item_id,
      item_name: it.item_name || '',
      drawing_no: it.drawing_no || '',
      item_qty: Math.max(1, Number(it.item_qty) || 1),
      components: Array.isArray(it.components) ? it.components : [],
    })));
  };

  const printPlan = (plan: any) => {
    const qtyInput = prompt('Enter quantity multiplier for print', '1');
    if (qtyInput === null) return;

    const multiplier = Math.max(1, Number(qtyInput) || 1);
    (window as any)._customPlan = plan;
    (window as any)._customPlanPrintQty = multiplier;
    (window as any)._setView?.('custom-bom-print');
  };

  const selectedSavedPlan = useMemo(() => {
    if (!selectedSavedPlanId) return null;
    return plans.find((p: any) => p.id === selectedSavedPlanId) || null;
  }, [plans, selectedSavedPlanId]);

  const filteredBomLibraryComponents = useMemo(() => {
    const query = componentSearchQuery.trim().toLowerCase();
    return allComponents.filter(component => {
      if (!query) return true;
      return String(component.name || '').toLowerCase().includes(query) ||
        (component.departments || []).some((dept: string) => String(dept).toLowerCase().includes(query));
    });
  }, [allComponents, componentSearchQuery]);

  const addNewComponentToLibrary = async () => {
    if (!newComponent.name.trim()) {
      alert('Component name is required');
      return;
    }

    if (newComponent.departments.length === 0) {
      alert('Please select at least one department for this component.');
      return;
    }

    const { error } = await supabase.from('child_items').insert([{
      name: newComponent.name.trim(),
      departments: newComponent.departments,
      qty_per_master: 1,
      parent_item_id: null,
    }]);

    if (error) {
      alert(error.message);
      return;
    }

    setNewComponent({ name: '', departments: [] });
    setIsComponentModalOpen(false);
    fetchData();
  };

  if (loading) return <LoadingState message="Loading custom planner..." />;

  return (
    <div className="space-y-5">
      <div className="sticky top-16 md:top-0 z-20 bg-gray-50/95 backdrop-blur p-2 rounded-xl border border-gray-100 flex flex-col md:flex-row gap-2 md:gap-3 md:items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-800 tracking-tight">Custom BOM Planner</h2>
          <p className="text-xs font-semibold text-gray-500 text-center sm:text-left">Create custom production plans by company with editable BOM.</p>
        </div>
      </div>

      <div className="inline-flex bg-white border border-gray-200 rounded-xl p-1 w-full sm:w-auto">
        <button onClick={() => setBomMode('unsaved')} className={`px-4 py-2 rounded-lg text-xs font-black ${bomMode === 'unsaved' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>Unsaved BOM</button>
        <button onClick={() => setBomMode('saved')} className={`px-4 py-2 rounded-lg text-xs font-black ${bomMode === 'saved' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>Saved BOM</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            value={bomSearchQuery}
            onChange={e => setBomSearchQuery(e.target.value)}
            placeholder={bomMode === 'saved' ? 'Search saved BOM by item/company/plan...' : 'Search unsaved BOM by item/company...'}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm"
          />
        </div>
        <select
          value={bomCompanyFilter}
          onChange={e => setBomCompanyFilter(e.target.value)}
          className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700"
        >
          <option value="All">All Companies</option>
          {companyOptions.map(company => (
            <option key={company} value={company}>{company}</option>
          ))}
        </select>
      </div>

      {!editingPlanId && planItems.length > 0 && (
        <div className="text-xs font-black uppercase tracking-wider text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          Unsaved BOM Draft - save first to enable print from top button.
        </div>
      )}

      {(editingPlanId || planItems.length > 0) && (
      <Card className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Company</label>
            <select value={selectedCompany} onChange={e => { setSelectedCompany(e.target.value); setPlanItems([]); }} className="w-full px-3 py-2.5 bg-gray-50 border rounded-xl">
              <option value="">Select Company</option>
              {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Plan Name</label>
            <input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="Example: March Corrugation Plan" className="w-full px-3 py-2.5 bg-gray-50 border rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2">
          <button onClick={addPlanItem} disabled={!selectedCompany} className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black disabled:opacity-40">+ Add Item</button>
          <button onClick={() => setIsComponentModalOpen(true)} className="px-3 sm:px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-black">+ New Component</button>
          <button onClick={savePlan} className="px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black">{editingPlanId ? 'Update BOM' : 'Save BOM'}</button>
          <button onClick={resetBuilder} className="px-3 sm:px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-xs font-black">Cancel</button>
        </div>

        <div className="space-y-3">
          {planItems.map((item, idx) => (
            <div key={item.local_id} className="border border-gray-200 rounded-xl p-3 space-y-3 bg-white">
              <div className="flex flex-col md:flex-row gap-2 md:items-end">
                <div className="flex-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Item #{idx + 1}</label>
                  <select value={item.item_name} onChange={e => onSelectItem(item.local_id, e.target.value)} className="w-full px-3 py-2 bg-gray-50 border rounded-lg">
                    <option value="">Select Item</option>
                    {customerItems.map(ci => <option key={ci.id} value={ci.name}>{ci.name}</option>)}
                  </select>
                </div>
                <div className="w-full md:w-40">
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Item Qty</label>
                  <input type="number" min={1} value={item.item_qty} onChange={e => onItemQtyChange(item.local_id, parseInt(e.target.value) || 1)} className="w-full px-3 py-2 bg-gray-50 border rounded-lg" />
                </div>
                <button onClick={() => removePlanItem(item.local_id)} className="px-3 py-2 bg-red-50 text-red-500 rounded-lg text-xs font-black">Remove</button>
              </div>

              {item.item_name && (
                <div className="space-y-2">
                  <div className="flex flex-col md:flex-row gap-2">
                    <select value={componentPicker[item.local_id] || ''} onChange={e => setComponentPicker(prev => ({ ...prev, [item.local_id]: e.target.value }))} className="flex-1 px-3 py-2 bg-gray-50 border rounded-lg text-sm">
                      <option value="">Add component to this item</option>
                      {allComponents.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                    </select>
                    <button onClick={() => addComponentToItem(item.local_id, componentPicker[item.local_id] || '')} className="w-full md:w-auto px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-black">Add Component</button>
                  </div>

                  <div className="hidden md:block overflow-x-auto border border-gray-100 rounded-lg">
                    <table className="w-full min-w-[700px] text-sm">
                      <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-black">
                        <tr>
                          <th className="px-3 py-2 text-left">Component</th>
                          <th className="px-3 py-2 text-left">Depts</th>
                          <th className="px-3 py-2 text-left">Qty / Item</th>
                          <th className="px-3 py-2 text-left">Total Qty</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {item.components.map(comp => (
                          <tr key={comp.component_name}>
                            <td className="px-3 py-2 font-bold text-gray-700">{comp.component_name}</td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1 flex-wrap">{comp.departments.map(d => <Badge key={d} color="gray">{d}</Badge>)}</div>
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" min={1} value={comp.qty_per_item} onChange={e => updateComponentQtyPerItem(item.local_id, comp.component_name, parseInt(e.target.value) || 1)} className="w-24 px-2 py-1 border rounded" />
                            </td>
                            <td className="px-3 py-2 font-black text-indigo-600">{comp.total_qty}</td>
                            <td className="px-3 py-2 text-right">
                              <button onClick={() => removeComponent(item.local_id, comp.component_name)} className="px-2 py-1 text-red-500 bg-red-50 rounded text-xs font-black">Remove</button>
                            </td>
                          </tr>
                        ))}
                        {item.components.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-gray-400 italic text-xs">No components selected for this item.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden space-y-2 border border-gray-100 rounded-lg p-2 bg-gray-50/40">
                    {item.components.map(comp => (
                      <div key={comp.component_name} className="bg-white border border-gray-200 rounded-lg p-2.5 space-y-2">
                        <div className="font-bold text-sm text-gray-800 break-words">{comp.component_name}</div>
                        <div className="flex flex-wrap gap-1">
                          {comp.departments.map(d => <Badge key={d} color="gray">{d}</Badge>)}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <label className="text-gray-500 font-semibold">
                            Qty / Item
                            <input
                              type="number"
                              min={1}
                              value={comp.qty_per_item}
                              onChange={e => updateComponentQtyPerItem(item.local_id, comp.component_name, parseInt(e.target.value) || 1)}
                              className="mt-1 w-full px-2 py-1 border rounded bg-white"
                            />
                          </label>
                          <div className="text-gray-500 font-semibold">
                            Total Qty
                            <div className="mt-1 px-2 py-1.5 border rounded bg-white font-black text-indigo-600 text-center">{comp.total_qty}</div>
                          </div>
                        </div>
                        <button onClick={() => removeComponent(item.local_id, comp.component_name)} className="w-full px-2 py-1.5 text-red-500 bg-red-50 rounded text-xs font-black">Remove</button>
                      </div>
                    ))}
                    {item.components.length === 0 && (
                      <div className="px-2 py-4 text-center text-gray-400 italic text-xs">No components selected for this item.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h3 className="font-black text-gray-800">{bomMode === 'unsaved' ? 'Items Without BOM Components' : 'Items With Saved BOM Components'}</h3>
          <span className="text-xs font-bold text-gray-400">{bomMode === 'unsaved' ? filteredUnsavedRows.length : filteredSavedRows.length} row(s)</span>
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-black border-b">
              <tr>
                <th className="px-4 py-2 text-left">Item Name</th>
                <th className="px-4 py-2 text-left">Company</th>
                <th className="px-4 py-2 text-left">Qty</th>
                <th className="px-4 py-2 text-left">Updated</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bomMode === 'saved' && filteredSavedRows.map(row => (
                <tr key={`${row.company_name}-${row.item_id}`}>
                  <td className="px-4 py-2 font-black text-indigo-700">{row.item_name}</td>
                  <td className="px-4 py-2 font-semibold text-gray-700">{row.company_name}</td>
                  <td className="px-4 py-2">{row.components_count} component(s)</td>
                  <td className="px-4 py-2 text-xs text-gray-500">Saved in Item Master</td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button onClick={() => openItemBomComponentDialog(row.item_ref)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-black">Edit BOM</button>
                  </td>
                </tr>
              ))}
              {bomMode === 'unsaved' && filteredUnsavedRows.map(row => (
                <tr key={`${row.company_name}-${row.item_id}`}>
                  <td className="px-4 py-2 font-black text-indigo-700">{row.item_name}</td>
                  <td className="px-4 py-2 font-semibold text-gray-700">{row.company_name}</td>
                  <td className="px-4 py-2">{row.default_qty}</td>
                  <td className="px-4 py-2 text-xs text-gray-400">-</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => createBomFromUnsavedRow(row)} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-black">Create BOM</button>
                  </td>
                </tr>
              ))}
              {(bomMode === 'saved' ? filteredSavedRows.length === 0 : filteredUnsavedRows.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400 italic">{bomMode === 'saved' ? 'No items with saved BOM components found.' : 'No items without BOM components found.'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden p-2 space-y-2">
          {bomMode === 'saved' && filteredSavedRows.map(row => (
            <div
              key={`${row.company_name}-${row.item_id}`}
              className="rounded-xl border border-gray-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-black text-indigo-700 text-sm leading-tight break-words">
                    {row.item_name}
                  </div>
                  <div className="text-[11px] font-semibold text-gray-500 mt-1 break-words">{row.company_name}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-600 font-semibold">
                {row.components_count} component(s)
              </div>
              <div className="mt-3">
                <button onClick={() => openItemBomComponentDialog(row.item_ref)} className="w-full px-2 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black">Edit BOM</button>
              </div>
            </div>
          ))}

          {bomMode === 'unsaved' && filteredUnsavedRows.map(row => (
            <div key={`${row.company_name}-${row.item_id}`} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="font-black text-indigo-700 text-sm leading-tight break-words">{row.item_name}</div>
              <div className="text-[11px] font-semibold text-gray-500 mt-1 break-words">{row.company_name}</div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-600 font-semibold">
                <span>Qty: {row.default_qty}</span>
                <button onClick={() => createBomFromUnsavedRow(row)} className="px-2.5 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-black">Create BOM</button>
              </div>
            </div>
          ))}

          {(bomMode === 'saved' ? filteredSavedRows.length === 0 : filteredUnsavedRows.length === 0) && (
            <div className="py-10 text-center text-gray-400 italic text-sm">
              {bomMode === 'saved' ? 'No items with saved BOM components found.' : 'No items without BOM components found.'}
            </div>
          )}
        </div>
      </Card>

      <Modal isOpen={!!componentItem} onClose={() => setComponentItem(null)} title={`Components: ${componentItem?.name || ''}`} maxWidthClassName="max-w-5xl">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                value={componentSearchQuery}
                onChange={e => setComponentSearchQuery(e.target.value)}
                placeholder="Search library components..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="max-h-[260px] overflow-y-auto rounded-xl border border-gray-200">
              <div className="border-b bg-gray-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Available Library</div>
              <div className="space-y-1 p-2">
                {filteredBomLibraryComponents.map(component => (
                  <div key={component.id} className="flex items-center justify-between rounded-lg border border-transparent p-3 transition-all hover:border-gray-200 hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-gray-800">{component.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(component.departments || []).map((dept: string) => <Badge key={dept} color="gray">{dept}</Badge>)}
                      </div>
                    </div>
                    <button type="button" onClick={() => addLibraryComponentToItemBom(component)} className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700"><Plus size={16} /></button>
                  </div>
                ))}
                {filteredBomLibraryComponents.length === 0 && <div className="p-8 text-center text-sm font-semibold text-gray-400">No matching components found.</div>}
              </div>
            </div>
            <div className="max-h-[260px] overflow-y-auto rounded-xl border border-indigo-100">
              <div className="border-b bg-indigo-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-500">Available Items</div>
              <div className="space-y-1 p-2">
                {filteredItemBomItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-transparent p-3 transition-all hover:border-indigo-100 hover:bg-indigo-50/50">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-gray-800">{item.name}</div>
                      <div className="text-[10px] font-semibold text-gray-400 truncate">{item.customer_name} {item.drawing_no ? `| ${item.drawing_no}` : ''}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(item.departments || []).map((dept: string) => <Badge key={dept} color="gray">{dept}</Badge>)}
                      </div>
                    </div>
                    <button type="button" onClick={() => addItemToItemBom(item)} className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-700"><Plus size={16} /></button>
                  </div>
                ))}
                {filteredItemBomItems.length === 0 && <div className="p-8 text-center text-sm font-semibold text-indigo-300">No available item matches this search.</div>}
              </div>
            </div>
            {componentSearchQuery.trim() && filteredBomLibraryComponents.length === 0 && (
              <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div>
                  <div className="text-base font-black text-gray-800">New Standard Component</div>
                  <div className="mt-1 text-xs font-semibold text-gray-400">Add one or many components to the library and this BOM.</div>
                </div>
                <div>
                  <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Component name</label>
                  <textarea
                    value={bomNewComponentNames}
                    onChange={e => setBomNewComponentNames(e.target.value)}
                    placeholder="e.g., Foam Insert, Plastic Corner Guard"
                    className="h-20 w-full resize-none rounded-2xl border bg-gray-50 px-4 py-3 text-sm font-semibold outline-none transition-all focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-3 ml-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">Related departments (select at least one)</label>
                  <div className="flex flex-wrap gap-2">
                    {involvingDepartments.map(department => (
                      <button
                        key={department.id}
                        type="button"
                        onClick={() => toggleBomNewComponentDepartment(department.name)}
                        className={`rounded-xl border px-4 py-3 text-xs font-bold transition-all ${bomNewComponentDepartments.includes(department.name) ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                      >
                        {department.name}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addBomComponentsToLibrary}
                  disabled={!bomNewComponentNames.trim() || isAddingBomComponent || bomNewComponentDepartments.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-sm font-black text-white shadow-xl transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  <Plus size={16} /> {isAddingBomComponent ? 'Adding...' : 'Add to Library'}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black text-blue-800">Selected BOM Rows ({componentRows.length})</div>
                <div className="text-[11px] font-semibold text-gray-500">Saving here makes this item a Saved BOM.</div>
              </div>
            </div>
            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {componentRows.map((component, index) => (
                <div key={`${component.name}-${index}`} className="rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black text-gray-800">{component.name}</div>
                      <Badge color={component.type === 'item' ? 'indigo' : 'blue'}>{component.type === 'item' ? 'Item' : 'Component'}</Badge>
                      <div className="mt-1 flex flex-wrap gap-1">{component.departments.map(dept => <Badge key={dept} color="gray">{dept}</Badge>)}</div>
                    </div>
                    <button type="button" onClick={() => setComponentRows(prev => prev.filter((_, rowIndex) => rowIndex !== index))} className="p-1 text-red-400 hover:text-red-600"><X size={16} /></button>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-gray-400">Qty per item</span>
                    <input type="number" min="1" value={component.qty} onChange={e => updateItemBomQty(index, e.target.value)} onBlur={e => { if (!e.target.value) updateItemBomQty(index, '1'); }} className="w-20 rounded-lg border px-2 py-1 text-center text-sm font-bold" />
                  </div>
                </div>
              ))}
              {componentRows.length === 0 && <div className="py-12 text-center text-sm font-semibold text-blue-300">No components selected for this item.</div>}
            </div>
            <button type="button" onClick={saveItemBomComponents} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-black text-white hover:bg-green-700"><Save size={16} /> Save BOM Components</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isComponentModalOpen} onClose={() => setIsComponentModalOpen(false)} title="Create Component">
        <div className="space-y-4">
          <input value={newComponent.name} onChange={e => setNewComponent(prev => ({ ...prev, name: e.target.value }))} placeholder="Component name" className="w-full px-3 py-2 bg-gray-50 border rounded-xl" />
          <div className="flex flex-wrap gap-2">
            {involvingDepartments.map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => setNewComponent(prev => ({
                  ...prev,
                  departments: prev.departments.includes(d.name)
                    ? prev.departments.filter(x => x !== d.name)
                    : [...prev.departments, d.name]
                }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-black border ${newComponent.departments.includes(d.name) ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-500 border-gray-200'}`}
              >
                {d.name.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <button onClick={addNewComponentToLibrary} disabled={!newComponent.name.trim() || newComponent.departments.length === 0} className="w-full py-2.5 bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm">Create Component</button>
        </div>
      </Modal>
    </div>
  );
};

const CustomBOMPrintView: React.FC<{ plan: any; onBack: () => void }> = ({ plan, onBack }) => {
  const items: CustomPlanItem[] = Array.isArray(plan?.plan_items) ? plan.plan_items : [];
  const [printMultiplier, setPrintMultiplier] = useState<number>(() => {
    const fromWindow = Number((window as any)._customPlanPrintQty || 1);
    return Math.max(1, fromWindow || 1);
  });

  const scaledItems = useMemo(() => {
    return items.map(it => {
      const scaledItemQty = Math.max(1, Number(it.item_qty) || 1) * printMultiplier;
      return {
        ...it,
        item_qty: scaledItemQty,
        components: (it.components || []).map(c => ({
          ...c,
          total_qty: Math.max(1, Number(c.qty_per_item) || 1) * scaledItemQty,
        })),
      };
    });
  }, [items, printMultiplier]);

  const openEditorFromPrint = (openComponentModal: boolean) => {
    (window as any)._customPlanForEdit = plan;
    (window as any)._openComponentModal = openComponentModal;
    (window as any)._setView?.('custom-bom-plan');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-xs font-black uppercase text-gray-400 hover:text-indigo-600">
          <ChevronLeft size={16} /> Back to Custom BOM
        </button>
        <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
          <button onClick={() => openEditorFromPrint(false)} className="bg-blue-50 text-blue-600 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black">Edit BOM</button>
          <button onClick={() => openEditorFromPrint(true)} className="bg-orange-600 text-white px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black">+ New Component</button>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <span className="text-xs font-black text-gray-500 uppercase">Qty</span>
            <input
              type="number"
              min={1}
              value={printMultiplier}
              onChange={(e) => setPrintMultiplier(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 px-2 py-1 border rounded-lg text-sm font-bold"
            />
          </div>
          <button onClick={() => {
            const qtyInput = prompt('Enter quantity multiplier for print', String(printMultiplier));
            if (qtyInput === null) return;
            const next = Math.max(1, Number(qtyInput) || 1);
            setPrintMultiplier(next);
            setTimeout(() => window.print(), 50);
          }} className="col-span-2 sm:col-span-1 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2">
            <Printer size={16} /> Print BOM
          </button>
        </div>
      </div>

      <div className="print-area custom-bom-print-area bg-white rounded-2xl border p-6 space-y-6">
        <div className="border-b pb-4">
          <h1 className="text-3xl font-black text-slate-900">Custom BOM</h1>
          <div className="mt-1 text-sm text-slate-500 font-semibold">Company: {plan?.company_name || '-'} | Plan: {plan?.plan_name || '-'}</div>
        </div>

        <div className="space-y-4">
          {scaledItems.map((it, idx) => {
            const byDept: Record<string, { name: string; qty: number }[]> = {
              Wood_Work: [],
              Corrugation: [],
              Trading_Consumables: [],
            };

            (it.components || []).forEach(c => {
              const depts = Array.isArray(c.departments) ? c.departments : [];
              depts.forEach(d => {
                const norm = normalizeDepartment(d);
                if (!PLAN_DEPARTMENT_COLUMNS.includes(norm)) return;
                const existing = byDept[norm].find(x => x.name === c.component_name);
                if (existing) existing.qty += Number(c.total_qty) || 0;
                else byDept[norm].push({ name: c.component_name, qty: Number(c.total_qty) || 0 });
              });
            });

            return (
              <div key={it.local_id || idx} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                  <div className="font-black text-slate-800">{it.item_name}</div>
                  <div className="text-sm font-black text-indigo-600">QTY: {it.item_qty}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 plan-dept-grid">
                  {PLAN_DEPARTMENT_COLUMNS.map(dept => (
                    <div key={dept} className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                        {dept.replace(/_/g, ' ')}
                      </div>
                      <div className="p-2 space-y-1 min-h-[120px]">
                        {byDept[dept].length === 0 && <div className="text-[10px] text-slate-300 italic">No components</div>}
                        {byDept[dept].map((comp, cIdx) => (
                          <div key={`${dept}-${cIdx}`} className="flex items-center justify-between text-xs border-b border-slate-100 last:border-0 pb-1 last:pb-0">
                            <span className="font-semibold text-slate-700 pr-2">{comp.name}</span>
                            <span className="font-black text-indigo-600">{comp.qty}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Production Planning ---

const ProductionPlanList: React.FC<{ onError: () => void; onGenerate: (ids: number[]) => void; loggedInUser: User }> = ({ onError, onGenerate, loggedInUser }) => {
  const [data, setData] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);

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

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filteredPlanOrders = useMemo(() => {
    if (statusFilter === 'All') return data;
    return data.filter(wo => wo.status === statusFilter);
  }, [data, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, data.length]);

  const { pageRows: paginatedPlanOrders, totalPages, safePage, totalRows, startIndex } = useMemo(
    () => getPageSlice(filteredPlanOrders, page, LIST_PAGE_SIZE),
    [filteredPlanOrders, page]
  );

  const statusOptions = useMemo(() => {
    const uniqueStatuses = Array.from(new Set(data.map(wo => wo.status)));
    return sortStatuses(uniqueStatuses);
  }, [data]);

  const toggleSelectAll = () => {
    const visibleIds = paginatedPlanOrders.map(wo => wo.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));

    if (allVisibleSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
      return;
    }

    setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="sticky top-16 md:top-0 z-20 bg-gray-50/95 backdrop-blur px-1 py-2 rounded-xl border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Production Planning</h2>
          <p className="text-gray-500 font-medium">Select orders to generate a master plan.</p>
        </div>
        {selectedIds.length > 0 && (
            <button 
                onClick={() => onGenerate(selectedIds)}
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 animate-in fade-in zoom-in w-full md:w-auto justify-center"
            >
                <Calculator size={20} /> Generate Plan ({selectedIds.length})
            </button>
        )}
      </div>

      <div className="w-full md:w-80">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All Statuses</option>
          {statusOptions.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      <Card className="p-0 overflow-hidden shadow-lg border-2 border-indigo-50">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#0f172a] text-white text-[10px] font-black uppercase tracking-widest">
              <tr>
                  <th className="px-6 py-5 w-10">
                      <button onClick={toggleSelectAll} className="text-white hover:text-indigo-200">
                          {paginatedPlanOrders.length > 0 && paginatedPlanOrders.every(wo => selectedIds.includes(wo.id)) ? <CheckSquare size={18}/> : <Square size={18}/>} 
                      </button>
                  </th>
                  <th className="px-6 py-5 whitespace-nowrap">Order ID</th>
                  <th className="px-6 py-5 whitespace-nowrap">Client</th>
                  <th className="px-6 py-5 whitespace-nowrap">Target Item</th>
                  <th className="px-6 py-5 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedPlanOrders.map(wo => (
                <tr key={wo.id} className={`hover:bg-indigo-50/30 group transition-all ${selectedIds.includes(wo.id) ? 'bg-indigo-50/50' : ''}`}>
                  <td className="px-6 py-4">
                      <button onClick={() => toggleSelect(wo.id)} className="text-gray-400 hover:text-indigo-600">
                          {selectedIds.includes(wo.id) ? <CheckSquare size={18} className="text-indigo-600"/> : <Square size={18}/>}
                      </button>
                  </td>
                  <td className="px-6 py-4 font-black text-indigo-600">#{wo.id}</td>
                  <td className="px-6 py-4 font-bold text-gray-800">{wo.customer}</td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-bold text-gray-700">{wo.job_details}</div>
                    <Badge color="orange" className="mt-1">Qty: {wo.qty}</Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <StatusBadge status={wo.status} />
                  </td>
                </tr>
              ))}
              {filteredPlanOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                    No orders found for selected status.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden p-2 space-y-2">
          {paginatedPlanOrders.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs font-bold text-gray-700"
            >
              {paginatedPlanOrders.every(wo => selectedIds.includes(wo.id)) ? 'Unselect Page' : 'Select Page'}
            </button>
          )}

          {paginatedPlanOrders.map(wo => (
            <div key={wo.id} className={`rounded-xl border p-3 ${selectedIds.includes(wo.id) ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black text-indigo-600">ORDER #{wo.id}</div>
                  <div className="font-black text-gray-800 mt-0.5 leading-tight text-xs">{wo.job_details}</div>
                  <div className="text-[11px] text-gray-500 font-semibold mt-0.5">{wo.customer}</div>
                </div>
                <StatusBadge status={wo.status} />
              </div>

              <div className="mt-2 flex items-center justify-between">
                <Badge color="orange">Qty: {wo.qty}</Badge>
                <button
                  onClick={() => toggleSelect(wo.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-black"
                >
                  {selectedIds.includes(wo.id) ? <CheckSquare size={12} /> : <Square size={12} />}
                  {selectedIds.includes(wo.id) ? 'Selected' : 'Select'}
                </button>
              </div>
            </div>
          ))}

          {filteredPlanOrders.length === 0 && (
            <div className="py-12 text-center text-gray-400 italic">No orders found for selected status.</div>
          )}
        </div>

        <PaginationBar
          page={safePage}
          totalPages={totalPages}
          totalRows={totalRows}
          startIndex={startIndex}
          pageRowsCount={paginatedPlanOrders.length}
          onPageChange={setPage}
        />
      </Card>
    </div>
  );
};

// --- Plan Generator (The Document) ---

const PlanGenerator: React.FC<{ ids: number[]; onBack: () => void }> = ({ ids, onBack }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptSummary, setDeptSummary] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const fetchAll = async () => {
      // 1. Fetch Work Orders
      const { data: woData } = await supabase.from('work_orders').select('*').in('id', ids);
      
      if (woData && woData.length > 0) {
        const enhancedOrders = [];
        
        const { data: allItemsData } = await supabase.from('items').select('*').order('name');
        const allItems = (allItemsData || []) as Item[];

        // 2. Fetch Items for these orders
        for (const wo of woData) {
            const itemData = allItems.find(item => item.name === wo.job_details) || null;
            let components: any[] = [];
            
            if (itemData) {
                // Get components from JSONB and expand nested item BOMs.
                if (itemData.children && Array.isArray(itemData.children)) {
                    addExpandedBomComponents(components, allItems, itemData.children, wo.qty, new Set([Number(itemData.id)]));
                }
                
                const { data: linkedComponents } = await supabase.from('child_items').select('*').eq('parent_item_id', itemData.id);
                if (linkedComponents) {
                    const linked = linkedComponents.map((d: any) => ({
                        id: d.id,
                        name: d.name,
                        departments: d.departments,
                        qtyPerMaster: d.qty_per_master,
                        totalQty: (d.qty_per_master || 1) * wo.qty
                    }));
                    // Merge avoiding duplicates if needed, typically just add
                    components = [...components, ...linked];
                }
            }
            enhancedOrders.push({ ...wo, item: itemData, components });
        }
        
        setOrders(enhancedOrders);

        // 3. Aggregate for Summary
        const summary: Record<string, any[]> = {};
        
        enhancedOrders.forEach(order => {
            order.components.forEach((comp: any) => {
                const depts = comp.departments || [];
                depts.forEach((d: string) => {
                    if (!summary[d]) summary[d] = [];
                    const existing = summary[d].find(x => x.name === comp.name);
                    if (existing) {
                        existing.totalQty += comp.totalQty;
                    } else {
                        summary[d].push({ name: comp.name, totalQty: comp.totalQty });
                    }
                });
            });
        });
        
        setDeptSummary(summary);
      }
      setLoading(false);
    };
    fetchAll();
  }, [ids]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <LoadingState message="Generating Master Plan..." />;
  if (orders.length === 0) return <div className="p-20 text-center font-bold text-red-500">No orders found.</div>;

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

      <div className="print-area bg-white p-6 rounded-2xl shadow-xl border border-slate-100 min-h-[11in] animate-in fade-in zoom-in duration-300">
         <div className="border-b pb-4 mb-5 flex justify-between items-end">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900">Production Plan</h1>
                <p className="text-slate-500 font-semibold text-sm mt-1">Generated material requirement by department</p>
            </div>
            <div className="text-right">
                <div className="text-xs font-bold text-slate-500">Date: {new Date().toLocaleDateString()}</div>
                <div className="text-xs font-black uppercase text-indigo-600">{orders.length} Item(s)</div>
            </div>
         </div>

         <div className="space-y-4">
           {orders.map((order, idx) => {
             const byDept: Record<string, { name: string; qty: number }[]> = {
               Wood_Work: [],
               Corrugation: [],
               Trading_Consumables: [],
             };

             (order.components || []).forEach((comp: any) => {
               const depts = Array.isArray(comp.departments) ? comp.departments : [];
               depts.forEach((d: string) => {
                 const norm = normalizeDepartment(d);
                 if (!PLAN_DEPARTMENT_COLUMNS.includes(norm)) return;
                 const existing = byDept[norm].find(x => x.name === comp.name);
                 if (existing) existing.qty += Number(comp.totalQty) || 0;
                 else byDept[norm].push({ name: comp.name, qty: Number(comp.totalQty) || 0 });
               });
             });

             return (
               <div key={idx} className="border border-slate-200 rounded-xl p-4">
                 <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                   <div className="font-black text-slate-800">{order.job_details}</div>
                   <div className="text-sm font-black text-indigo-600">QTY: {order.qty}</div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-3 plan-dept-grid">
                   {PLAN_DEPARTMENT_COLUMNS.map(dept => (
                     <div key={dept} className="border border-slate-200 rounded-lg overflow-hidden">
                       <div className="bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                         {dept.replace(/_/g, ' ')}
                       </div>
                       <div className="p-2 space-y-1 min-h-[120px]">
                         {byDept[dept].length === 0 && <div className="text-[10px] text-slate-300 italic">No components</div>}
                         {byDept[dept].map((comp, cIdx) => (
                           <div key={`${dept}-${cIdx}`} className="flex items-center justify-between text-xs border-b border-slate-100 last:border-0 pb-1 last:pb-0">
                             <span className="font-semibold text-slate-700 pr-2">{comp.name}</span>
                             <span className="font-black text-indigo-600">{comp.qty}</span>
                           </div>
                         ))}
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             );
           })}
         </div>
      </div>
    </div>
  );
};

// --- Notification Audit ---

const NotificationAuditView: React.FC<{ onError: () => void }> = ({ onError }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const getEventTimestamp = (ev: any) => {
    const rawTime = ev.event_time || ev.created || ev.created_at || null;
    if (!rawTime) return 0;

    const timestamp = new Date(rawTime).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  };

  const formatEventTime = (ev: any) => {
    const timestamp = getEventTimestamp(ev);
    if (!timestamp) return 'No time';
    return new Date(timestamp).toLocaleString();
  };

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_events')
        .select('*')
        .limit(200);

      if (error?.code === '42P01') {
        onError();
        return;
      }

      const sortedEvents = [...(data || [])].sort((a: any, b: any) => {
        return getEventTimestamp(b) - getEventTimestamp(a);
      });

      setEvents(sortedEvents);
    } catch (_e) {
      onError();
    }
    setLoading(false);
  }, [onError]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events;
    const q = searchQuery.toLowerCase();
    return events.filter((ev: any) =>
      String(ev.title || '').toLowerCase().includes(q) ||
      String(ev.body || '').toLowerCase().includes(q) ||
      String(ev.actor || '').toLowerCase().includes(q) ||
      String((ev.departments || []).join(',')).toLowerCase().includes(q) ||
      String(ev.work_order_id || '').includes(q)
    );
  }, [events, searchQuery]);

  if (loading) return <LoadingState message="Loading notifications..." />;

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] bg-white p-5 text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.12)] border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="md:hidden text-[10px] font-black uppercase tracking-widest text-blue-700">Alerts Center</div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 md:text-gray-800">Notification Audit</h2>
          <p className="text-xs font-semibold text-slate-600 md:text-gray-500 text-left">Last 200 notification events from push function.</p>
        </div>
        <button onClick={fetchEvents} className="px-4 py-3 md:py-2 bg-blue-600 md:bg-slate-900 text-white rounded-2xl md:rounded-xl text-sm font-black">Refresh</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by title, message, user, department, order id..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm"
        />
      </div>

      <div className="md:hidden space-y-2.5">
        {filteredEvents.map((ev: any) => {
          const failed = Number(ev.failed || 0);
          const sent = Number(ev.sent || 0);
          const targets = Number(ev.targets || 0);
          const tone = failed > 0 ? 'border-l-red-500' : sent > 0 ? 'border-l-emerald-500' : 'border-l-amber-500';

          return (
            <div key={ev.id} className={`rounded-2xl bg-white border border-gray-100 border-l-4 ${tone} p-3.5 shadow-sm`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">{formatEventTime(ev)}</div>
                  <h3 className="mt-1 text-sm font-black text-slate-900 leading-tight">{ev.title}</h3>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] font-black text-indigo-600">WO #{ev.work_order_id || '-'}</div>
                </div>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-600 whitespace-pre-line">{ev.body}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(ev.departments || []).map((d: string) => <Badge key={d} color="gray">{d}</Badge>)}
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl bg-gray-50 px-2 py-2"><div className="text-[9px] font-black text-gray-400 uppercase">By</div><div className="text-[10px] font-black text-slate-700 truncate">{ev.actor || '-'}</div></div>
                <div className="rounded-xl bg-gray-50 px-2 py-2"><div className="text-[9px] font-black text-gray-400 uppercase">Targets</div><div className="text-xs font-black text-slate-900">{targets}</div></div>
                <div className="rounded-xl bg-emerald-50 px-2 py-2"><div className="text-[9px] font-black text-emerald-600 uppercase">Sent</div><div className="text-xs font-black text-emerald-700">{sent}</div></div>
                <div className="rounded-xl bg-red-50 px-2 py-2"><div className="text-[9px] font-black text-red-600 uppercase">Failed</div><div className="text-xs font-black text-red-700">{failed}</div></div>
              </div>
            </div>
          );
        })}
        {filteredEvents.length === 0 && <div className="rounded-2xl bg-white p-8 text-center text-sm font-semibold text-gray-400">No notification events found.</div>}
      </div>

      <Card className="hidden md:block p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-widest text-gray-400 font-black border-b">
              <tr>
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Message</th>
                <th className="px-4 py-2 text-left">Done By</th>
                <th className="px-4 py-2 text-left">Departments</th>
                <th className="px-4 py-2 text-left">WO #</th>
                <th className="px-4 py-2 text-left">Targets</th>
                <th className="px-4 py-2 text-left">Sent</th>
                <th className="px-4 py-2 text-left">Failed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEvents.map((ev: any) => (
                <tr key={ev.id}>
                  <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{formatEventTime(ev)}</td>
                  <td className="px-4 py-2 font-black text-slate-800 whitespace-nowrap">{ev.title}</td>
                  <td className="px-4 py-2 text-xs text-gray-600">{ev.body}</td>
                  <td className="px-4 py-2 text-xs font-bold text-gray-700 whitespace-nowrap">{ev.actor || '-'}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {(ev.departments || []).map((d: string) => <Badge key={d} color="gray">{d}</Badge>)}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs font-black text-indigo-600">{ev.work_order_id || '-'}</td>
                  <td className="px-4 py-2 font-bold">{ev.targets}</td>
                  <td className="px-4 py-2 font-bold text-green-600">{ev.sent}</td>
                  <td className="px-4 py-2 font-bold text-red-600">{ev.failed}</td>
                </tr>
              ))}
              {filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400 italic">No notification events found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const ReportsView: React.FC<{ onError: () => void }> = ({ onError }) => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [dispatchLogs, setDispatchLogs] = useState<any[]>([]);
  const [reportType, setReportType] = useState<'dispatch' | 'company' | 'item'>('dispatch');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [activePreset, setActivePreset] = useState<'today' | '7d' | '30d' | '90d' | 'all' | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      try {
        const [{ data: woRes, error: woErr }, { data: dispatchRes, error: dispatchErr }] = await Promise.all([
          supabase.from('work_orders').select('*').order('id', { ascending: false }),
          supabase.from('dispatch_logs').select('*').order('created_at', { ascending: false }),
        ]);

        if (woErr?.code === '42P01' || dispatchErr?.code === '42P01') {
          onError();
          return;
        }

        if (woRes) {
          const normalized = woRes.map((wo: any) => ({
            ...wo,
            assigned_departments: parseAssignedDepartments(wo.assigned_departments),
          }));
          setOrders(normalized);
        }

        if (dispatchErr) {
          console.warn('Dispatch logs fetch issue:', dispatchErr.message);
        }
        setDispatchLogs(dispatchRes || []);
      } catch (e) {
        onError();
      }
      setLoading(false);
    };

    fetchReportData();
  }, [onError]);

  const orderById = useMemo(() => {
    const map = new Map<number, any>();
    orders.forEach(order => map.set(Number(order.id), order));
    return map;
  }, [orders]);

  const parseDate = (value: string | null | undefined, fallbackMidday = false): Date | null => {
    if (!value) return null;
    const date = new Date(fallbackMidday ? `${value}T12:00:00` : value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const inRange = (date: Date | null) => {
    const from = fromDate ? parseDate(`${fromDate}T00:00:00`) : null;
    const to = toDate ? parseDate(`${toDate}T23:59:59`) : null;
    if (!from && !to) return true;
    if (!date) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  };

  const dispatchRows = useMemo(() => {
    const invoiceQ = invoiceSearch.trim().toLowerCase();
    const vehicleQ = vehicleSearch.trim().toLowerCase();

    const fromLogs = dispatchLogs
      .map((log: any) => {
        const order = orderById.get(Number(log.work_order_id));
        return {
          ...log,
          order,
          when: parseDate(log.created_at),
        };
      })
      .filter((row: any) => {
        if (!inRange(row.when)) return false;
        if (invoiceQ && !String(row.invoice_no || '').toLowerCase().includes(invoiceQ)) return false;
        if (vehicleQ && !String(row.vehicle_no || '').toLowerCase().includes(vehicleQ)) return false;
        return true;
      });

    if (fromLogs.length > 0) return fromLogs;

    return orders
      .map((order: any) => {
        const qtyDispatched = Number(order.qty_dispatched) || 0;
        const invoice = String(order.last_invoice_no || '').trim();
        const vehicle = String(order.last_vehicle_no || '').trim();
        const when = parseDate(order.updated_at) || parseDate(order.created_at) || parseDate(order.etd, true);
        return {
          id: `fallback-${order.id}`,
          work_order_id: order.id,
          dispatch_qty: qtyDispatched,
          invoice_no: invoice,
          vehicle_no: vehicle,
          dispatched_by: '-',
          order,
          when,
        };
      })
      .filter((row: any) => {
        const hasDispatchData = row.dispatch_qty > 0 || !!row.invoice_no || !!row.vehicle_no;
        if (!hasDispatchData) return false;
        if (!inRange(row.when)) return false;
        if (invoiceQ && !String(row.invoice_no || '').toLowerCase().includes(invoiceQ)) return false;
        if (vehicleQ && !String(row.vehicle_no || '').toLowerCase().includes(vehicleQ)) return false;
        return true;
      });
  }, [dispatchLogs, orders, orderById, fromDate, toDate, invoiceSearch, vehicleSearch]);

  const companyRows = useMemo(() => {
    const companyQ = companySearch.trim().toLowerCase();
    const grouped = new Map<string, {
      company: string;
      orders: number;
      totalQty: number;
      inStockQty: number;
      dispatchedQty: number;
      completedQty: number;
      pendingQty: number;
    }>();

    orders.forEach((order: any) => {
      const orderDate = parseDate(order.created_at) || parseDate(order.etd, true);
      if (!inRange(orderDate)) return;

      const company = String(order.customer || 'Unknown');
      if (companyQ && !company.toLowerCase().includes(companyQ)) return;

      const row = grouped.get(company) || {
        company,
        orders: 0,
        totalQty: 0,
        inStockQty: 0,
        dispatchedQty: 0,
        completedQty: 0,
        pendingQty: 0,
      };
      const qty = Number(order.qty) || 0;
      const dispatched = Number(order.qty_dispatched) || 0;
      const pending = Math.max(0, qty - dispatched);
      const isDelivered = order.status === 'Delivered';
      const isReadyForDispatch = ['QC Approved', 'Ready for despatch', 'Dispatched'].includes(order.status) && pending > 0;
      row.orders += 1;
      row.totalQty += qty;
      row.dispatchedQty += dispatched;
      row.pendingQty += pending;
      row.completedQty += isDelivered ? qty : 0;
      row.inStockQty += isReadyForDispatch ? pending : 0;
      grouped.set(company, row);
    });

    return Array.from(grouped.values()).sort((a, b) => b.orders - a.orders);
  }, [orders, fromDate, toDate, companySearch]);

  const itemRows = useMemo(() => {
    const itemQ = itemSearch.trim().toLowerCase();
    const grouped = new Map<string, {
      item: string;
      companies: Set<string>;
      orders: number;
      totalQty: number;
      inStockQty: number;
      dispatchedQty: number;
      completedQty: number;
      pendingQty: number;
    }>();

    orders.forEach((order: any) => {
      const orderDate = parseDate(order.created_at) || parseDate(order.etd, true);
      if (!inRange(orderDate)) return;

      const item = String(order.job_details || 'Unknown');
      if (itemQ && !item.toLowerCase().includes(itemQ)) return;

      const row = grouped.get(item) || {
        item,
        companies: new Set<string>(),
        orders: 0,
        totalQty: 0,
        inStockQty: 0,
        dispatchedQty: 0,
        completedQty: 0,
        pendingQty: 0,
      };
      const qty = Number(order.qty) || 0;
      const dispatched = Number(order.qty_dispatched) || 0;
      const pending = Math.max(0, qty - dispatched);
      const isDelivered = order.status === 'Delivered';
      const isReadyForDispatch = ['QC Approved', 'Ready for despatch', 'Dispatched'].includes(order.status) && pending > 0;
      row.orders += 1;
      row.totalQty += qty;
      row.dispatchedQty += dispatched;
      row.pendingQty += pending;
      row.completedQty += isDelivered ? qty : 0;
      row.inStockQty += isReadyForDispatch ? pending : 0;
      row.companies.add(String(order.customer || 'Unknown'));
      grouped.set(item, row);
    });

    return Array.from(grouped.values())
      .map(row => ({
        ...row,
        companyCount: row.companies.size,
      }))
      .sort((a, b) => b.orders - a.orders);
  }, [orders, fromDate, toDate, itemSearch]);

  const vehicleOptions = useMemo(() => {
    const unique = new Set<string>();
    dispatchLogs.forEach((log: any) => {
      const vehicle = String(log?.vehicle_no || '').trim();
      if (vehicle) unique.add(vehicle);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [dispatchLogs]);

  const itemOptions = useMemo(() => {
    const unique = new Set<string>();
    orders.forEach((order: any) => {
      const item = String(order?.job_details || '').trim();
      if (item) unique.add(item);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const reportRowsCount = reportType === 'dispatch' ? dispatchRows.length : reportType === 'company' ? companyRows.length : itemRows.length;

  const reportTotals = useMemo(() => {
    if (reportType === 'dispatch') {
      return {
        qty: dispatchRows.reduce((sum: number, row: any) => sum + (Number(row.dispatch_qty) || 0), 0),
        uniqueWOs: new Set(dispatchRows.map((r: any) => r.work_order_id)).size,
        uniqueCustomers: new Set(dispatchRows.map((r: any) => r.order?.customer).filter(Boolean)).size,
      };
    }
    if (reportType === 'company') {
      return {
        qty: companyRows.reduce((sum, row) => sum + row.totalQty, 0),
        inStock: companyRows.reduce((sum, row) => sum + row.inStockQty, 0),
        dispatched: companyRows.reduce((sum, row) => sum + row.dispatchedQty, 0),
        completed: companyRows.reduce((sum, row) => sum + row.completedQty, 0),
        pending: companyRows.reduce((sum, row) => sum + row.pendingQty, 0),
      };
    }
    return {
      qty: itemRows.reduce((sum, row) => sum + row.totalQty, 0),
      inStock: itemRows.reduce((sum, row) => sum + row.inStockQty, 0),
      dispatched: itemRows.reduce((sum, row) => sum + row.dispatchedQty, 0),
      completed: itemRows.reduce((sum, row) => sum + row.completedQty, 0),
      pending: itemRows.reduce((sum, row) => sum + row.pendingQty, 0),
    };
  }, [reportType, dispatchRows, companyRows, itemRows]);

  const handleSort = (key: string) => {
    setSortConfig(sc => sc?.key === key ? { key, dir: sc.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  };

  const applySortGeneric = <T extends Record<string, any>>(rows: T[]): T[] => {
    if (!sortConfig) return rows;
    const { key, dir } = sortConfig;
    return [...rows].sort((a, b) => {
      const av = a[key], bv = b[key];
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av ?? '').localeCompare(String(bv ?? ''));
      return dir === 'asc' ? cmp : -cmp;
    });
  };

  const sortedDispatchRows = useMemo(() => applySortGeneric(
    dispatchRows.map((r: any) => ({
      ...r,
      _date: r.when ? r.when.getTime() : 0,
      _customer: r.order?.customer || '',
      _item: r.order?.job_details || '',
    }))
  ), [dispatchRows, sortConfig]);

  const sortedCompanyRows = useMemo(() => applySortGeneric(companyRows), [companyRows, sortConfig]);
  const sortedItemRows = useMemo(() => applySortGeneric(itemRows), [itemRows, sortConfig]);

  const downloadCsv = (filename: string, rows: Record<string, any>[]) => {
    if (rows.length === 0) {
      alert('No rows available for export.');
      return;
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(row => headers.map(h => {
        const raw = String(row[h] ?? '');
        return raw.includes(',') || raw.includes('"') || raw.includes('\n') ? `"${raw.replace(/"/g, '""')}"` : raw;
      }).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportCurrentReport = () => {
    if (reportType === 'dispatch') {
      downloadCsv('dispatch-report.csv', dispatchRows.map((row: any) => ({
        date: row.when ? new Date(row.when).toLocaleString() : '-',
        work_order_id: row.work_order_id,
        customer: row.order?.customer || '-',
        item: row.order?.job_details || '-',
        dispatch_qty: row.dispatch_qty,
        invoice_no: row.invoice_no,
        vehicle_no: row.vehicle_no,
        dispatched_by: row.dispatched_by || '-',
      })));
      return;
    }

    if (reportType === 'company') {
      downloadCsv('company-report.csv', companyRows.map(row => ({
        company: row.company,
        total_orders: row.orders,
        total_qty: row.totalQty,
        in_stock_qty: row.inStockQty,
        dispatched_qty: row.dispatchedQty,
        completed_qty: row.completedQty,
        pending_qty: row.pendingQty,
      })));
      return;
    }

    downloadCsv('item-report.csv', itemRows.map(row => ({
      item: row.item,
      companies: row.companyCount,
      total_orders: row.orders,
      total_qty: row.totalQty,
      in_stock_qty: row.inStockQty,
      dispatched_qty: row.dispatchedQty,
      completed_qty: row.completedQty,
      pending_qty: row.pendingQty,
    })));
  };

  const applyQuickRange = (range: 'today' | '7d' | '30d' | '90d' | 'all') => {
    setActivePreset(range);
    const now = new Date();

    if (range === 'all') {
      setFromDate('');
      setToDate('');
      return;
    }

    if (range === 'today') {
      const today = toIsoDate(now);
      setFromDate(today);
      setToDate(today);
      return;
    }

    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const from = new Date(now);
    from.setDate(now.getDate() - days);
    setFromDate(toIsoDate(from));
    setToDate(toIsoDate(now));
  };

  if (loading) return <LoadingState message="Loading reports..." />;

  const thClass = "px-4 py-3 text-left cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap";

  const SortIcon = ({ col }: { col: string }) => (
    sortConfig?.key === col
      ? <span className="ml-1 text-indigo-500">{sortConfig.dir === 'asc' ? '↑' : '↓'}</span>
      : <span className="ml-1 opacity-25">↕</span>
  );

  const presetButtons: { key: 'today' | '7d' | '30d' | '90d' | 'all'; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-4">
      <div className="sticky top-16 md:top-0 z-20 bg-gray-50/95 backdrop-blur p-2 rounded-xl border border-gray-100 flex flex-col md:flex-row gap-2 md:items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-800 tracking-tight">Reports</h2>
          <p className="text-xs text-gray-500 font-semibold">Dispatch · Company · Item performance</p>
        </div>
        <button onClick={exportCurrentReport} className="w-full md:w-auto px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2">
          <FileText size={13} />
          Export CSV
        </button>
      </div>

      <Card className="space-y-3">
        {/* Quick presets */}
        <div className="flex flex-wrap gap-1.5">
          {presetButtons.map(btn => (
            <button
              key={btn.key}
              onClick={() => applyQuickRange(btn.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                activePreset === btn.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setActivePreset(null); }}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm mt-0.5"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={e => { setToDate(e.target.value); setActivePreset(null); }}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm mt-0.5"
            />
          </div>
        </div>

        {/* Report type tabs */}
        <div className="inline-flex bg-gray-100 rounded-xl p-1 w-full sm:w-auto">
          {([
            { key: 'dispatch', label: 'Dispatch' },
            { key: 'company', label: 'Company-wise' },
            { key: 'item', label: 'Item-wise' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setReportType(tab.key); setSortConfig(null); }}
              className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-black transition-all ${reportType === tab.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search filters */}
        {reportType === 'dispatch' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              placeholder="Search invoice number"
              value={invoiceSearch}
              onChange={e => setInvoiceSearch(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm"
            />
            <input
              placeholder="Search vehicle number"
              value={vehicleSearch}
              onChange={e => setVehicleSearch(e.target.value)}
              list="vehicle-options"
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm"
            />
            <datalist id="vehicle-options">
              {vehicleOptions.map(vehicle => (
                <option key={vehicle} value={vehicle} />
              ))}
            </datalist>
          </div>
        )}

        {reportType === 'company' && (
          <input
            placeholder="Search company/customer"
            value={companySearch}
            onChange={e => setCompanySearch(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm"
          />
        )}

        {reportType === 'item' && (
          <>
            <input
              placeholder="Search item/job"
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              list="item-options"
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm"
            />
            <datalist id="item-options">
              {itemOptions.map(item => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </>
        )}
      </Card>

      {/* Stats cards — 4 cards per tab */}
      {reportType === 'dispatch' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <Card className="p-3">
            <div className="text-[10px] uppercase font-black text-gray-400">Records</div>
            <div className="text-xl font-black text-gray-800 mt-1">{dispatchRows.length}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase font-black text-gray-400">Total Dispatched</div>
            <div className="text-xl font-black text-indigo-700 mt-1">{reportTotals.qty}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase font-black text-gray-400">Work Orders</div>
            <div className="text-xl font-black text-gray-800 mt-1">{(reportTotals as any).uniqueWOs ?? 0}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase font-black text-gray-400">Customers</div>
            <div className="text-xl font-black text-gray-800 mt-1">{(reportTotals as any).uniqueCustomers ?? 0}</div>
          </Card>
        </div>
      )}

      {(reportType === 'company' || reportType === 'item') && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
          <Card className="p-3">
            <div className="text-[10px] uppercase font-black text-gray-400">{reportType === 'company' ? 'Companies' : 'Items'}</div>
            <div className="text-xl font-black text-gray-800 mt-1">{reportRowsCount}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase font-black text-gray-400">Total Qty</div>
            <div className="text-xl font-black text-indigo-700 mt-1">{reportTotals.qty}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase font-black text-gray-400">In Stock</div>
            <div className="text-xl font-black text-blue-700 mt-1">{(reportTotals as any).inStock ?? 0}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase font-black text-gray-400">Dispatched</div>
            <div className="text-xl font-black text-green-700 mt-1">{(reportTotals as any).dispatched ?? 0}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase font-black text-gray-400">Completed</div>
            <div className="text-xl font-black text-emerald-700 mt-1">{(reportTotals as any).completed ?? 0}</div>
          </Card>
          <Card className="p-3 col-span-2 sm:col-span-1">
            <div className="text-[10px] uppercase font-black text-gray-400">Pending</div>
            <div className="text-xl font-black text-orange-600 mt-1">{(reportTotals as any).pending ?? 0}</div>
          </Card>
        </div>
      )}

      {/* Dispatch table */}
      {reportType === 'dispatch' && (
        <Card className="p-0 overflow-hidden shadow-sm">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-black border-b">
                <tr>
                  <th className={thClass} onClick={() => handleSort('_date')}>Date <SortIcon col="_date" /></th>
                  <th className={thClass} onClick={() => handleSort('work_order_id')}>WO <SortIcon col="work_order_id" /></th>
                  <th className={thClass} onClick={() => handleSort('_customer')}>Company <SortIcon col="_customer" /></th>
                  <th className={thClass} onClick={() => handleSort('_item')}>Item <SortIcon col="_item" /></th>
                  <th className={thClass} onClick={() => handleSort('dispatch_qty')}>Qty <SortIcon col="dispatch_qty" /></th>
                  <th className={thClass} onClick={() => handleSort('invoice_no')}>Invoice <SortIcon col="invoice_no" /></th>
                  <th className={thClass} onClick={() => handleSort('vehicle_no')}>Vehicle <SortIcon col="vehicle_no" /></th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedDispatchRows.map((row: any) => (
                  <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{row.when ? new Date(row.when).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3 font-black text-indigo-600">#{row.work_order_id}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{row.order?.customer || '-'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{row.order?.job_details || '-'}</td>
                    <td className="px-4 py-3 font-black text-gray-800">{row.dispatch_qty}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{row.invoice_no || '-'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{row.vehicle_no || '-'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{row.dispatched_by || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden p-2 space-y-2">
            {dispatchRows.map((row: any) => (
              <div key={row.id} className="rounded-lg border border-gray-200 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-black text-indigo-700 text-sm">WO #{row.work_order_id}</div>
                  <div className="text-[11px] font-semibold text-gray-500">Qty: {row.dispatch_qty}</div>
                </div>
                <div className="text-xs text-gray-700 font-semibold mt-1 break-words">{row.order?.customer || '-'} • {row.order?.job_details || '-'}</div>
                <div className="text-[11px] text-gray-500 font-semibold mt-1">Invoice: {row.invoice_no || '-'} | Vehicle: {row.vehicle_no || '-'}</div>
              </div>
            ))}
          </div>
          {dispatchRows.length === 0 && <div className="py-12 text-center text-gray-400 italic text-sm">No dispatch records for the selected range.</div>}
        </Card>
      )}

      {/* Company-wise table */}
      {reportType === 'company' && (
        <Card className="p-0 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-black border-b">
                <tr>
                  <th className={thClass} onClick={() => handleSort('company')}>Company Name <SortIcon col="company" /></th>
                  <th className={thClass} onClick={() => handleSort('orders')}>Total Orders <SortIcon col="orders" /></th>
                  <th className={thClass} onClick={() => handleSort('totalQty')}>Total Qty <SortIcon col="totalQty" /></th>
                  <th className={thClass} onClick={() => handleSort('inStockQty')}>In Stock <SortIcon col="inStockQty" /></th>
                  <th className={thClass} onClick={() => handleSort('dispatchedQty')}>Dispatched <SortIcon col="dispatchedQty" /></th>
                  <th className={thClass} onClick={() => handleSort('completedQty')}>Completed <SortIcon col="completedQty" /></th>
                  <th className={thClass} onClick={() => handleSort('pendingQty')}>Pending <SortIcon col="pendingQty" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedCompanyRows.map(row => (
                  <tr key={row.company} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 font-black text-gray-800">{row.company}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{row.orders}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{row.totalQty}</td>
                    <td className="px-4 py-3 font-semibold text-blue-700">{row.inStockQty}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">{row.dispatchedQty}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">{row.completedQty}</td>
                    <td className="px-4 py-3 font-semibold text-orange-700">{row.pendingQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {companyRows.length === 0 && <div className="py-12 text-center text-gray-400 italic text-sm">No company data for the selected range.</div>}
        </Card>
      )}

      {/* Item-wise table */}
      {reportType === 'item' && (
        <Card className="p-0 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-black border-b">
                <tr>
                  <th className={thClass} onClick={() => handleSort('item')}>Item Name <SortIcon col="item" /></th>
                  <th className={thClass} onClick={() => handleSort('companyCount')}>Companies <SortIcon col="companyCount" /></th>
                  <th className={thClass} onClick={() => handleSort('orders')}>Total Orders <SortIcon col="orders" /></th>
                  <th className={thClass} onClick={() => handleSort('totalQty')}>Total Qty <SortIcon col="totalQty" /></th>
                  <th className={thClass} onClick={() => handleSort('inStockQty')}>In Stock <SortIcon col="inStockQty" /></th>
                  <th className={thClass} onClick={() => handleSort('dispatchedQty')}>Dispatched <SortIcon col="dispatchedQty" /></th>
                  <th className={thClass} onClick={() => handleSort('completedQty')}>Completed <SortIcon col="completedQty" /></th>
                  <th className={thClass} onClick={() => handleSort('pendingQty')}>Pending <SortIcon col="pendingQty" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedItemRows.map(row => (
                  <tr key={row.item} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 font-black text-gray-800">{row.item}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{row.companyCount}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{row.orders}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{row.totalQty}</td>
                    <td className="px-4 py-3 font-semibold text-blue-700">{row.inStockQty}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">{row.dispatchedQty}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">{row.completedQty}</td>
                    <td className="px-4 py-3 font-semibold text-orange-700">{row.pendingQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {itemRows.length === 0 && <div className="py-12 text-center text-gray-400 italic text-sm">No item data for the selected range.</div>}
        </Card>
      )}
    </div>
  );
};

// --- App Root ---
export default function App() {
  const [view, setView] = useState<AppView>('dashboard');
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [dbReady, setDbReady] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState<Record<string, boolean>>({});
  const recentNotificationKeysRef = useRef<Record<string, number>>({});
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallAvailable, setIsInstallAvailable] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [notificationEventsPreview, setNotificationEventsPreview] = useState<any[]>([]);
  const [notificationEventsLoading, setNotificationEventsLoading] = useState(false);
  const [showExitHint, setShowExitHint] = useState(false);
  const [notificationHealth, setNotificationHealth] = useState({
    permission: typeof Notification !== 'undefined' ? Notification.permission : ('unsupported' as NotificationPermission | 'unsupported'),
    hasSubscription: false,
    pushSupported: false,
    swReady: false,
    lastError: '',
  });

  // Define role and department constants
  const OFFICE_MANAGER_LEVEL = '1-Manager';
  const OFFICE_STAFF_LEVEL = '3-Staff';
  const QUALITY_DEPT = 'Quality_Control';
  const OFFICE_DEPT = 'Office';
  const viewRef = useRef<AppView>('dashboard');
  const lastExitBackPressRef = useRef(0);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('Service worker registration failed:', err);
      });
    }
  }, []);

  useEffect(() => {
    if (!loggedInUser) return;

    const normDept = normalizeDepartment(loggedInUser.department);
    primeCachedCollection('work_orders', 'id', normDept === 'Office' ? 500 : 250);
    primeCachedCollection('items');
    primeCachedCollection('departments');

    if (canAccessView(loggedInUser, 'customers')) primeCachedCollection('customers');
    if (canAccessView(loggedInUser, 'child-items')) primeCachedCollection('child_items');
    if (canAccessView(loggedInUser, 'users')) primeCachedCollection('users', 'id', 200);
  }, [loggedInUser]);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
      setIsInstallAvailable(true);
    };

    const onAppInstalled = () => {
      setInstallPromptEvent(null);
      setIsInstallAvailable(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!loggedInUser) return;

    const userDept = normalizeDepartment(loggedInUser.department);

    const getNormalizedAssignedDepartments = (workOrder: any): string[] => {
      const parsed = parseAssignedDepartments(workOrder?.assigned_departments);
      return parsed.map((d: string) => normalizeDepartment(d)).filter((d: string) => !!d);
    };

    const notifyOnce = (key: string, title: string, body: string) => {
      const now = Date.now();
      const recent = recentNotificationKeysRef.current[key];
      if (recent && now - recent < 20000) return;

      recentNotificationKeysRef.current[key] = now;
      sendNotification(title, body);
    };

    const isPendingQC = (departmentStatus: any) => (
      departmentStatus?.status === 'Ready for QC' &&
      (!departmentStatus?.qc_status || departmentStatus.qc_status === 'Pending QC')
    );

    const getNewlyStartedDepartments = (oldWorkOrder: any, newStatuses: any[]): string[] => {
      if (!oldWorkOrder?.id) return [];

      const oldStatuses = Array.isArray(oldWorkOrder.department_statuses) ? oldWorkOrder.department_statuses : [];
      const oldStatusByDepartment = new Map(
        oldStatuses.map((departmentStatus: any) => [
          normalizeDepartment(departmentStatus.department),
          departmentStatus.status,
        ])
      );

      return newStatuses
        .filter((departmentStatus: any) => {
          const department = normalizeDepartment(departmentStatus.department);
          return departmentStatus.status === 'Work Started' && oldStatusByDepartment.get(department) !== 'Work Started';
        })
        .map((departmentStatus: any) => normalizeDepartment(departmentStatus.department))
        .filter((department: string) => !!department);
    };

    const channel = supabase
      .channel(`wo-notifications-${loggedInUser.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'work_orders' },
        (payload) => {
          const wo: any = payload.new;
          const assigned = getNormalizedAssignedDepartments(wo);
          const isAssignedToUser = assigned.includes(userDept);

          if (userDept === 'Office') {
            notifyOnce(
              `office-insert-${wo.id}`,
              'New Work Order',
              `Order #${wo.id} created for ${wo.customer || 'customer'}`
            );
          } else if (isAssignedToUser) {
            notifyOnce(
              `insert-${wo.id}-${userDept}`,
              'New Work Assigned',
              `Order #${wo.id} - ${wo.job_details}`
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'work_orders' },
        (payload) => {
          const wo: any = payload.new;
          const oldWo: any = payload.old || {};
          const statuses = Array.isArray(wo.department_statuses) ? wo.department_statuses : [];
          const statusChanged = !!oldWo.id && oldWo.status !== wo.status;

          const oldAssigned = getNormalizedAssignedDepartments(oldWo);
          const newAssigned = getNormalizedAssignedDepartments(wo);
          const wasAssigned = oldAssigned.includes(userDept);
          const isAssignedNow = newAssigned.includes(userDept);

          if (isAssignedNow && !wasAssigned) {
            notifyOnce(
              `assigned-update-${wo.id}-${userDept}`,
              'New Work Assigned',
              `Order #${wo.id} - ${wo.job_details}`
            );
          }

          if (isAssignedNow && statusChanged) {
            notifyOnce(
              `assigned-status-${wo.id}-${wo.status}-${userDept}`,
              'Work Order Updated',
              `Order #${wo.id} status changed to ${wo.status}`
            );
          }

          if (userDept === 'Office' && statusChanged) {
            notifyOnce(
              `office-status-${wo.id}-${wo.status}`,
              'Order Status Updated',
              `Order #${wo.id} is now ${wo.status}`
            );
          }

          if (userDept === 'Office') {
            getNewlyStartedDepartments(oldWo, statuses).forEach((department) => {
              notifyOnce(
                `office-dept-started-${wo.id}-${department}`,
                'Work Started',
                `Order #${wo.id} - ${department.replace(/_/g, ' ')} started work`
              );
            });
          }

          if (userDept === 'Quality_Control') {
            const oldStatuses = Array.isArray(oldWo.department_statuses) ? oldWo.department_statuses : [];
            const hadPendingQC = oldStatuses.some(isPendingQC);
            const pendingQC = statuses.some(isPendingQC);
            if (pendingQC && !hadPendingQC) {
              notifyOnce(
                `qc-${wo.id}-${wo.status}`,
                'QC Check Required',
                `Order #${wo.id} is waiting for QC approval`
              );
            }
          }

          if (userDept === 'Dispatch' && (wo.status === 'QC Approved' || wo.status === 'Ready for despatch')) {
            notifyOnce(
              `dispatch-${wo.id}-${wo.status}`,
              'Dispatch Queue Updated',
              `Order #${wo.id} is ready for dispatch`
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime notifications channel error');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loggedInUser]);

  useEffect(() => {
    const saved = localStorage.getItem('excell_erp_user');
    if (saved) setLoggedInUser(JSON.parse(saved));
  }, []);

  const applyNavigationPayload = useCallback((payload?: AppHistoryState['payload']) => {
    if (!payload) return;
    if (payload.id !== undefined) (window as any)._id = payload.id;
    if (payload.ids !== undefined) (window as any)._ids = payload.ids;
    if (payload.customPlan !== undefined) (window as any)._customPlan = payload.customPlan;
  }, []);

  const buildHistoryState = useCallback((nextView: AppView, payload?: AppHistoryState['payload']): AppHistoryState => {
    const resolvedPayload: AppHistoryState['payload'] = {
      id: payload?.id ?? (window as any)._id,
      ids: payload?.ids ?? (window as any)._ids,
      customPlan: payload?.customPlan ?? (window as any)._customPlan,
    };

    return {
      __app: true,
      view: nextView,
      payload: resolvedPayload,
    };
  }, []);

  const navigateTo = useCallback((nextView: AppView, options?: { replace?: boolean; payload?: AppHistoryState['payload'] }) => {
    applyNavigationPayload(options?.payload);
    setView(nextView);

    const historyState = buildHistoryState(nextView, options?.payload);
    if (options?.replace) {
      window.history.replaceState(historyState, '');
    } else {
      window.history.pushState(historyState, '');
    }
  }, [applyNavigationPayload, buildHistoryState]);

  const handleLogin = (u: User) => { 
    setLoggedInUser(u); 
    localStorage.setItem('excell_erp_user', JSON.stringify(u)); 
    
    // Redirect logic
    const normDept = normalizeDepartment(u.department);
    if (normDept === 'Office') {
      navigateTo('dashboard', { replace: true });
    } else if (normDept === 'Dispatch') {
      navigateTo('dispatch-dashboard', { replace: true });
    } else {
      navigateTo('worker-dashboard', { replace: true });
    }
  };
  const handleLogout = () => { setLoggedInUser(null); localStorage.removeItem('excell_erp_user'); };

  const handleNavClick = (viewId: AppView) => {
    navigateTo(viewId);
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    if (!loggedInUser) return;

    const current = window.history.state as AppHistoryState | null;
    if (!current || !current.__app) {
      window.history.replaceState(buildHistoryState(viewRef.current), '');
    }
  }, [loggedInUser, buildHistoryState]);

  useEffect(() => {
    if (!loggedInUser) return;

    const clearHint = () => setShowExitHint(false);
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as AppHistoryState | null;

      if (state?.__app && state.view) {
        applyNavigationPayload(state.payload);
        setView(state.view);
        clearHint();
        return;
      }

      if (viewRef.current === 'dashboard') {
        const now = Date.now();
        if (now - lastExitBackPressRef.current < 2000) {
          return;
        }

        lastExitBackPressRef.current = now;
        setShowExitHint(true);
        window.setTimeout(() => setShowExitHint(false), 2000);
        window.history.pushState(buildHistoryState('dashboard'), '');
        return;
      }

      window.history.pushState(buildHistoryState(viewRef.current), '');
      setShowExitHint(false);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [loggedInUser, applyNavigationPayload, buildHistoryState]);

  const isStandalone = typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
  const isIOSLike = typeof navigator !== 'undefined' && (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );

  const refreshNotificationHealth = useCallback(async () => {
    const permission: NotificationPermission | 'unsupported' =
      typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

    const pushSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

    let swReady = false;
    let hasSubscription = false;
    let lastError = '';

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js') || await navigator.serviceWorker.getRegistration();
        swReady = !!registration;
        if (registration && 'pushManager' in registration) {
          const subscription = await registration.pushManager.getSubscription();
          hasSubscription = !!subscription;
        }
      }
    } catch (error: any) {
      lastError = String(error?.message || error || 'Unable to read push status');
    }

    setNotificationHealth({ permission, hasSubscription, pushSupported, swReady, lastError });
  }, []);

  const handleEnableNotifications = useCallback(async () => {
    if (!loggedInUser) return;
    if (isIOSLike && !isStandalone) {
      alert('On iPad/iPhone, install the app first: Safari -> Share -> Add to Home Screen. Then open from Home Screen and enable notifications.');
      return;
    }

    setNotificationBusy(true);
    try {
      await registerBackgroundPushForUser(loggedInUser);
    } catch (error: any) {
      alert(`Unable to enable notifications: ${String(error?.message || error || 'Unknown error')}`);
    } finally {
      await refreshNotificationHealth();
      setNotificationBusy(false);
    }
  }, [loggedInUser, isIOSLike, isStandalone, refreshNotificationHealth]);

  useEffect(() => {
    refreshNotificationHealth();
  }, [loggedInUser, isStandalone, refreshNotificationHealth]);

  const handleInstallApp = async () => {
    if (isStandalone) return;

    if (installPromptEvent) {
      await installPromptEvent.prompt();
      await installPromptEvent.userChoice;
      setInstallPromptEvent(null);
      setIsInstallAvailable(false);
      return;
    }

    if (isIOSLike) {
      alert('To install on iPhone/iPad: open in Safari, tap Share, then tap Add to Home Screen.');
      return;
    }

    alert('Install prompt is not ready yet. Refresh once and try again.');
  };

  const canAccess = useCallback((user: User, targetView: AppView): boolean => {
    return canAccessView(user, targetView);
  }, []);

  const onError = useCallback(() => {
    setDbReady(false);
  }, []);

  useEffect(() => {
    (window as any)._setView = (nextView: AppView, payload?: AppHistoryState['payload']) => navigateTo(nextView, { payload });
  }, [navigateTo]);

  type NavItem = {
    id: AppView;
    label: string;
    icon: any;
    highlight?: boolean;
  };

  type NavGroup = {
    key: string;
    label: string;
    items: NavItem[];
  };

  type GlobalSearchResult = {
    key: string;
    type: string;
    title: string;
    subtitle: string;
    icon: any;
    view: AppView;
    payload?: AppHistoryState['payload'];
  };

  const navGroups: NavGroup[] = useMemo(() => {
    return [
      {
        key: 'operations',
        label: 'Operations',
        items: [
          { id: 'dashboard' as AppView, label: 'Dashboard', icon: LayoutDashboard },
          { id: 'worker-dashboard' as AppView, label: 'My Jobs', icon: Hammer },
          { id: 'dispatch-dashboard' as AppView, label: 'Dispatch', icon: Truck },
          { id: 'work-orders' as AppView, label: 'Orders', icon: ClipboardList },
          { id: 'notification-audit' as AppView, label: 'Alerts Log', icon: AlertCircle },
        ],
      },
      {
        key: 'masters',
        label: 'Masters',
        items: [
          { id: 'users' as AppView, label: 'Users', icon: Users },
          { id: 'departments' as AppView, label: 'Depts', icon: Building2 },
          { id: 'customers' as AppView, label: 'Clients', icon: UserCircle },
          { id: 'items' as AppView, label: 'Items', icon: Package },
          { id: 'child-items' as AppView, label: 'Components', icon: Layers },
        ],
      },
      {
        key: 'planning',
        label: 'Planning',
        items: [
          { id: 'production-plan' as AppView, label: 'Prod Plan', icon: FileText, highlight: true },
          { id: 'custom-bom-plan' as AppView, label: 'Custom BOM', icon: ListPlus, highlight: true },
          { id: 'reports' as AppView, label: 'Reports', icon: GanttChartSquare, highlight: true },
        ],
      },
    ]
      .map(group => ({
        ...group,
        items: group.items.filter(item => loggedInUser && canAccess(loggedInUser, item.id)),
      }))
      .filter(group => group.items.length > 0);
  }, [loggedInUser, canAccess]);

  const mobileNavGroups: NavGroup[] = useMemo(() => {
    if (!loggedInUser) return [];

    const normDept = normalizeDepartment(loggedInUser.department);
    const preferredViews: AppView[] = normDept === 'Office'
      ? ['dashboard', 'work-orders', 'production-plan', 'reports']
      : normDept === 'Dispatch'
        ? ['dispatch-dashboard', 'reports', 'notification-audit']
        : normDept === 'Quality_Control'
          ? ['worker-dashboard', 'work-orders', 'notification-audit']
          : ['worker-dashboard', 'notification-audit'];

    const allAccessibleItems = navGroups.flatMap(group => group.items);
    const preferredItems = preferredViews
      .map(targetView => allAccessibleItems.find(item => item.id === targetView))
      .filter(Boolean) as NavItem[];

    const fallbackItems = allAccessibleItems
      .filter(item => !preferredItems.some(preferred => preferred.id === item.id))
      .slice(0, Math.max(0, 4 - preferredItems.length));

    const quickItems = [...preferredItems, ...fallbackItems].slice(0, 4);
    const moreItems = allAccessibleItems.filter(item => !quickItems.some(quick => quick.id === item.id));

    return [
      { key: 'mobile-quick', label: 'Quick Menu', items: quickItems },
      ...(moreItems.length ? [{ key: 'mobile-more', label: 'More', items: moreItems }] : []),
    ];
  }, [loggedInUser, navGroups]);

  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<GlobalSearchResult[]>([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);

  const searchableViews = useMemo(() => (
    navGroups.flatMap(group => group.items.map(item => ({ ...item, group: group.label })))
  ), [navGroups]);

  const openGlobalSearchResult = useCallback((result: GlobalSearchResult) => {
    setGlobalSearchQuery('');
    setGlobalSearchResults([]);
    setIsGlobalSearchOpen(false);
    navigateTo(result.view, { payload: result.payload });
  }, [navigateTo]);

  useEffect(() => {
    if (!loggedInUser) return;

    const query = globalSearchQuery.trim().toLowerCase();
    if (query.length < 2) {
      setGlobalSearchResults([]);
      setGlobalSearchLoading(false);
      return;
    }

    let cancelled = false;
    const includesQuery = (...values: any[]) => values.some(value => String(value || '').toLowerCase().includes(query));

    const timer = window.setTimeout(async () => {
      setGlobalSearchLoading(true);
      try {
        const pageResults: GlobalSearchResult[] = searchableViews
          .filter(item => includesQuery(item.label, item.group))
          .slice(0, 4)
          .map(item => ({
            key: `view-${item.id}`,
            type: 'Page',
            title: item.label,
            subtitle: item.group,
            icon: item.icon,
            view: item.id,
          }));

        const [orders, customers, cachedItems, childItems, users] = await Promise.all([
          loadCachedCollection<WorkOrder>('work_orders', 'id', 150),
          canAccess(loggedInUser, 'customers') ? loadCachedCollection<Customer>('customers') : Promise.resolve([]),
          canAccess(loggedInUser, 'items') ? loadCachedCollection<Item>('items') : Promise.resolve([]),
          canAccess(loggedInUser, 'child-items') ? loadCachedCollection<ChildItem>('child_items') : Promise.resolve([]),
          canAccess(loggedInUser, 'users') ? loadCachedCollection<User>('users', 'id', 150) : Promise.resolve([]),
        ]);

        const visibleOrders = filterWorkOrdersByDepartment(orders, loggedInUser);
        const orderResults: GlobalSearchResult[] = visibleOrders
          .filter(wo => includesQuery(wo.id, wo.customer, wo.job_details, wo.drawing, wo.status))
          .slice(0, 6)
          .map(wo => ({
            key: `wo-${wo.id}`,
            type: 'Work Order',
            title: `Order #${wo.id}`,
            subtitle: `${wo.customer || 'No customer'} - ${wo.job_details || 'No job details'}`,
            icon: ClipboardList,
            view: 'wo-details' as AppView,
            payload: { id: wo.id },
          }));

        const customerResults: GlobalSearchResult[] = customers
          .filter(customer => includesQuery(customer.name, customer.city, customer.contact, customer.email, customer.gst))
          .slice(0, 4)
          .map(customer => ({
            key: `customer-${customer.id}`,
            type: 'Customer',
            title: customer.name,
            subtitle: [customer.city, customer.contact].filter(Boolean).join(' - ') || 'Customer master',
            icon: UserCircle,
            view: 'customers' as AppView,
          }));

        const itemResults: GlobalSearchResult[] = cachedItems
          .filter(item => includesQuery(item.name, item.customer_name, item.drawing_no, item.remarks))
          .slice(0, 4)
          .map(item => ({
            key: `item-${item.id}`,
            type: 'Item',
            title: item.name,
            subtitle: [item.customer_name, item.drawing_no].filter(Boolean).join(' - ') || 'Item master',
            icon: Package,
            view: 'items' as AppView,
          }));

        const componentResults: GlobalSearchResult[] = childItems
          .filter(component => includesQuery(component.name, component.size, ...(component.departments || [])))
          .slice(0, 4)
          .map(component => ({
            key: `component-${component.id}`,
            type: 'Component',
            title: component.name,
            subtitle: (component.departments || []).map(dept => dept.replace(/_/g, ' ')).join(', ') || 'Component library',
            icon: Layers,
            view: 'child-items' as AppView,
          }));

        const userResults: GlobalSearchResult[] = users
          .filter(user => includesQuery(user.username, user.mobile, user.email, user.department, user.level))
          .slice(0, 4)
          .map(user => ({
            key: `user-${user.id}`,
            type: 'User',
            title: user.username,
            subtitle: `${user.department.replace(/_/g, ' ')} - ${user.level}`,
            icon: Users,
            view: 'users' as AppView,
          }));

        if (!cancelled) {
          setGlobalSearchResults([
            ...pageResults,
            ...orderResults,
            ...customerResults,
            ...itemResults,
            ...componentResults,
            ...userResults,
          ].slice(0, 12));
        }
      } finally {
        if (!cancelled) setGlobalSearchLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [globalSearchQuery, loggedInUser, searchableViews, canAccess]);

  useEffect(() => {
    setMobileNavOpen(prev => {
      let hasChanges = false;
      const next = { ...prev };
      navGroups.forEach(group => {
        if (next[group.key] === undefined) {
          next[group.key] = group.items.some(item => item.id === viewRef.current);
          hasChanges = true;
        }
      });
      return hasChanges ? next : prev;
    });
  }, [navGroups]);

  const getNotificationEventTime = useCallback((event: any) => {
    const rawTime = event.event_time || event.created || event.created_at || null;
    if (!rawTime) return 0;
    const timestamp = new Date(rawTime).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }, []);

  const formatNotificationEventTime = useCallback((event: any) => {
    const timestamp = getNotificationEventTime(event);
    if (!timestamp) return 'No time';
    return new Date(timestamp).toLocaleString([], {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [getNotificationEventTime]);

  const fetchNotificationEventsPreview = useCallback(async () => {
    setNotificationEventsLoading(true);
    try {
      const { data } = await supabase
        .from('notification_events')
        .select('*')
        .limit(40);

      const sortedEvents = [...(data || [])]
        .sort((a: any, b: any) => getNotificationEventTime(b) - getNotificationEventTime(a))
        .slice(0, 8);

      setNotificationEventsPreview(sortedEvents);
    } catch (_error) {
      setNotificationEventsPreview([]);
    } finally {
      setNotificationEventsLoading(false);
    }
  }, [getNotificationEventTime]);

  useEffect(() => {
    if (!loggedInUser) return;
    fetchNotificationEventsPreview();
    const timer = window.setInterval(fetchNotificationEventsPreview, 30000);
    return () => window.clearInterval(timer);
  }, [loggedInUser, fetchNotificationEventsPreview]);

  if (!dbReady) return <DatabaseSetup onRetry={() => setDbReady(true)} />;
  if (!loggedInUser) return <Login onLogin={handleLogin} />;

  const renderContent = () => {
    // Initial check for unauthorized view access
    if (!canAccess(loggedInUser, view)) {
      const normDept = normalizeDepartment(loggedInUser.department);
      if (normDept === 'Office') {
        navigateTo('dashboard', { replace: true });
      } else if (normDept === 'Dispatch') {
        navigateTo('dispatch-dashboard', { replace: true });
      } else {
        navigateTo('worker-dashboard', { replace: true });
      }
      return <LoadingState message="Access Denied. Redirecting..." />;
    }

    switch (view) {
      case 'dashboard': return <Dashboard user={loggedInUser} setView={navigateTo} onError={onError} />;
      case 'worker-dashboard': return <WorkerDashboard onError={onError} onView={id => navigateTo('wo-details', { payload: { id } })} loggedInUser={loggedInUser} />;
      case 'dispatch-dashboard': return <DispatchDashboard onError={onError} onView={id => navigateTo('wo-details', { payload: { id } })} loggedInUser={loggedInUser} />;
      case 'users': return <UserList onError={onError} />;
      case 'departments': return <DepartmentList onError={onError} />;
      case 'customers': return <CustomerManagement onError={onError} />;
      case 'items': return <ItemList onError={onError} />;
      case 'child-items': return <ChildItemListView onError={onError} />;
      case 'work-orders': return <WorkOrderList onError={onError} onView={id => navigateTo('wo-details', { payload: { id } })} loggedInUser={loggedInUser} />;
      case 'wo-details': return <WODetails id={(window as any)._id} onBack={() => {
         const normDept = normalizeDepartment(loggedInUser.department);
         if (normDept === 'Office') {
            navigateTo('work-orders');
         } else if (normDept === 'Dispatch') {
            navigateTo('dispatch-dashboard');
         } else {
            navigateTo('worker-dashboard');
         }
      }} loggedInUser={loggedInUser} />;
      case 'production-plan': return <ProductionPlanList onError={onError} onGenerate={ids => navigateTo('plan-generator', { payload: { ids } })} loggedInUser={loggedInUser} />;
      case 'plan-generator': return <PlanGenerator ids={(window as any)._ids} onBack={() => navigateTo('production-plan')} />;
      case 'custom-bom-plan': return <CustomBOMPlanView onError={onError} />;
      case 'custom-bom-print': return <CustomBOMPrintView plan={(window as any)._customPlan} onBack={() => navigateTo('custom-bom-plan')} />;
      case 'reports': return <ReportsView onError={onError} />;
      case 'notification-audit': return <NotificationAuditView onError={onError} />;
      default: return <Dashboard user={loggedInUser} setView={navigateTo} onError={onError} />;
    }
  };

  const shouldShowNotificationBanner = !!loggedInUser && (
    notificationHealth.permission !== 'granted' ||
    !notificationHealth.hasSubscription ||
    (isIOSLike && !isStandalone)
  );

  const notificationStatusText = notificationHealth.permission === 'granted'
    ? (notificationHealth.hasSubscription ? 'Active' : 'Permission granted, subscription missing')
    : notificationHealth.permission === 'denied'
      ? 'Blocked by browser settings'
      : notificationHealth.permission === 'default'
        ? 'Permission not granted yet'
        : 'Notifications unsupported';

  const notificationsReady = notificationHealth.permission === 'granted' && notificationHealth.hasSubscription;
  const notificationDotClass = notificationsReady
    ? 'bg-emerald-400'
    : notificationHealth.permission === 'denied'
      ? 'bg-red-400'
      : 'bg-amber-300';

  return (
    <div className="liquid-app min-h-screen flex bg-[#f3f6f9] overflow-x-hidden">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 12mm;
        }

        @media print {
          .no-print { display: none !important; }
          .lg\\:ml-64 { margin-left: 0 !important; }
          body { background: white !important; }
          html, body { width: 210mm; }
          .print-area { 
            box-shadow: none !important; 
            border: none !important; 
            padding: 0 !important; 
            margin: 0 !important;
            width: 100% !important;
          }

          .custom-bom-print,
          .custom-bom-print-area {
            width: 100% !important;
            max-width: 100% !important;
          }

          .custom-bom-print .custom-bom-item-card {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .custom-bom-print table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed;
          }

          .custom-bom-print th,
          .custom-bom-print td {
            white-space: normal !important;
            word-break: break-word;
            font-size: 11px !important;
          }

          .custom-bom-print .custom-bom-item-head .text-lg {
            font-size: 16px !important;
            line-height: 1.1 !important;
          }

          .plan-dept-grid {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          main { padding: 0 !important; }
        }

        @media screen {
          @keyframes erpFadeUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes erpScaleIn {
            from { opacity: 0; transform: translateY(-4px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }

          @keyframes erpFadeOnly {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes erpSoftPulse {
            0%, 100% { box-shadow: inset 0 0 0 0 rgba(255,255,255,0.12), 0 0 0 rgba(255,255,255,0); }
            50% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18), 0 0 18px rgba(255,255,255,0.16); }
          }

          @keyframes erpShimmer {
            0% { background-position: -240px 0; }
            100% { background-position: calc(240px + 100%) 0; }
          }

          .erp-fade-up {
            animation: erpFadeUp 360ms cubic-bezier(.2,.8,.2,1) both;
          }

          .erp-scale-in {
            animation: erpScaleIn 180ms cubic-bezier(.2,.8,.2,1) both;
          }

          .erp-fade-only {
            animation: erpFadeOnly 220ms ease-out both;
          }

          .erp-stagger > * {
            animation: erpFadeUp 420ms cubic-bezier(.2,.8,.2,1) both;
          }

          .erp-stagger > *:nth-child(1) { animation-delay: 40ms; }
          .erp-stagger > *:nth-child(2) { animation-delay: 90ms; }
          .erp-stagger > *:nth-child(3) { animation-delay: 140ms; }
          .erp-stagger > *:nth-child(4) { animation-delay: 190ms; }
          .erp-stagger > *:nth-child(5) { animation-delay: 240ms; }
          .erp-stagger > *:nth-child(6) { animation-delay: 290ms; }

          .erp-active-pulse {
            animation: erpSoftPulse 1.8s ease-in-out infinite;
          }

          .erp-search-results > * {
            animation: erpFadeUp 220ms cubic-bezier(.2,.8,.2,1) both;
          }

          .erp-search-results > *:nth-child(2) { animation-delay: 25ms; }
          .erp-search-results > *:nth-child(3) { animation-delay: 50ms; }
          .erp-search-results > *:nth-child(4) { animation-delay: 75ms; }
          .erp-search-results > *:nth-child(5) { animation-delay: 100ms; }

          .erp-skeleton {
            background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 45%, #f8fafc 70%, #f1f5f9 100%);
            background-size: 240px 100%;
            animation: erpShimmer 1.4s ease-in-out infinite;
          }

          .liquid-app .liquid-sidebar {
            background: linear-gradient(180deg, #032d60 0%, #083b7a 55%, #062b5f 100%) !important;
            border-right: 1px solid rgba(255,255,255,0.12) !important;
            box-shadow: 0 14px 40px rgba(3,45,96,0.24) !important;
          }

          .liquid-app .liquid-sidebar .liquid-brand,
          .liquid-app .liquid-sidebar .liquid-brand span {
            color: #ffffff !important;
          }

          .liquid-app .liquid-sidebar .liquid-nav-group {
            border-color: rgba(255,255,255,0.14) !important;
            background: rgba(255,255,255,0.04) !important;
          }

          .liquid-app .liquid-sidebar .liquid-nav-head {
            background: rgba(255,255,255,0.06) !important;
            color: #dbeafe !important;
          }

          .liquid-app .liquid-sidebar .liquid-nav-body {
            background: rgba(0,0,0,0.05) !important;
          }

          .liquid-app .liquid-sidebar .liquid-nav-item:not(.liquid-active) {
            color: #d7e8ff !important;
          }

          .liquid-app .liquid-sidebar .liquid-muted-icon {
            color: #b9d7ff !important;
          }

          .liquid-app .liquid-glass-surface {
            background: #ffffff !important;
            border-color: #d8dde6 !important;
            box-shadow: 0 1px 3px rgba(15,23,42,0.14) !important;
          }

          @media (prefers-reduced-motion: reduce) {
            .erp-fade-up,
            .erp-fade-only,
            .erp-scale-in,
            .erp-stagger > *,
            .erp-search-results > *,
            .erp-active-pulse,
            .erp-skeleton {
              animation: none !important;
            }
          }
        }
      `}</style>

      {/* Desktop Sidebar */}
      <aside className="liquid-sidebar hidden lg:flex w-24 bg-[#032d60] flex-col fixed h-full z-40 no-print transition-all duration-300">
        <div className="flex h-[54px] w-[95px] flex-col items-center justify-center border-b border-white/10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-[#0176d3] text-white shadow-lg shadow-blue-950/20" aria-label="Excell Packaging">
            <Package size={25} strokeWidth={2.4} />
          </div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-4 overflow-y-auto">
          {navGroups.map((group) => {
            const isOpen = mobileNavOpen[group.key] ?? group.items.some(item => item.id === view);
            const hasActiveItem = group.items.some(item => item.id === view);
            return (
              <section key={group.key} className="space-y-1.5 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
                <button
                  onClick={() => setMobileNavOpen(prev => ({ ...prev, [group.key]: !isOpen }))}
                  className={`w-full rounded-lg px-1 py-2 text-center text-[9px] font-black uppercase tracking-[0.16em] transition-colors ${hasActiveItem ? 'bg-white/12 text-white' : 'text-blue-100/75 hover:bg-white/10 hover:text-white'}`}
                  title={`${isOpen ? 'Hide' : 'Show'} ${group.label}`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {group.label}
                    <ChevronRight size={11} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  </span>
                </button>
                {isOpen && (
                  <div className="erp-stagger space-y-1.5">
                    {group.items.map((item) => {
                  const isActive = view === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id as AppView)}
                    className={`group w-full min-h-[70px] rounded-xl flex flex-col items-center justify-center gap-1.5 text-center font-semibold text-[11px] leading-tight transition-all ${isActive ? 'text-white' : 'text-blue-50 hover:bg-white/10 hover:text-white'}`}
                      title={`${group.label}: ${item.label}`}
                    >
                      <span className={`flex h-10 w-14 items-center justify-center rounded-xl transition-all ${isActive ? 'erp-active-pulse border-2 border-white bg-white/10 shadow-inner' : 'border border-transparent group-hover:border-white/30'}`}>
                        <item.icon size={25} strokeWidth={2.3} className="text-current" />
                      </span>
                      <span className="max-w-[82px] px-0.5">{item.label}</span>
                    </button>
                  );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Sidebar (Drawer) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Drawer Content */}
          <aside className="liquid-sidebar relative w-[85vw] max-w-64 bg-white/85 backdrop-blur-2xl flex flex-col h-full shadow-2xl animate-in slide-in-from-left duration-300">
            <div className="liquid-brand p-6 border-b border-white/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white shadow-lg"><Package size={20}/></div>
                <span className="text-slate-900 font-black tracking-widest text-lg">EXCELL</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-500 hover:text-slate-900 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <nav className="flex-1 p-3 space-y-2 mt-1 overflow-y-auto">
              {mobileNavGroups.map(group => {
                const isOpen = mobileNavOpen[group.key] ?? group.key === 'mobile-quick';
                return (
                  <div key={group.key} className="liquid-nav-group rounded-xl border border-slate-200/80 overflow-hidden">
                    <button
                      onClick={() => setMobileNavOpen(prev => ({ ...prev, [group.key]: !isOpen }))}
                      className="liquid-nav-head w-full flex items-center justify-between px-3 py-2.5 bg-white/60 text-slate-600"
                    >
                      <span className="text-[10px] font-medium uppercase tracking-widest">{group.label}</span>
                      <ChevronRight size={14} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="liquid-nav-body p-1.5 space-y-1 bg-slate-50/50">
                        {group.items.map(item => (
                          <button
                            key={item.id}
                            onClick={() => handleNavClick(item.id as AppView)}
                            className={`liquid-nav-item ${view === item.id ? 'liquid-active' : ''} w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg font-normal text-[13px] transition-all ${view === item.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-200/70' : item.highlight ? 'text-indigo-600 hover:bg-white/80 bg-white/40 border border-indigo-100' : 'text-slate-600 hover:bg-white/80'}`}
                          >
                            <item.icon size={18} className={view === item.id ? 'text-white' : item.highlight ? 'text-indigo-500' : 'liquid-muted-icon text-slate-500'} />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            
            <div className="p-6 border-t border-white/70 space-y-3">
              {!isStandalone && (isInstallAvailable || isIOSLike) && (
                <button onClick={handleInstallApp} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-emerald-700 hover:bg-emerald-50 text-sm group transition-colors border border-emerald-100 bg-white/40">
                  <ExternalLink size={20} /> Install App
                </button>
              )}
              <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-red-500 hover:bg-red-50 text-sm group transition-colors">
                <LogOut size={20} /> Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 lg:ml-24 flex flex-col min-h-screen transition-all duration-300">
          <div className="hidden lg:flex h-[54px] bg-[#0176d3] text-white items-center justify-center px-5 no-print shadow-sm relative">
            <div className="flex items-center gap-2">
            <div className="relative w-[560px] max-w-[52vw]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={globalSearchQuery}
                onChange={e => {
                  setGlobalSearchQuery(e.target.value);
                  setIsGlobalSearchOpen(true);
                }}
                onFocus={() => setIsGlobalSearchOpen(true)}
                onBlur={() => window.setTimeout(() => setIsGlobalSearchOpen(false), 140)}
                onKeyDown={e => {
                  if (e.key === 'Escape') setIsGlobalSearchOpen(false);
                  if (e.key === 'Enter' && globalSearchResults[0]) openGlobalSearchResult(globalSearchResults[0]);
                }}
                placeholder="Search orders, customers, items, users..."
                className="w-full rounded-full border border-white/30 bg-white pl-11 pr-11 py-2.5 text-sm font-semibold text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-white focus:ring-4 focus:ring-white/20"
              />
              {globalSearchQuery && (
                <button
                  onClick={() => {
                    setGlobalSearchQuery('');
                    setGlobalSearchResults([]);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}

              {isGlobalSearchOpen && globalSearchQuery.trim().length >= 2 && (
                <div className="erp-scale-in absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl shadow-blue-950/20">
                  {globalSearchLoading && (
                    <div className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-slate-500">
                      <Loader2 size={16} className="animate-spin text-blue-600" /> Searching...
                    </div>
                  )}
                  {!globalSearchLoading && globalSearchResults.length === 0 && (
                    <div className="px-4 py-3 text-sm font-bold text-slate-500">No results found</div>
                  )}
                  {!globalSearchLoading && (
                    <div className="erp-search-results">
                      {globalSearchResults.map(result => {
                        const ResultIcon = result.icon;
                        return (
                          <button
                            key={result.key}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => openGlobalSearchResult(result)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50"
                          >
                            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                              <ResultIcon size={18} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-black text-slate-900">{result.title}</span>
                              <span className="block truncate text-xs font-semibold text-slate-500">{result.subtitle}</span>
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                              {result.type}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>
            <div className="absolute right-5 flex items-center gap-2">
              <button onClick={refreshNotificationHealth} className="rounded-full bg-white/15 p-2 hover:bg-white/25 transition-colors" aria-label="Refresh notification status">
                <RefreshCw size={17} />
              </button>
              <button onClick={handleLogout} className="rounded-full bg-white/15 p-2 hover:bg-white/25 transition-colors" aria-label="Sign out" title="Sign out">
                <LogOut size={17} />
              </button>
            </div>
          </div>
          <header className="lg:hidden flex justify-between items-center h-16 bg-[#0176d3] border-b border-blue-700 px-3 sm:px-4 sticky top-0 z-30 no-print shadow-lg shadow-blue-900/20">
             <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-white hover:bg-white/15 rounded-xl transition-colors">
               <Menu size={24} />
             </button>
             <div className="flex items-center gap-2">
               <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-900/40"><Package size={16}/></div>
               <span className="font-black tracking-widest text-lg text-white">EXCELL</span>
             </div>
             <button onClick={refreshNotificationHealth} className="p-2 text-white hover:bg-white/15 rounded-xl transition-colors" aria-label="Refresh notification status">
               <RefreshCw size={20} />
             </button>
          </header>
          <div className={`p-3 pb-24 sm:p-3 md:p-4 lg:pb-4 mx-auto w-full flex-1 ${view === 'work-orders' ? 'max-w-none' : 'max-w-[1700px]'}`}>
           {showExitHint && (
             <div className="mb-2 rounded-lg bg-slate-900 text-white px-3 py-2 text-xs font-bold no-print inline-block">
               Press back again to exit
             </div>
           )}
           {shouldShowNotificationBanner && (
              <div className="mb-3 rounded-2xl border border-blue-200 bg-white/95 lg:bg-blue-50/80 px-3 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 no-print shadow-sm lg:hidden">
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-wider text-blue-700 flex items-center gap-1.5"><AlertCircle size={14}/> Notification Setup</div>
                  <div className="text-xs font-semibold text-blue-800 mt-0.5 break-words">
                   {notificationStatusText}
                   {isIOSLike && !isStandalone ? ' - Open from Home Screen app to receive push on iOS.' : ''}
                 </div>
                 {notificationHealth.lastError && (
                   <div className="text-[11px] text-blue-700 mt-0.5 break-words">{notificationHealth.lastError}</div>
                 )}
               </div>
               <div className="flex items-center gap-2">
                 {!isStandalone && isIOSLike && (
                   <button onClick={handleInstallApp} className="px-3 py-2 rounded-lg text-xs font-black bg-white text-blue-700 border border-blue-200">Install App</button>
                 )}
                 <button
                   onClick={handleEnableNotifications}
                   disabled={notificationBusy || notificationHealth.permission === 'denied'}
                   className="px-3 py-2 rounded-lg text-xs font-black bg-blue-600 text-white disabled:opacity-50"
                 >
                   {notificationBusy ? 'Enabling...' : 'Enable Notifications'}
                 </button>
                 <button onClick={refreshNotificationHealth} className="px-3 py-2 rounded-lg text-xs font-black bg-white text-blue-700 border border-blue-200">Refresh</button>
               </div>
             </div>
           )}
            <div key={view} className="erp-fade-only">
              {renderContent()}
            </div>
          </div>
          <div className="hidden lg:block no-print">
            {isNotificationMenuOpen && (
              <div className="erp-scale-in fixed bottom-24 right-6 z-50 w-[380px] overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-800 shadow-2xl shadow-blue-950/20">
                <div className="bg-[#0176d3] px-4 py-4 text-white">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative rounded-2xl bg-white/15 p-2">
                        <Bell size={20} />
                        <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#0176d3] ${notificationDotClass}`} />
                      </div>
                      <div>
                        <div className="text-sm font-black">Notifications</div>
                        <div className="text-xs font-semibold text-blue-100">{notificationStatusText}</div>
                      </div>
                    </div>
                    <button onClick={() => setIsNotificationMenuOpen(false)} className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white" aria-label="Close notifications">
                      <X size={18} />
                    </button>
                  </div>
                  {notificationHealth.lastError && (
                    <div className="mt-2 rounded-xl bg-white/12 px-3 py-2 text-[11px] font-semibold text-blue-50">{notificationHealth.lastError}</div>
                  )}
                </div>

                <div className="max-h-[360px] overflow-y-auto p-3">
                  {notificationEventsLoading && (
                    <div className="space-y-2 p-2">
                      <div className="erp-skeleton h-12 rounded-2xl" />
                      <div className="erp-skeleton h-12 rounded-2xl" />
                      <div className="erp-skeleton h-12 rounded-2xl" />
                    </div>
                  )}
                  {!notificationEventsLoading && notificationEventsPreview.length === 0 && (
                    <div className="px-4 py-10 text-center text-sm font-semibold text-slate-400">No notification events yet.</div>
                  )}
                  {!notificationEventsLoading && notificationEventsPreview.map((event) => {
                    const failed = Number(event.failed || 0);
                    const sent = Number(event.sent || 0);
                    const tone = failed > 0 ? 'bg-red-500' : sent > 0 ? 'bg-emerald-500' : 'bg-amber-400';
                    return (
                      <div key={event.id} className="mb-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 last:mb-0">
                        <div className="flex items-start gap-3">
                          <span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${tone}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="truncate text-sm font-black text-slate-900">{event.title || 'Notification'}</div>
                              <div className="whitespace-nowrap text-[10px] font-bold text-slate-400">{formatNotificationEventTime(event)}</div>
                            </div>
                            <div className="mt-1 line-clamp-2 whitespace-pre-line text-xs font-semibold text-slate-600">{event.body || '-'}</div>
                            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                              <span>WO #{event.work_order_id || '-'}</span>
                              <span>{sent} sent / {failed} failed</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 bg-slate-50 p-3">
                  {!notificationsReady ? (
                    <button
                      onClick={() => void handleEnableNotifications()}
                      disabled={notificationBusy || notificationHealth.permission === 'denied'}
                      className="col-span-3 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {notificationBusy ? 'Enabling...' : 'Enable Notifications'}
                    </button>
                  ) : null}
                  <button onClick={() => { navigateTo('notification-audit'); setIsNotificationMenuOpen(false); }} className="col-span-2 rounded-xl bg-white px-3 py-2.5 text-xs font-black text-slate-700 shadow-sm transition-colors hover:bg-blue-50 hover:text-blue-700">
                    Open Alerts Log
                  </button>
                  <button onClick={() => { void refreshNotificationHealth(); void fetchNotificationEventsPreview(); }} className="rounded-xl bg-white px-3 py-2.5 text-xs font-black text-slate-700 shadow-sm transition-colors hover:bg-blue-50 hover:text-blue-700">
                    Refresh
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={() => setIsNotificationMenuOpen(prev => !prev)}
              className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-[#0176d3] text-white shadow-2xl shadow-blue-300/80 transition-all hover:bg-[#0b5cab] hover:shadow-blue-400/80"
              aria-label="Open notifications"
              title="Notifications"
            >
              <Bell size={25} />
              <span className={`absolute right-3 top-3 h-3.5 w-3.5 rounded-full border-2 border-[#0176d3] ${notificationDotClass}`} />
            </button>
          </div>
          <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-40 no-print border border-white/70 bg-white/82 backdrop-blur-2xl rounded-3xl px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl shadow-slate-300/50">
            <div className="grid grid-cols-5 gap-1">
              {navGroups.flatMap(group => group.items).slice(0, 5).map(item => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id as AppView)}
                  className={`min-h-14 rounded-2xl flex flex-col items-center justify-center gap-1 text-[10px] font-normal transition-colors ${view === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200/80' : 'text-slate-500 hover:bg-white/80 hover:text-slate-900'}`}
                >
                  <item.icon size={18} />
                  <span className="truncate max-w-full px-1">{item.label}</span>
                </button>
              ))}
            </div>
          </nav>
       </main>
    </div>
  );
}

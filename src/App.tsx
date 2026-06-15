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
  Upload,
  Pencil,
  ListTodo,
  Monitor,
  ShoppingCart
} from 'lucide-react';
import { AppView, User, Customer, Item, WorkOrder, Department, WOStatus, ChildItem, DepartmentStatus, Metric } from './types';
import { supabase, supabaseAnonKey, loginWithMobilePassword, getCurrentAuthUser, logoutAuth } from './supabase';
import { canAccessView, filterWorkOrdersByDepartment, getQCApprovalProgress, sendNotification, normalizeDepartment } from './utils';
import DepartmentStatusTracker from './DepartmentStatusTracker';
import DailyTasks from './DailyTasks';
import LiveScreen from './LiveScreen';
import ClientPortal from './ClientPortal';
import ClientOrderManager from './ClientOrderManager';
import { getCachedData, invalidateCachedData, primeCachedData } from './dataCache';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    backView?: AppView;
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
    'Work Started': { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Work Started' },
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

const statusTabColors: Record<string, string> = {
  'Not Started': 'bg-gray-100 text-gray-700 border-gray-200',
  'Work Started': 'bg-blue-100 text-blue-700 border-blue-200',
  'Ready for QC': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'QC Approved': 'bg-green-100 text-green-700 border-green-200',
  'Ready for despatch': 'bg-purple-100 text-purple-700 border-purple-200',
  'Dispatched': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Delivered': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Cancelled': 'bg-red-100 text-red-700 border-red-200',
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

const getItemForWorkOrder = (items: Item[], wo: WorkOrder) => {
  const customerKey = normalizeDuplicateKey(wo.customer || '');
  const itemNameKey = normalizeDuplicateKey(wo.job_details || '');
  return items.find(item =>
    normalizeDuplicateKey(item.name || '') === itemNameKey &&
    normalizeDuplicateKey(item.customer_name || '') === customerKey
  ) || items.find(item => normalizeDuplicateKey(item.name || '') === itemNameKey);
};

const getEditableDepartmentForUser = (wo: WorkOrder, user: User) => {
  const userDept = normalizeDepartment(user.department);
  if (userDept === 'Office') return '';

  const departments = wo.assigned_departments || [];
  if (userDept === 'Quality_Control') {
    return departments.find(dept => {
      const deptStatus = (wo.department_statuses || []).find(status => normalizeDepartment(status.department) === normalizeDepartment(dept));
      return deptStatus?.status === 'Ready for QC' && deptStatus.qc_status !== 'QC Approved';
    }) || '';
  }

  return departments.find(dept => normalizeDepartment(dept) === userDept) || '';
};

const getCardStatusOptions = (wo: WorkOrder, user: User): string[] => {
  const userDept = normalizeDepartment(user.department);
  if (userDept === 'Office') return ['Not Started', 'Work Started', 'Ready for QC', 'Ready for despatch', 'Cancelled'];
  if (userDept === 'Quality_Control') return getEditableDepartmentForUser(wo, user) ? ['QC Approved', 'QC Denied'] : [];
  return getEditableDepartmentForUser(wo, user) ? ['Not Started', 'Work Started', 'Ready for QC'] : [];
};

const isCardStatusCurrent = (wo: WorkOrder, user: User, status: string) => {
  const userDept = normalizeDepartment(user.department);
  if (userDept === 'Office') return wo.status === status;

  const targetDepartment = getEditableDepartmentForUser(wo, user);
  if (!targetDepartment) return false;

  const departmentStatus = (wo.department_statuses || []).find(row => normalizeDepartment(row.department) === normalizeDepartment(targetDepartment));
  if (userDept === 'Quality_Control') return departmentStatus?.qc_status === status;
  return (departmentStatus?.status || 'Not Started') === status;
};

const buildDepartmentStatusUpdate = (wo: WorkOrder, user: User, nextStatus: string) => {
  const userDept = normalizeDepartment(user.department);
  const targetDepartment = getEditableDepartmentForUser(wo, user);
  if (!targetDepartment) return null;

  const now = new Date().toISOString();
  const existingStatuses = Array.isArray(wo.department_statuses) ? wo.department_statuses : [];
  const targetDeptNorm = normalizeDepartment(targetDepartment);
  const isQCAction = userDept === 'Quality_Control';
  let found = false;

  const departmentStatuses: DepartmentStatus[] = existingStatuses.map(status => {
    if (normalizeDepartment(status.department) !== targetDeptNorm) return status;
    found = true;
    return {
      ...status,
      status: isQCAction ? 'Ready for QC' : nextStatus as any,
      qc_status: isQCAction ? nextStatus as any : status.qc_status,
      updated_at: now,
      updated_by: user.username,
    };
  });

  if (!found) {
    departmentStatuses.push({
      department: targetDepartment,
      status: isQCAction ? 'Ready for QC' : nextStatus as any,
      qc_status: isQCAction ? nextStatus as any : undefined,
      updated_at: now,
      updated_by: user.username,
    });
  }

  const overallStatus = deriveOverallStatusFromDepartmentStatuses(wo, departmentStatuses);

  return {
    departmentStatuses,
    overallStatus,
  };
};

const deriveOverallStatusFromDepartmentStatuses = (wo: WorkOrder, departmentStatuses: DepartmentStatus[]): WOStatus => {
  const assignedDepartments = wo.assigned_departments || [];
  if (assignedDepartments.length === 0) return wo.status;

  const allApproved = assignedDepartments.every(dept => {
    const status = departmentStatuses.find(row => normalizeDepartment(row.department) === normalizeDepartment(dept));
    return status?.qc_status === 'QC Approved';
  });

  if (allApproved) return 'QC Approved';

  const allReadyForQC = assignedDepartments.every(dept => {
    const status = departmentStatuses.find(row => normalizeDepartment(row.department) === normalizeDepartment(dept));
    return status?.status === 'Ready for QC' || !!status?.qc_status;
  });

  if (allReadyForQC) return 'Ready for QC';

  const anyStarted = assignedDepartments.some(dept => {
    const status = departmentStatuses.find(row => normalizeDepartment(row.department) === normalizeDepartment(dept));
    return status?.status === 'Work Started' || status?.status === 'Ready for QC' || !!status?.qc_status;
  });

  if (anyStarted) return 'Work Started';
  return 'Not Started';
};

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

const WorkOrderCardActions: React.FC<{
  wo: WorkOrder & { itemInfo?: Item };
  loggedInUser: User;
  onViewPlan: (id: number) => void;
  onViewDrawing: (url: string) => void;
  onChangeStatus: (wo: WorkOrder & { itemInfo?: Item }, status: string) => void;
  busy?: boolean;
}> = ({ wo, loggedInUser, onViewPlan, onViewDrawing, onChangeStatus, busy = false }) => {
  const statusOptions = getCardStatusOptions(wo, loggedInUser);
  const drawingUrl = wo.itemInfo?.drawing_image_url;

  return (
    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-gray-100">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onViewPlan(wo.id); }}
        className="rounded-lg bg-blue-50 px-2 py-2 text-[9px] font-black text-blue-700 transition-colors hover:bg-blue-100"
      >
        View Plan
      </button>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          if (drawingUrl) onViewDrawing(drawingUrl);
        }}
        disabled={!drawingUrl}
        className="rounded-lg bg-slate-50 px-2 py-2 text-[9px] font-black text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Drawing PDF
      </button>
      {statusOptions.length > 0 ? (
        <details className="relative" onClick={e => e.stopPropagation()}>
          <summary className="list-none rounded-lg bg-indigo-600 px-2 py-2 text-center text-[9px] font-black text-white transition-colors hover:bg-indigo-700 cursor-pointer">
            {busy ? 'Updating' : 'Status'}
          </summary>
          <div className="absolute right-0 top-full z-30 mt-1 min-w-36 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
            {statusOptions.map(status => (
              <button
                key={status}
                type="button"
                disabled={busy || isCardStatusCurrent(wo, loggedInUser, status)}
                onClick={e => {
                  e.stopPropagation();
                  e.currentTarget.closest('details')?.removeAttribute('open');
                  onChangeStatus(wo, status);
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-[10px] font-black text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:bg-blue-50 disabled:text-blue-700 disabled:opacity-70"
              >
                {status}
              </button>
            ))}
          </div>
        </details>
      ) : (
        <button type="button" disabled className="rounded-lg bg-gray-100 px-2 py-2 text-[9px] font-black text-gray-400">Status</button>
      )}
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

const logActivity = async (params: {
  eventType: string;
  action: string;
  title: string;
  body?: string;
  actor?: User | null;
  targetCollection?: string;
  targetId?: string | number;
  targetLabel?: string;
  workOrderId?: number;
  customerName?: string;
  itemName?: string;
  department?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, any>;
  severity?: 'info' | 'success' | 'warning' | 'error';
}) => {
  try {
    await supabase.from('activity_events').insert([{
      event_type: params.eventType,
      action: params.action,
      title: params.title,
      body: params.body || '',
      actor_user_id: params.actor?.id ?? 0,
      actor_name: params.actor?.username || '',
      actor_department: params.actor ? normalizeDepartment(params.actor.department) : '',
      target_collection: params.targetCollection || '',
      target_id: params.targetId !== undefined ? String(params.targetId) : '',
      target_label: params.targetLabel || '',
      work_order_id: params.workOrderId ?? 0,
      customer_name: params.customerName || '',
      item_name: params.itemName || '',
      department: params.department ? normalizeDepartment(params.department) : '',
      old_value: params.oldValue || '',
      new_value: params.newValue || '',
      metadata: params.metadata || {},
      severity: params.severity || 'info',
      event_time: new Date().toISOString(),
    }]);
  } catch (error) {
    if (import.meta.env.DEV) console.warn('Activity log failed:', error);
  }
};

const getStoredLoggedInUser = (): User | null => {
  try {
    const saved = localStorage.getItem('excell_erp_user');
    return saved ? JSON.parse(saved) as User : null;
  } catch (_error) {
    return null;
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
      const user = await loginWithMobilePassword(mobile, passkey);
      onLogin(user);
    } catch (err: any) {
      setError(err?.message || 'Invalid mobile number or passkey.');
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

const LiveScreenLogin: React.FC<{ onLogin: (user: any) => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    const { data, error: err } = await supabase.from('live_screen_users').select('*').eq('username', username).single();
    if (err || !data) { setError('Invalid username or password.'); setLoading(false); return; }
    if (data.password !== password) { setError('Invalid username or password.'); setLoading(false); return; }
    if (!data.is_active) { setError('This account is disabled.'); setLoading(false); return; }
    setLoading(false);
    onLogin(data);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full">
        <div className="text-center mb-6">
          <Monitor size={48} className="text-blue-400 mx-auto mb-3" />
          <h1 className="text-xl font-black text-white">Live Screen</h1>
          <p className="text-sm text-gray-400 mt-1">Sign in to display</p>
        </div>
        {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-900/50 text-red-400 text-xs font-semibold">{error}</div>}
        <div className="space-y-3">
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500" />
          <button onClick={handleSubmit} disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? 'Signing in...' : 'SIGN IN'}
          </button>
        </div>
      </div>
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

-- 14. Daily tasks table (SQLite syntax)
CREATE TABLE IF NOT EXISTS daily_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  assignee TEXT NOT NULL,
  due_date TEXT,
  priority TEXT NOT NULL DEFAULT 'Medium',
  status TEXT NOT NULL DEFAULT 'Pending',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 15. Client portal users (SQLite syntax)
CREATE TABLE IF NOT EXISTS client_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  portal_id TEXT NOT NULL UNIQUE,
  portal_password TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 16. Client orders (SQLite syntax)
CREATE TABLE IF NOT EXISTS client_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  items TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'Pending',
  rejection_reason TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 17. Live screen users (SQLite syntax)
CREATE TABLE IF NOT EXISTS live_screen_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
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
  const recentOrdersScrollRef = useRef<HTMLDivElement | null>(null);
  const productionFlowScrollRef = useRef<HTMLDivElement | null>(null);

  const scrollDashboardPanel = (ref: React.RefObject<HTMLDivElement | null>, direction: 1 | -1) => {
    ref.current?.scrollBy({ top: direction * 220, behavior: 'smooth' });
  };

  const autoScrollPanel = (element: HTMLDivElement | null) => {
    if (!element || element.scrollHeight <= element.clientHeight + 8) return;
    const isNearBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 8;
    if (isNearBottom) {
      element.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      element.scrollBy({ top: 74, behavior: 'smooth' });
    }
  };

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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      autoScrollPanel(recentOrdersScrollRef.current);
      autoScrollPanel(productionFlowScrollRef.current);
    }, 2800);

    return () => window.clearInterval(intervalId);
  }, [orders.length]);

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

  const getOrderTimestamp = (wo: any) => {
    const rawDate = wo.created_at || wo.created || wo.etd || '';
    const timestamp = rawDate ? new Date(rawDate).getTime() : 0;
    return Number.isFinite(timestamp) ? timestamp : Number(wo.id) || 0;
  };

  const formatDashboardDate = (dateValue: string | undefined) => {
    if (!dateValue) return 'No date';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return dateValue;
    return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  };

  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a))
      .slice(0, 8);
  }, [orders]);

  const dashboardBuckets = useMemo(() => {
    const makeBucket = (key: string, title: string, description: string, tone: string, icon: React.ElementType, rows: any[]) => ({
      key,
      title,
      description,
      tone,
      icon,
      rows: [...rows].sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a)),
    });

    return [
      makeBucket('work-started', 'Work Started', 'Currently moving in production', 'blue', Hammer, orders.filter(wo => wo.status === 'Work Started')),
      makeBucket('ready-qc', 'Ready for QC', 'Waiting for quality approval', 'amber', ShieldCheck, orders.filter(wo => wo.status === 'Ready for QC')),
      makeBucket('ready-dispatch', 'Ready for Dispatch', 'QC approved and waiting dispatch', 'purple', Truck, orders.filter(wo => wo.status === 'QC Approved' || wo.status === 'Ready for despatch')),
      makeBucket('dispatched', 'Dispatched', 'Partially or fully sent out', 'indigo', Package, orders.filter(wo => wo.status === 'Dispatched')),
    ];
  }, [orders]);

  const productionStageData = useMemo(() => {
    const rows = [
      { label: 'Started', count: analyticsOrders.filter(wo => wo.status === 'Work Started').length, tone: 'bg-slate-700' },
      { label: 'Ready QC', count: analyticsOrders.filter(wo => wo.status === 'Ready for QC').length, tone: 'bg-amber-500' },
      { label: 'Ready Dispatch', count: analyticsOrders.filter(wo => wo.status === 'QC Approved' || wo.status === 'Ready for despatch').length, tone: 'bg-violet-500' },
      { label: 'Dispatched', count: analyticsOrders.filter(wo => wo.status === 'Dispatched').length, tone: 'bg-sky-500' },
      { label: 'Delivered', count: analyticsOrders.filter(wo => wo.status === 'Delivered').length, tone: 'bg-slate-400' },
    ];
    const max = Math.max(1, ...rows.map(row => row.count));
    return rows.map(row => ({ ...row, width: Math.max(6, Math.round((row.count / max) * 100)) }));
  }, [analyticsOrders]);

  const dispatchProgress = useMemo(() => {
    const totals = analyticsOrders.reduce((acc, wo) => {
      acc.qty += Number(wo.qty) || 0;
      acc.sent += Number(wo.qty_dispatched) || 0;
      return acc;
    }, { qty: 0, sent: 0 });
    const pct = totals.qty > 0 ? Math.min(100, Math.round((totals.sent / totals.qty) * 100)) : 0;
    return { ...totals, pct, pending: Math.max(0, totals.qty - totals.sent) };
  }, [analyticsOrders]);

  const etdHeatmap = useMemo(() => {
    const openOrders = analyticsOrders.filter(wo => !['Delivered', 'Cancelled'].includes(wo.status));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cells = [
      { label: 'Late', count: 0, late: true },
      ...Array.from({ length: 7 }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() + index);
        return { label: index === 0 ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'short' }), count: 0, late: false, key: date.toDateString() };
      }),
    ];

    openOrders.forEach(wo => {
      if (!wo.etd) return;
      const etd = new Date(`${wo.etd}T00:00:00`);
      if (Number.isNaN(etd.getTime())) return;
      if (etd < today) {
        cells[0].count += 1;
        return;
      }
      const match = cells.find(cell => 'key' in cell && cell.key === etd.toDateString());
      if (match) match.count += 1;
    });

    const max = Math.max(1, ...cells.map(cell => cell.count));
    return cells.map(cell => ({ ...cell, intensity: cell.count / max }));
  }, [analyticsOrders]);

  const openOrderDetails = (orderId: number) => {
    (window as any)._id = orderId;
    setView('wo-details');
  };

  const bucketToneClass = (tone: string) => {
    const tones: Record<string, { card: string; icon: string; line: string; glow: string; text: string }> = {
      blue: { card: 'border-blue-100 bg-blue-50/40', icon: 'bg-blue-600 text-white shadow-blue-200', line: 'bg-blue-500', glow: 'shadow-blue-100', text: 'text-blue-700' },
      amber: { card: 'border-amber-100 bg-amber-50/40', icon: 'bg-amber-500 text-white shadow-amber-200', line: 'bg-amber-500', glow: 'shadow-amber-100', text: 'text-amber-700' },
      purple: { card: 'border-purple-100 bg-purple-50/40', icon: 'bg-purple-600 text-white shadow-purple-200', line: 'bg-purple-500', glow: 'shadow-purple-100', text: 'text-purple-700' },
      indigo: { card: 'border-indigo-100 bg-indigo-50/40', icon: 'bg-indigo-600 text-white shadow-indigo-200', line: 'bg-indigo-500', glow: 'shadow-indigo-100', text: 'text-indigo-700' },
    };
    return tones[tone] || tones.blue;
  };

  const renderOrderSummary = (wo: any, index: number, compact = false) => (
    <button
      key={wo.id}
      onClick={() => openOrderDetails(wo.id)}
      className={`group w-full text-left rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md animate-in fade-in slide-in-from-bottom-2 ${compact ? 'space-y-2' : 'space-y-3'}`}
      style={{ animationDelay: `${Math.min(index * 45, 240)}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">#{wo.id}</span>
            {wo.order_type === 'suborder' && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-black text-purple-600">Suborder #{wo.parent_work_order_id || '-'}</span>}
          </div>
          <div className="mt-1 truncate text-sm font-black text-slate-900 group-hover:text-blue-700">{wo.job_details}</div>
          <div className="truncate text-[11px] font-bold text-gray-500">{wo.customer}</div>
        </div>
        <StatusBadge status={wo.status} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-gray-500">
        <div className="rounded-xl bg-gray-50 px-2 py-1.5"><span className="block text-gray-400">Qty</span><span className="text-slate-800">{wo.qty || 0}</span></div>
        <div className="rounded-xl bg-gray-50 px-2 py-1.5"><span className="block text-gray-400">ETD</span><span className="text-slate-800">{formatDashboardDate(wo.etd)}</span></div>
        <div className="rounded-xl bg-gray-50 px-2 py-1.5"><span className="block text-gray-400">Sent</span><span className="text-slate-800">{wo.qty_dispatched || 0}</span></div>
      </div>
      {!compact && (
        <div className="flex flex-wrap gap-1">
          {(wo.assigned_departments || []).slice(0, 4).map((dept: string) => <Badge key={dept} color="gray">{String(dept).replace(/_/g, ' ')}</Badge>)}
          {(wo.assigned_departments || []).length > 4 && <Badge color="gray">+{(wo.assigned_departments || []).length - 4}</Badge>}
        </div>
      )}
    </button>
  );

  if (loading) return <LoadingState />;

  const stats = [
    { label: 'Users', count: counts.users, icon: Users, view: 'users' as AppView, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Departments', count: counts.depts, icon: Building2, view: 'departments' as AppView, tone: 'bg-violet-50 text-violet-600' },
    { label: 'Customers', count: counts.customers, icon: UserCircle, view: 'customers' as AppView, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Item Master', count: counts.items, icon: Package, view: 'items' as AppView, tone: 'bg-amber-50 text-amber-600' },
    { label: 'Work Orders', count: counts.wos, icon: ClipboardList, view: 'work-orders' as AppView, tone: 'bg-indigo-50 text-indigo-600' },
  ];

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <div className="inline-flex rounded-full border border-gray-200 bg-white p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {(['today', '7d', '30d', '90d', 'custom'] as const).map(w => (
            <button key={w} onClick={() => setAnalyticsWindow(w)} className={`min-w-[54px] rounded-full px-2.5 py-1.5 text-[10px] font-black transition-colors ${analyticsWindow === w ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-slate-700'}`}>{w.toUpperCase()}</button>
          ))}
        </div>
        <button onClick={() => setView('reports')} className="rounded-full border border-gray-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 transition-colors hover:bg-gray-50">Reports</button>
      </div>

      {analyticsWindow === 'custom' && (
        <div className="grid grid-cols-1 gap-2 rounded-2xl border border-gray-200 bg-white p-2 sm:grid-cols-2">
          <input type="date" value={customFromDate} onChange={e => setCustomFromDate(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700" />
          <input type="date" value={customToDate} onChange={e => setCustomToDate(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700" />
        </div>
      )}

      <div className="overflow-hidden rounded-[20px] border border-gray-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
          {[
            { label: 'Open', value: kpis.openOrders, tone: 'text-slate-900' },
            { label: 'Work Started', value: dashboardBuckets[0]?.rows.length || 0, tone: 'text-slate-900' },
            { label: 'Ready QC', value: dashboardBuckets[1]?.rows.length || 0, tone: 'text-amber-700' },
            { label: 'Ready Dispatch', value: dashboardBuckets[2]?.rows.length || 0, tone: 'text-violet-700' },
            { label: 'Dispatched', value: dashboardBuckets[3]?.rows.length || 0, tone: 'text-sky-700' },
            { label: 'Overdue', value: kpis.overdue, tone: 'text-red-600' },
            { label: 'Delivered', value: kpis.deliveredOrders, tone: 'text-slate-900' },
            { label: 'Window', value: kpis.totalOrders, tone: 'text-slate-900' },
          ].map((metric, index) => (
            <div key={metric.label} className="border-b border-r border-gray-100 px-4 py-3" style={{ animationDelay: `${index * 20}ms` }}>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{metric.label}</div>
              <div className={`mt-1 text-2xl font-black leading-none ${metric.tone}`}>{metric.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <button
            key={stat.label}
            onClick={() => setView(stat.view)}
            className="group flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:bg-gray-50 active:scale-[0.99]"
          >
            <div>
              <h3 className="text-[9px] font-black uppercase tracking-wider text-gray-400">{stat.label}</h3>
              <span className="mt-0.5 block text-lg font-black leading-none text-gray-900">{stat.count}</span>
            </div>
            <div className="text-gray-300 group-hover:text-gray-500">
              <stat.icon size={14} />
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[390px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-[20px] border border-gray-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-900">Recent Orders</h3>
            </div>
            <button onClick={() => setView('work-orders')} className="rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-gray-600 transition-colors hover:bg-gray-50">View All</button>
          </div>
          <div ref={recentOrdersScrollRef} className="max-h-[560px] divide-y divide-gray-100 overflow-y-auto">
            {recentOrders.map((wo, index) => (
              <button key={wo.id} onClick={() => openOrderDetails(wo.id)} className="group w-full px-4 py-3 text-left transition-colors hover:bg-gray-50" style={{ animationDelay: `${index * 20}ms` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-black text-slate-600">#{wo.id}</div>
                    <div className="mt-0.5 truncate text-sm font-black text-gray-900 group-hover:text-slate-700">{wo.job_details}</div>
                    <div className="truncate text-xs font-semibold text-gray-500">{wo.customer}</div>
                  </div>
                  <StatusBadge status={wo.status} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-gray-500">
                  <span>Qty <span className="text-gray-900">{wo.qty || 0}</span></span>
                  <span>ETD <span className="text-gray-900">{formatDashboardDate(wo.etd)}</span></span>
                  <span>Sent <span className="text-gray-900">{wo.qty_dispatched || 0}</span></span>
                </div>
              </button>
            ))}
            {recentOrders.length === 0 && <div className="px-5 py-12 text-center text-sm font-semibold text-gray-400">No recent orders found.</div>}
          </div>
        </section>

        <section className="overflow-hidden rounded-[20px] border border-gray-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-900">Production Flow</h3>
              </div>
              <div className="text-[11px] font-black text-gray-500">{analyticsOrders.length} window orders</div>
            </div>
          </div>
          <div ref={productionFlowScrollRef} className="grid max-h-[560px] grid-cols-1 divide-y divide-gray-100 overflow-y-auto lg:grid-cols-2 xl:grid-cols-4 lg:divide-x lg:divide-y-0 lg:divide-gray-100">
            {dashboardBuckets.map((bucket, index) => {
              const tone = bucketToneClass(bucket.tone);
              return (
                <section key={bucket.key} className="min-h-[280px] p-3" style={{ animationDelay: `${index * 30}ms` }}>
                  <button onClick={() => setView(bucket.key === 'dispatched' || bucket.key === 'ready-dispatch' ? 'dispatch-dashboard' : 'work-orders')} className="mb-3 flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-gray-50">
                    <h4 className={`text-[10px] font-black uppercase tracking-wider ${tone.text}`}>{bucket.title}</h4>
                    <div className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-black text-gray-600">{bucket.rows.length}</div>
                  </button>

                  <div className="space-y-1.5">
                    {bucket.rows.slice(0, 5).map((wo, rowIndex) => (
                      <button key={wo.id} onClick={() => openOrderDetails(wo.id)} className="group w-full rounded-xl border border-gray-100 bg-white px-2.5 py-2 text-left transition-colors hover:border-gray-200 hover:bg-gray-50" style={{ animationDelay: `${(index * 30) + (rowIndex * 20)}ms` }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[11px] font-black text-gray-900 group-hover:text-slate-700">#{wo.id} {wo.job_details}</div>
                            <div className="mt-0.5 truncate text-[11px] font-semibold text-gray-500">{wo.customer}</div>
                          </div>
                          <div className="shrink-0 text-[10px] font-black text-gray-400">{formatDashboardDate(wo.etd)}</div>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-gray-500">
                          <span>Qty {wo.qty || 0}</span>
                          <span>Sent {wo.qty_dispatched || 0}</span>
                        </div>
                      </button>
                    ))}
                    {bucket.rows.length === 0 && <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-xs font-semibold text-gray-400">No orders</div>}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-[20px] border border-gray-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-900">Status Mix</h3>
            <span className="text-[10px] font-black text-gray-400">{kpis.totalOrders} orders</span>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative h-28 w-28 shrink-0 rounded-full" style={{ background: pieGradient }}>
              <div className="absolute inset-5 rounded-full bg-white shadow-inner" />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black leading-none text-slate-900">{kpis.openOrders}</span>
                <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">Open</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {statusChart.slice(0, 4).map(row => (
                <div key={row.status} className="flex items-center justify-between gap-2 text-[11px] font-bold">
                  <span className="flex min-w-0 items-center gap-2 text-gray-600"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} /><span className="truncate">{row.status}</span></span>
                  <span className="text-gray-900">{row.pct}%</span>
                </div>
              ))}
              {statusChart.length === 0 && <div className="text-xs font-semibold text-gray-400">No orders in this window.</div>}
            </div>
          </div>
        </section>

        <section className="rounded-[20px] border border-gray-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-900">Stage Load</h3>
            <span className="text-[10px] font-black text-gray-400">Production</span>
          </div>
          <div className="mt-4 space-y-3">
            {productionStageData.map(row => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-[11px] font-black text-gray-600">
                  <span>{row.label}</span>
                  <span className="text-gray-900">{row.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-full rounded-full ${row.tone}`} style={{ width: `${row.width}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[20px] border border-gray-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-900">Department Load</h3>
            <span className="text-[10px] font-black text-gray-400">Top {departmentWorkload.length}</span>
          </div>
          <div className="mt-4 space-y-3">
            {departmentWorkload.map(row => (
              <div key={row.dept} className="grid grid-cols-[86px_minmax(0,1fr)_28px] items-center gap-2 text-[11px] font-black">
                <span className="truncate text-gray-600">{row.dept}</span>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-slate-700" style={{ width: `${Math.max(6, Math.round((row.orders / maxDeptOrders) * 100))}%` }} />
                </div>
                <span className="text-right text-gray-900">{row.orders}</span>
              </div>
            ))}
            {departmentWorkload.length === 0 && <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-8 text-center text-xs font-semibold text-gray-400">No department assignments.</div>}
          </div>
        </section>

        <section className="rounded-[20px] border border-gray-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-900">ETD & Dispatch</h3>
            <span className="text-[10px] font-black text-gray-400">Next 7 days</span>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {etdHeatmap.map(cell => (
              <div key={cell.label} className={`rounded-xl border px-2 py-2 text-center ${cell.late && cell.count > 0 ? 'border-red-100 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                <div className={`text-lg font-black leading-none ${cell.late && cell.count > 0 ? 'text-red-600' : 'text-slate-900'}`} style={!cell.late ? { opacity: 0.45 + (cell.intensity * 0.55) } : undefined}>{cell.count}</div>
                <div className="mt-1 text-[9px] font-black uppercase tracking-wider text-gray-400">{cell.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-gray-50 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] font-black text-gray-600">
              <span>Quantity Dispatched</span>
              <span className="text-gray-900">{dispatchProgress.pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-slate-800" style={{ width: `${dispatchProgress.pct}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-gray-500">
              <span>Sent {dispatchProgress.sent}</span>
              <span>Pending {dispatchProgress.pending}</span>
            </div>
          </div>
        </section>
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

        void logActivity({
          eventType: 'dispatch',
          action: newStatus === 'Delivered' ? 'delivered' : 'dispatched',
          title: newStatus === 'Delivered' ? 'Order Delivered' : 'Order Dispatched',
          body: `Order #${orderId}: ${dispatchQty} unit(s) dispatched. Invoice ${invoiceNo} | Vehicle ${vehicleNo}`,
          actor: loggedInUser,
          targetCollection: 'work_orders',
          targetId: orderId,
          targetLabel: order.job_details,
          workOrderId: orderId,
          customerName: order.customer,
          itemName: order.job_details,
          oldValue: order.status,
          newValue: newStatus,
          metadata: { dispatch_qty: dispatchQty, qty_dispatched: newDispatched, invoice_no: invoiceNo, vehicle_no: vehicleNo },
          severity: newStatus === 'Delivered' ? 'success' : 'info',
        });
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
        <div className="flex gap-1.5 flex-wrap items-center">
          <button onClick={() => setStatusFilter('All')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${statusFilter === 'All' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}>All</button>
          {statusOptions.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${statusFilter === s ? (statusTabColors[s] || 'bg-slate-900 text-white') : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}>{s}</button>
          ))}
        </div>
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

const UserList: React.FC<{ onError: () => void; editingId?: number }> = ({ onError, editingId }) => {
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

  useEffect(() => {
    if (editingId && users.length > 0) {
      const found = users.find(u => Number(u.id) === Number(editingId));
      if (found) {
        openEditUser(found);
        (window as any)._id = undefined;
      }
    }
  }, [editingId, users]);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.department) { alert("Please select a department."); return; }
    const mobileKey = normalizeMobileNumber(formData.mobile);
    if (!mobileKey) { alert("Please enter a valid mobile number."); return; }
    if (!editingUser && formData.passkey.trim().length < 6) {
      alert('Please set a passkey/password with at least 6 characters.');
      return;
    }
    if (editingUser && formData.passkey.trim() && formData.passkey.trim().length < 6) {
      alert('New passkey/password must be at least 6 characters.');
      return;
    }
    const duplicateUser = users.find(existingUser =>
      normalizeMobileNumber(existingUser.mobile || '') === mobileKey &&
      (!editingUser || Number(existingUser.id) !== Number(editingUser.id))
    );
    if (duplicateUser) {
      alert(`A user with mobile number ${formData.mobile} already exists: ${duplicateUser.username}.`);
      return;
    }
    setIsSubmitting(true);
    
    const userPayload: Record<string, any> = {
      username: mobileKey,
      display_name: formData.username.trim(),
      email: formData.email.trim(),
      login_email: formData.email.trim(),
      mobile: mobileKey,
      vehicle_number: formData.vehicle_number.trim(),
      department: formData.department,
      level: formData.level,
    };

    if (formData.passkey.trim()) {
      userPayload.password = formData.passkey.trim();
      userPayload.passwordConfirm = formData.passkey.trim();
    }

    let result;
    if (editingUser) {
      result = await supabase.from('users').update(userPayload).eq('id', editingUser.id);
    } else {
      result = await supabase.from('users').insert([userPayload]);
    }

    const { error } = result;
    if (error) alert(error.message);
    else { 
      void logActivity({
        eventType: 'user',
        action: editingUser ? 'updated' : 'created',
        title: editingUser ? 'User Updated' : 'User Created',
        body: `${editingUser ? 'Updated' : 'Created'} user: ${formData.username}`,
        actor: getStoredLoggedInUser(),
        targetCollection: 'users',
        targetId: editingUser?.id,
        targetLabel: formData.username,
        department: formData.department,
        severity: 'info',
      });
      setIsModalOpen(false); 
      setFormData(initialFormData); 
      setEditingUser(null);
      fetchData(); 
    }
    setIsSubmitting(false);
  };

  const handleDeleteUser = async (id: number) => {
    if (confirm("Are you sure you want to delete this user?")) {
      const userToDelete = users.find(user => Number(user.id) === Number(id));
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) {
        alert("Error deleting user: " + error.message);
      } else {
        void logActivity({
          eventType: 'user',
          action: 'deleted',
          title: 'User Deleted',
          body: `Deleted user: ${userToDelete?.username || id}`,
          actor: getStoredLoggedInUser(),
          targetCollection: 'users',
          targetId: id,
          targetLabel: userToDelete?.username || String(id),
          department: userToDelete?.department,
          severity: 'warning',
        });
        fetchData();
      }
    }
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username || '',
      email: user.email || '',
      mobile: user.mobile || '',
      vehicle_number: user.vehicle_number || '',
      passkey: '',
      department: user.department || '',
      level: user.level || '3-Staff',
    });
    setIsModalOpen(true);
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
        <form onSubmit={handleSaveUser} className="space-y-5">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3 text-xs font-semibold text-blue-800">
            Users log in with mobile number + passkey. Email is used internally for PocketBase authentication.
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">Full Name</label>
            <input
              required
              disabled={isSubmitting}
              placeholder="Full employee name"
              value={formData.username}
              onChange={e => setFormData({...formData, username: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border rounded-xl disabled:opacity-60"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">Email / Login Email</label>
            <input
              required
              disabled={isSubmitting}
              type="email"
              placeholder="email@example.com"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border rounded-xl disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">Mobile Number</label>
              <input
                required
                disabled={isSubmitting}
                inputMode="tel"
                placeholder="10-digit mobile number"
                value={formData.mobile}
                onChange={e => setFormData({...formData, mobile: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border rounded-xl disabled:opacity-60"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">Vehicle Number</label>
              <input
                disabled={isSubmitting}
                placeholder="Optional vehicle number"
                value={formData.vehicle_number || ''}
                onChange={e => setFormData({...formData, vehicle_number: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border rounded-xl disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">Passkey / Password</label>
            <input
              required={!editingUser}
              disabled={isSubmitting}
              type="password"
              placeholder={editingUser ? "New passkey/password (optional)" : "Minimum 6 characters"}
              value={formData.passkey}
              onChange={e => setFormData({...formData, passkey: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border rounded-xl disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">Department</label>
              <select required disabled={isSubmitting} value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl disabled:opacity-60">
                <option value="">Select department</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">Role</label>
              <select disabled={isSubmitting} value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl disabled:opacity-60">
                <option value="1-Manager">Manager</option>
                <option value="2-Supervisor">Supervisor</option>
                <option value="3-Staff">Staff</option>
                <option value="4-Quality">Quality Control</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-black">
            {isSubmitting ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}
          </button>
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
                    <button onClick={() => openEditUser(u)} className="text-blue-600 mr-2 hover:bg-blue-50 p-2 rounded-lg transition-colors inline-block"><Edit size={16} /></button>
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
                  onClick={() => openEditUser(u)}
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
  const [formData, setFormData] = useState<{ name: string; incharge: string; supervisor: string; info: string; metrics: Metric[] }>({ name: '', incharge: '', supervisor: '', info: '', metrics: [] });

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
      void logActivity({
        eventType: 'department',
        action: editingDepartment ? 'updated' : 'created',
        title: editingDepartment ? 'Department Updated' : 'Department Created',
        body: `${editingDepartment ? 'Updated' : 'Created'} department: ${formData.name}`,
        actor: getStoredLoggedInUser(),
        targetCollection: 'departments',
        targetId: editingDepartment?.id,
        targetLabel: formData.name,
        department: formData.name,
        severity: 'info',
      });
      setIsModalOpen(false); 
      setEditingDepartment(null);
      setFormData({ name: '', incharge: '', supervisor: '', info: '', metrics: [] }); 
      invalidateCollectionCache('departments');
      fetchData(); 
    }
  };

  if (loading && data.length === 0) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black text-gray-800">Departments</h2>
        <button onClick={() => { setEditingDepartment(null); setFormData({ name: '', incharge: '', supervisor: '', info: '', metrics: [] }); setIsModalOpen(true); }} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-purple-700 transition-colors">
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
          <div className="border-t pt-4">
            <h4 className="font-bold text-sm text-gray-500 mb-2">📊 Metrics</h4>
            {formData.metrics.map((m, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input placeholder="Type (e.g. Plywood)" value={m.type} onChange={e => { const updated = [...formData.metrics]; updated[i] = { ...updated[i], type: e.target.value }; setFormData({...formData, metrics: updated}); }} className="flex-1 px-3 py-2 bg-gray-50 border rounded-lg text-sm" />
                <input placeholder="Unit (e.g. CFT)" value={m.unit} onChange={e => { const updated = [...formData.metrics]; updated[i] = { ...updated[i], unit: e.target.value }; setFormData({...formData, metrics: updated}); }} className="w-24 px-3 py-2 bg-gray-50 border rounded-lg text-sm" />
                <button type="button" onClick={() => { setFormData({...formData, metrics: formData.metrics.filter((_, j) => j !== i)}); }} className="text-red-400 hover:text-red-600 font-bold">✕</button>
              </div>
            ))}
            <button type="button" onClick={() => { setFormData({...formData, metrics: [...formData.metrics, { type: '', unit: '' }]}); }} className="text-purple-600 text-sm font-bold hover:text-purple-800">+ Add Metric</button>
          </div>
          <button type="submit" className="w-full py-4 bg-purple-600 text-white rounded-xl font-black shadow-lg">{editingDepartment ? 'Save Department' : 'Register Department'}</button>
        </form>
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map(d => (
          <Card key={d.id} className="hover:border-purple-200 transition-all border-l-4 border-l-purple-500">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-black text-gray-800">{d.name}</h3>
              <div className="flex gap-1">
                <button onClick={() => { setEditingDepartment(d); setFormData({ name: d.name, incharge: d.incharge || '', supervisor: d.supervisor || '', info: d.info || '', metrics: d.metrics || [] }); setIsModalOpen(true); }} className="text-blue-500 hover:text-blue-700 transition-colors"><Edit size={16} /></button>
                <button onClick={async () => {
                  const deptName = d.name;
                  const lower = deptName.trim().toLowerCase();
                  if (lower === 'dispatch' || lower === 'quality control' || lower === 'quality_control') {
                    alert(`"${deptName}" is a system-required department and cannot be deleted.`);
                    return;
                  }
                  const [{ data: users }, { data: allItems }, { data: allChildItems }] = await Promise.all([
                    supabase.from('erp_users').select('*').eq('department', deptName),
                    supabase.from('items').select('*'),
                    supabase.from('child_items').select('*'),
                  ]);
                  const linkedUsers = (users || []).filter((u: any) => u.department === deptName);
                  const linkedItems = (allItems || []).filter((i: Item) => i.departments?.includes(deptName));
                  const linkedComponents = (allChildItems || []).filter((c: ChildItem) => c.departments?.includes(deptName));
                  if (linkedUsers.length > 0 || linkedItems.length > 0 || linkedComponents.length > 0) {
                    let msg = 'Cannot delete this department:\n';
                    if (linkedUsers.length > 0) msg += `\n- ${linkedUsers.length} user(s) are assigned to this department`;
                    if (linkedItems.length > 0) msg += `\n- ${linkedItems.length} item(s) use this department`;
                    if (linkedComponents.length > 0) msg += `\n- ${linkedComponents.length} component(s) use this department`;
                    msg += '\n\nRemove these associations first.';
                    alert(msg);
                    return;
                  }
                  if(confirm("Delete?")) { await supabase.from('departments').delete().eq('id', d.id); void logActivity({ eventType: 'department', action: 'deleted', title: 'Department Deleted', body: `Deleted department: ${d.name}`, actor: getStoredLoggedInUser(), targetCollection: 'departments', targetId: d.id, targetLabel: d.name, department: d.name, severity: 'warning' }); invalidateCollectionCache('departments'); fetchData(); }
                }} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
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
            {d.metrics && d.metrics.length > 0 && (
              <div className="border-t pt-3 mt-3">
                <span className="text-gray-400 font-bold text-[10px] uppercase tracking-wider">📊 Metrics</span>
                {d.metrics.map((m, i) => (
                  <div key={i} className="flex justify-between text-sm text-gray-700 mt-1">
                    <span className="font-medium">{m.type}</span>
                    <span className="text-gray-500">{m.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

// --- Customer Management ---

const CustomerManagement: React.FC<{ onError: () => void; editingId?: number }> = ({ onError, editingId }) => {
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

  useEffect(() => {
    if (editingId && data.length > 0) {
      const found = data.find(c => Number(c.id) === Number(editingId));
      if (found) {
        setEditingCustomer(found);
        setFormData({ name: found.name || '', proprietor: found.proprietor || '', address: found.address || '', city: found.city || '', contact: found.contact || '', email: found.email || '', gst: found.gst || '', type: found.type || 'Direct', reference: found.reference || '', remarks: found.remarks || '' });
        setIsModalOpen(true);
        (window as any)._id = undefined;
      }
    }
  }, [editingId, data]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const oldCustomerName = editingCustomer?.name || '';
    const result = editingCustomer
      ? await supabase.from('customers').update(formData).eq('id', editingCustomer.id)
      : await supabase.from('customers').insert([formData]);
    const { error } = result;
    if (error) alert(error.message);
    else { 
      void logActivity({
        eventType: 'customer',
        action: editingCustomer ? 'updated' : 'created',
        title: editingCustomer ? 'Customer Updated' : 'Customer Created',
        body: `${editingCustomer ? 'Updated' : 'Created'} customer: ${formData.name}`,
        actor: getStoredLoggedInUser(),
        targetCollection: 'customers',
        targetId: editingCustomer?.id,
        targetLabel: formData.name,
        customerName: formData.name,
        oldValue: oldCustomerName,
        newValue: formData.name,
        severity: 'info',
      });
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
      void logActivity({
        eventType: 'customer',
        action: 'deleted',
        title: 'Customer Deleted',
        body: `Deleted customer: ${customer.name}`,
        actor: getStoredLoggedInUser(),
        targetCollection: 'customers',
        targetId: customer.id,
        targetLabel: customer.name,
        customerName: customer.name,
        severity: 'warning',
      });
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

const ItemList: React.FC<{ onError: () => void; editingId?: number }> = ({ onError, editingId }) => {
  const [data, setData] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  
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
  const [itemRows, setItemRows] = useState<Array<{ name: string; drawing_no: string; drawing_file: File | null; departments: string[]; metric_requirements: ItemMetricRequirement[] }>>([{ name: '', drawing_no: '', drawing_file: null, departments: [], metric_requirements: [] }]);
  const [rowWithDeptError, setRowWithDeptError] = useState<number | null>(null);
  const itemCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const involvingDepartments = useMemo(
    () => departments.filter(d => isInvolvingDepartment(d.name)),
    [departments]
  );
  const bomReferenceIndex = useMemo(() => buildBomReferenceIndex(data), [data]);

  const departmentOptions = useMemo(() => {
    const uniqueDepartments = new Set<string>();
    data.forEach(item => {
      (item.departments || []).forEach((dept: string) => uniqueDepartments.add(dept));
    });
    return Array.from(uniqueDepartments).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return data.filter(item => {
      const matchesSearch = !query ||
        item.name.toLowerCase().includes(query) ||
        (item.customer_name || '').toLowerCase().includes(query) ||
        (item.drawing_no || '').toLowerCase().includes(query);
      const matchesDepartment = departmentFilter === 'All' ||
        (item.departments || []).includes(departmentFilter);
      return matchesSearch && matchesDepartment;
    });
  }, [data, searchQuery, departmentFilter]);

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

  useEffect(() => {
    if (editingId && data.length > 0) {
      const found = data.find(item => Number(item.id) === Number(editingId));
      if (found) { openEditItem(found); (window as any)._id = undefined; }
    }
  }, [editingId, data]);

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

   const handleDeptToggle = (rowIndex: number, name: string) => {
     setRowWithDeptError(null);
     const dept = departments.find(d => d.name === name);
     setItemRows(prev => {
       const row = prev[rowIndex];
       const wasSelected = (row.departments || []).includes(name);
       const next = [...prev];
       next[rowIndex] = {
         ...row,
         departments: wasSelected
           ? (row.departments || []).filter(d => d !== name)
           : [...(row.departments || []), name],
       };
       if (dept?.metrics?.length) {
         const existing = row.metric_requirements || [];
         next[rowIndex] = {
           ...next[rowIndex],
           metric_requirements: wasSelected
             ? existing.filter(ex => !dept.metrics?.some(m => m.type === ex.metric))
             : [...existing, ...dept.metrics.filter(m => !existing.some(ex => ex.metric === m.type)).map(m => ({ metric: m.type, unit: m.unit, qtyPerUnit: 0 }))],
         };
       }
       return next;
     });
   };

   const resetItemForm = () => {
     setFormData({ name: '', customer_name: '', drawing_no: '', departments: [] });
     setItemRows([{ name: '', drawing_no: '', drawing_file: null, departments: [], metric_requirements: [] }]);
     setRowWithDeptError(null);
   };

  const updateItemRow = (index: number, field: 'name' | 'drawing_no' | 'metric_requirements' | 'departments', value: string | ItemMetricRequirement[] | string[]) => {
    setItemRows(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };

  const updateItemDrawingFile = (index: number, file: File | null) => {
    setItemRows(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, drawing_file: file } : row));
  };

  const addItemRow = () => {
    setItemRows(prev => [...prev, { name: '', drawing_no: '', drawing_file: null, departments: [], metric_requirements: [] }]);
  };

  const removeItemRow = (index: number) => {
    setItemRows(prev => prev.length === 1 ? [{ name: '', drawing_no: '', drawing_file: null, departments: [], metric_requirements: [] }] : prev.filter((_, rowIndex) => rowIndex !== index));
  };

   const openEditItem = (item: Item) => {
     setEditingItem(item);
     const existingMetrics = item.metric_requirements || [];
     const deptMetrics = (item.departments || []).flatMap(deptName => {
       const dept = departments.find(d => d.name === deptName);
       return (dept?.metrics || [])
         .filter(m => !existingMetrics.some(ex => ex.metric === m.type))
         .map(m => ({ metric: m.type, unit: m.unit, qtyPerUnit: 0 }));
     });
     setFormData({ name: item.name || '', customer_name: item.customer_name || '', drawing_no: item.drawing_no || '', departments: [] });
     setItemRows([{ name: item.name || '', drawing_no: item.drawing_no || '', drawing_file: null, departments: item.departments || [], metric_requirements: [...existingMetrics, ...deptMetrics] }]);
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
      void logActivity({
        eventType: 'item',
        action: 'bom_updated',
        title: 'BOM Updated',
        body: `Updated BOM for ${selectedItem.name}: ${componentsToSave.length} row(s)`,
        actor: getStoredLoggedInUser(),
        targetCollection: 'items',
        targetId: selectedItem.id,
        targetLabel: selectedItem.name,
        customerName: selectedItem.customer_name,
        itemName: selectedItem.name,
        metadata: { component_count: componentsToSave.length, components: componentsToSave.map(row => ({ name: row.name, type: row.type, qty: row.qtyPerMaster })) },
        severity: 'info',
      });
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
      void logActivity({
        eventType: 'item',
        action: 'deleted',
        title: 'Item Deleted',
        body: `Deleted item: ${item.name}`,
        actor: getStoredLoggedInUser(),
        targetCollection: 'items',
        targetId: item.id,
        targetLabel: item.name,
        customerName: item.customer_name,
        itemName: item.name,
        severity: 'warning',
      });
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search items by name, customer or drawing no..."
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

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(null); }} title={editingItem ? "Edit Item" : "New Item"} maxWidthClassName="max-w-6xl">
        <form onSubmit={async (e) => { 
          e.preventDefault(); 
          const customerKey = normalizeDuplicateKey(formData.customer_name);
          const validRows = itemRows
            .map(row => ({
              name: row.name.trim().replace(/\s+/g, ' '),
              drawing_no: row.drawing_no.trim(),
              drawing_file: row.drawing_file,
              departments: row.departments,
              metric_requirements: row.metric_requirements || [],
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

          // Check each row has at least one department
          const rowsWithoutDept = validRows.filter(row => !row.departments || row.departments.length === 0);
          if (rowsWithoutDept.length > 0) {
            const errIdx = itemRows.findIndex(r => !r.departments || r.departments.length === 0);
            if (errIdx >= 0) {
              setRowWithDeptError(errIdx);
              setTimeout(() => itemCardRefs.current[errIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            }
            alert(`Item "${rowsWithoutDept[0].name}" needs at least one department.`);
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
            departments: row.departments,
            metric_requirements: row.metric_requirements,
          }));
          const result = editingItem
            ? await supabase.from('items').update(rowsToInsert[0]).eq('id', editingItem.id)
            : await supabase.from('items').insert(rowsToInsert);
          const { error } = result; 
          if(error) alert(error.message);
          else {
            if (editingItem) await updateItemReferencesInBoms(editingItem, { name: rowsToInsert[0].name, drawing_no: rowsToInsert[0].drawing_no, departments: rowsToInsert[0].departments });
            void logActivity({
              eventType: 'item',
              action: editingItem ? 'updated' : 'created',
              title: editingItem ? 'Item Updated' : 'Item Created',
              body: `${editingItem ? 'Updated' : 'Created'} item(s): ${rowsToInsert.map(row => row.name).join(', ')}`,
              actor: getStoredLoggedInUser(),
              targetCollection: 'items',
              targetId: editingItem?.id,
              targetLabel: rowsToInsert[0].name,
              customerName: formData.customer_name,
              itemName: rowsToInsert[0].name,
              metadata: { count: rowsToInsert.length, drawing_nos: rowsToInsert.map(row => row.drawing_no), departments: rowsToInsert.map(row => row.departments) },
              severity: 'info',
            });
            setIsModalOpen(false); 
            setEditingItem(null);
            resetItemForm();
            invalidateCollectionCache('items');
            fetchData(); 
          }
        }} className="flex flex-col h-full gap-6">

          {/* Sticky top: Client */}
          <div className="flex-shrink-0">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Client</h4>
              <select required value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm">
                <option value="">Select Client</option>
                {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Items section: wraps both sticky header + scrollable cards */}
          <div className="rounded-xl border border-gray-200 bg-white flex flex-col flex-1 min-h-0">
            <div className="flex-shrink-0 flex items-center justify-between p-5 pb-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-gray-500">Items</h4>
                <p className="text-[11px] text-gray-400 mt-0.5">Add item masters one by one</p>
              </div>
              {!editingItem && <button type="button" onClick={addItemRow} className="flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-xs font-black text-orange-700 hover:bg-orange-100"><Plus size={14} /> Add Item</button>}
            </div>

            {/* Scrollable item cards */}
            <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-5 space-y-4">
            {itemRows.map((row, index) => (
              <div key={index} ref={el => itemCardRefs.current[index] = el} className={`rounded-xl border p-5 transition-shadow ${rowWithDeptError === index ? 'border-red-400 bg-red-50 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]' : 'border-orange-200 bg-orange-50/40'}`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-black uppercase tracking-widest text-gray-500">Item {index + 1}</span>
                  {!editingItem && <button type="button" onClick={() => removeItemRow(index)} className="text-xs font-bold text-red-400 hover:text-red-600">Remove</button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div className="md:col-span-3">
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-1.5 block">Item Name</label>
                        <input required={index === 0} placeholder="e.g. Wooden Box 12x8" value={row.name} onChange={e => updateItemRow(index, 'name', e.target.value)} className="w-full px-5 py-3.5 bg-white border rounded-lg text-base" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-1.5 block">Drawing No.</label>
                        <input required={index === 0} placeholder="e.g. DWG-001" value={row.drawing_no} onChange={e => updateItemRow(index, 'drawing_no', e.target.value)} className="w-full px-4 py-3 bg-white border rounded-lg text-sm" />
                      </div>
                      <div className="md:col-span-1">
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-1.5 block">Drawing File</label>
                        <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 text-sm font-bold text-gray-500 hover:bg-orange-50">
                          <span className="min-w-0 truncate">{row.drawing_file ? row.drawing_file.name : 'Upload PDF'}</span>
                          <Upload size={16} className="flex-shrink-0 text-orange-600" />
                          <input type="file" accept="application/pdf,image/*" onChange={e => updateItemDrawingFile(index, e.target.files?.[0] || null)} className="hidden" />
                        </label>
                      </div>
                    </div>

                    {/* Departments */}
                    <div className="mt-4">
                      <h5 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Departments</h5>
                      <div className="flex flex-wrap gap-2">
                        {involvingDepartments.map(d => (
                          <button key={d.id} type="button" onClick={() => handleDeptToggle(index, d.name)} className={`px-4 py-2 text-xs font-black border rounded-xl transition-all ${(row.departments || []).includes(d.name) ? 'bg-orange-600 text-white shadow-md border-orange-600' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-orange-300'}`}>{d.name}</button>
                        ))}
                      </div>
                      {rowWithDeptError === index && <p className="mt-2 text-xs font-bold text-red-500">Please select at least one department.</p>}
                    </div>

                  </div>

                  <div>
                    <div className="rounded-xl border border-orange-200 bg-white p-4">
                      <h5 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5">📊 Metric Requirements {(row.metric_requirements?.length || 0) > 0 && <span className="text-purple-600 font-black">({row.metric_requirements!.length})</span>}</h5>
                      {row.metric_requirements && row.metric_requirements.length > 0 && (
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 px-1">
                              <span className="flex-1">Metric</span>
                              <span className="w-20 text-center">Unit</span>
                              <span className="w-20 text-right">Qty/Unit</span>
                              <span className="w-7"></span>
                            </div>
                            {row.metric_requirements.map((req, mi) => (
                              <div key={mi} className="flex items-center gap-2">
                                <input placeholder="e.g. Plywood" value={req.metric} onChange={e => { const updated = [...itemRows[index].metric_requirements]; updated[mi] = {...updated[mi], metric: e.target.value}; updateItemRow(index, 'metric_requirements', updated); }} className="flex-1 px-3 py-2 bg-white border rounded-lg text-sm" />
                                <input placeholder="e.g. Sq.m" value={req.unit} onChange={e => { const updated = [...itemRows[index].metric_requirements]; updated[mi] = {...updated[mi], unit: e.target.value}; updateItemRow(index, 'metric_requirements', updated); }} className="w-20 px-3 py-2 bg-white border rounded-lg text-sm" />
                                <input type="number" step="any" placeholder="0" value={req.qtyPerUnit} onChange={e => { const updated = [...itemRows[index].metric_requirements]; updated[mi] = {...updated[mi], qtyPerUnit: parseFloat(e.target.value) || 0}; updateItemRow(index, 'metric_requirements', updated); }} className="w-20 px-3 py-2 bg-white border rounded-lg text-sm text-right" />
                                <button type="button" onClick={() => { const updated = itemRows[index].metric_requirements.filter((_, i) => i !== mi); updateItemRow(index, 'metric_requirements', updated); }} className="text-red-400 hover:text-red-600 font-bold text-sm px-1">✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <button type="button" onClick={() => { const updated = [...(itemRows[index].metric_requirements || []), { metric: '', unit: '', qtyPerUnit: 0 }]; updateItemRow(index, 'metric_requirements', updated); }} className="text-purple-600 text-sm font-bold hover:text-purple-800 flex items-center gap-1"><Plus size={14} /> Add Metric Requirement</button>
                      </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </div>

          {/* Sticky bottom: Submit */}
          <div className="flex-shrink-0">
            <button type="submit" className="w-full py-4 bg-orange-600 text-white rounded-xl font-black shadow-lg hover:bg-orange-700 text-sm">{editingItem ? 'Save Item' : 'Register Item Master'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} title="Drawing PDF Preview" maxWidthClassName="max-w-6xl">
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
              {filteredData.map(c => (
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
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">No items found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden p-2 space-y-2">
          {filteredData.map(c => (
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

          {filteredData.length === 0 && (
            <div className="py-8 text-center text-gray-400 italic text-sm">No items found.</div>
          )}
        </div>
      </Card>
    </div>
  );
};

// --- Child Item List View ---

const ChildItemListView: React.FC<{ onError: () => void; editingId?: number | string }> = ({ onError, editingId }) => {
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

  useEffect(() => {
    if (editingId && data.length > 0) {
      const found = data.find(c => String(c.id) === String(editingId));
      if (found) { openEditComponent(found); (window as any)._id = undefined; }
    }
  }, [editingId, data]);

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
       void logActivity({
         eventType: 'component',
         action: editingComponent ? 'updated' : 'created',
         title: editingComponent ? 'Component Updated' : 'Component Created',
         body: `${editingComponent ? 'Updated' : 'Created'} component(s): ${rowsToCreate.map(row => row.name).join(', ')}`,
         actor: getStoredLoggedInUser(),
         targetCollection: 'child_items',
         targetId: editingComponent?.id,
         targetLabel: payloadRows[0]?.name,
         department: payloadRows[0]?.departments?.[0],
         metadata: { count: rowsToCreate.length, departments: payloadRows.map(row => row.departments), names: rowsToCreate.map(row => row.name) },
         severity: 'info',
       });
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
      void logActivity({
        eventType: 'component',
        action: 'deleted',
        title: 'Component Deleted',
        body: `Deleted component: ${component.name}`,
        actor: getStoredLoggedInUser(),
        targetCollection: 'child_items',
        targetId: component.id,
        targetLabel: component.name,
        department: component.departments?.[0],
        metadata: { departments: component.departments || [] },
        severity: 'warning',
      });
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
                    <div className="flex items-center justify-center gap-1">
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
                    </div>
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

const WorkerDashboard: React.FC<{ onError: () => void; onView: (id: number) => void; onViewPlan: (id: number) => void; loggedInUser: User }> = ({ onError, onView, onViewPlan, loggedInUser }) => {
  const [data, setData] = useState<(WorkOrder & { itemInfo?: Item })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [busyCardStatusId, setBusyCardStatusId] = useState<number | null>(null);

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
          const enriched = woRes.map(wo => {
            const departments = parseAssignedDepartments(wo.assigned_departments);
            return {
              ...wo,
              itemInfo: getItemForWorkOrder(itemRes, wo),
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

  const updateCardStatus = async (wo: WorkOrder & { itemInfo?: Item }, status: string) => {
    if (busyCardStatusId) return;
    const userDept = normalizeDepartment(loggedInUser.department);
    setBusyCardStatusId(wo.id);

    const previousData = data;
    try {
      if (userDept === 'Office') {
        setData(prev => prev.map(row => row.id === wo.id ? { ...row, status: status as WOStatus } : row));
        const { error } = await supabase.from('work_orders').update({ status }).eq('id', wo.id);
        if (error) throw error;
        void logActivity({
          eventType: 'work_order',
          action: 'overall_status_changed',
          title: 'Order Status Changed',
          body: `Order #${wo.id}: ${wo.status} -> ${status}`,
          actor: loggedInUser,
          targetCollection: 'work_orders',
          targetId: wo.id,
          targetLabel: wo.job_details,
          workOrderId: wo.id,
          customerName: wo.customer,
          itemName: wo.job_details,
          oldValue: wo.status,
          newValue: status,
          severity: 'info',
        });
      } else {
        const update = buildDepartmentStatusUpdate(wo, loggedInUser, status);
        if (!update) return;
        setData(prev => prev.map(row => row.id === wo.id ? { ...row, department_statuses: update.departmentStatuses, status: update.overallStatus } : row));
        const { error } = await supabase.from('work_orders').update({ department_statuses: update.departmentStatuses, status: update.overallStatus }).eq('id', wo.id);
        if (error) throw error;
        const department = getEditableDepartmentForUser(wo, loggedInUser);
        const previousDeptStatus = (wo.department_statuses || []).find(row => normalizeDepartment(row.department) === normalizeDepartment(department));
        void logActivity({
          eventType: 'work_order',
          action: normalizeDepartment(loggedInUser.department) === 'Quality_Control' ? 'qc_status_changed' : 'department_status_changed',
          title: normalizeDepartment(loggedInUser.department) === 'Quality_Control' ? 'QC Status Changed' : 'Department Status Changed',
          body: `Order #${wo.id} | ${department.replace(/_/g, ' ')}: ${(normalizeDepartment(loggedInUser.department) === 'Quality_Control' ? previousDeptStatus?.qc_status : previousDeptStatus?.status) || 'Not Started'} -> ${status}`,
          actor: loggedInUser,
          targetCollection: 'work_orders',
          targetId: wo.id,
          targetLabel: wo.job_details,
          workOrderId: wo.id,
          customerName: wo.customer,
          itemName: wo.job_details,
          department,
          oldValue: (normalizeDepartment(loggedInUser.department) === 'Quality_Control' ? previousDeptStatus?.qc_status : previousDeptStatus?.status) || 'Not Started',
          newValue: status,
          severity: status === 'QC Denied' ? 'warning' : 'success',
        });
      }
      invalidateCollectionCache('work_orders');
    } catch (error) {
      setData(previousData);
      alert('Failed to update status');
    } finally {
      setBusyCardStatusId(null);
    }
  };

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
        <div className="flex gap-1.5 flex-wrap items-center">
          <button onClick={() => setStatusFilter('All')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${statusFilter === 'All' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}>All</button>
          {statusOptions.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${statusFilter === s ? (statusTabColors[s] || 'bg-slate-900 text-white') : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}>{s}</button>
          ))}
        </div>
      </div>

      <Modal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} title="Drawing PDF Preview" maxWidthClassName="max-w-6xl">
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

            <WorkOrderCardActions
              wo={wo}
              loggedInUser={loggedInUser}
              onViewPlan={onViewPlan}
              onViewDrawing={(url) => { setSelectedImageUrl(url); setIsImageModalOpen(true); }}
              onChangeStatus={updateCardStatus}
              busy={busyCardStatusId === wo.id}
            />
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

const WorkOrderList: React.FC<{ onError: () => void; onView: (id: number) => void; onViewPlan: (id: number) => void; loggedInUser: User }> = ({ onError, onView, onViewPlan, loggedInUser }) => {
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
  const [busyCardStatusId, setBusyCardStatusId] = useState<number | null>(null);
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
        const enriched = woRes.map(wo => {
          const departments = parseAssignedDepartments(wo.assigned_departments);
          return {
            ...wo,
            itemInfo: getItemForWorkOrder(itemRes, wo),
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
        void logActivity({
          eventType: 'work_order',
          action: 'suborder_created',
          title: 'Suborder Created',
          body: `Suborder #${insertedSuborder.id} created for parent #${params.parentWorkOrderId}: ${childItem.name}`,
          actor: loggedInUser,
          targetCollection: 'work_orders',
          targetId: insertedSuborder.id,
          targetLabel: childItem.name,
          workOrderId: insertedSuborder.id,
          customerName: params.customer,
          itemName: childItem.name,
          metadata: { parent_work_order_id: params.parentWorkOrderId, qty: suborderQty, assigned_departments: assignedDepartments },
          severity: 'success',
        });
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
            void logActivity({
              eventType: 'work_order',
              action: 'created',
              title: 'Order Created',
              body: `Order #${insertedOrder.id} created: ${formData.job_details}`,
              actor: loggedInUser,
              targetCollection: 'work_orders',
              targetId: insertedOrder.id,
              targetLabel: formData.job_details,
              workOrderId: insertedOrder.id,
              customerName: formData.customer,
              itemName: formData.job_details,
              newValue: 'Not Started',
              metadata: { qty: formData.qty, etd: formData.etd, assigned_departments: sanitizedAssignedDepartments },
              severity: 'success',
            });
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

  const updateCardStatus = async (wo: WorkOrder & { itemInfo?: Item }, status: string) => {
    if (busyCardStatusId) return;
    const userDept = normalizeDepartment(loggedInUser.department);
    setBusyCardStatusId(wo.id);

    const previousData = data;
    try {
      if (userDept === 'Office') {
        setData(prev => prev.map(row => row.id === wo.id ? { ...row, status: status as WOStatus } : row));
        const { error } = await supabase.from('work_orders').update({ status }).eq('id', wo.id);
        if (error) throw error;
        void logActivity({
          eventType: 'work_order',
          action: 'overall_status_changed',
          title: 'Order Status Changed',
          body: `Order #${wo.id}: ${wo.status} -> ${status}`,
          actor: loggedInUser,
          targetCollection: 'work_orders',
          targetId: wo.id,
          targetLabel: wo.job_details,
          workOrderId: wo.id,
          customerName: wo.customer,
          itemName: wo.job_details,
          oldValue: wo.status,
          newValue: status,
          severity: 'info',
        });
      } else {
        const update = buildDepartmentStatusUpdate(wo, loggedInUser, status);
        if (!update) return;
        setData(prev => prev.map(row => row.id === wo.id ? { ...row, department_statuses: update.departmentStatuses, status: update.overallStatus } : row));
        const { error } = await supabase.from('work_orders').update({ department_statuses: update.departmentStatuses, status: update.overallStatus }).eq('id', wo.id);
        if (error) throw error;
        const department = getEditableDepartmentForUser(wo, loggedInUser);
        const previousDeptStatus = (wo.department_statuses || []).find(row => normalizeDepartment(row.department) === normalizeDepartment(department));
        const isQcAction = normalizeDepartment(loggedInUser.department) === 'Quality_Control';
        void logActivity({
          eventType: 'work_order',
          action: isQcAction ? 'qc_status_changed' : 'department_status_changed',
          title: isQcAction ? 'QC Status Changed' : 'Department Status Changed',
          body: `Order #${wo.id} | ${department.replace(/_/g, ' ')}: ${(isQcAction ? previousDeptStatus?.qc_status : previousDeptStatus?.status) || 'Not Started'} -> ${status}`,
          actor: loggedInUser,
          targetCollection: 'work_orders',
          targetId: wo.id,
          targetLabel: wo.job_details,
          workOrderId: wo.id,
          customerName: wo.customer,
          itemName: wo.job_details,
          department,
          oldValue: (isQcAction ? previousDeptStatus?.qc_status : previousDeptStatus?.status) || 'Not Started',
          newValue: status,
          severity: status === 'QC Denied' ? 'warning' : 'success',
        });
      }
      invalidateCollectionCache('work_orders');
    } catch (error) {
      setData(previousData);
      alert('Failed to update status');
    } finally {
      setBusyCardStatusId(null);
    }
  };

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
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setStatusFilter('All')} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${statusFilter === 'All' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}>All</button>
              {statusOptions.map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${statusFilter === s ? (statusTabColors[s] || 'bg-slate-900 text-white') : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}>{s}</button>
              ))}
            </div>

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
          <div className="flex gap-1.5 flex-wrap items-center">
            <button onClick={() => setStatusFilter('All')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${statusFilter === 'All' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}>All</button>
            {statusOptions.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${statusFilter === s ? (statusTabColors[s] || 'bg-slate-900 text-white') : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}>{s}</button>
            ))}
          </div>

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
        {formData.assigned_departments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {formData.assigned_departments.map(dept => (
              <span key={dept} className="px-3 py-1.5 rounded-xl text-[10px] font-bold bg-blue-600 text-white border border-blue-600">
                {dept.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-[10px] font-semibold text-gray-400 italic">Select an Item Master to auto-populate departments.</div>
        )}
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

      <Modal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} title="Drawing PDF Preview" maxWidthClassName="max-w-6xl">
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

                <WorkOrderCardActions
                  wo={wo}
                  loggedInUser={loggedInUser}
                  onViewPlan={onViewPlan}
                  onViewDrawing={(url) => { setSelectedImageUrl(url); setIsImageModalOpen(true); }}
                  onChangeStatus={updateCardStatus}
                  busy={busyCardStatusId === wo.id}
                />
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

  if (loading) return <LoadingState />;
  if (!wo) return <div className="p-20 text-center font-black text-red-500">Order not found or you do not have permission to view it.</div>;

  const normUserDept = normalizeDepartment(loggedInUser.department);
  const isOffice = normUserDept === 'Office';

  return (
    <div className="space-y-3 sm:space-y-4 max-[375px]:space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="no-print">
        <button onClick={onBack} className="flex items-center gap-2 max-[375px]:gap-1.5 text-[10px] max-[375px]:text-[9px] font-black text-slate-300 md:text-gray-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">
          <ChevronLeft size={16}/> Back
        </button>
      </div>
       
       <div className="flex flex-col xl:flex-row gap-4 max-[375px]:gap-3">
         <div className="flex-1 space-y-4">
            <Card className="p-3 md:p-5 border-t-[3px] border-t-indigo-600 rounded-xl overflow-hidden print-job-card">
              <div className="flex flex-col md:flex-row justify-between items-start mb-5 gap-3">
                  <div className="space-y-1">
                     <div className="flex flex-wrap items-center gap-2">
                       <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-xs font-bold tracking-widest border border-indigo-100">ORDER-#{wo.id}</span>
                       {wo.order_type === 'suborder' && <Badge color="purple">Suborder Of #{wo.parent_work_order_id || '-'}</Badge>}
                     </div>
                     <h1 className="text-lg md:text-2xl font-bold text-gray-800 mt-1.5 mb-0.5 break-words leading-tight line-clamp-2">{wo.job_details}</h1>
                     {wo.parent_work_order_id && <p className="text-xs font-semibold text-purple-500 uppercase tracking-wider">Parent Item: {wo.parent_item_name || 'Parent Item'}</p>}
                     <p className="text-xs md:text-sm font-medium text-gray-400 uppercase tracking-tight">{wo.customer}</p>
                  </div>
                  <StatusBadge status={wo.status} />
               </div>
                
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3 py-4 border-y border-gray-100">
                  <div>
                     <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-0.5">Batch Size</label>
                     <p className="text-base md:text-lg font-bold text-indigo-600">{wo.qty} <span className="text-xs text-gray-400 font-medium">PCS</span></p>
                  </div>
                  <div>
                     <label className="text-xs font-semibold uppercase text-gray-400 tracking-widest block mb-0.5">Delivery ETD</label>
                     <p className="text-sm font-semibold text-orange-600 flex items-center gap-1"><Clock size={14}/> {wo.etd || 'N/A'}</p>
                  </div>
                  <div className="hidden md:block">
                     <label className="text-xs font-semibold uppercase text-gray-400 tracking-widest block mb-0.5">Blueprint Ref</label>
                     <p className="text-xs font-mono font-medium text-gray-700 px-2 py-1 bg-gray-50 rounded inline-block break-all">{wo.drawing || 'NO DRAWING'}</p>
                  </div>
                  <div className="hidden md:block">
                     <label className="text-xs font-semibold uppercase text-gray-400 tracking-widest block mb-0.5">QC/Ready Date</label>
                     <p className="text-sm font-semibold text-green-600">{wo.ready_date || 'IN PROGRESS'}</p>
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
                      
                      const allDepartments = wo.assigned_departments || [];
                      const wasAllApproved = allDepartments.length > 0 && allDepartments.every(dept => {
                          const ds = existingStatuses.find(s => normalizeDepartment(s.department) === normalizeDepartment(dept));
                          return ds?.qc_status === 'QC Approved';
                      });
                      const allApproved = allDepartments.length > 0 && allDepartments.every(dept => {
                          const ds = updatedStatuses.find(s => normalizeDepartment(s.department) === normalizeDepartment(dept));
                          return ds?.qc_status === 'QC Approved';
                      });

                      const newOverallStatus = deriveOverallStatusFromDepartmentStatuses(wo, updatedStatuses);
                      const optimisticWo = { ...wo, department_statuses: updatedStatuses, status: newOverallStatus };
                      setWo(optimisticWo);
                      
                      const { error } = await supabase.from('work_orders').update({ department_statuses: updatedStatuses, status: newOverallStatus }).eq('id', wo.id);
                      if (error) throw error;
                      invalidateCollectionCache('work_orders');

                      void logActivity({
                        eventType: 'work_order',
                        action: qcStatus ? 'qc_status_changed' : 'department_status_changed',
                        title: qcStatus ? 'QC Status Changed' : 'Department Status Changed',
                        body: `Order #${wo.id} | ${department.replace(/_/g, ' ')}: ${qcStatus ? (previousQCStatus || 'Pending QC') : (previousStatus || 'Not Started')} -> ${qcStatus || status}`,
                        actor: loggedInUser,
                        targetCollection: 'work_orders',
                        targetId: wo.id,
                        targetLabel: wo.job_details,
                        workOrderId: wo.id,
                        customerName: wo.customer,
                        itemName: wo.job_details,
                        department,
                        oldValue: qcStatus ? (previousQCStatus || 'Pending QC') : (previousStatus || 'Not Started'),
                        newValue: qcStatus || status,
                        severity: qcStatus === 'QC Denied' ? 'warning' : 'success',
                      });

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

               <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2 no-print">
                 <button onClick={() => window.print()} className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2">
                    <Printer size={16}/> PRINT JOB CARD
                 </button>
                 {isOffice && (
                    <button onClick={async () => {
                      if(confirm("Delete Order?")) {
                        await supabase.from('work_orders').delete().eq('id', id);
                        void logActivity({ eventType: 'work_order', action: 'deleted', title: 'Order Deleted', body: `Deleted order #${id} from WO Details`, actor: getStoredLoggedInUser(), targetCollection: 'work_orders', targetId: id, severity: 'warning' });
                        onBack();
                      }
                    }} className="flex-1 py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border border-red-200">
                       <Trash2 size={16}/> DELETE ORDER
                    </button>
                 )}
              </div>
           </Card>
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

    void logActivity({
      eventType: 'custom_bom',
      action: editingPlanId ? 'updated' : 'created',
      title: editingPlanId ? 'BOM Plan Updated' : 'BOM Plan Created',
      body: `Plan: ${planName}, Company: ${selectedCompany}`,
      actor: getStoredLoggedInUser(),
      targetCollection: 'custom_bom_plans',
      severity: 'success',
    });
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
        void logActivity({
          eventType: 'component',
          action: 'created',
          title: 'Components Added to Library',
          body: `Added ${namesToCreate.length} component(s) from BOM builder`,
          actor: getStoredLoggedInUser(),
          targetCollection: 'child_items',
          severity: 'info',
        });
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

    void logActivity({
      eventType: 'item',
      action: 'bom_updated',
      title: 'Item BOM Updated',
      body: `Saved ${children.length} component(s) to item: ${componentItem.name}`,
      actor: getStoredLoggedInUser(),
      targetCollection: 'items',
      targetId: componentItem.id,
      targetLabel: componentItem.name,
      customerName: componentItem.customer_name,
      severity: 'info',
    });
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

  const printSavedItemBom = (item: Item) => {
    const qtyInput = prompt('Enter quantity for production plan', '1');
    if (qtyInput === null) return;

    const multiplier = Math.max(1, Number(qtyInput) || 1);
    const plan = {
      plan_name: item.name,
      company_name: item.customer_name,
      plan_items: [{
        local_id: makeLocalId(),
        item_id: item.id,
        item_name: item.name,
        drawing_no: item.drawing_no || '',
        item_qty: 1,
        components: (item.children || []).map(child => ({
          component_type: (child as any).type || 'component',
          component_id: String((child as any).id || ''),
          component_name: child.name,
          departments: Array.isArray(child.departments) ? child.departments : [],
          qty_per_item: Math.max(1, Number((child as any).qtyPerMaster) || 1),
          total_qty: Math.max(1, Number((child as any).qtyPerMaster) || 1),
        })),
      }],
    };
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

    void logActivity({
      eventType: 'component',
      action: 'created',
      title: 'Component Created',
      body: `Component: ${newComponent.name}`,
      actor: getStoredLoggedInUser(),
      targetCollection: 'child_items',
      severity: 'success',
    });
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
                    <button onClick={() => printSavedItemBom(row.item_ref)} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-black">Print</button>
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
              <div className="mt-3 flex gap-2">
                <button onClick={() => openItemBomComponentDialog(row.item_ref)} className="flex-1 px-2 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black">Edit BOM</button>
                <button onClick={() => printSavedItemBom(row.item_ref)} className="flex-1 px-2 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-black">Print</button>
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

      <div className="w-full md:w-auto">
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setStatusFilter('All')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${statusFilter === 'All' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}>All</button>
          {statusOptions.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${statusFilter === s ? (statusTabColors[s] || 'bg-slate-900 text-white') : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}>{s}</button>
          ))}
        </div>
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const activityOffsetRef = useRef(0);
  const notificationOffsetRef = useRef(0);
  const ACTIVITY_PAGE = 100;
  const NOTIFICATION_PAGE = 100;

  const toArray = (value: any) => Array.isArray(value) ? value : value ? [value] : [];

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

  const getEventActor = (ev: any) => ev.actor_name || ev.actor || ev.dispatched_by || '-';
  const getEventDepartments = (ev: any) => toArray(ev.departments || ev.department || ev.actor_department).filter(Boolean);
  const getEventType = (ev: any) => ev._source === 'activity' ? (ev.event_type || 'activity') : 'notification';
  const getEventAction = (ev: any) => ev._source === 'activity' ? (ev.action || 'logged') : 'push_sent';

  const getTone = (ev: any) => {
    if (ev._source === 'notification') {
      const failed = Number(ev.failed || 0);
      const sent = Number(ev.sent || 0);
      return failed > 0 ? 'border-l-red-500' : sent > 0 ? 'border-l-emerald-500' : 'border-l-amber-500';
    }
    if (ev.severity === 'error') return 'border-l-red-500';
    if (ev.severity === 'warning') return 'border-l-amber-500';
    if (ev.severity === 'success') return 'border-l-emerald-500';
    return 'border-l-blue-500';
  };

  const fetchEvents = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      activityOffsetRef.current = 0;
      notificationOffsetRef.current = 0;
      setHasMore(true);
    }
    try {
      const [activityResult, notificationResult] = await Promise.all([
        supabase.from('activity_events').select('*').order('event_time', { ascending: false }).range(activityOffsetRef.current, activityOffsetRef.current + ACTIVITY_PAGE - 1),
        supabase.from('notification_events').select('*').order('event_time', { ascending: false }).range(notificationOffsetRef.current, notificationOffsetRef.current + NOTIFICATION_PAGE - 1),
      ]);

      if (activityResult.error?.code === '42P01' || notificationResult.error?.code === '42P01') {
        onError();
        return;
      }

      const newBatch = [
        ...(activityResult.data || []).map((event: any) => ({ ...event, _source: 'activity' })),
        ...(notificationResult.data || []).map((event: any) => ({ ...event, _source: 'notification' })),
      ];

      if (isLoadMore) {
        setEvents(prev => {
          const merged = [...prev, ...newBatch];
          return merged.sort((a: any, b: any) => getEventTimestamp(b) - getEventTimestamp(a));
        });
      } else {
        setEvents(newBatch.sort((a: any, b: any) => getEventTimestamp(b) - getEventTimestamp(a)));
      }

      activityOffsetRef.current += ACTIVITY_PAGE;
      notificationOffsetRef.current += NOTIFICATION_PAGE;

      const activityFull = (activityResult.data || []).length >= ACTIVITY_PAGE;
      const notificationFull = (notificationResult.data || []).length >= NOTIFICATION_PAGE;
      setHasMore(activityFull || notificationFull);
    } catch (_e) {
      onError();
    }
    if (isLoadMore) {
      setLoadingMore(false);
    } else {
      setLoading(false);
    }
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
      String(getEventActor(ev)).toLowerCase().includes(q) ||
      String(getEventType(ev)).toLowerCase().includes(q) ||
      String(getEventAction(ev)).toLowerCase().includes(q) ||
      String(ev.customer_name || '').toLowerCase().includes(q) ||
      String(ev.item_name || '').toLowerCase().includes(q) ||
      String(getEventDepartments(ev).join(',')).toLowerCase().includes(q) ||
      String(ev.work_order_id || '').includes(q)
    );
  }, [events, searchQuery]);

  if (loading) return <LoadingState message="Loading activity log..." />;

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] bg-white p-5 text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.12)] border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="md:hidden text-[10px] font-black uppercase tracking-widest text-blue-700">Alerts Center</div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 md:text-gray-800">Alerts & Activity Log</h2>
          <p className="text-xs font-semibold text-slate-600 md:text-gray-500 text-left">Recent order, master-data, dispatch, status, and push delivery events.</p>
        </div>
        <button onClick={fetchEvents} className="px-4 py-3 md:py-2 bg-blue-600 md:bg-slate-900 text-white rounded-2xl md:rounded-xl text-sm font-black">Refresh</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by title, action, user, department, customer, item, order id..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm"
        />
      </div>

      <div className="md:hidden space-y-2.5">
        {filteredEvents.map((ev: any) => {
          const failed = Number(ev.failed || 0);
          const sent = Number(ev.sent || 0);
          const targets = Number(ev.targets || 0);
          const tone = getTone(ev);
          const departments = getEventDepartments(ev);

          return (
            <div key={ev.id} className={`rounded-2xl bg-white border border-gray-100 border-l-4 ${tone} p-3.5 shadow-sm`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">{formatEventTime(ev)}</div>
                  <h3 className="mt-1 text-sm font-black text-slate-900 leading-tight">{ev.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge color="gray">{getEventType(ev)}</Badge>
                    <Badge color="gray">{getEventAction(ev)}</Badge>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] font-black text-indigo-600">WO #{ev.work_order_id || '-'}</div>
                </div>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-600 whitespace-pre-line">{ev.body}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {departments.map((d: string) => <Badge key={d} color="gray">{String(d).replace(/_/g, ' ')}</Badge>)}
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl bg-gray-50 px-2 py-2"><div className="text-[9px] font-black text-gray-400 uppercase">By</div><div className="text-[10px] font-black text-slate-700 truncate">{getEventActor(ev)}</div></div>
                <div className="rounded-xl bg-gray-50 px-2 py-2"><div className="text-[9px] font-black text-gray-400 uppercase">Target</div><div className="text-[10px] font-black text-slate-700 truncate">{ev.target_label || ev.item_name || '-'}</div></div>
                <div className="rounded-xl bg-emerald-50 px-2 py-2"><div className="text-[9px] font-black text-emerald-600 uppercase">Sent</div><div className="text-xs font-black text-emerald-700">{ev._source === 'notification' ? sent : '-'}</div></div>
                <div className="rounded-xl bg-red-50 px-2 py-2"><div className="text-[9px] font-black text-red-600 uppercase">Failed</div><div className="text-xs font-black text-red-700">{ev._source === 'notification' ? failed : '-'}</div></div>
              </div>
            </div>
          );
        })}
        {filteredEvents.length === 0 && <div className="rounded-2xl bg-white p-8 text-center text-sm font-semibold text-gray-400">No activity events found.</div>}
      </div>

      <Card className="hidden md:block p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-widest text-gray-400 font-black border-b">
              <tr>
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Message</th>
                <th className="px-4 py-2 text-left">Done By</th>
                <th className="px-4 py-2 text-left">Departments</th>
                <th className="px-4 py-2 text-left">WO #</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Item/Target</th>
                <th className="px-4 py-2 text-left">Targets</th>
                <th className="px-4 py-2 text-left">Sent</th>
                <th className="px-4 py-2 text-left">Failed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEvents.map((ev: any) => {
                const departments = getEventDepartments(ev);
                return (
                  <tr key={ev.id}>
                    <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{formatEventTime(ev)}</td>
                    <td className="px-4 py-2"><Badge color="gray">{getEventType(ev)}</Badge></td>
                    <td className="px-4 py-2 text-xs font-black text-slate-700 whitespace-nowrap">{getEventAction(ev)}</td>
                    <td className="px-4 py-2 font-black text-slate-800 whitespace-nowrap">{ev.title}</td>
                    <td className="px-4 py-2 text-xs text-gray-600 max-w-[360px]">{ev.body}</td>
                    <td className="px-4 py-2 text-xs font-bold text-gray-700 whitespace-nowrap">{getEventActor(ev)}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {departments.map((d: string) => <Badge key={d} color="gray">{String(d).replace(/_/g, ' ')}</Badge>)}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs font-black text-indigo-600">{ev.work_order_id || '-'}</td>
                    <td className="px-4 py-2 text-xs font-bold text-gray-700 whitespace-nowrap">{ev.customer_name || '-'}</td>
                    <td className="px-4 py-2 text-xs font-bold text-gray-700 whitespace-nowrap">{ev.item_name || ev.target_label || '-'}</td>
                    <td className="px-4 py-2 font-bold">{ev._source === 'notification' ? ev.targets : '-'}</td>
                    <td className="px-4 py-2 font-bold text-green-600">{ev._source === 'notification' ? ev.sent : '-'}</td>
                    <td className="px-4 py-2 font-bold text-red-600">{ev._source === 'notification' ? ev.failed : '-'}</td>
                  </tr>
                );
              })}
              {filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-gray-400 italic">No activity events found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {hasMore && !loading && (
        <div className="text-center">
          <button
            onClick={() => fetchEvents(true)}
            disabled={loadingMore}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-black shadow-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load More Events'}
          </button>
        </div>
      )}
    </div>
  );
};

const ReportsView: React.FC<{ onError: () => void }> = ({ onError }) => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [dispatchLogs, setDispatchLogs] = useState<any[]>([]);
  const [productionReports, setProductionReports] = useState<any[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [reportType, setReportType] = useState<'component-usage' | 'item-usage' | 'on-time' | 'delayed' | 'dept-wise' | 'company-performance'>('component-usage');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [activePreset, setActivePreset] = useState<'today' | '7d' | '30d' | '90d' | 'all' | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      try {
        const [{ data: woRes, error: woErr }, { data: dispatchRes, error: dispatchErr }, { data: prodRes }, { data: itemsRes }] = await Promise.all([
          supabase.from('work_orders').select('*').order('id', { ascending: false }),
          supabase.from('dispatch_logs').select('*').order('created_at', { ascending: false }),
          supabase.from('production_reports').select('*'),
          supabase.from('items').select('*'),
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
        setProductionReports(prodRes || []);
        setItems(itemsRes || []);
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

  const itemsById = useMemo(() => {
    const map = new Map<number, Item>();
    items.forEach(item => map.set(Number(item.id), item));
    return map;
  }, [items]);

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

  const readyStatuses = ['Ready for despatch', 'Dispatched', 'Delivered'];

  const delayDays = (dispatchDate: Date, etd: Date) => Math.max(0, Math.ceil((dispatchDate.getTime() - etd.getTime()) / 86400000));

  const componentUsageRows = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    const result: { component: string; parentItem: string; qtyUsed: number; company: string; orderId: number }[] = [];
    for (const order of orders) {
      if (!readyStatuses.includes(order.status)) continue;
      const d = parseDate(order.created_at) || parseDate(order.etd, true);
      if (!inRange(d)) continue;
      const c = String(order.customer || 'Unknown');
      if (q && !c.toLowerCase().includes(q)) continue;
      const item = itemsById.get(Number(order.source_item_id || order.itemId));
      if (!item?.children) continue;
      for (const child of item.children) {
        const qty = (child.qtyPerMaster || 0) * Number(order.qty);
        result.push({ component: child.name, parentItem: item.name, qtyUsed: qty, company: c, orderId: Number(order.id) });
      }
    }
    return result;
  }, [orders, itemsById, fromDate, toDate, companySearch]);

  const itemUsageRows = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    const grouped = new Map<string, { item: string; orders: number; totalQty: number; companies: Set<string> }>();
    for (const order of orders) {
      if (!readyStatuses.includes(order.status)) continue;
      const d = parseDate(order.created_at) || parseDate(order.etd, true);
      if (!inRange(d)) continue;
      const c = String(order.customer || 'Unknown');
      if (q && !c.toLowerCase().includes(q)) continue;
      const name = String(order.job_details || 'Unknown');
      const row = grouped.get(name) || { item: name, orders: 0, totalQty: 0, companies: new Set<string>() };
      row.orders += 1;
      row.totalQty += Number(order.qty) || 0;
      row.companies.add(c);
      grouped.set(name, row);
    }
    return Array.from(grouped.values()).map(r => ({ ...r, companyCount: r.companies.size })).sort((a, b) => b.orders - a.orders);
  }, [orders, fromDate, toDate, companySearch]);

  const onTimeRows = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    return dispatchLogs.map((log: any) => {
      const order = orderById.get(Number(log.work_order_id));
      if (!order) return null;
      const d = parseDate(log.created_at);
      const etd = parseDate(order.etd, true);
      if (!d || !etd || d > etd) return null;
      if (!inRange(d)) return null;
      const c = String(order.customer || 'Unknown');
      if (q && !c.toLowerCase().includes(q)) return null;
      return { ...log, order, when: d };
    }).filter(Boolean);
  }, [dispatchLogs, orderById, fromDate, toDate, companySearch]);

  const delayedRows = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    return dispatchLogs.map((log: any) => {
      const order = orderById.get(Number(log.work_order_id));
      if (!order) return null;
      const d = parseDate(log.created_at);
      const etd = parseDate(order.etd, true);
      if (!d || !etd || d <= etd) return null;
      if (!inRange(d)) return null;
      const c = String(order.customer || 'Unknown');
      if (q && !c.toLowerCase().includes(q)) return null;
      return { ...log, order, when: d, daysDelay: delayDays(d, etd) };
    }).filter(Boolean);
  }, [dispatchLogs, orderById, fromDate, toDate, companySearch]);

  const deptWiseRows = useMemo(() => {
    const grouped = new Map<string, { dept: string; reports: number; shiftHrs: number; otHrs: number; totalHrs: number; qtyProduced: number }>();
    for (const pr of productionReports) {
      const d = parseDate(pr.date);
      if (!inRange(d)) continue;
      const name = String(pr.department || 'Unknown');
      const row = grouped.get(name) || { dept: name, reports: 0, shiftHrs: 0, otHrs: 0, totalHrs: 0, qtyProduced: 0 };
      row.reports += 1;
      row.shiftHrs += Number(pr.total_shift_hours) || 0;
      row.otHrs += Number(pr.total_ot_hours) || 0;
      row.totalHrs += Number(pr.grand_total_hours) || 0;
      row.qtyProduced += Number(pr.qty_produced) || 0;
      if (pr.items) for (const item of pr.items) row.qtyProduced += Number(item.qty_produced) || 0;
      grouped.set(name, row);
    }
    return Array.from(grouped.values()).sort((a, b) => b.reports - a.reports);
  }, [productionReports, fromDate, toDate]);

  const companyPerfRows = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    const grouped = new Map<string, { company: string; totalWOs: number; totalQty: number; onTime: number; delayed: number }>();
    for (const order of orders) {
      if (!readyStatuses.includes(order.status)) continue;
      const d = parseDate(order.created_at) || parseDate(order.etd, true);
      if (!inRange(d)) continue;
      const c = String(order.customer || 'Unknown');
      if (q && !c.toLowerCase().includes(q)) continue;
      const row = grouped.get(c) || { company: c, totalWOs: 0, totalQty: 0, onTime: 0, delayed: 0 };
      row.totalWOs += 1;
      row.totalQty += Number(order.qty) || 0;
      const orderDispatches = dispatchLogs.filter((dl: any) => Number(dl.work_order_id) === Number(order.id));
      if (orderDispatches.length > 0) {
        const etd = parseDate(order.etd, true);
        if (etd) {
          const allOnTime = orderDispatches.every((dl: any) => { const dd = parseDate(dl.created_at); return dd && dd <= etd; });
          if (allOnTime) row.onTime += 1; else row.delayed += 1;
        }
      }
      grouped.set(c, row);
    }
    return Array.from(grouped.values()).sort((a, b) => b.totalWOs - a.totalWOs);
  }, [orders, dispatchLogs, fromDate, toDate, companySearch]);

  const reportRows = useMemo(() => {
    switch (reportType) {
      case 'component-usage': return componentUsageRows;
      case 'item-usage': return itemUsageRows;
      case 'on-time': return onTimeRows;
      case 'delayed': return delayedRows;
      case 'dept-wise': return deptWiseRows;
      case 'company-performance': return companyPerfRows;
    }
  }, [reportType, componentUsageRows, itemUsageRows, onTimeRows, delayedRows, deptWiseRows, companyPerfRows]);

  const reportRowsCount = reportRows.length;

  const reportTotals = useMemo(() => {
    const rows = reportRows as any[];
    return {
      count: rows.length,
      qty: rows.reduce((s: number, r: any) => s + (Number(r.qtyUsed ?? r.totalQty ?? r.dispatch_qty ?? r.qty) || 0), 0),
      onTime: rows.reduce((s: number, r: any) => s + (Number(r.onTime ?? 0) || 0), 0),
      delayed: rows.reduce((s: number, r: any) => s + (Number(r.delayed ?? 0) || 0), 0),
    };
  }, [reportRows]);

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

  const sortedRows = useMemo(() => applySortGeneric(reportRows.map((r: any) => ({
    ...r,
    _date: r.when ? r.when.getTime() : 0,
    _customer: r.order?.customer || r.company || '',
    _item: r.order?.job_details || '',
  }))), [reportRows, sortConfig]);

  const exportPdfReport = () => {
    const rows = sortedRows as any[];
    if (rows.length === 0) { alert('No rows available for export.'); return; }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    const tabLabel = tabMeta.find(t => t.key === reportType)?.label || reportType;
    const dateLabel = fromDate || toDate
      ? `${fromDate || '…'} to ${toDate || '…'}`
      : 'All dates';

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Excell Packaging - Report', pageW / 2, 20, { align: 'center' });
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text(tabLabel, pageW / 2, 28, { align: 'center' });

    // Info line
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Date range: ${dateLabel}  |  Generated: ${new Date().toLocaleString()}`, pageW / 2, 34, { align: 'center' });

    const mapRow = (r: any) => {
      switch (reportType) {
        case 'component-usage':
          return [String(r.component || ''), String(r.parentItem || ''), String(r.qtyUsed ?? 0), String(r.company || ''), `#${r.orderId || ''}`];
        case 'item-usage':
          return [String(r.item || ''), String(r.orders ?? 0), String(r.totalQty ?? 0), String(r.companyCount ?? 0)];
        case 'on-time':
          return [r.when ? new Date(r.when).toLocaleDateString() : '-', `#${r.work_order_id || ''}`, r.order?.customer || '-', r.order?.job_details || '-', String(r.dispatch_qty ?? 0), r.invoice_no || '-'];
        case 'delayed':
          return [r.when ? new Date(r.when).toLocaleDateString() : '-', `#${r.work_order_id || ''}`, r.order?.customer || '-', r.order?.job_details || '-', `${r.daysDelay || 0} days`, String(r.dispatch_qty ?? 0)];
        case 'dept-wise':
          return [String(r.dept || ''), String(r.reports ?? 0), String(r.shiftHrs ?? 0), String(r.otHrs ?? 0), String(r.totalHrs ?? 0), String(r.qtyProduced ?? 0)];
        case 'company-performance':
          const pct = r.totalWOs > 0 ? Math.round(r.onTime / r.totalWOs * 100) + '%' : '0%';
          return [String(r.company || ''), String(r.totalWOs ?? 0), String(r.totalQty ?? 0), String(r.onTime ?? 0), String(r.delayed ?? 0), pct];
      }
    };

    const columns: Record<string, string[]> = {
      'component-usage': ['Component', 'Parent Item', 'Qty Used', 'Company', 'Order #'],
      'item-usage': ['Item Name', 'Orders', 'Total Qty', 'Companies'],
      'on-time': ['Date', 'WO #', 'Company', 'Item', 'Qty', 'Invoice'],
      'delayed': ['Date', 'WO #', 'Company', 'Item', 'Days Late', 'Qty'],
      'dept-wise': ['Department', 'Reports', 'Shift Hrs', 'OT Hrs', 'Total Hrs', 'Qty Produced'],
      'company-performance': ['Company', 'Total WOs', 'Total Qty', 'On-Time', 'Delayed', 'On-Time %'],
    };

    autoTable(doc, {
      head: [columns[reportType] || []],
      body: rows.map(mapRow),
      startY: 38,
      margin: { top: 38, horizontal: 10 },
      tableWidth: 'auto',
      styles: { fontSize: 7, cellPadding: 2.5, lineColor: [200, 200, 200], lineWidth: 0.3 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: { 0: { cellWidth: 'auto' } },
      didDrawPage: (data: any) => {
        doc.setFontSize(6);
        doc.setTextColor(150);
        doc.text(`Page ${data.pageNumber}`, pageW - 10, doc.internal.pageSize.getHeight() - 5, { align: 'right' });
        doc.text('Excell Packaging ERP', 10, doc.internal.pageSize.getHeight() - 5);
      },
    });

    doc.save(`${reportType}-report.pdf`);
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

  const tabMeta: { key: typeof reportType; label: string }[] = [
    { key: 'component-usage', label: 'Component Usage' },
    { key: 'item-usage', label: 'Item Usage' },
    { key: 'on-time', label: 'On-Time Delivery' },
    { key: 'delayed', label: 'Delayed Delivery' },
    { key: 'dept-wise', label: 'Department Wise' },
    { key: 'company-performance', label: 'Company Performance' },
  ];

  const showCompanySearch = ['component-usage', 'item-usage', 'on-time', 'delayed', 'company-performance'].includes(reportType);

  return (
    <div className="space-y-4">
      <div className="sticky top-16 md:top-0 z-20 bg-gray-50/95 backdrop-blur p-2 rounded-xl border border-gray-100 flex flex-col md:flex-row gap-2 md:items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-800 tracking-tight">Reports</h2>
          <p className="text-xs text-gray-500 font-semibold">
            {tabMeta.find(t => t.key === reportType)?.label || ''}
          </p>
        </div>
        <button onClick={exportPdfReport} className="w-full md:w-auto px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2">
          <FileText size={13} />
          Export PDF
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
        <div className="flex flex-wrap bg-gray-100 rounded-xl p-1 gap-1">
          {tabMeta.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setReportType(tab.key); setSortConfig(null); }}
              className={`px-3 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap ${
                reportType === tab.key
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Company search filter */}
        {showCompanySearch && (
          <input
            placeholder="Filter by company/customer..."
            value={companySearch}
            onChange={e => setCompanySearch(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm"
          />
        )}
      </Card>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card className="p-3">
          <div className="text-[10px] uppercase font-black text-gray-400">Records</div>
          <div className="text-xl font-black text-gray-800 mt-1">{reportRowsCount}</div>
        </Card>
        {reportType === 'component-usage' && (
          <Card className="p-3">
            <div className="text-[10px] uppercase font-black text-gray-400">Total Qty Used</div>
            <div className="text-xl font-black text-indigo-700 mt-1">{componentUsageRows.reduce((s, r) => s + r.qtyUsed, 0)}</div>
          </Card>
        )}
        {reportType === 'item-usage' && (
          <Card className="p-3">
            <div className="text-[10px] uppercase font-black text-gray-400">Total Qty</div>
            <div className="text-xl font-black text-indigo-700 mt-1">{itemUsageRows.reduce((s, r) => s + r.totalQty, 0)}</div>
          </Card>
        )}
        {reportType === 'on-time' && (
          <Card className="p-3">
            <div className="text-[10px] uppercase font-black text-gray-400">Total Qty Dispatched</div>
            <div className="text-xl font-black text-green-700 mt-1">{onTimeRows.reduce((s: number, r: any) => s + (Number(r.dispatch_qty) || 0), 0)}</div>
          </Card>
        )}
        {reportType === 'delayed' && (
          <>
            <Card className="p-3">
              <div className="text-[10px] uppercase font-black text-gray-400">Total Qty Dispatched</div>
              <div className="text-xl font-black text-orange-700 mt-1">{delayedRows.reduce((s: number, r: any) => s + (Number(r.dispatch_qty) || 0), 0)}</div>
            </Card>
            <Card className="p-3">
              <div className="text-[10px] uppercase font-black text-gray-400">Avg Delay (Days)</div>
              <div className="text-xl font-black text-red-700 mt-1">
                {delayedRows.length > 0 ? (delayedRows.reduce((s: number, r: any) => s + (r.daysDelay || 0), 0) / delayedRows.length).toFixed(1) : 0}
              </div>
            </Card>
          </>
        )}
        {reportType === 'dept-wise' && (
          <>
            <Card className="p-3">
              <div className="text-[10px] uppercase font-black text-gray-400">Departments</div>
              <div className="text-xl font-black text-gray-800 mt-1">{deptWiseRows.length}</div>
            </Card>
            <Card className="p-3">
              <div className="text-[10px] uppercase font-black text-gray-400">Total Hrs</div>
              <div className="text-xl font-black text-indigo-700 mt-1">{deptWiseRows.reduce((s, r) => s + r.totalHrs, 0)}</div>
            </Card>
          </>
        )}
        {reportType === 'company-performance' && (
          <>
            <Card className="p-3">
              <div className="text-[10px] uppercase font-black text-gray-400">Total Qty</div>
              <div className="text-xl font-black text-indigo-700 mt-1">{companyPerfRows.reduce((s, r) => s + r.totalQty, 0)}</div>
            </Card>
            <Card className="p-3">
              <div className="text-[10px] uppercase font-black text-gray-400">On-Time %</div>
              <div className="text-xl font-black text-green-700 mt-1">
                {companyPerfRows.reduce((s, r) => s + r.totalWOs, 0) > 0
                  ? Math.round(companyPerfRows.reduce((s, r) => s + r.onTime, 0) / companyPerfRows.reduce((s, r) => s + r.totalWOs, 0) * 100) + '%'
                  : '0%'}
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Component Usage table */}
      {reportType === 'component-usage' && (
        <Card className="p-0 overflow-hidden shadow-sm">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-black border-b">
                <tr>
                  <th className={thClass} onClick={() => handleSort('component')}>Component <SortIcon col="component" /></th>
                  <th className={thClass} onClick={() => handleSort('parentItem')}>Parent Item <SortIcon col="parentItem" /></th>
                  <th className={thClass} onClick={() => handleSort('qtyUsed')}>Qty Used <SortIcon col="qtyUsed" /></th>
                  <th className={thClass} onClick={() => handleSort('company')}>Company <SortIcon col="company" /></th>
                  <th className={thClass} onClick={() => handleSort('orderId')}>Order # <SortIcon col="orderId" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedRows.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-800">{row.component}</td>
                    <td className="px-4 py-3 text-gray-600">{row.parentItem}</td>
                    <td className="px-4 py-3 font-black text-gray-800">{row.qtyUsed}</td>
                    <td className="px-4 py-3 text-gray-600">{row.company}</td>
                    <td className="px-4 py-3 font-semibold text-indigo-600">#{row.orderId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden p-2 space-y-2">
            {sortedRows.map((row: any, i: number) => (
              <div key={i} className="rounded-lg border border-gray-200 p-2.5">
                <div className="font-black text-sm text-gray-800">{row.component}</div>
                <div className="text-xs text-gray-600 mt-0.5">Item: {row.parentItem} · Qty: {row.qtyUsed}</div>
                <div className="text-xs text-gray-500">Company: {row.company} · WO #{row.orderId}</div>
              </div>
            ))}
          </div>
          {sortedRows.length === 0 && <div className="py-12 text-center text-gray-400 italic text-sm">No component usage data for the selected range.</div>}
        </Card>
      )}

      {/* Item Usage table */}
      {reportType === 'item-usage' && (
        <Card className="p-0 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-black border-b">
                <tr>
                  <th className={thClass} onClick={() => handleSort('item')}>Item Name <SortIcon col="item" /></th>
                  <th className={thClass} onClick={() => handleSort('orders')}>Orders <SortIcon col="orders" /></th>
                  <th className={thClass} onClick={() => handleSort('totalQty')}>Total Qty <SortIcon col="totalQty" /></th>
                  <th className={thClass} onClick={() => handleSort('companyCount')}>Companies <SortIcon col="companyCount" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedRows.map((row: any) => (
                  <tr key={row.item} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 font-black text-gray-800">{row.item}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{row.orders}</td>
                    <td className="px-4 py-3 font-semibold text-indigo-700">{row.totalQty}</td>
                    <td className="px-4 py-3 text-gray-600">{row.companyCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedRows.length === 0 && <div className="py-12 text-center text-gray-400 italic text-sm">No item usage data for the selected range.</div>}
        </Card>
      )}

      {/* On-Time Delivery table */}
      {reportType === 'on-time' && (
        <Card className="p-0 overflow-hidden shadow-sm">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-black border-b">
                <tr>
                  <th className={thClass} onClick={() => handleSort('_date')}>Date <SortIcon col="_date" /></th>
                  <th className={thClass} onClick={() => handleSort('work_order_id')}>WO <SortIcon col="work_order_id" /></th>
                  <th className={thClass} onClick={() => handleSort('_customer')}>Company <SortIcon col="_customer" /></th>
                  <th className={thClass} onClick={() => handleSort('_item')}>Item <SortIcon col="_item" /></th>
                  <th className={thClass} onClick={() => handleSort('dispatch_qty')}>Qty <SortIcon col="dispatch_qty" /></th>
                  <th className={thClass} onClick={() => handleSort('invoice_no')}>Invoice <SortIcon col="invoice_no" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedRows.map((row: any) => (
                  <tr key={row.id} className="hover:bg-green-50/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{row.when ? new Date(row.when).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3 font-black text-indigo-600">#{row.work_order_id}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{row.order?.customer || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{row.order?.job_details || '-'}</td>
                    <td className="px-4 py-3 font-black text-green-700">{row.dispatch_qty}</td>
                    <td className="px-4 py-3 text-gray-600">{row.invoice_no || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden p-2 space-y-2">
            {sortedRows.map((row: any) => (
              <div key={row.id} className="rounded-lg border border-green-200 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-black text-indigo-700 text-sm">WO #{row.work_order_id}</div>
                  <div className="text-[11px] font-semibold text-green-700">Qty: {row.dispatch_qty} ✓</div>
                </div>
                <div className="text-xs text-gray-700 font-semibold mt-1">{row.order?.customer || '-'} • {row.order?.job_details || '-'}</div>
                <div className="text-[11px] text-gray-500 mt-1">Invoice: {row.invoice_no || '-'}</div>
              </div>
            ))}
          </div>
          {sortedRows.length === 0 && <div className="py-12 text-center text-gray-400 italic text-sm">No on-time deliveries for the selected range.</div>}
        </Card>
      )}

      {/* Delayed Delivery table */}
      {reportType === 'delayed' && (
        <Card className="p-0 overflow-hidden shadow-sm">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-black border-b">
                <tr>
                  <th className={thClass} onClick={() => handleSort('_date')}>Date <SortIcon col="_date" /></th>
                  <th className={thClass} onClick={() => handleSort('work_order_id')}>WO <SortIcon col="work_order_id" /></th>
                  <th className={thClass} onClick={() => handleSort('_customer')}>Company <SortIcon col="_customer" /></th>
                  <th className={thClass} onClick={() => handleSort('_item')}>Item <SortIcon col="_item" /></th>
                  <th className={thClass} onClick={() => handleSort('daysDelay')}>Days Late <SortIcon col="daysDelay" /></th>
                  <th className={thClass} onClick={() => handleSort('dispatch_qty')}>Qty <SortIcon col="dispatch_qty" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedRows.map((row: any) => (
                  <tr key={row.id} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{row.when ? new Date(row.when).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3 font-black text-indigo-600">#{row.work_order_id}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{row.order?.customer || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{row.order?.job_details || '-'}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-lg bg-red-100 text-red-700 font-black text-xs">{row.daysDelay}d</span></td>
                    <td className="px-4 py-3 font-black text-gray-800">{row.dispatch_qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden p-2 space-y-2">
            {sortedRows.map((row: any) => (
              <div key={row.id} className="rounded-lg border border-red-200 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-black text-indigo-700 text-sm">WO #{row.work_order_id}</div>
                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-black text-xs">{row.daysDelay}d late</span>
                </div>
                <div className="text-xs text-gray-700 font-semibold mt-1">{row.order?.customer || '-'} • {row.order?.job_details || '-'}</div>
                <div className="text-[11px] text-gray-500 mt-1">Qty: {row.dispatch_qty}</div>
              </div>
            ))}
          </div>
          {sortedRows.length === 0 && <div className="py-12 text-center text-gray-400 italic text-sm">No delayed deliveries for the selected range.</div>}
        </Card>
      )}

      {/* Department-Wise table */}
      {reportType === 'dept-wise' && (
        <Card className="p-0 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-black border-b">
                <tr>
                  <th className={thClass} onClick={() => handleSort('dept')}>Department <SortIcon col="dept" /></th>
                  <th className={thClass} onClick={() => handleSort('reports')}>Reports <SortIcon col="reports" /></th>
                  <th className={thClass} onClick={() => handleSort('shiftHrs')}>Shift Hrs <SortIcon col="shiftHrs" /></th>
                  <th className={thClass} onClick={() => handleSort('otHrs')}>OT Hrs <SortIcon col="otHrs" /></th>
                  <th className={thClass} onClick={() => handleSort('totalHrs')}>Total Hrs <SortIcon col="totalHrs" /></th>
                  <th className={thClass} onClick={() => handleSort('qtyProduced')}>Qty Produced <SortIcon col="qtyProduced" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedRows.map((row: any) => (
                  <tr key={row.dept} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 font-black text-gray-800">{row.dept}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{row.reports}</td>
                    <td className="px-4 py-3 text-gray-600">{row.shiftHrs}</td>
                    <td className="px-4 py-3 text-gray-600">{row.otHrs}</td>
                    <td className="px-4 py-3 font-semibold text-indigo-700">{row.totalHrs}</td>
                    <td className="px-4 py-3 font-black text-gray-800">{row.qtyProduced}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedRows.length === 0 && <div className="py-12 text-center text-gray-400 italic text-sm">No department-wise data for the selected range.</div>}
        </Card>
      )}

      {/* Company Performance table */}
      {reportType === 'company-performance' && (
        <Card className="p-0 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-black border-b">
                <tr>
                  <th className={thClass} onClick={() => handleSort('company')}>Company <SortIcon col="company" /></th>
                  <th className={thClass} onClick={() => handleSort('totalWOs')}>Total WOs <SortIcon col="totalWOs" /></th>
                  <th className={thClass} onClick={() => handleSort('totalQty')}>Total Qty <SortIcon col="totalQty" /></th>
                  <th className={thClass} onClick={() => handleSort('onTime')}>On-Time <SortIcon col="onTime" /></th>
                  <th className={thClass} onClick={() => handleSort('delayed')}>Delayed <SortIcon col="delayed" /></th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">On-Time %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedRows.map((row: any) => (
                  <tr key={row.company} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 font-black text-gray-800">{row.company}</td>
                    <td className="px-4 py-3 font-semibold text-gray-700">{row.totalWOs}</td>
                    <td className="px-4 py-3 font-semibold text-indigo-700">{row.totalQty}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">{row.onTime}</td>
                    <td className="px-4 py-3 font-semibold text-red-700">{row.delayed}</td>
                    <td className="px-4 py-3 font-black text-gray-800">
                      {row.totalWOs > 0 ? Math.round(row.onTime / row.totalWOs * 100) + '%' : '0%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedRows.length === 0 && <div className="py-12 text-center text-gray-400 italic text-sm">No company performance data for the selected range.</div>}
        </Card>
      )}
    </div>
  );
};

// --- Production Entry ---

const formatDateDMY = (dateStr: string) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y.slice(2)}`;
};

const parseDMY = (dmy: string) => {
  const parts = dmy.split('/');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  const fullY = y.length === 2 ? `20${y}` : y;
  return `${fullY}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

const ProductionReports: React.FC<{ onError: () => void }> = ({ onError }) => {
  const [mode, setMode] = useState<'list' | 'entry' | 'detail' | 'compare'>('list');
  const [reports, setReports] = useState<ProductionReport[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ProductionReport | null>(null);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [expandedOtherReports, setExpandedOtherReports] = useState<Set<number>>(new Set());

  // Entry form state
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedDept, setSelectedDept] = useState('');
  const [shiftWorkers, setShiftWorkers] = useState(0);
  const [shiftHours, setShiftHours] = useState(8);
  const [otWorkers, setOtWorkers] = useState(0);
  const [otHours, setOtHours] = useState(2);
  const [entryItems, setEntryItems] = useState<{ itemId: number; qty: number }[]>([{ itemId: 0, qty: 0 }]);
  const [itemSearchText, setItemSearchText] = useState<string[]>(['']);
  const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);
  const [metricResults, setMetricResults] = useState<MetricResult[]>([]);
  const [otherWork, setOtherWork] = useState('');

  const totalShiftHours = shiftWorkers * shiftHours;
  const totalOtHours = otWorkers * otHours;
  const grandTotalHours = totalShiftHours + totalOtHours;

  // When in a non-list sub-mode, push history entry so browser back returns to list
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (mode !== 'list' && prevModeRef.current === 'list') {
      window.history.pushState(null, '');
    }
    prevModeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (mode === 'list') return;
    const onPop = () => { setMode('list'); setSelectedReport(null); setCompareIds([]); setExpandedOtherReports(new Set()); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [mode]);

  const dept = departments.find(d => d.name === selectedDept);

  useEffect(() => {
    const deptMetricTypes = new Set((dept?.metrics || []).map(m => m.type));
    const validItems = entryItems.filter(e => e.itemId > 0 && e.qty > 0);
    if (!selectedDept || validItems.length === 0) {
      setMetricResults([]);
      return;
    }
    const combined = new Map<string, MetricResult>();
    for (const e of validItems) {
      const item = items.find(i => i.id === e.itemId);
      if (!item?.metric_requirements) continue;
      for (const req of item.metric_requirements) {
        if (!deptMetricTypes.has(req.metric)) continue;
        const key = `${req.metric}\t${req.unit}`;
        const existing = combined.get(key);
        if (existing) {
          existing.totalQty += req.qtyPerUnit * e.qty;
        } else {
          combined.set(key, {
            metric: req.metric,
            unit: req.unit,
            qtyPerUnit: req.qtyPerUnit,
            totalQty: req.qtyPerUnit * e.qty,
          });
        }
      }
    }
    setMetricResults(Array.from(combined.values()));
  }, [entryItems, selectedDept, items, dept]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data: r } = await supabase.from('production_reports').select('*').order('id', { ascending: false } as any);
      if (r) setReports(r as ProductionReport[]);
    } catch { onError(); }
    setLoading(false);
  }, [onError]);

  const fetchRefs = useCallback(async () => {
    const [dRes, iRes] = await Promise.all([
      supabase.from('departments').select('*').order('name'),
      supabase.from('items').select('*').order('name'),
    ]);
    if (dRes.data) setDepartments(dRes.data as Department[]);
    if (iRes.data) setItems(iRes.data as Item[]);
  }, []);

  useEffect(() => { fetchReports(); fetchRefs(); }, []);

  const handleSave = async () => {
    const validItems = entryItems.filter(e => e.itemId > 0 && e.qty > 0);
    if (!selectedDept || validItems.length === 0) {
      alert('Please select a department and at least one item with qty > 0');
      return;
    }
    const itemIds = validItems.map(e => e.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      alert('An item cannot be added twice in the same report.');
      return;
    }
    if (!editingId) {
      const { data: existing } = await supabase
        .from('production_reports')
        .select('id')
        .eq('date', reportDate)
        .eq('department', selectedDept);
      if (existing && existing.length > 0) {
        alert(`A report for ${selectedDept} on ${formatDateDMY(reportDate)} already exists. Only one report per department per date is allowed.`);
        setSaving(false);
        return;
      }
    }
    setSaving(true);
    const itemsPayload = validItems.map(e => {
      const item = items.find(i => i.id === e.itemId);
      const itemDeptMetricTypes = new Set((departments.find(d => d.name === selectedDept)?.metrics || []).map(m => m.type));
      const itemResults = (item?.metric_requirements || [])
        .filter(req => itemDeptMetricTypes.has(req.metric))
        .map(req => ({
          metric: req.metric,
          unit: req.unit,
          qtyPerUnit: req.qtyPerUnit,
          totalQty: req.qtyPerUnit * e.qty,
        }));
      return {
        item_id: e.itemId,
        item_name: item?.name || '',
        qty_produced: e.qty,
        results: itemResults,
      };
    });
    const payload = {
      department: selectedDept,
      item_id: itemsPayload[0].item_id,
      item_name: itemsPayload[0].item_name,
      shift_workers: shiftWorkers,
      shift_hours: shiftHours,
      ot_workers: otWorkers,
      ot_hours: otHours,
      qty_produced: validItems.reduce((s, e) => s + e.qty, 0),
      total_shift_hours: totalShiftHours,
      total_ot_hours: totalOtHours,
      grand_total_hours: grandTotalHours,
      date: reportDate,
      results: metricResults,
      created_by: getStoredLoggedInUser() || '',
      other_work: otherWork || null,
      items: itemsPayload,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from('production_reports').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('production_reports').insert([payload]));
    }
    if (error) alert(error.message);
    else {
      void logActivity({
        eventType: 'production_report',
        action: editingId ? 'updated' : 'created',
        title: editingId ? 'Production Report Updated' : 'Production Report Created',
        body: `Department: ${selectedDept}, Date: ${reportDate}`,
        actor: getStoredLoggedInUser(),
        targetCollection: 'production_reports',
        severity: 'success',
      });
      setMode('list');
      resetForm();
      fetchReports();
    }
    setSaving(false);
  };

  const populateForm = (r: ProductionReport) => {
    setEditingId(r.id);
    setReportDate(r.date);
    setSelectedDept(r.department);
    setShiftWorkers(r.shift_workers);
    setShiftHours(r.shift_hours);
    setOtWorkers(r.ot_workers);
    setOtHours(r.ot_hours);
    setOtherWork(r.other_work || '');
    if (r.items && r.items.length > 0) {
      setEntryItems(r.items.map(it => ({ itemId: it.item_id, qty: it.qty_produced })));
      setItemSearchText(r.items.map(it => it.item_name));
    } else {
      setEntryItems([{ itemId: r.item_id, qty: r.qty_produced }]);
      setItemSearchText([r.item_name]);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setReportDate(new Date().toISOString().slice(0, 10));
    setSelectedDept('');
    setShiftWorkers(0);
    setShiftHours(8);
    setOtWorkers(0);
    setOtHours(2);
    setEntryItems([{ itemId: 0, qty: 0 }]);
    setItemSearchText(['']);
    setMetricResults([]);
    setOtherWork('');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this report?')) return;
    const { error } = await supabase.from('production_reports').delete().eq('id', id);
    if (error) alert(error.message);
    else {
      void logActivity({
        eventType: 'production_report',
        action: 'deleted',
        title: 'Production Report Deleted',
        body: `Report ID: ${id}`,
        actor: getStoredLoggedInUser(),
        targetCollection: 'production_reports',
        targetId: id,
        severity: 'warning',
      });
      fetchReports();
    }
  };

  const exportProductionPdf = (r: ProductionReport) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const ml = 18;
    const cw = pw - ml * 2;
    const slate = [30, 41, 59] as [number, number, number];
    const muted = [100, 100, 100] as [number, number, number];
    const lightBg = [248, 250, 252] as [number, number, number];
    const border = [226, 232, 240] as [number, number, number];

    let y = 24;

    const sectionTitle = (title: string) => {
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(slate[0], slate[1], slate[2]);
      doc.text(title, ml, y);
      doc.setDrawColor(border[0], border[1], border[2]);
      doc.setLineWidth(0.3);
      doc.line(ml, y + 1.5, pw - ml, y + 1.5);
      y += 6;
    };

    // ── Header ──────────────────────────────────────
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.text('Excell Packaging', pw / 2, y, { align: 'center' });
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.setLineWidth(0.5);
    doc.line(ml, y + 4, pw - ml, y + 4);
    y += 12;

    // ── Section 1: Production Report ────────────────
    sectionTitle('Production Report');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(muted[0], muted[1], muted[2]);
    const col1 = ml, col2 = ml + 70;
    doc.text('Date:', col1, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.text(formatDateDMY(r.date), col1 + 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text('Department:', col2, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.text(r.department, col2 + 24, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text('Report #:', col1, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.text(String(r.id), col1 + 20, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text('Created by:', col2, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.text(r.created_by || '-', col2 + 24, y + 6);
    y += 14;

    // ── Section 2: Work Breakdown ───────────────────
    sectionTitle('Work Breakdown');
    const sw = Number(r.shift_workers) || 0;
    const sh = Number(r.shift_hours) || 0;
    const ow = Number(r.ot_workers) || 0;
    const oh = Number(r.ot_hours) || 0;
    const tsh = sw * sh;
    const toh = ow * oh;
    const gth = tsh + toh;
    autoTable(doc, {
      startY: y,
      tableWidth: cw,
      margin: { left: ml },
      head: [['', 'Workers', 'Hrs/Each', 'Total']],
      body: [
        ['Shift', String(sw), `${sh}h`, `${tsh}h`],
        ['Overtime', String(ow), `${oh}h`, `${toh}h`],
      ],
      foot: [['GRAND TOTAL', '', '', `${gth}h`]],
      styles: { fontSize: 7.5, cellPadding: { top: 1.5, right: 3, bottom: 1.5, left: 3 }, lineColor: border, lineWidth: 0.2 },
      headStyles: { fillColor: slate, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { textColor: [50, 50, 50] },
      footStyles: { fillColor: lightBg, textColor: slate, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: lightBg },
      columnStyles: { 0: { cellWidth: 32, fontStyle: 'bold' }, 1: { cellWidth: 24, halign: 'center' }, 2: { cellWidth: 24, halign: 'center' }, 3: { cellWidth: 24, halign: 'center', fontStyle: 'bold' } },
      tableLineColor: border,
      tableLineWidth: 0.2,
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Section 3: Items ───────────────────────────
    sectionTitle('Items');
    const itemsArr = (r.items?.length ? r.items : [{ item_name: r.item_name, qty_produced: r.qty_produced, results: r.results || [] }]) as any[];
    autoTable(doc, {
      startY: y,
      tableWidth: cw,
      margin: { left: ml },
      head: [['Item', 'Qty', 'Metrics']],
      body: itemsArr.map((it: any) => {
        const mets = (it.results || []) as MetricResult[];
        const metricsText = mets.length ? mets.map(m => `${m.metric}: ${m.totalQty} ${m.unit}`).join(', ') : '-';
        return [it.item_name, String(it.qty_produced ?? 0), metricsText];
      }),
      styles: { fontSize: 7.5, cellPadding: { top: 1.5, right: 3, bottom: 1.5, left: 3 }, lineColor: border, lineWidth: 0.2 },
      headStyles: { fillColor: slate, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: lightBg },
      columnStyles: { 0: { cellWidth: 56 }, 1: { cellWidth: 16, halign: 'center' } },
      tableLineColor: border,
      tableLineWidth: 0.2,
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Section 4: Metrics Total ────────────────────
    if (r.results?.length) {
      sectionTitle('Metrics Total');
      autoTable(doc, {
        startY: y,
        tableWidth: cw,
        margin: { left: ml },
        head: [['Metric', 'Req / Unit', 'Total Qty', 'Unit']],
        body: r.results.map(res => [res.metric, res.qtyPerUnit ? String(res.qtyPerUnit) : '-', String(res.totalQty), res.unit]),
        styles: { fontSize: 7.5, cellPadding: { top: 1.5, right: 3, bottom: 1.5, left: 3 }, lineColor: border, lineWidth: 0.2, textColor: [50, 50, 50] },
        headStyles: { fillColor: slate, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
        alternateRowStyles: { fillColor: lightBg },
        columnStyles: { 2: { halign: 'right', fontStyle: 'bold', textColor: slate } },
        tableLineColor: border,
        tableLineWidth: 0.2,
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── Section 5: Other Work ───────────────────────
    if (r.other_work) {
      sectionTitle('Other Work');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80);
      const lines = doc.splitTextToSize(r.other_work || '', cw);
      doc.text(lines, ml, y);
    }

    // ── Footer ──────────────────────────────────────
    const fy = ph - 14;
    doc.setDrawColor(border[0], border[1], border[2]);
    doc.setLineWidth(0.3);
    doc.line(ml, fy, pw - ml, fy);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160);
    doc.text('Excell Packaging', ml, fy + 5);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pw - ml, fy + 5, { align: 'right' });

    doc.save(`production-report-${r.id}.pdf`);
  };

  if (mode === 'detail' && selectedReport) {
    const r = selectedReport;
    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-gray-800">Production Report</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => exportProductionPdf(r)} className="text-sm font-bold text-green-600 hover:text-green-800 flex items-center gap-1"><FileText size={13} /> PDF</button>
            <button onClick={() => { populateForm(r); setMode('entry'); }} className="text-sm font-bold text-indigo-600 hover:text-indigo-800">Edit</button>
            <button onClick={() => setMode('list')} className="text-sm font-bold text-gray-500 hover:text-gray-700">← Back to List</button>
          </div>
        </div>

        {r.results && r.results.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-6 py-4 text-center">
            <span className="text-lg font-black text-indigo-800">
              In {r.grand_total_hours} Hrs Total {r.results.map((res, i) => (
                <span key={i}>
                  {i > 0 && (i === r.results.length - 1 ? <span> and </span> : <span>, </span>)}
                  {res.totalQty} {res.unit}
                </span>
              ))} Work was done
            </span>
          </div>
        )}

        {/* ── Production Report Info ── */}
        <Card>
          <h3 className="font-black text-gray-700 mb-4 text-sm uppercase tracking-wider">Production Report</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-2 text-sm">
            <div><span className="text-gray-400 font-semibold">Date:</span> <span className="font-bold text-gray-800 ml-1">{formatDateDMY(r.date)}</span></div>
            <div><span className="text-gray-400 font-semibold">Department:</span> <span className="font-bold text-gray-800 ml-1">{r.department}</span></div>
            <div><span className="text-gray-400 font-semibold">Report #:</span> <span className="font-bold text-gray-800 ml-1">{r.id}</span></div>
            <div><span className="text-gray-400 font-semibold">Created by:</span> <span className="font-bold text-gray-800 ml-1">{r.created_by || '-'}</span></div>
          </div>
        </Card>

        {/* ── Work Breakdown ── */}
        <Card>
          <h3 className="font-black text-gray-700 mb-4 text-sm uppercase tracking-wider">Work Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-black uppercase text-gray-400 border-b">
                  <th className="text-left py-2"></th>
                  <th className="text-center py-2">Workers</th>
                  <th className="text-center py-2">Hrs/Each</th>
                  <th className="text-center py-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-2.5 font-bold text-gray-800">Shift</td>
                  <td className="py-2.5 text-center font-semibold text-gray-700">{r.shift_workers}</td>
                  <td className="py-2.5 text-center font-semibold text-gray-700">{r.shift_hours}h</td>
                  <td className="py-2.5 text-center font-bold text-blue-700">{r.total_shift_hours}h</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-bold text-gray-800">Overtime</td>
                  <td className="py-2.5 text-center font-semibold text-gray-700">{r.ot_workers}</td>
                  <td className="py-2.5 text-center font-semibold text-gray-700">{r.ot_hours}h</td>
                  <td className="py-2.5 text-center font-bold text-orange-700">{r.total_ot_hours}h</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="py-3 font-black text-gray-800"></td>
                  <td className="py-3 text-center" colSpan={2}><span className="font-black text-gray-800">GRAND TOTAL</span></td>
                  <td className="py-3 text-center font-black text-green-700 text-base">{r.grand_total_hours}h</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* ── Items ── */}
        <Card>
          <h3 className="font-black text-gray-700 mb-4 text-sm uppercase tracking-wider">Items</h3>
          {(() => {
            const itemsArr = (r.items?.length ? r.items : [{ item_name: r.item_name, qty_produced: r.qty_produced, results: r.results || [] }]) as any[];
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-black uppercase text-gray-400 border-b">
                      <th className="text-left py-2">Item</th>
                      <th className="text-center py-2 w-16">Qty</th>
                      <th className="text-left py-2">Metrics</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {itemsArr.map((it: any, idx: number) => {
                      const mets = (it.results || []) as MetricResult[];
                      const metricsText = mets.length ? mets.map(m => `${m.metric}: ${m.totalQty} ${m.unit}`).join(', ') : '-';
                      return (
                        <tr key={idx}>
                          <td className="py-2.5 font-semibold text-gray-800">{it.item_name}</td>
                          <td className="py-2.5 text-center font-bold text-indigo-700">{it.qty_produced}</td>
                          <td className="py-2.5 text-gray-600">{metricsText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </Card>

        {/* ── Metrics Total ── */}
        <Card>
          <h3 className="font-black text-gray-700 mb-4 text-sm uppercase tracking-wider">Metrics Total</h3>
          {r.results && r.results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-black uppercase text-gray-400 border-b">
                    <th className="text-left py-2">Metric</th>
                    <th className="text-right py-2">Req / Unit</th>
                    <th className="text-right py-2">Total Qty</th>
                    <th className="text-right py-2">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {r.results.map((res, i) => (
                    <tr key={i}>
                      <td className="py-2.5 font-semibold text-gray-800">{res.metric}</td>
                      <td className="py-2.5 text-right text-gray-500">{res.qtyPerUnit ?? '-'}</td>
                      <td className="py-2.5 text-right font-bold text-indigo-700">{res.totalQty}</td>
                      <td className="py-2.5 text-right font-semibold text-gray-500">{res.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 italic text-sm">No metric data for this report.</div>
          )}
        </Card>

        {/* ── Other Work ── */}
        {r.other_work && (
          <Card>
            <h3 className="font-black text-gray-700 mb-4 text-sm uppercase tracking-wider">Other Work</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.other_work}</p>
          </Card>
        )}
      </div>
    );
  }

  if (mode === 'compare' && compareIds.length >= 2) {
    const compareList = reports.filter(r => compareIds.includes(r.id));
    const allMetrics = [...new Set(compareList.flatMap(r => r.results?.map(res => res.metric) || []))];

    const vals = (fn: (r: ProductionReport) => string) => compareList.map(fn);
    const isDiff = (a: string[]) => new Set(a).size > 1;

    const SectionRow: React.FC<{ label: string; bg?: string; textColor?: string }> = ({ label, bg = 'bg-gray-100', textColor = 'text-gray-500' }) => (
      <tr className={bg}>
        <td className={`px-4 py-2 text-[10px] font-black uppercase tracking-wider ${textColor}`} colSpan={compareList.length + 1}>{label}</td>
      </tr>
    );

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-gray-800">Compare Reports</h2>
          <button onClick={() => { setMode('list'); setCompareIds([]); setExpandedOtherReports(new Set()); }} className="text-sm font-bold text-gray-500 hover:text-gray-700">← Back to List</button>
        </div>
        <div className="overflow-x-auto rounded-2xl border shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-black border-b">
              <tr>
                <th className="px-4 py-3 text-left w-44">Field</th>
                {compareList.map(r => <th key={r.id} className="px-4 py-3 text-center min-w-[160px]">{formatDateDMY(r.date)}<br /><span className="text-gray-500 font-bold">{r.department}</span></th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <SectionRow label="📋 Report Info" bg="bg-sky-50" textColor="text-sky-700" />
              {[
                { key: 'department', label: 'Department', render: (r: ProductionReport) => r.department },
                { key: 'item_name', label: 'Item', render: (r: ProductionReport) => r.items && r.items.length > 1 ? `${r.items[0].item_name} (+${r.items.length - 1})` : r.item_name },

              ].map(({ key, label, render }) => {
                const rowVals = vals(render);
                const diff = isDiff(rowVals);
                return (
                  <tr key={key} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-700">{label}</td>
                    {compareList.map(r => (
                      <td key={r.id} className={`px-4 py-3 text-center font-semibold ${diff ? 'text-indigo-700 bg-indigo-50/50' : 'text-gray-800'}`}>{render(r)}</td>
                    ))}
                  </tr>
                );
              })}

              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 font-bold text-gray-700">Other Work</td>
                {compareList.map(r => (
                  <td key={r.id} className={`px-4 py-3 text-center ${expandedOtherReports.has(r.id) ? '' : 'max-w-[200px]'} ${r.other_work ? 'cursor-pointer' : ''}`} onClick={() => { if (r.other_work) { setExpandedOtherReports(prev => { const n = new Set(prev); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; }); } }}>
                    <span className={`font-semibold text-gray-800 ${expandedOtherReports.has(r.id) ? 'whitespace-pre-wrap' : 'line-clamp-1'}`}>{r.other_work || '—'}</span>
                  </td>
                ))}
              </tr>

              <SectionRow label="👷 Labor Breakdown" bg="bg-amber-50" textColor="text-amber-700" />
              {[
                { key: 'shift_workers', label: 'Shift Workers', render: (r: ProductionReport) => String(r.shift_workers) },
                { key: 'total_shift_hours', label: 'Shift Hrs', render: (r: ProductionReport) => `${r.total_shift_hours}h` },
                { key: 'ot_workers', label: 'OT Workers', render: (r: ProductionReport) => String(r.ot_workers) },
                { key: 'total_ot_hours', label: 'OT Hrs', render: (r: ProductionReport) => `${r.total_ot_hours}h` },
              ].map(({ key, label, render }) => {
                const rowVals = vals(render);
                const diff = isDiff(rowVals);
                return (
                  <tr key={key} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-700">{label}</td>
                    {compareList.map(r => (
                      <td key={r.id} className={`px-4 py-3 text-center font-semibold ${diff ? 'text-indigo-700 bg-indigo-50/50' : 'text-gray-800'}`}>{render(r)}</td>
                    ))}
                  </tr>
                );
              })}
              <tr className="bg-green-50 hover:bg-green-100/50">
                <td className="px-4 py-3 font-black text-green-800">Total Man Hour</td>
                {compareList.map(r => (
                  <td key={r.id} className="px-4 py-3 text-center font-black text-green-700 text-base">{r.grand_total_hours}h</td>
                ))}
              </tr>

              <SectionRow label="📦 Production" bg="bg-purple-50" textColor="text-purple-700" />
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 font-bold text-gray-700">Qty Produced</td>
                {compareList.map(r => <td key={r.id} className="px-4 py-3 text-center font-semibold text-gray-800">{r.qty_produced.toLocaleString()}</td>)}
              </tr>

              {allMetrics.length > 0 && (
                <>
                  <SectionRow label="📊 Metrics" bg="bg-indigo-50" textColor="text-indigo-700" />
                  {allMetrics.map(metric => (
                    <tr key={metric} className="hover:bg-indigo-50/30">
                      <td className="px-4 py-3 font-bold text-gray-700">{metric}</td>
                      {compareList.map(r => {
                        const found = r.results?.find(res => res.metric === metric);
                        return (
                          <td key={r.id} className="px-4 py-3 text-center font-semibold text-gray-800">
                            {found ? `${found.totalQty.toLocaleString()} ${found.unit}` : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (mode === 'entry') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-gray-800">{editingId ? 'Edit Production Report' : 'New Production Report'}</h2>
          <button onClick={() => { setMode('list'); resetForm(); }} className="text-sm font-bold text-gray-500 hover:text-gray-700">← Back</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-black text-gray-700 mb-4 text-sm">Department & Labor</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Date</label>
                <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border rounded-xl mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Department</label>
                <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border rounded-xl mt-1">
                  <option value="">Select Department</option>
                  {departments.filter(d => !['Office', 'Quality Control', 'Dispatch', 'QC', 'QC Control', 'Quality_Control'].includes(d.name)).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-blue-50/50 p-4 border border-blue-100">
                  <div className="text-[10px] font-black uppercase text-blue-500 mb-2">Shift</div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500">Workers</label>
                      <input type="number" min="0" value={shiftWorkers} onChange={e => setShiftWorkers(Number(e.target.value))} className="w-full px-3 py-2 bg-white border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500">Hours</label>
                      <input type="number" min="0" step="0.5" value={shiftHours} onChange={e => setShiftHours(Number(e.target.value))} className="w-full px-3 py-2 bg-white border rounded-lg text-sm" />
                    </div>
                    <div className="text-sm font-bold text-blue-700 pt-1">Total: {totalShiftHours} hrs</div>
                  </div>
                </div>
                <div className="rounded-xl bg-orange-50/50 p-4 border border-orange-100">
                  <div className="text-[10px] font-black uppercase text-orange-500 mb-2">Overtime</div>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500">Workers</label>
                      <input type="number" min="0" value={otWorkers} onChange={e => setOtWorkers(Number(e.target.value))} className="w-full px-3 py-2 bg-white border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500">Hours</label>
                      <input type="number" min="0" step="0.5" value={otHours} onChange={e => setOtHours(Number(e.target.value))} className="w-full px-3 py-2 bg-white border rounded-lg text-sm" />
                    </div>
                    <div className="text-sm font-bold text-orange-700 pt-1">Total: {totalOtHours} hrs</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-green-50 p-4 border border-green-200 text-center">
                <span className="text-xs font-black uppercase text-green-600">Total Man Hour</span>
                <div className="text-2xl font-black text-green-700">{grandTotalHours} hrs</div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-black text-gray-700 mb-4 text-sm">Item & Production</h3>
             <div className="space-y-4">
               <div className="text-xs font-bold text-gray-500 mb-1">Items ({entryItems.length})</div>
               <div className="max-h-[260px] overflow-y-auto space-y-3">
                   <div className="flex items-end gap-2 mb-1">
                    <div className="flex-1">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Item</label>
                    </div>
                    <div className="w-24">
                      <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Qty</label>
                    </div>
                    <div className="w-10" />
                  </div>
                  {entryItems.map((item, idx) => (
                    <div key={idx} className="flex items-end gap-2">
                      <div className="flex-1 relative">
                        {!selectedDept ? (
                          <div className="w-full px-3 py-2.5 bg-gray-100 border rounded-xl mt-1 text-sm text-gray-400">Select a department first</div>
                        ) : (
                          <>
                            <input
                              placeholder="Search items..."
                              value={itemSearchText[idx] ?? ''}
                              onChange={e => {
                                const val = e.target.value;
                                setItemSearchText(prev => { const next = [...prev]; next[idx] = val; return next; });
                                if (item.itemId > 0) {
                                  setEntryItems(prev => { const next = [...prev]; next[idx] = { ...next[idx], itemId: 0 }; return next; });
                                }
                                setOpenDropdownIdx(idx);
                              }}
                              onFocus={() => setOpenDropdownIdx(idx)}
                              onBlur={() => setTimeout(() => setOpenDropdownIdx(null), 200)}
                              className="w-full px-3 py-2.5 bg-gray-50 border rounded-xl mt-1 text-sm outline-none focus:border-orange-400 transition-colors"
                            />
                            {openDropdownIdx === idx && (
                              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                {items.filter(i => (i.departments || []).includes(selectedDept!))
                                  .filter(i => !itemSearchText[idx] || i.name.toLowerCase().includes(itemSearchText[idx].toLowerCase()))
                                  .filter(i => !entryItems.some((e, ei) => ei !== idx && e.itemId === i.id))
                                  .slice(0, 50)
                                  .map(i => (
                                    <button
                                      type="button"
                                      key={i.id}
                                      onMouseDown={() => {
                                        setEntryItems(prev => { const next = [...prev]; next[idx] = { ...next[idx], itemId: i.id }; return next; });
                                        setItemSearchText(prev => { const next = [...prev]; next[idx] = i.name; return next; });
                                        setOpenDropdownIdx(null);
                                      }}
                                      className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 transition-colors ${item.itemId === i.id ? 'bg-orange-100 font-bold' : ''}`}
                                    >{i.name}</button>
                                  ))}
                                {items.filter(i => (i.departments || []).includes(selectedDept!)).filter(i => !itemSearchText[idx] || i.name.toLowerCase().includes(itemSearchText[idx].toLowerCase())).filter(i => !entryItems.some((e, ei) => ei !== idx && e.itemId === i.id)).length === 0 && (
                                  <div className="px-3 py-2 text-sm text-gray-400 italic">No items match</div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                    </div>
                    <div className="w-24">
                      <input type="number" min="0" value={item.qty} onChange={e => { const val = Number(e.target.value); setEntryItems(prev => { const next = [...prev]; next[idx] = { ...next[idx], qty: val }; return next; }); }} className="w-full px-3 py-2.5 bg-gray-50 border rounded-xl mt-1 text-sm" />
                    </div>
                    {entryItems.length > 1 && (
                      <button onClick={() => { setEntryItems(prev => prev.filter((_, i) => i !== idx)); setItemSearchText(prev => prev.filter((_, i) => i !== idx)); }} className="pb-1 text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
                    )}
                  </div>
                ))}
              </div>
                <button onClick={() => { setEntryItems(prev => [...prev, { itemId: 0, qty: 0 }]); setItemSearchText(prev => [...prev, '']); }} className="text-indigo-600 text-sm font-bold hover:text-indigo-800 flex items-center gap-1">
                  <Plus size={16} /> Add Item
                </button>

              {metricResults.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-bold text-sm text-gray-500 mb-3">📊 Metric Calculation</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] font-black uppercase text-gray-400 border-b">
                          <th className="text-left py-2">Metric</th>
                          <th className="text-right py-2">Req/Unit</th>
                          <th className="text-right py-2">Total</th>
                          <th className="text-right py-2">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {metricResults.map((r, i) => (
                          <tr key={i} className="text-sm">
                            <td className="py-2 font-bold text-gray-700">{r.metric}</td>
                            <td className="py-2 text-right text-gray-500">{r.qtyPerUnit ?? '-'}</td>
                            <td className="py-2 text-right font-black text-indigo-700">{r.totalQty}</td>
                            <td className="py-2 text-right font-bold text-gray-500">{r.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-center">
                    <span className="text-sm font-black text-indigo-800">
                      In {grandTotalHours} Hrs Total {metricResults.map((res, i) => (
                        <span key={i}>
                          {i > 0 && (i === metricResults.length - 1 ? <span> and </span> : <span>, </span>)}
                          {res.totalQty} {res.unit}
                        </span>
                      ))} Work was done
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-1.5 block">Other Work</label>
                <textarea placeholder="Describe any other work done..." value={otherWork} onChange={e => setOtherWork(e.target.value)} rows={3} className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm resize-none" />
              </div>

              <div className="sticky bottom-0 bg-white pb-2 pt-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <h2 className="text-xl font-black text-gray-800">Production Entry</h2>
        <div className="flex items-center gap-2">
          {compareIds.length >= 2 && (
            <button onClick={() => setMode('compare')} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:bg-emerald-700 transition-colors text-sm flex items-center gap-1">
              Compare ({compareIds.length})
            </button>
          )}
          <button onClick={() => setMode('entry')} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
            <Plus size={18} /> New Entry
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by item name..." value={searchText} onChange={e => setSearchText(e.target.value)} className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm bg-white" />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="px-4 py-2.5 border rounded-xl text-sm bg-white">
          <option value="">All Departments</option>
          {departments.filter(d => !['Office', 'Quality Control', 'Dispatch', 'QC', 'QC Control', 'Quality_Control'].includes(d.name)).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
      </div>

      {loading ? (
        <LoadingState />
      ) : reports.length === 0 ? (
        <div className="text-center py-20 text-gray-400 italic">No production reports yet.</div>
      ) : (
        <>
        {(() => {
          const filtered = reports.filter(r => {
            if (filterDept && r.department !== filterDept) return false;
            if (searchText) {
              const q = searchText.toLowerCase();
              const itemMatch = r.items ? r.items.some(it => it.item_name.toLowerCase().includes(q)) : r.item_name.toLowerCase().includes(q);
              if (!itemMatch) return false;
            }
            return true;
          });
          return filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400 italic">No reports match your search.</div>
          ) : (
        <div className="overflow-x-auto rounded-2xl border shadow-sm bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-black border-b">
              <tr>
                <th className="px-2 py-3 text-center w-8">
                  <input type="checkbox" checked={compareIds.length === reports.length} onChange={e => setCompareIds(e.target.checked ? reports.map(r => r.id) : [])} className="cursor-pointer" />
                </th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-right">Shift</th>
                <th className="px-4 py-3 text-right">OT</th>
                <th className="px-4 py-3 text-right">Total Hrs</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-indigo-50/30 transition-colors cursor-pointer">
                    <td className="px-2 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={compareIds.includes(r.id)} onChange={e => setCompareIds(prev => e.target.checked ? [...prev, r.id] : prev.filter(id => id !== r.id))} className="cursor-pointer" />
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-700" onClick={() => { setSelectedReport(r); setMode('detail'); }}>{formatDateDMY(r.date)}</td>
                    <td className="px-4 py-3 font-bold text-gray-800" onClick={() => { setSelectedReport(r); setMode('detail'); }}>{r.department}</td>
                    <td className="px-4 py-3 text-gray-700" onClick={() => { setSelectedReport(r); setMode('detail'); }}>
                      {r.items && r.items.length > 1
                        ? `${r.items[0].item_name} (+${r.items.length - 1} more)`
                        : r.item_name}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600" onClick={() => { setSelectedReport(r); setMode('detail'); }}>{r.total_shift_hours}h</td>
                    <td className="px-4 py-3 text-right text-gray-600" onClick={() => { setSelectedReport(r); setMode('detail'); }}>{r.total_ot_hours}h</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-700" onClick={() => { setSelectedReport(r); setMode('detail'); }}>{r.grand_total_hours}h</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700" onClick={() => { setSelectedReport(r); setMode('detail'); }}>{r.qty_produced}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={e => { e.stopPropagation(); populateForm(r); setMode('entry'); }} className="p-1 text-indigo-300 hover:text-indigo-500 mr-1"><Pencil size={14} /></button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(r.id); }} className="p-1 text-red-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
          </table>
        </div>
          );
        })()}
        {compareIds.length > 0 && (
          <div className="text-xs text-gray-400 text-right">Compare ({compareIds.length} selected) <button onClick={() => setCompareIds([])} className="text-red-400 hover:text-red-600 ml-2">Clear</button></div>
        )}
        </>
      )}

    </div>
  );
};

// --- App Root ---
export default function App() {
  const [view, setView] = useState<AppView>('dashboard');
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [clientUser, setClientUser] = useState<any>(null);
  const [liveScreenUser, setLiveScreenUser] = useState<any>(null);
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
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [toasts, setToasts] = useState<Array<{ id: number; title: string; body: string }>>([]);
  const knownEventIdsRef = useRef<Set<number>>(new Set());

  // Load read notification IDs from localStorage when user changes
  useEffect(() => {
    if (!loggedInUser) return;
    try {
      const stored = localStorage.getItem('excell_read_notifications_' + loggedInUser.id);
      setReadIds(new Set<number>(stored ? JSON.parse(stored) : []));
    } catch { setReadIds(new Set()); }
  }, [loggedInUser]);

  // Save read IDs to localStorage
  useEffect(() => {
    if (!loggedInUser) return;
    localStorage.setItem('excell_read_notifications_' + loggedInUser.id, JSON.stringify([...readIds]));
  }, [readIds, loggedInUser]);
  const [showExitHint, setShowExitHint] = useState(false);
  const [notificationHealth, setNotificationHealth] = useState({
    permission: typeof Notification !== 'undefined' ? Notification.permission : ('unsupported' as NotificationPermission | 'unsupported'),
    hasSubscription: false,
    pushSupported: false,
    swReady: false,
    lastError: '',
  });
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const currentVersionRef = useRef<string>('');

  useEffect(() => {
    const POLL_INTERVAL = 300_000;

    const check = async () => {
      try {
        const res = await fetch('/version.json?_=' + Date.now());
        const data = await res.json();
        if (!currentVersionRef.current) {
          currentVersionRef.current = data.version;
        } else if (data.version !== currentVersionRef.current) {
          setUpdateAvailable(true);
        }
      } catch {}
    };

    check();
    const id = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

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
    const authUser = getCurrentAuthUser();
    if (authUser) {
      setLoggedInUser(authUser);
      localStorage.setItem('excell_erp_user', JSON.stringify(authUser));
      return;
    }

    localStorage.removeItem('excell_erp_user');
  }, []);

  const applyNavigationPayload = useCallback((payload?: AppHistoryState['payload']) => {
    if (!payload) return;
    if (payload.id !== undefined) (window as any)._id = payload.id;
    if (payload.ids !== undefined) (window as any)._ids = payload.ids;
    if (payload.customPlan !== undefined) (window as any)._customPlan = payload.customPlan;
    if (payload.backView !== undefined) (window as any)._planBackView = payload.backView;
  }, []);

  const buildHistoryState = useCallback((nextView: AppView, payload?: AppHistoryState['payload']): AppHistoryState => {
    const resolvedPayload: AppHistoryState['payload'] = {
      id: payload?.id ?? (window as any)._id,
      ids: payload?.ids ?? (window as any)._ids,
      customPlan: payload?.customPlan ?? (window as any)._customPlan,
      backView: payload?.backView ?? (window as any)._planBackView,
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
    const safeUser = { ...u, passkey: undefined };
    setLoggedInUser(safeUser); 
    localStorage.setItem('excell_erp_user', JSON.stringify(safeUser)); 
    
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
  const handleLogout = () => { logoutAuth(); setLoggedInUser(null); localStorage.removeItem('excell_erp_user'); };
  const handleClientLogin = (user: any) => { setClientUser(user); };
  const handleClientLogout = () => { setClientUser(null); navigateTo('client-login'); };
  const handleLiveScreenLogin = (user: any) => { setLiveScreenUser(user); navigateTo('live-screen'); };
  const handleLiveScreenLogout = () => { setLiveScreenUser(null); navigateTo('live-screen-login'); };

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
          { id: 'daily-tasks' as AppView, label: 'Daily Tasks', icon: ListTodo },
          { id: 'live-screen' as AppView, label: 'Live Screen', icon: Monitor },
          { id: 'notification-audit' as AppView, label: 'Alerts Log', icon: AlertCircle },
          { id: 'client-orders' as AppView, label: 'Client Orders', icon: ShoppingCart },
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
           { id: 'production-reports' as AppView, label: 'Production Entry', icon: ClipboardList, highlight: true },
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
            payload: { id: customer.id },
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
            payload: { id: item.id },
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
            payload: { id: component.id },
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
            payload: { id: user.id },
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

      // Detect new events for toast popups (skip on first poll)
      if (knownEventIdsRef.current.size > 0) {
        for (const ev of sortedEvents) {
          if (!knownEventIdsRef.current.has(ev.id)) {
            const id = ev.id;
            setToasts(prev => {
              if (prev.some(t => t.id === id)) return prev;
              const next = [...prev, { id, title: ev.title || 'Notification', body: ev.body || '' }];
              setTimeout(() => setToasts(cur => cur.filter(t => t.id !== id)), 5000);
              return next;
            });
          }
        }
      }
      knownEventIdsRef.current = new Set(sortedEvents.map((e: any) => e.id));

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

  if (view === 'client-login') return <ClientPortal clientUser={clientUser} onLogin={handleClientLogin} onLogout={handleClientLogout} />;
  if (view === 'client-dashboard') {
    if (!clientUser) return <ClientPortal clientUser={null} onLogin={handleClientLogin} onLogout={handleClientLogout} />;
    return <ClientPortal clientUser={clientUser} onLogin={handleClientLogin} onLogout={handleClientLogout} />;
  }

  if (view === 'live-screen-login') return <LiveScreenLogin onLogin={handleLiveScreenLogin} />;
  if (view === 'live-screen' && !loggedInUser && !liveScreenUser) return <LiveScreenLogin onLogin={handleLiveScreenLogin} />;

  if (view === 'live-screen' && liveScreenUser) {
    return <LiveScreen liveScreenUser={liveScreenUser} onBack={handleLiveScreenLogout} />;
  }

  if (view === 'live-screen' && loggedInUser) {
    return <LiveScreen loggedInUser={loggedInUser} onBack={() => navigateTo('dashboard')} />;
  }

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
      case 'worker-dashboard': return <WorkerDashboard onError={onError} onView={id => navigateTo('wo-details', { payload: { id } })} onViewPlan={id => navigateTo('plan-generator', { payload: { ids: [id], backView: 'worker-dashboard' } })} loggedInUser={loggedInUser} />;
      case 'dispatch-dashboard': return <DispatchDashboard onError={onError} onView={id => navigateTo('wo-details', { payload: { id } })} loggedInUser={loggedInUser} />;
      case 'users': return <UserList onError={onError} editingId={(window as any)._id} />;
      case 'departments': return <DepartmentList onError={onError} />;
      case 'customers': return <CustomerManagement onError={onError} editingId={(window as any)._id} />;
      case 'items': return <ItemList onError={onError} editingId={(window as any)._id} />;
      case 'child-items': return <ChildItemListView onError={onError} editingId={(window as any)._id} />;
      case 'work-orders': return <WorkOrderList onError={onError} onView={id => navigateTo('wo-details', { payload: { id } })} onViewPlan={id => navigateTo('plan-generator', { payload: { ids: [id], backView: 'work-orders' } })} loggedInUser={loggedInUser} />;
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
       case 'production-plan': return <ProductionPlanList onError={onError} onGenerate={ids => navigateTo('plan-generator', { payload: { ids, backView: 'production-plan' } })} loggedInUser={loggedInUser} />;
       case 'plan-generator': return <PlanGenerator ids={(window as any)._ids} onBack={() => navigateTo((window as any)._planBackView || 'production-plan')} />;
       case 'custom-bom-plan': return <CustomBOMPlanView onError={onError} />;
       case 'custom-bom-print': return <CustomBOMPrintView plan={(window as any)._customPlan} onBack={() => navigateTo('custom-bom-plan')} />;
       case 'production-reports': return <ProductionReports onError={onError} />;
       case 'reports': return <ReportsView onError={onError} />;
        case 'notification-audit': return <NotificationAuditView onError={onError} />;
        case 'daily-tasks': return <DailyTasks loggedInUser={loggedInUser} />;
        case 'live-screen-login': return <LiveScreenLogin onLogin={handleLiveScreenLogin} />;
        case 'live-screen': return <Dashboard user={loggedInUser} setView={navigateTo} onError={onError} />;
        case 'client-orders': return <ClientOrderManager loggedInUser={loggedInUser} />;
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
      {updateAvailable && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3 bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg">
          <span>A new version is available.</span>
          <div className="flex items-center gap-2">
            <button onClick={() => window.location.reload()} className="rounded-lg bg-white px-3 py-1 text-xs font-black text-orange-600 hover:bg-orange-50">Refresh</button>
            <button onClick={() => setUpdateAvailable(false)} className="text-white/70 hover:text-white text-lg leading-none">✕</button>
          </div>
        </div>
      )}
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
          .print-job-card {
            border: 2px solid #e2e8f0 !important;
            box-shadow: none !important;
            padding: 12px !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .print-job-card .print-status-label {
            font-size: 11px !important;
            font-weight: 600 !important;
            padding: 2px 8px !important;
            border-radius: 4px !important;
            border: 1px solid !important;
            display: inline-block !important;
          }
          .print-job-card .print-dept-card {
            page-break-inside: avoid;
            break-inside: avoid;
            border: 1px solid #e2e8f0 !important;
            border-radius: 4px !important;
            padding: 8px !important;
            margin-bottom: 6px !important;
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
        }

        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slideIn 0.3s ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          .erp-fade-only,
          .erp-scale-in,
          .erp-stagger > *,
          .erp-search-results > *,
          .erp-active-pulse,
          .erp-skeleton,
          .animate-slide-in {
            animation: none !important;
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
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-blue-100/80">{notificationEventsPreview.filter(e => !readIds.has(e.id)).length} unread</span>
                    {notificationEventsPreview.some(e => !readIds.has(e.id)) && (
                      <button onClick={() => setReadIds(new Set(notificationEventsPreview.map(e => e.id)))} className="rounded-lg bg-white/15 px-2 py-1 text-[10px] font-black text-white hover:bg-white/25 transition-colors">Mark all read</button>
                    )}
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
                    const isRead = readIds.has(event.id);
                    return (
                      <div key={event.id} className={`mb-2 rounded-2xl border p-3 last:mb-0 transition-opacity ${isRead ? 'border-slate-200 bg-white opacity-50' : 'border-slate-100 bg-slate-50/80'}`}>
                        <div className="flex items-start gap-3">
                          <span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${tone}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="truncate text-sm font-black text-slate-900">{event.title || 'Notification'}</div>
                              <div className="whitespace-nowrap text-[10px] font-bold text-slate-400">{formatNotificationEventTime(event)}</div>
                            </div>
                            <div className="mt-1 line-clamp-2 whitespace-pre-line text-xs font-semibold text-slate-600">{event.body || '-'}</div>
                            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider">
                              <button
                                onClick={() => setReadIds(prev => { const next = new Set(prev); isRead ? next.delete(event.id) : next.add(event.id); return next; })}
                                className="text-blue-500 hover:text-blue-700 hover:underline transition-colors"
                              >
                                {isRead ? 'Unread' : 'Read'}
                              </button>
                              <span className="text-slate-400">WO #{event.work_order_id || '-'}</span>
                              <span className="text-slate-400">{sent} sent / {failed} failed</span>
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

          {/* Toast popups */}
          <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
            {toasts.map(t => (
              <div
                key={t.id}
                className="pointer-events-auto animate-slide-in rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/10 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <span>🔔</span> {t.title}
                  </div>
                  <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-600 line-clamp-1 ml-7">{t.body || '-'}</div>
              </div>
            ))}
          </div>
       </main>
    </div>
  );
}

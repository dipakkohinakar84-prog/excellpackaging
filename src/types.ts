export type AppView = 
  | 'dashboard' 
  | 'worker-dashboard'
  | 'dispatch-dashboard'
  | 'users' 
  | 'departments' 
  | 'customers' 
  | 'items' 
  | 'item-details'
  | 'work-orders' 
  | 'wo-details' 
  | 'child-items'
  | 'production-plan'
  | 'plan-generator'
  | 'custom-bom-plan'
  | 'custom-bom-print'
  | 'reports'
  | 'production-reports'
  | 'notification-audit'
  | 'profile' 
  | 'backup'
  | 'daily-tasks'
  | 'live-screen'
  | 'live-screen-login'
  | 'client-login'
  | 'client-dashboard'
  | 'client-orders';

export interface User {
  id: number;
  username: string;
  email: string;
  mobile: string;
  vehicle_number?: string;
  passkey?: string;
  department: string;
  level: string;
}

export interface Metric {
  type: string;
  unit: string;
}

export interface Department {
  id: number;
  name: string;
  incharge: string;
  supervisor: string;
  info: string;
  metrics: Metric[];
}

export interface Customer {
  id: number;
  name: string;
  proprietor: string;
  address: string;
  city: string;
  contact: string;
  email: string;
  gst: string;
  type: string;
  reference: string;
  remarks: string;
}

export type BomChildType = 'component' | 'item';

export interface ChildItem {
  id: string | number;
  type?: BomChildType;
  name: string;
  departments: string[];
  size?: string;
  qtyPerMaster?: number;
  drawing_no?: string;
}

export interface ItemMetricRequirement {
  metric: string;
  unit: string;
  qtyPerUnit: number;
}

export interface Item {
  id: number;
  name: string;
  customer_name: string;
  drawing_no: string;
  drawing_image_url?: string;
  drawing_file?: string;
  remarks: string;
  departments: string[];
  children?: ChildItem[];
  metric_requirements?: ItemMetricRequirement[];
}

export interface MetricResult {
  metric: string;
  unit: string;
  qtyPerUnit: number;
  totalQty: number;
}

export interface ReportItem {
  item_id: number;
  item_name: string;
  qty_produced: number;
  results: MetricResult[];
}

export interface ProductionReport {
  id: number;
  department: string;
  item_id: number;
  item_name: string;
  shift_workers: number;
  shift_hours: number;
  ot_workers: number;
  ot_hours: number;
  qty_produced: number;
  total_shift_hours: number;
  total_ot_hours: number;
  grand_total_hours: number;
  date: string;
  results: MetricResult[];
  created_by: string;
  items?: ReportItem[];
  other_work?: string;
}

export type DepartmentWOStatus = 'Not Started' | 'Work Started' | 'Ready for QC';
export type QCStatus = 'Pending QC' | 'QC Denied' | 'QC Approved';
export type WOStatus = 'Not Started' | 'Work Started' | 'Ready for QC' | 'QC Approved' | 'Ready for despatch' | 'Dispatched' | 'Delivered' | 'Cancelled';

export interface DepartmentStatus {
  department: string;
  status: DepartmentWOStatus;
  qc_status?: QCStatus;
  updated_at?: string;
  updated_by?: string;
}

export interface DailyTask {
  id: number | string;
  title: string;
  description: string;
  assignee: string;
  due_date: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ClientUser {
  id: number | string;
  customer_id: number;
  portal_id: string;
  portal_password: string;
  is_active: boolean;
}

export interface ClientOrderItem {
  item_id: number;
  item_name: string;
  qty: number;
  drawing_no: string;
}

export interface ClientOrder {
  id: number | string;
  customer_id: number;
  customer_name: string;
  items: ClientOrderItem[];
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Completed' | 'Cancelled';
  rejection_reason: string;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Notice {
  id: number | string;
  message: string;
  is_active: boolean;
  created_at: string;
}

export interface WorkOrder {
  id: number;
  itemId?: number; 
  order_type?: 'parent' | 'suborder';
  parent_work_order_id?: number;
  parent_item_name?: string;
  source_item_id?: number;
  source_child_qty?: number;
  customer: string;
  job_details: string;
  drawing: string;
  qty: number;
  qty_dispatched?: number;
  last_invoice_no?: string;
  last_vehicle_no?: string;
  etd: string;
  ready_date: string;
  status: WOStatus;
  assigned_departments?: string[];
  department_statuses?: DepartmentStatus[];
}

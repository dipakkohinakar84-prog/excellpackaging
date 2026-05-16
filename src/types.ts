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
  | 'notification-audit'
  | 'profile' 
  | 'backup';

export interface User {
  id: number;
  username: string;
  email: string;
  mobile: string;
  vehicle_number?: string;
  passkey: string;
  department: string;
  level: string;
}

export interface Department {
  id: number;
  name: string;
  incharge: string;
  supervisor: string;
  info: string;
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

import { User, WorkOrder } from './types';

export type QCApprovalProgress = 'none' | 'partial' | 'full';

export const normalizeDepartment = (dept: string): string => {
  if (!dept) return '';
  
  // Remove extra spaces and normalize
  const cleaned = dept.trim().replace(/\s+/g, ' ');
  const normalized = cleaned.toLowerCase().replace(/[^a-z]/g, '_').replace(/_+/g, '_');
  
  const mapping: Record<string, string> = {
    'wood_work': 'Wood_Work',
    'woodwork': 'Wood_Work',
    'wood__work': 'Wood_Work',
    'plywood': 'Plywood',
    'ply_wood': 'Plywood',
    'corrugation': 'Corrugation',
    'trading_consumable': 'Trading_Consumables',
    'tradingconsumable': 'Trading_Consumables',
    'trading_consumables': 'Trading_Consumables',
    'quality_control': 'Quality_Control',
    'qualitycontrol': 'Quality_Control',
    'qc': 'Quality_Control',
    'quality': 'Quality_Control',
    'office': 'Office',
    'dispatch': 'Dispatch',
    'despatch': 'Dispatch'
  };
  
  // Direct mapping match
  if (mapping[normalized]) {
    return mapping[normalized];
  }
  
  // Fallback: partial matches
  if (normalized.includes('ply') && normalized.includes('wood')) return 'Plywood';
  if (normalized.includes('wood') && !normalized.includes('ply')) return 'Wood_Work';
  if (normalized.includes('corrugat')) return 'Corrugation';
  if (normalized.includes('trading') || normalized.includes('consumable')) return 'Trading_Consumables';
  if (normalized.includes('quality') || normalized.includes('qc')) return 'Quality_Control';
  if (normalized.includes('office')) return 'Office';
  if (normalized.includes('dispatch') || normalized.includes('despatch')) return 'Dispatch';
  
  // Return original if no match
  return dept;
};

export const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.error('Notification sound failed:', error);
  }
};

export const sendNotification = (title: string, body: string, departments?: string[]) => {
  playNotificationSound();

  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    if (import.meta.env.DEV) console.log('Foreground notification suppressed:', title, body, departments);
    return;
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(registration => {
          return registration.showNotification(title, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
          });
        })
        .catch(() => {
          try { new Notification(title, { body }); } catch (e) { console.error('Notification fallback failed:', e); }
        });
    } else {
      new Notification(title, { body });
    }
  }

  if (import.meta.env.DEV) console.log('Notification:', title, body, departments);
};

export const requestNotificationPermission = () => {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => undefined);
  }
};

export const canAccessView = (user: User | null, view: string): boolean => {
  if (!user) return false;
  
  const { department, level } = user;
  const normDept = normalizeDepartment(department);
  
  if (normDept === 'Office' && level === '1-Manager') {
    return true;
  }
  
  if (normDept === 'Quality_Control') {
    return ['worker-dashboard', 'wo-details'].includes(view);
  }

  // Dispatch Department
  if (normDept === 'Dispatch') {
    return ['dispatch-dashboard', 'wo-details'].includes(view);
  }
  
  if (normDept === 'Office' && (level === '3-Staff' || level === '2-Supervisor')) {
    const allowedViews = [
      'dashboard',
      'customers',
      'items',
      'work-orders',
      'wo-details',
      'child-items',
      'production-plan',
      'plan-generator',
       'custom-bom-plan',
       'custom-bom-print',
       'reports',
       'notification-audit',
       'departments'
     ];
    return allowedViews.includes(view);
  }
  
  // Production Departments
  const productionDepts = ['Wood_Work', 'Plywood', 'Corrugation', 'Trading_Consumables', 'Foam_Plastic_bags'];
  if (productionDepts.includes(normDept)) {
    return ['worker-dashboard', 'wo-details'].includes(view);
  }
  
  return false;
};

export const getAllowedStatuses = (department: string): string[] => {
  const normDept = normalizeDepartment(department);
  
  if (normDept === 'Quality_Control') {
    return ['Pending QC', 'QC Denied', 'QC Approved', 'Ready for despatch'];
  }
  
  const productionDepts = ['Wood_Work', 'Plywood', 'Corrugation', 'Trading_Consumables'];
  if (productionDepts.includes(normDept)) {
    return ['Not Started', 'Work Started', 'Ready for QC'];
  }
  
  if (normDept === 'Office') {
    return ['Not Started', 'Work Started', 'Ready for QC', 'QC Approved', 'Ready for despatch', 'Dispatched', 'Delivered', 'Cancelled'];
  }
  
  return [];
};

export const canEditWorkOrder = (user: User, workOrder: WorkOrder): boolean => {
  const normDept = normalizeDepartment(user.department);
  
  if (normDept === 'Office' && user.level === '1-Manager') {
    return true;
  }
  
  if (normDept === 'Office' && (user.level === '3-Staff' || user.level === '2-Supervisor')) {
    return true;
  }
  
  if (workOrder.assigned_departments?.some((d: string) => normalizeDepartment(d) === normDept)) {
    return true;
  }
  
  return false;
};

export const getQCApprovalProgress = (workOrder: WorkOrder): QCApprovalProgress => {
  const assignedDepartments = Array.isArray(workOrder?.assigned_departments)
    ? workOrder.assigned_departments
    : [];

  if (assignedDepartments.length === 0) {
    return 'none';
  }

  const departmentStatuses = Array.isArray(workOrder?.department_statuses)
    ? workOrder.department_statuses
    : [];

  const approvedCount = assignedDepartments.filter((dept: string) => {
    const deptStatus = departmentStatuses.find((status: any) =>
      normalizeDepartment(status.department) === normalizeDepartment(dept)
    );

    return deptStatus?.qc_status === 'QC Approved';
  }).length;

  if (approvedCount === 0) return 'none';
  if (approvedCount === assignedDepartments.length) return 'full';

  return 'partial';
};

export const filterWorkOrdersByDepartment = (workOrders: WorkOrder[], user: User): WorkOrder[] => {
  const normDept = normalizeDepartment(user.department);
  
  if (import.meta.env.DEV) console.log('🔍 FILTER DEBUG:', {
    userDepartment: user.department,
    normalizedDept: normDept,
    totalOrders: workOrders.length,
    orderIds: workOrders.map(wo => wo.id)
  });

  // Office sees all
  if (normDept === 'Office') {
    if (import.meta.env.DEV) console.log('✅ Office user - showing all orders');
    return workOrders;
  }

  // Quality Control sees only orders currently in QC workflow
  if (normDept === 'Quality_Control') {
    const qcVisibleOrders = workOrders.filter(wo => {
      const statuses = Array.isArray(wo.department_statuses) ? wo.department_statuses : [];
      const hasQCWork = statuses.some((ds: any) => ds.status === 'Ready for QC' || !!ds.qc_status);
      return hasQCWork && getQCApprovalProgress(wo) !== 'full';
    });
    if (import.meta.env.DEV) console.log('✅ QC user - filtered to', qcVisibleOrders.length, 'orders');
    return qcVisibleOrders;
  }

  // Dispatch sees only assigned dispatch work
  if (normDept === 'Dispatch') {
    const dispatchOrders = workOrders.filter(wo =>
      wo.assigned_departments?.some((dept: string) => normalizeDepartment(dept) === normDept)
    );
    if (import.meta.env.DEV) console.log('✅ Dispatch user - filtered to', dispatchOrders.length, 'orders');
    return dispatchOrders;
  }

  // Production departments see only their assigned orders
  const filtered = workOrders.filter(wo => {
      const isAssigned = wo.assigned_departments?.some((dept: string) =>
        normalizeDepartment(dept) === normDept
      );

      if (!isAssigned) return false;

      return getQCApprovalProgress(wo) !== 'full';
  });

  if (import.meta.env.DEV) console.log('✅ Production worker - filtered to', filtered.length, 'orders');
  return filtered;
};

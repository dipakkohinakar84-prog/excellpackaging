import { User } from './types';

export const normalizeDepartment = (dept: string): string => {
  if (!dept) return '';
  const normalized = dept.toLowerCase().replace(/[^a-z]/g, '_');
  const mapping: Record<string, string> = {
    'wood_work': 'Wood_Work',
    'woodwork': 'Wood_Work',
    'plywood': 'Plywood',
    'corrugation': 'Corrugation',
    'trading_consumable': 'Trading_Consumables', // Fixed matching existing DB values
    'tradingconsumable': 'Trading_Consumables',
    'trading_consumables': 'Trading_Consumables',
    'quality_control': 'Quality_Control',
    'qualitycontrol': 'Quality_Control',
    'qc': 'Quality_Control',
    'office': 'Office'
  };
  // Fallback check for partial matches if not found in mapping
  if (normalized.includes('plywood')) return 'Plywood';
  if (normalized.includes('wood')) return 'Wood_Work';
  
  return mapping[normalized] || dept;
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
    console.log('Notification sound failed:', error);
  }
};

export const sendNotification = (title: string, body: string, departments?: string[]) => {
  playNotificationSound();
  
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body: body });
  }
  
  console.log('Notification:', title, body, departments);
};

export const requestNotificationPermission = () => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
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
    return ['dashboard', 'work-orders', 'wo-details', 'worker-dashboard'].includes(view);
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
      'production-reports',
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
    return ['Not Started', 'Work Started', 'Ready for QC', 'QC Approved', 'Ready for despatch', 'Cancelled'];
  }
  
  return [];
};

export const canEditWorkOrder = (user: User, workOrder: any): boolean => {
  const normDept = normalizeDepartment(user.department);
  
  if (normDept === 'Office' && user.level === '1-Manager') {
    return true;
  }
  
  if (normDept === 'Office' && (user.level === '3-Staff' || user.level === '2-Supervisor')) {
    return true;
  }
  
  if (workOrder.assigned_departments?.includes(user.department)) {
    return true;
  }
  
  return false;
};

export const filterWorkOrdersByDepartment = (workOrders: any[], user: User): any[] => {
  const normDept = normalizeDepartment(user.department);
  
  if (normDept === 'Office') {
    return workOrders;
  }
  
  if (normDept === 'Quality_Control') {
    return workOrders.filter(wo => {
      // QC sees items marked ready for QC or already in QC process
      if (wo.department_statuses) {
        return wo.department_statuses.some((ds: any) => 
          ds.status === 'Ready for QC' || ds.qc_status
        );
      }
      return wo.status === 'Ready for QC' || wo.status === 'QC Approved';
    });
  }
  
  return workOrders.filter(wo => {
      // Check normalized assigned departments
      return wo.assigned_departments?.some((dept: string) => 
        normalizeDepartment(dept) === normDept
      );
  });
};
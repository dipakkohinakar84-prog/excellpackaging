import React from 'react';
import { Check, X, CheckCircle2 } from 'lucide-react';
import { DepartmentStatus, User } from './types';
import { getAllowedStatuses, normalizeDepartment, sendNotification } from './utils';

interface DepartmentStatusTrackerProps {
  workOrderId: number;
  assignedDepartments: string[];
  departmentStatuses: DepartmentStatus[];
  loggedInUser: User;
  onStatusUpdate: (department: string, status: string, qcStatus?: string) => void;
}

const DepartmentStatusTracker: React.FC<DepartmentStatusTrackerProps> = ({
  workOrderId,
  assignedDepartments,
  departmentStatuses,
  loggedInUser,
  onStatusUpdate
}) => {
  const userDept = normalizeDepartment(loggedInUser.department);
  const isQC = userDept === 'Quality_Control';
  const isOffice = userDept === 'Office';

  const getDepartmentStatus = (dept: string): DepartmentStatus => {
    return departmentStatuses?.find(ds => 
      normalizeDepartment(ds.department) === normalizeDepartment(dept)
    ) || {
      department: dept,
      status: 'Not Started'
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Not Started': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'Work Started': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Ready for QC': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'QC Approved': return 'bg-green-100 text-green-700 border-green-200';
      case 'QC Denied': return 'bg-red-100 text-red-700 border-red-200';
      case 'Pending QC': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const handleStatusChange = (dept: string, newStatus: string) => {
    if (newStatus === 'Ready for QC') {
      sendNotification(
        'QC Required',
        `Work Order #${workOrderId} - ${dept} is ready for quality check`,
        ['Quality_Control']
      );
    }
    onStatusUpdate(dept, newStatus);
  };

  const handleQCStatusChange = (dept: string, qcStatus: string) => {
    onStatusUpdate(dept, 'Ready for QC', qcStatus);
    
    if (qcStatus === 'QC Approved' || qcStatus === 'QC Denied') {
      sendNotification(
        qcStatus === 'QC Approved' ? 'QC Approved' : 'QC Denied',
        `Work Order #${workOrderId} - ${dept} has been ${qcStatus.toLowerCase()}`,
        [dept]
      );
    }
  };

  const canEditDepartment = (dept: string): boolean => {
    const normDept = normalizeDepartment(dept);
    
    if (isOffice && loggedInUser.level === '1-Manager') {
      return true;
    }
    
    if (isQC) {
      // QC can only edit if status is Ready for QC
      return getDepartmentStatus(dept).status === 'Ready for QC';
    }
    
    // Workers can edit their own department
    return normalizeDepartment(loggedInUser.department) === normDept;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-800 mb-4">Department Status Tracking</h3>
      
      {assignedDepartments.map(dept => {
        const deptStatus = getDepartmentStatus(dept);
        const canEdit = canEditDepartment(dept);
        
        return (
          <div key={dept} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <h4 className="font-bold text-gray-800">{dept.replace(/_/g, ' ')}</h4>
              </div>
              
              <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(deptStatus.status)}`}>
                {deptStatus.status}
              </div>
            </div>

            {canEdit && !isQC && (
              <div className="flex gap-2 flex-wrap mb-3">
                {['Not Started', 'Work Started', 'Ready for QC'].map(status => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(dept, status)}
                    disabled={deptStatus.status === status}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      deptStatus.status === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            )}

            {(deptStatus.status === 'Ready for QC' || deptStatus.qc_status) && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <span className="text-sm font-semibold text-gray-700">Quality Control</span>
                </div>
                
                {deptStatus.qc_status && (
                  <div className={`mb-2 px-3 py-2 rounded-lg text-sm font-semibold ${getStatusColor(deptStatus.qc_status)}`}>
                    {deptStatus.qc_status}
                  </div>
                )}
                
                {canEdit && isQC && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleQCStatusChange(dept, 'QC Approved')}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors flex items-center justify-center"
                    >
                      <Check size={16} className="inline mr-1" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleQCStatusChange(dept, 'QC Denied')}
                      className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors flex items-center justify-center"
                    >
                      <X size={16} className="inline mr-1" />
                      Deny
                    </button>
                  </div>
                )}
              </div>
            )}

            {deptStatus.updated_at && (
              <div className="mt-3 text-xs text-gray-400">
                Updated: {new Date(deptStatus.updated_at).toLocaleString()}
                {deptStatus.updated_by && ` by ${deptStatus.updated_by}`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DepartmentStatusTracker;
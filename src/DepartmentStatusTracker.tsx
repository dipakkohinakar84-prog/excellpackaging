import React from 'react';
import { Check, X, CheckCircle2 } from 'lucide-react';
import { DepartmentStatus, User } from './types';
import { getAllowedStatuses, normalizeDepartment } from './utils';

interface DepartmentStatusTrackerProps {
  workOrderId: number;
  assignedDepartments: string[];
  departmentStatuses: DepartmentStatus[];
  loggedInUser: User;
  onStatusUpdate: (department: string, status: string, qcStatus?: string) => void;
  busyDepartmentKey?: string | null;
  isBusy?: boolean;
}

const DepartmentStatusTracker: React.FC<DepartmentStatusTrackerProps> = ({
  workOrderId,
  assignedDepartments,
  departmentStatuses,
  loggedInUser,
  onStatusUpdate,
  busyDepartmentKey = null,
  isBusy = false,
}) => {
  const userDept = normalizeDepartment(loggedInUser.department);
  const isQC = userDept === 'Quality_Control';
  const isOffice = userDept === 'Office';

  const getDepartmentStatus = (dept: string): DepartmentStatus => {
    return departmentStatuses?.find(ds =>
      normalizeDepartment(ds.department) === normalizeDepartment(dept)
    ) || {
      department: dept,
      status: 'Not Started',
      qc_status: undefined,
      updated_at: undefined,
      updated_by: undefined,
    };
  };

  const mobilePrimaryDepartments = assignedDepartments.filter(dept => {
    const normDept = normalizeDepartment(dept);
    const deptStatus = getDepartmentStatus(dept);

    if (isOffice) return true;
    if (isQC) return deptStatus.status === 'Ready for QC' || !!deptStatus.qc_status;
    return normDept === userDept;
  });

  const mobileVisibleDepartments = mobilePrimaryDepartments.length > 0
    ? mobilePrimaryDepartments
    : assignedDepartments.slice(0, 1);

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
    onStatusUpdate(dept, newStatus);
  };

  const handleQCStatusChange = (dept: string, qcStatus: string) => {
    onStatusUpdate(dept, 'Ready for QC', qcStatus);
  };

  const canEditDepartment = (dept: string): boolean => {
    const normDept = normalizeDepartment(dept);
    
    if (isOffice && loggedInUser.level === '1-Manager') {
      return true;
    }
    
    if (isQC) {
      // QC can only edit if status is Ready for QC and not already approved
      const s = getDepartmentStatus(dept);
      return s.status === 'Ready for QC' && s.qc_status !== 'QC Approved';
    }
    
    // Workers can edit their own department
    return normalizeDepartment(loggedInUser.department) === normDept;
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm sm:text-xl font-black text-gray-800">Department Status Tracking</h3>
        <span className="sm:hidden rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">#{workOrderId}</span>
      </div>

      <div className="sm:hidden space-y-2">
        {mobileVisibleDepartments.map(dept => {
          const deptStatus = getDepartmentStatus(dept);
          const canEdit = canEditDepartment(dept);
          const normalizedDept = normalizeDepartment(dept);
          const isDepartmentBusy = isBusy && busyDepartmentKey === normalizedDept;

          return (
            <div key={dept} className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <h4 className="font-black text-gray-800 text-sm truncate">{dept.replace(/_/g, ' ')}</h4>
                  <div className={`mt-1 inline-flex px-2 py-0.5 rounded-full text-[10px] font-black border ${getStatusColor(deptStatus.status)}`}>
                    {deptStatus.status}
                  </div>
                </div>
                {deptStatus.qc_status && (
                  <span className={`shrink-0 px-2 py-1 rounded-full text-[9px] font-black border ${getStatusColor(deptStatus.qc_status)}`}>
                    {deptStatus.qc_status}
                  </span>
                )}
              </div>

              {canEdit && !isQC && (
                <div className="grid grid-cols-3 gap-1.5">
                  {['Not Started', 'Work Started', 'Ready for QC'].map(status => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(dept, status)}
                      disabled={deptStatus.status === status || isDepartmentBusy}
                      className={`min-h-10 px-2 py-2 rounded-xl text-[9px] font-black transition-all ${
                        deptStatus.status === status
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600'
                      } disabled:opacity-50`}
                    >
                      {isDepartmentBusy ? 'Updating' : status.replace('Not Started', 'Not').replace('Work Started', 'Start').replace('Ready for QC', 'Ready QC')}
                    </button>
                  ))}
                </div>
              )}

              {canEdit && isQC && deptStatus.status === 'Ready for QC' && (
                <div className="grid grid-cols-2 gap-1.5">
                  <button onClick={() => handleQCStatusChange(dept, 'QC Approved')} disabled={isDepartmentBusy} className="min-h-10 rounded-xl bg-green-600 text-white text-[10px] font-black disabled:opacity-50">Approve</button>
                  <button onClick={() => handleQCStatusChange(dept, 'QC Denied')} disabled={isDepartmentBusy} className="min-h-10 rounded-xl bg-red-600 text-white text-[10px] font-black disabled:opacity-50">Deny</button>
                </div>
              )}
            </div>
          );
        })}

        {assignedDepartments.length > mobileVisibleDepartments.length && (
          <details className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <summary className="list-none cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-500">Show all departments ({assignedDepartments.length})</summary>
            <div className="mt-2 space-y-1.5">
              {assignedDepartments.map(dept => {
                const deptStatus = getDepartmentStatus(dept);
                return (
                  <div key={dept} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs">
                    <span className="font-bold text-slate-700 truncate">{dept.replace(/_/g, ' ')}</span>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black border ${getStatusColor(deptStatus.status)}`}>{deptStatus.status}</span>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>

      <div className="hidden sm:grid grid-cols-1 xl:grid-cols-2 gap-2">
      {assignedDepartments.map(dept => {
        const deptStatus = getDepartmentStatus(dept);
        const canEdit = canEditDepartment(dept);
        const normalizedDept = normalizeDepartment(dept);
        const isDepartmentBusy = isBusy && busyDepartmentKey === normalizedDept;
        
        return (
          <div key={dept} className="bg-white border border-gray-200 rounded-2xl sm:rounded-xl p-3 sm:p-2.5 shadow-sm">
            {/* Responsive header for the department status card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1.5 gap-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 shadow shadow-blue-200"></div>
                <h4 className="font-black text-gray-800 break-words text-sm">{dept.replace(/_/g, ' ')}</h4>
              </div>
              
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-black border self-start sm:self-auto ${getStatusColor(deptStatus.status)}`}>
                {deptStatus.status}
              </div>
            </div>

            {canEdit && !isQC && (
              <div className="grid grid-cols-3 sm:flex gap-1.5 sm:gap-1 flex-wrap mb-2 sm:mb-1.5">
                {['Not Started', 'Work Started', 'Ready for QC'].map(status => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(dept, status)}
                    disabled={deptStatus.status === status || isDepartmentBusy}
                    className={`min-h-11 sm:min-h-0 px-2 py-2 sm:py-1 rounded-xl sm:rounded-md text-[10px] font-bold transition-all flex-grow sm:flex-grow-0 ${
                      deptStatus.status === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    {isDepartmentBusy ? 'Updating...' : status}
                  </button>
                ))}
              </div>
            )}

            {(deptStatus.status === 'Ready for QC' || deptStatus.qc_status) && (
              <div className="mt-1.5 pt-1.5 border-t border-gray-100">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <CheckCircle2 size={13} className="text-green-600" />
                  <span className="text-[11px] font-black text-gray-700">Quality Control</span>
                </div>
                
                {deptStatus.qc_status && (
                  <div className={`mb-1.5 inline-flex px-2.5 py-1 rounded-md text-[10px] font-black border ${getStatusColor(deptStatus.qc_status)}`}>
                    {deptStatus.qc_status}
                  </div>
                )}
                
                {canEdit && isQC && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleQCStatusChange(dept, 'QC Approved')}
                      disabled={isDepartmentBusy}
                      className="flex-1 min-h-11 sm:min-h-0 px-2.5 py-2 sm:py-1.5 bg-green-600 text-white rounded-xl sm:rounded-md text-[10px] font-black hover:bg-green-700 transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                      <Check size={12} className="inline mr-1" />
                      {isDepartmentBusy ? 'Updating...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleQCStatusChange(dept, 'QC Denied')}
                      disabled={isDepartmentBusy}
                      className="flex-1 min-h-11 sm:min-h-0 px-2.5 py-2 sm:py-1.5 bg-red-600 text-white rounded-xl sm:rounded-md text-[10px] font-black hover:bg-red-700 transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                      <X size={12} className="inline mr-1" />
                      {isDepartmentBusy ? 'Updating...' : 'Deny'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {deptStatus.updated_at && (() => {
              const d = new Date(deptStatus.updated_at!);
              const dateStr = !isNaN(d.getTime()) ? d.toLocaleString() : deptStatus.updated_at;
              return (
                <div className="mt-1.5 text-[10px] text-gray-400">
                  Updated: {dateStr}
                  {deptStatus.updated_by && ` by ${deptStatus.updated_by}`}
                </div>
              );
            })()}
          </div>
        );
      })}
      </div>
    </div>
  );
};

export default DepartmentStatusTracker;

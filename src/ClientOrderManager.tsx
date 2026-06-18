import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './pocketbase';
import { ClientOrder, User } from './types';
import { CheckCircle, XCircle, RefreshCw, Package } from 'lucide-react';

interface Props {
  loggedInUser: User;
}

const ClientOrderManager: React.FC<Props> = ({ loggedInUser }) => {
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'Pending' | 'Accepted' | 'Rejected' | 'All'>('Pending');
  const [rejectModal, setRejectModal] = useState<{ id: number; reason: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('client_orders').select('*').order('created_at', { ascending: false });
    if (tab !== 'All') query = query.eq('status', tab);
    const { data, error } = await query;
    if (!error && data) setOrders(data as ClientOrder[]);
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleAccept = async (order: ClientOrder) => {
    if (!confirm(`Accept order #${order.id}? This will create a work order.`)) return;
    setActionLoading(order.id);
    const itemNames = (order.items || []).map((i: any) => `${i.item_name} x${i.qty}`).join(', ');

    const { error: woError } = await supabase.from('work_orders').insert([{
      customer: order.customer_name,
      job_details: `Client Order #${order.id} - ${itemNames}`,
      drawing: (order.items || [])[0]?.drawing_no || '',
      qty: (order.items || []).reduce((sum: number, i: any) => sum + (i.qty || 0), 0),
      etd: '',
      ready_date: '',
      status: 'Not Started',
      assigned_departments: [],
      department_statuses: [],
    }] as any);

    if (!woError) {
      await supabase.from('client_orders').update({ status: 'Accepted', updated_at: new Date().toISOString() }).eq('id', order.id);
    }
    setActionLoading(null);
    fetchOrders();
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    const { error } = await supabase.from('client_orders').update({ status: 'Rejected', rejection_reason: rejectModal.reason, updated_at: new Date().toISOString() }).eq('id', rejectModal.id);
    setRejectModal(null);
    setActionLoading(null);
    fetchOrders();
  };

  const tabs = ['Pending', 'Accepted', 'Rejected', 'All'] as const;

const tabColors: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Accepted: 'bg-green-100 text-green-700 border-green-200',
  Rejected: 'bg-red-100 text-red-700 border-red-200',
  All: 'bg-slate-900 text-white',
};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-gray-800 flex items-center gap-2"><Package size={20}/> Client Orders</h1>
        <button onClick={fetchOrders} className="px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200"><RefreshCw size={14}/></button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${tab === t ? tabColors[t] : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}>{t === 'All' ? 'All Orders' : t}</button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm font-semibold text-gray-400">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-10 text-sm font-semibold text-gray-400">No {tab.toLowerCase()} orders.</div>
      ) : (
        <div className="space-y-2.5">
          {orders.map(order => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-800 text-sm">Order #{order.id}</h3>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{order.customer_name}</p>
                  <p className="text-[10px] text-gray-400 mb-2">{new Date(order.created_at).toLocaleString()}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(order.items || []).map((item: any, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[10px] font-semibold">{item.item_name} x{item.qty}</span>
                    ))}
                  </div>
                  {order.rejection_reason && (
                    <p className="text-[10px] text-red-500 mt-2 font-semibold">Rejection reason: {order.rejection_reason}</p>
                  )}
                </div>
                {order.status === 'Pending' && (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => handleAccept(order)} disabled={actionLoading === order.id} className="px-3 py-2 rounded-lg bg-green-50 text-green-600 text-xs font-bold hover:bg-green-100 transition-colors disabled:opacity-50 flex items-center gap-1">
                      <CheckCircle size={14}/> {actionLoading === order.id ? '...' : 'Accept'}
                    </button>
                    <button onClick={() => setRejectModal({ id: order.id, reason: '' })} disabled={actionLoading === order.id} className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-1">
                      <XCircle size={14}/> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-2xl p-5 max-w-sm w-full space-y-3">
            <h3 className="font-bold text-gray-800 text-sm">Reject Order #{rejectModal.id}</h3>
            <textarea value={rejectModal.reason} onChange={e => setRejectModal({...rejectModal, reason: e.target.value})} placeholder="Reason for rejection..." rows={3} className="w-full px-3 py-2.5 border rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-red-500 resize-none" />
            <div className="flex gap-2">
              <button onClick={() => setRejectModal(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200">Cancel</button>
              <button onClick={handleReject} disabled={!rejectModal.reason.trim()} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const OrderStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    Pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    Accepted: 'bg-green-100 text-green-700 border-green-200',
    Rejected: 'bg-red-100 text-red-700 border-red-200',
    Completed: 'bg-blue-100 text-blue-700 border-blue-200',
    Cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${styles[status] || styles.Pending}`}>{status}</span>;
};

export default ClientOrderManager;

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './pocketbase';
import { ClientOrder, ClientOrderItem, User, Item } from './types';
import { normalizeDepartment } from './utils';
import { CheckCircle, XCircle, RefreshCw, Package, Save } from 'lucide-react';
import { sendOrderEmail } from './orderEmail';

interface Props {
  loggedInUser: User;
}

type OrderItemStatus = 'Pending' | 'Accepted' | 'Rejected';

interface ClientOrderRow {
  key: string;
  order: ClientOrder;
  item: ClientOrderItem;
  itemIndex: number;
  status: OrderItemStatus;
}

const getItemStatus = (order: ClientOrder, item: ClientOrderItem): OrderItemStatus => {
  if (item.status) return item.status;
  if (item.work_order_id) return 'Accepted';
  if (order.status === 'Rejected') return 'Rejected';
  if (order.status === 'Accepted') return 'Accepted';
  return 'Pending';
};

const getParentStatus = (items: ClientOrderItem[]): ClientOrder['status'] => {
  const statuses = items.map(item => item.status || (item.work_order_id ? 'Accepted' : 'Pending'));
  if (statuses.some(status => status === 'Pending')) return 'Pending';
  if (statuses.length > 0 && statuses.every(status => status === 'Rejected')) return 'Rejected';
  return 'Accepted';
};

const isValidEmail = (value?: string) => !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const ClientOrderManager: React.FC<Props> = ({ loggedInUser }) => {
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'Pending' | 'Accepted' | 'Rejected' | 'All'>('Pending');
  const [rejectModal, setRejectModal] = useState<{ orderId: number | string; itemIndex: number; itemName: string; reason: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [etdEdits, setEtdEdits] = useState<Record<string, string>>({});

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const [ordersRes, itemsRes] = await Promise.all([
      supabase.from('client_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('items').select('*'),
    ]);
    if (!ordersRes.error && ordersRes.data) setOrders(ordersRes.data as ClientOrder[]);
    if (!itemsRes.error && itemsRes.data) setAllItems(itemsRes.data as Item[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const rows = useMemo<ClientOrderRow[]>(() => {
    return orders.flatMap(order => (order.items || []).map((item, itemIndex) => {
      const status = getItemStatus(order, item);
      return { key: `${order.id}-${itemIndex}`, order, item, itemIndex, status };
    })).filter(row => tab === 'All' || row.status === tab);
  }, [orders, tab]);

  const updateOrderItem = async (order: ClientOrder, itemIndex: number, nextItem: ClientOrderItem) => {
    const updatedItems = [...(order.items || [])];
    updatedItems[itemIndex] = nextItem;
    const workOrderIds = updatedItems.map(item => item.work_order_id).filter((id): id is number => typeof id === 'number');
    await supabase.from('client_orders').update({
      status: getParentStatus(updatedItems),
      items: updatedItems,
      work_order_ids: workOrderIds,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
  };

  const handleSaveEtd = async (row: ClientOrderRow) => {
    const editedEtd = etdEdits[row.key] ?? row.item.etd ?? '';
    setActionLoading(row.key);
    await updateOrderItem(row.order, row.itemIndex, { ...row.item, etd: editedEtd });
    setEtdEdits(prev => {
      const next = { ...prev };
      delete next[row.key];
      return next;
    });
    setActionLoading(null);
    fetchOrders();
  };

  const handleAccept = async (row: ClientOrderRow) => {
    const editedEtd = etdEdits[row.key] ?? row.item.etd ?? '';
    if (!confirm(`Accept ${row.item.item_name} for ${row.order.customer_name}? This will create one ERP work order.`)) return;
    setActionLoading(row.key);

    const matchedItem = allItems.find(i => i.id === row.item.item_id || i.name === row.item.item_name);
    const depts = (matchedItem?.departments || [])
      .map((d: string) => normalizeDepartment(d))
      .filter((d: string) => d !== 'Admin' && d !== 'Office');
    const now = new Date().toISOString();

    const { data } = await supabase.from('work_orders').insert([{
      customer: row.order.customer_name,
      job_details: row.item.item_name,
      drawing: row.item.drawing_no || '',
      drawing_image_url: '',
      drawing_file: '',
      entry_date: now.slice(0, 10),
      qty: row.item.qty,
      etd: editedEtd,
      ready_date: '',
      status: 'Not Started',
      assigned_departments: depts,
      department_statuses: depts.map(dept => ({
        department: dept,
        status: 'Not Started',
        updated_at: now,
        updated_by: loggedInUser.username,
        created_by: loggedInUser.username,
        created_at: now,
        history: [{ status: 'Not Started', by: loggedInUser.username, at: now }],
      })),
      history: [{ status: 'Not Started', by: loggedInUser.username, at: now }],
      source_item_id: matchedItem?.id || null,
    }] as any).select('id');

    if (data && data[0]) {
      const erpOrderId = Number(data[0].id);
      await updateOrderItem(row.order, row.itemIndex, {
        ...row.item,
        etd: editedEtd,
        status: 'Accepted',
        rejection_reason: undefined,
        work_order_id: erpOrderId,
      });

      let recipient = isValidEmail(row.order.created_by) ? row.order.created_by : '';
      if (!recipient) {
        const { data: customer } = await supabase.from('customers').select('email').eq('id', row.order.customer_id).single();
        recipient = isValidEmail(customer?.email) ? customer.email : '';
      }

      void sendOrderEmail({
        type: 'accepted',
        to: recipient,
        erpOrderId,
        itemName: row.item.item_name,
        qty: row.item.qty,
        etd: editedEtd,
      });
    }

    setActionLoading(null);
    fetchOrders();
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    const order = orders.find(o => o.id === rejectModal.orderId);
    if (!order) return;

    const item = order.items?.[rejectModal.itemIndex];
    if (!item) return;

    const rowKey = `${rejectModal.orderId}-${rejectModal.itemIndex}`;
    setActionLoading(rowKey);
    await updateOrderItem(order, rejectModal.itemIndex, {
      ...item,
      etd: etdEdits[rowKey] ?? item.etd ?? '',
      status: 'Rejected',
      rejection_reason: rejectModal.reason,
    });
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
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${tab === t ? tabColors[t] : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'}`}>{t === 'All' ? 'All Items' : t}</button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm font-bold text-gray-500">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-sm font-bold text-gray-500">No {tab.toLowerCase()} items.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Client Name</th>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3">ETD</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">ERP WO</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(row => {
                  const editedEtd = etdEdits[row.key] ?? row.item.etd ?? '';
                  const etdChanged = editedEtd !== (row.item.etd ?? '');
                  return (
                    <tr key={row.key} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-bold text-gray-500 whitespace-nowrap">{new Date(row.order.created_at).toLocaleString('en-GB')}</td>
                      <td className="px-4 py-3 font-bold text-gray-800">{row.order.customer_name}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-gray-800">{row.item.item_name}</p>
                        <p className="text-[10px] font-mono text-gray-400">Drawing: {row.item.drawing_no || '-'}</p>
                        {row.status === 'Rejected' && row.item.rejection_reason && <p className="text-[10px] font-semibold text-red-500 mt-1">{row.item.rejection_reason}</p>}
                      </td>
                      <td className="px-4 py-3 text-center font-black text-gray-700">{row.item.qty}</td>
                      <td className="px-4 py-3">
                        <input type="date" value={editedEtd} onChange={e => setEtdEdits(prev => ({ ...prev, [row.key]: e.target.value }))} disabled={row.status === 'Accepted'} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60" />
                      </td>
                      <td className="px-4 py-3"><OrderStatusBadge status={row.status} /></td>
                      <td className="px-4 py-3 font-black text-indigo-600">{row.item.work_order_id ? `#${row.item.work_order_id}` : '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 justify-end">
                          {row.status === 'Pending' && etdChanged && (
                            <button onClick={() => handleSaveEtd(row)} disabled={actionLoading === row.key} className="px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 transition-colors disabled:opacity-50 flex items-center gap-1">
                              <Save size={14}/> Save ETD
                            </button>
                          )}
                          {row.status === 'Pending' && (
                            <>
                              <button onClick={() => handleAccept(row)} disabled={actionLoading === row.key} className="px-3 py-2 rounded-lg bg-green-50 text-green-600 text-xs font-bold hover:bg-green-100 transition-colors disabled:opacity-50 flex items-center gap-1">
                                <CheckCircle size={14}/> {actionLoading === row.key ? '...' : 'Accept'}
                              </button>
                              <button onClick={() => setRejectModal({ orderId: row.order.id, itemIndex: row.itemIndex, itemName: row.item.item_name, reason: '' })} disabled={actionLoading === row.key} className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-1">
                                <XCircle size={14}/> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-2xl p-5 max-w-sm w-full space-y-3">
            <h3 className="font-bold text-gray-800 text-sm">Reject {rejectModal.itemName}</h3>
            <textarea value={rejectModal.reason} onChange={e => setRejectModal({...rejectModal, reason: e.target.value})} placeholder="Reason for rejection..." rows={3} className="w-full px-3 py-2.5 border rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-red-500 resize-none" />
            <div className="flex gap-2">
              <button onClick={() => setRejectModal(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200">Cancel</button>
              <button onClick={handleReject} disabled={!rejectModal.reason.trim()} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50">Reject Item</button>
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

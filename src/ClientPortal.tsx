import React, { useState, useEffect, useMemo, useRef } from 'react';
import { pb, supabase } from './pocketbase';
import { Item, ClientUser, ClientOrder } from './types';
import { LogIn, Box, Search, Loader2, X, Plus, CheckCircle, XCircle, RefreshCw, PackageCheck, ShoppingCart, ClipboardCheck, Mail, Lock, Eye, EyeOff, AlertCircle, Package } from 'lucide-react';

interface Props {
  clientUser?: ClientUser | null;
  onLogin: (user: ClientUser) => void;
  onLogout: () => void;
}

interface OrderLineItem {
  key: string;
  itemId: number;
  itemName: string;
  drawingNo: string;
  qty: number | '';
  etd: string;
}

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  Accepted: 'bg-green-50 text-green-800 border-green-200',
  Rejected: 'bg-white text-slate-700 border-slate-200',
  Dispatched: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  Completed: 'bg-white text-slate-700 border-slate-200',
  Cancelled: 'bg-white text-slate-700 border-slate-200',
};

const STATUS_DOT_STYLES: Record<string, string> = {
  Pending: 'bg-slate-400',
  Accepted: 'bg-slate-700',
  Rejected: 'bg-slate-500',
  Dispatched: 'bg-indigo-600',
  Completed: 'bg-slate-700',
  Cancelled: 'bg-slate-300',
};

const getPortalItemStatus = (order: ClientOrder, item: any) => {
  if (item.status) return item.status;
  if (item.work_order_id) return 'Accepted';
  if (order.status === 'Rejected') return 'Rejected';
  if (order.status === 'Cancelled') return 'Cancelled';
  if (order.status === 'Accepted') return 'Accepted';
  return 'Pending';
};

const getPortalStatusLabel = (status: string) => status === 'Pending' ? 'Waiting For Order Acceptance' : status;

const PortalStatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold leading-none whitespace-nowrap shadow-sm ${STATUS_STYLES[status] || STATUS_STYLES.Pending}`}>
    <span className={`h-1.5 w-1.5 rounded-sm ${STATUS_DOT_STYLES[status] || STATUS_DOT_STYLES.Pending}`} />
    {getPortalStatusLabel(status)}
  </span>
);

const ClientPortal: React.FC<Props> = ({ clientUser, onLogin, onLogout }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [items, setItems] = useState<Item[]>([]);
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [portalTab, setPortalTab] = useState<'orders' | 'place-order'>('orders');
  const [orderSortField, setOrderSortField] = useState<'date' | 'etd' | 'status'>('date');
  const [orderSortAsc, setOrderSortAsc] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  const [lineItems, setLineItems] = useState<OrderLineItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const itemSearchRef = useRef<HTMLDivElement>(null);
  const [placing, setPlacing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(q) || (i.drawing_no || '').toLowerCase().includes(q));
  }, [items, searchQuery]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [filteredItems]);

  const filteredItemOptions = itemSearch
    ? items.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase()))
    : items;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (itemSearchRef.current && !itemSearchRef.current.contains(e.target as Node)) {
        setShowItemDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogin = async () => {
    setLoginError('');
    setLoggingIn(true);
    try {
      const authData = await pb.collection('client_portal_users').authWithPassword(email, password);
      if (!authData.record.is_active) { setLoginError('This account is disabled.'); setLoggingIn(false); return; }
      onLogin(authData.record as unknown as ClientUser);
    } catch {
      setLoginError('Invalid email or password.');
    }
    setLoggingIn(false);
  };

  const handleLogout = () => {
    setLogoutConfirmOpen(true);
  };

  useEffect(() => {
    if (!clientUser) return;
    loadData();
  }, [clientUser]);

  const loadData = async () => {
    if (!clientUser) return;
    setLoading(true);
    const { data: cust } = await supabase.from('customers').select('name').eq('id', clientUser.customer_id).single();
    if (cust) setCustomerName(cust.name);

    const custName = cust?.name || '';
    const [itemsRes, ordersRes] = await Promise.all([
      supabase.from('items').select('*').eq('customer_name', custName).order('name'),
      supabase.from('client_orders').select('*').eq('customer_id', clientUser.customer_id).order('created_at', { ascending: false }),
    ]);
    if (!itemsRes.error && itemsRes.data) setItems(itemsRes.data as Item[]);
    if (!ordersRes.error && ordersRes.data) setOrders(ordersRes.data as ClientOrder[]);
    setLoading(false);
  };

  const createBlankLineItem = (): OrderLineItem => ({
    key: crypto.randomUUID?.() || Math.random().toString(36).substr(2, 9),
    itemId: 0,
    itemName: '',
    drawingNo: '',
    qty: 1,
    etd: '',
  });

  const addLineItem = (item?: Item) => {
    setLineItems(prev => [...prev, item ? {
      key: crypto.randomUUID?.() || Math.random().toString(36).substr(2, 9),
      itemId: item.id,
      itemName: item.name,
      drawingNo: item.drawing_no || '',
      qty: 1,
      etd: '',
    } : createBlankLineItem()]);
  };

  const removeLineItem = (key: string) => {
    if (lineItems.length > 1) setLineItems(prev => prev.filter(li => li.key !== key));
  };

  const selectItemForLine = (key: string, item: Item) => {
    setLineItems(prev => prev.map(li => li.key === key ? { ...li, itemId: item.id, itemName: item.name, drawingNo: item.drawing_no || '' } : li));
    setShowItemDropdown(false);
    setItemSearch('');
  };

  const updateLineQty = (key: string, val: string) => {
    const num = parseInt(val);
    setLineItems(prev => prev.map(li => li.key === key ? { ...li, qty: val === '' ? '' as const : (isNaN(num) ? 1 : num) } : li));
  };

  const updateLineEtd = (key: string, val: string) => {
    setLineItems(prev => prev.map(li => li.key === key ? { ...li, etd: val } : li));
  };

  const placeOrder = () => {
    const validItems = lineItems.filter(li => li.itemName && li.qty);
    if (validItems.length === 0 || !clientUser) return;
    setSubmitError('');
    setReviewOpen(true);
  };

  const confirmPlaceOrder = async () => {
    const validItems = lineItems.filter(li => li.itemName && li.qty);
    if (validItems.length === 0 || !clientUser) return;
    setPlacing(true);
    setSubmitError('');
    const orderItems = validItems.map(li => ({ item_id: li.itemId, item_name: li.itemName, qty: li.qty, drawing_no: li.drawingNo, etd: li.etd || undefined }));
    const { error } = await supabase.from('client_orders').insert([{
      customer_id: clientUser.customer_id,
      customer_name: customerName,
      items: orderItems as any,
      status: 'Pending',
      created_by: clientUser.email,
    }] as any);
    if (!error) {
      setLineItems([]);
      setReviewOpen(false);
      setSuccessMsg(`Order placed successfully with ${validItems.length} item${validItems.length > 1 ? 's' : ''}! We will review it shortly.`);
      setTimeout(() => setSuccessMsg(''), 5000);
      loadData();
    } else {
      setSubmitError('Could not place the order. Please refresh and try again.');
    }
    setPlacing(false);
  };

  if (!clientUser) {
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
              <h1 className="mt-8 text-center text-[28px] font-bold tracking-tight text-[#032d60]">Client Portal Login</h1>
              <p className="mt-2 text-center text-sm font-semibold text-slate-500">Access your packaging orders and work order updates.</p>

              <form onSubmit={e => { e.preventDefault(); handleLogin(); }} className="mt-8 space-y-5">
                {loginError && (
                  <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle size={18} />
                    {loginError}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="client@example.com"
                      className="w-full rounded-md border border-slate-400 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-all focus:border-[#0176d3] focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full rounded-md border border-slate-400 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-900 outline-none transition-all focus:border-[#0176d3] focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loggingIn || !email || !password}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#0176d3] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b5cab] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loggingIn ? <Loader2 className="animate-spin" size={18} /> : <><LogIn size={17} /> Sign In</>}
                </button>
              </form>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-8 py-5 text-center sm:px-10">
              <div className="text-xs font-semibold text-slate-500">Authorized Excell Packaging clients only</div>
            </div>
          </div>
        </section>

        <section className="relative hidden min-h-screen overflow-hidden bg-gradient-to-br from-[#0b2ee8] via-[#123ec5] to-[#0622a8] px-10 py-9 text-white lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.22),transparent_28%),radial-gradient(circle_at_78%_55%,rgba(59,130,246,0.55),transparent_30%)]" />
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:44px_44px]" />

          <div className="relative z-10 max-w-4xl">
            <p className="text-sm font-bold tracking-wide text-blue-100">Client Portal | Excell Packaging</p>
            <h2 className="mt-5 max-w-3xl text-[52px] font-black leading-[1.05] tracking-tight xl:text-[64px]">Manage every packaging order from request to acceptance.</h2>
            <p className="mt-7 max-w-3xl text-xl font-semibold leading-8 text-blue-50/90">Place repeat orders, confirm ETDs, and track ERP work order updates in one secure portal.</p>
          </div>

          <div className="relative z-10 mt-12 h-[430px] max-w-4xl overflow-hidden rounded-[34px] border border-white/20 bg-white/10 shadow-2xl shadow-blue-950/40 backdrop-blur-sm">
            <div className="absolute left-10 top-10 h-24 w-24 rounded-[28px] border border-white/20 bg-white/15 login-animate" style={{ animation: 'loginFloat 5.5s ease-in-out infinite' }}>
              <PackageCheck className="m-7 text-white" size={40} />
            </div>
            <div className="absolute right-12 top-16 h-28 w-28 rounded-full bg-cyan-300/80 blur-sm login-animate" style={{ animation: 'loginPulse 4.5s ease-in-out infinite' }} />
            <div className="absolute left-32 top-36 h-56 w-[38rem] rounded-[999px] bg-gradient-to-r from-cyan-300 via-yellow-300 to-red-400 opacity-90 login-animate" style={{ animation: 'loginDrift 7s ease-in-out infinite alternate' }} />
            <div className="absolute bottom-[-74px] right-[-42px] h-72 w-[42rem] rotate-[-7deg] rounded-[44px] border-[10px] border-white/30 bg-slate-950/80 shadow-2xl">
              <div className="grid h-full grid-cols-3 gap-4 p-8">
                {['Orders', 'ETD', 'ERP WO'].map((label, index) => (
                  <div key={label} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                    <div className="h-3 w-16 rounded-full bg-blue-300" />
                    <div className="mt-5 h-20 rounded-2xl bg-white/15" />
                    <div className="mt-4 text-sm font-black text-white">{label}</div>
                    <div className="mt-2 h-2 rounded-full bg-white/15">
                      <div className="h-2 rounded-full bg-emerald-300" style={{ width: `${58 + index * 15}%` }} />
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
  }

  const validCount = lineItems.filter(li => li.itemName && li.qty).length;
  const validLineItems = lineItems.filter(li => li.itemName && li.qty);
  const handleOrderSort = (field: 'date' | 'etd' | 'status') => {
    if (orderSortField === field) setOrderSortAsc(prev => !prev);
    else {
      setOrderSortField(field);
      setOrderSortAsc(field === 'status');
    }
  };
  const orderSortLabel = (field: 'date' | 'etd' | 'status') => orderSortField === field ? (orderSortAsc ? ' ↑' : ' ↓') : '';
  const orderRows = orders.flatMap(order => (order.items || []).map((item: any, index: number) => ({
    key: `${order.id}-${index}`,
    order,
    item,
    status: getPortalItemStatus(order, item),
  }))).sort((a, b) => {
    let cmp = 0;
    if (orderSortField === 'date') cmp = new Date(a.order.created_at).getTime() - new Date(b.order.created_at).getTime();
    else if (orderSortField === 'etd') cmp = (a.item.etd || '').localeCompare(b.item.etd || '');
    else cmp = getPortalStatusLabel(a.status).localeCompare(getPortalStatusLabel(b.status));
    return orderSortAsc ? cmp : -cmp;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-sky-700 text-white px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 justify-between sticky top-0 z-30 shadow-lg shadow-sky-200/60">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/15 text-white flex items-center justify-center"><Box size={20} /></div>
          <div>
            <h1 className="text-sm font-black text-white">{customerName}</h1>
            <p className="text-[10px] text-sky-100 font-semibold">Excell Packaging — Client Portal</p>
          </div>
        </div>
        <nav className="order-3 sm:order-2 w-full sm:w-auto flex gap-1.5 rounded-2xl bg-white/12 border border-white/20 p-1">
          <button onClick={() => setPortalTab('orders')} className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-black transition-colors ${portalTab === 'orders' ? 'bg-white text-sky-700 shadow-sm' : 'text-sky-50 hover:bg-white/10'}`}>Orders</button>
          <button onClick={() => setPortalTab('place-order')} className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-black transition-colors ${portalTab === 'place-order' ? 'bg-white text-sky-700 shadow-sm' : 'text-sky-50 hover:bg-white/10'}`}>Place Order</button>
        </nav>
        <button onClick={handleLogout} className="order-2 sm:order-3 px-3 py-2 rounded-xl bg-white/15 text-white text-xs font-bold hover:bg-white/25 transition-colors flex items-center gap-1.5"><X size={14} /> Logout</button>
      </header>

      <div className="w-full p-4 sm:p-6 space-y-6">
        {successMsg && (
          <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold flex items-center gap-2 shadow-sm animate-in slide-in-from-top-2 duration-300">
            <CheckCircle size={16} /> {successMsg}
          </div>
        )}
        {submitError && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-center gap-2 shadow-sm">
            <XCircle size={16} /> {submitError}
          </div>
        )}

        {portalTab === 'orders' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[calc(100vh-150px)]">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-2"><PackageCheck size={16} /> Orders</h2>
              <button onClick={loadData} className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors"><RefreshCw size={14} /></button>
            </div>
            {loading ? (
              <div className="p-8 text-center text-sm font-bold text-slate-500 flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading...</div>
            ) : orderRows.length === 0 ? (
              <div className="p-8 text-center text-sm font-bold text-slate-400">No orders yet.</div>
            ) : (
              <div className="overflow-auto max-h-[calc(100vh-230px)]">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 sm:px-6 py-3.5">ERP Order</th>
                      <th className="px-4 sm:px-6 py-3.5 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => handleOrderSort('date')}>Date{orderSortLabel('date')}</th>
                      <th className="px-4 sm:px-6 py-3.5">Sent By</th>
                      <th className="px-4 sm:px-6 py-3.5">Item</th>
                      <th className="px-4 sm:px-6 py-3.5 text-center">Qty</th>
                      <th className="px-4 sm:px-6 py-3.5 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => handleOrderSort('etd')}>ETD{orderSortLabel('etd')}</th>
                      <th className="px-4 sm:px-6 py-3.5 cursor-pointer select-none hover:bg-slate-100 transition-colors" onClick={() => handleOrderSort('status')}>Status{orderSortLabel('status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orderRows.map(row => {
                      return (
                        <tr key={row.key} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 sm:px-6 py-3 font-black text-indigo-600">{row.item.work_order_id ? `#${row.item.work_order_id}` : '-'}</td>
                          <td className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">{new Date(row.order.created_at).toLocaleString('en-GB')}</td>
                          <td className="px-4 sm:px-6 py-3 text-xs text-slate-500 truncate max-w-[140px]" title={row.order.created_by || ''}>{row.order.created_by || '—'}</td>
                          <td className="px-4 sm:px-6 py-3 font-bold text-slate-800">{row.item.item_name}</td>
                          <td className="px-4 sm:px-6 py-3 text-center font-black text-slate-700">{row.item.qty}</td>
                          <td className="px-4 sm:px-6 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">{row.item.etd || '-'}</td>
                          <td className="px-4 sm:px-6 py-3"><PortalStatusBadge status={row.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="grid xl:grid-cols-2 gap-6 items-start min-h-[calc(100vh-150px)]">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[calc(100vh-150px)]">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
                <h2 className="text-sm font-black text-slate-800 flex items-center gap-2"><Box size={16} /> Our Products</h2>
                <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search products..." className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-sky-500 transition-all" />
                </div>
              </div>
              {loading ? (
                <div className="p-8 text-center text-sm font-bold text-slate-500 flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading...</div>
              ) : sortedItems.length === 0 ? (
                <div className="p-8 text-center text-sm font-bold text-slate-500">No products available for your company.</div>
              ) : (
                <div className="overflow-auto max-h-[calc(100vh-230px)]">
                  <table className="w-full min-w-[360px] text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 sm:px-6 py-3.5">Item Name</th>
                        <th className="px-4 sm:px-6 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedItems.map(item => (
                        <tr key={item.id} className="hover:bg-sky-50/40 transition-colors">
                          <td className="px-4 sm:px-6 py-3 font-bold text-slate-800">{item.name}</td>
                          <td className="px-4 sm:px-6 py-3 text-right">
                            <button onClick={() => addLineItem(item)} className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 text-[10px] font-bold hover:bg-sky-100 hover:text-sky-800 transition-colors active:scale-95 flex items-center gap-1 ml-auto">
                              <Plus size={12} /> Add
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[calc(100vh-150px)] flex flex-col">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-800 flex items-center gap-2"><ShoppingCart size={16} /> New Order</h2>
                {lineItems.length > 0 && <button onClick={() => setLineItems([])} className="text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors">Clear All</button>}
              </div>
              <div className="overflow-auto max-h-[calc(100vh-290px)] flex-1">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 sm:px-6 py-3.5">Item Name</th>
                      <th className="px-4 sm:px-6 py-3.5 w-24">Qty</th>
                      <th className="px-4 sm:px-6 py-3.5 w-40">ETD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineItems.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 sm:px-6 py-8 text-center text-sm font-bold text-slate-400">Add products from the table to start a new order.</td></tr>
                    ) : lineItems.map(li => (
                      <tr key={li.key} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 sm:px-6 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            {li.itemName ? (
                              <span className="font-bold text-slate-800 text-sm">{li.itemName}</span>
                            ) : (
                              <div className="relative flex-1" ref={itemSearchRef}>
                                <input value={itemSearch} onChange={e => { setItemSearch(e.target.value); setShowItemDropdown(true); }} onFocus={() => setShowItemDropdown(true)} placeholder="Search product..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-sky-500" />
                                {showItemDropdown && filteredItemOptions.length > 0 && (
                                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                    {filteredItemOptions.map(opt => (
                                      <button key={opt.id} type="button" onClick={() => selectItemForLine(li.key, opt)} className="w-full text-left px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors border-b border-slate-50 last:border-b-0">{opt.name}</button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            <button onClick={() => removeLineItem(li.key)} disabled={lineItems.length === 1} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><X size={14} /></button>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-2.5"><input type="number" min="1" value={li.qty} onChange={e => updateLineQty(li.key, e.target.value)} className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center outline-none focus:ring-2 focus:ring-sky-500" /></td>
                        <td className="px-4 sm:px-6 py-2.5"><input type="date" value={li.etd} onChange={e => updateLineEtd(li.key, e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-sky-500" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 sm:px-6 py-3 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button onClick={() => addLineItem()} className="px-4 py-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 text-[11px] font-bold hover:border-sky-300 hover:text-sky-600 hover:bg-sky-50 transition-colors flex items-center justify-center gap-1.5"><Plus size={14} /> Add Another Item</button>
                <button onClick={placeOrder} disabled={placing || validCount === 0} className="sm:ml-auto px-6 py-2.5 bg-sky-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black hover:bg-sky-800 transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2">
                  {placing ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {placing ? 'Placing...' : `Place Order (${validCount})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {reviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center"><ClipboardCheck size={20} /></div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Review Order</h3>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">Confirm products, quantity, and ETD for {customerName}.</p>
                </div>
              </div>
              <button onClick={() => setReviewOpen(false)} disabled={placing} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"><X size={16} /></button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[55vh] space-y-3">
              {validLineItems.map(li => (
                <div key={li.key} className="rounded-2xl border border-slate-200 p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h4 className="font-black text-slate-800 text-sm truncate">{li.itemName}</h4>
                    <p className="text-[10px] font-mono text-slate-400 mt-1">Drawing: {li.drawingNo || '-'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-slate-800">Qty {li.qty}</p>
                    <p className="text-[10px] font-semibold text-slate-500 mt-1">ETD: {li.etd || 'Not specified'}</p>
                  </div>
                </div>
              ))}
            </div>
            {submitError && <div className="mx-5 mb-3 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2"><XCircle size={14} /> {submitError}</div>}
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button onClick={() => setReviewOpen(false)} disabled={placing} className="px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-black hover:bg-slate-100 transition-colors disabled:opacity-50">Edit Order</button>
              <button onClick={confirmPlaceOrder} disabled={placing || validLineItems.length === 0} className="px-5 py-3 rounded-xl bg-sky-700 text-white text-sm font-black hover:bg-sky-800 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {placing ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />}
                {placing ? 'Submitting...' : `Submit ${validLineItems.length} Item${validLineItems.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">Logout?</h3>
              <p className="text-sm font-semibold text-slate-500 mt-1">Are you sure you want to logout from the client portal?</p>
            </div>
            <div className="px-5 py-4 bg-slate-50 flex gap-2 justify-end">
              <button onClick={() => setLogoutConfirmOpen(false)} className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-black hover:bg-slate-100 transition-colors">Cancel</button>
              <button onClick={onLogout} className="px-4 py-2.5 rounded-xl bg-sky-700 text-white text-sm font-black hover:bg-sky-800 transition-colors">Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientPortal;

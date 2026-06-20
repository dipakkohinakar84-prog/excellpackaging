import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './pocketbase';
import { Item, ClientUser, ClientOrder } from './types';
import { LogIn, Package, ShoppingCart, CheckCircle, XCircle, Clock, ArrowLeft, Plus, Minus, Send, LogOut } from 'lucide-react';

interface Props {
  clientUser?: ClientUser | null;
  onLogin: (user: ClientUser) => void;
  onLogout: () => void;
}

const ClientPortal: React.FC<Props> = ({ clientUser, onLogin, onLogout }) => {
  const [portalId, setPortalId] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [cart, setCart] = useState<{ item: Item; qty: number }[]>([]);
  const [placing, setPlacing] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!clientUser) return;
    loadData();
  }, [clientUser]);

  const loadData = async () => {
    if (!clientUser) return;
    const { data: cust } = await supabase.from('customers').select('name').eq('id', clientUser.customer_id).single();
    if (cust) setCustomerName(cust.name);

    const [itemsRes, ordersRes] = await Promise.all([
      supabase.from('items').select('*').eq('customer_name', cust?.name || '').order('name'),
      supabase.from('client_orders').select('*').eq('customer_id', clientUser.customer_id).order('created_at', { ascending: false }),
    ]);
    if (!itemsRes.error && itemsRes.data) setItems(itemsRes.data as Item[]);
    if (!ordersRes.error && ordersRes.data) setOrders(ordersRes.data as ClientOrder[]);
  };

  const handleLogin = async () => {
    setLoginError('');
    const { data, error } = await supabase.from('client_users').select('*, customers!inner(name)').eq('portal_id', portalId).single();
    if (error || !data) { setLoginError('Invalid portal ID or password.'); return; }
    if (data.portal_password !== password) { setLoginError('Invalid portal ID or password.'); return; }
    if (!data.is_active) { setLoginError('This account is disabled.'); return; }
    onLogin(data as unknown as ClientUser);
  };

  const addToCart = (item: Item) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { item, qty: 1 }];
    });
  };

  const updateCartQty = (itemId: number, delta: number) => {
    setCart(prev => prev.map(c => c.item.id === itemId ? { ...c, qty: Math.max(1, c.qty + delta) } : c));
  };

  const removeFromCart = (itemId: number) => {
    setCart(prev => prev.filter(c => c.item.id !== itemId));
  };

  const placeOrder = async () => {
    if (cart.length === 0 || !clientUser) return;
    setPlacing(true);
    const orderItems = cart.map(c => ({ item_id: c.item.id, item_name: c.item.name, qty: c.qty, drawing_no: c.item.drawing_no }));
    const { error } = await supabase.from('client_orders').insert([{
      customer_id: clientUser.customer_id,
      customer_name: customerName,
      items: orderItems as any,
      status: 'Pending',
      created_by: portalId,
    }] as any);
    if (!error) {
      setCart([]);
      setSuccessMsg('Order placed successfully! We will review it shortly.');
      setTimeout(() => setSuccessMsg(''), 5000);
      loadData();
    }
    setPlacing(false);
  };

  if (!clientUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full">
          <div className="text-center mb-6">
            <Package size={40} className="text-blue-600 mx-auto mb-2" />
            <h1 className="text-xl font-black text-gray-800">Client Portal</h1>
            <p className="text-sm text-gray-400 mt-1">Sign in to place your orders</p>
          </div>
          {loginError && <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-semibold">{loginError}</div>}
          <div className="space-y-3">
            <input value={portalId} onChange={e => setPortalId(e.target.value)} placeholder="Portal ID" className="w-full px-4 py-3 border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full px-4 py-3 border rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={handleLogin} className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
              <LogIn size={18}/> SIGN IN
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalQty = cart.reduce((sum, c) => sum + c.qty, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Package size={20} className="text-blue-600" />
          <div>
            <h1 className="text-sm font-black text-gray-800">{customerName}</h1>
            <p className="text-[10px] text-gray-400 font-semibold">Client Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <button onClick={placeOrder} disabled={placing} className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-black hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50">
              <Send size={14}/> {placing ? 'Placing...' : `Place Order (${totalQty})`}
            </button>
          )}
          <button onClick={onLogout} className="px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200"><LogOut size={14}/></button>
        </div>
      </header>

      {successMsg && (
        <div className="mx-4 mt-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-semibold flex items-center gap-2">
          <CheckCircle size={16}/> {successMsg}
        </div>
      )}

      <div className="max-w-6xl mx-auto p-4 grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-black text-gray-700 flex items-center gap-2"><Package size={16}/> Our Products</h2>
          {items.length === 0 ? (
            <div className="text-center py-10 text-sm font-semibold text-gray-400">No products available for your company.</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {items.map(item => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm">
                  <h3 className="font-bold text-gray-800 text-sm mb-1">{item.name}</h3>
                  <p className="text-[10px] text-gray-400 font-medium mb-2">Drawing: {item.drawing_no || 'N/A'}</p>
                  {item.remarks && <p className="text-[10px] text-gray-500 mb-2 line-clamp-2">{item.remarks}</p>}
                  <button onClick={() => addToCart(item)} className="w-full py-2 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5">
                    <Plus size={14}/> Add to Order
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-black text-gray-700 flex items-center gap-2"><ShoppingCart size={16}/> Cart ({cart.length})</h2>
          {cart.length === 0 ? (
            <div className="text-center py-8 text-sm font-semibold text-gray-400 bg-white rounded-xl border border-gray-200">Cart is empty</div>
          ) : (
            <div className="space-y-2">
              {cart.map(c => (
                <div key={c.item.id} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-gray-800 truncate">{c.item.name}</span>
                    <button onClick={() => removeFromCart(c.item.id)} className="text-red-400 hover:text-red-600"><XCircle size={14}/></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateCartQty(c.item.id, -1)} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200"><Minus size={12}/></button>
                    <span className="text-sm font-black text-gray-800 w-6 text-center">{c.qty}</span>
                    <button onClick={() => updateCartQty(c.item.id, 1)} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200"><Plus size={12}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 className="text-sm font-black text-gray-700 flex items-center gap-2 mt-4"><Clock size={16}/> Order History</h2>
          {orders.length === 0 ? (
            <div className="text-center py-6 text-sm font-semibold text-gray-400 bg-white rounded-xl border border-gray-200">No orders yet</div>
          ) : (
            <div className="space-y-2">
              {orders.map(o => (
                <div key={o.id} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-800">Order #{o.id}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="text-[10px] text-gray-500">{o.items.length} item(s) · {new Date(o.created_at).toLocaleDateString('en-GB')}</p>
                  {o.status === 'Rejected' && o.rejection_reason && (
                    <p className="text-[10px] text-red-500 mt-1">Reason: {o.rejection_reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    Pending: 'bg-yellow-100 text-yellow-700',
    Accepted: 'bg-green-100 text-green-700',
    Rejected: 'bg-red-100 text-red-700',
    Completed: 'bg-blue-100 text-blue-700',
    Cancelled: 'bg-gray-100 text-gray-600',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${styles[status] || styles.Pending}`}>{status}</span>;
};

export default ClientPortal;

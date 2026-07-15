import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './pocketbase';
import { Expense, User, Party } from './types';
import { Plus, CheckCircle2, XCircle, AlertCircle, Search, Loader2, X } from 'lucide-react';

const categoryColors: Record<string, string> = {
  'Excell Packaging': 'bg-blue-100 text-blue-700',
  'Shree Enterprises': 'bg-purple-100 text-purple-700',
  Personal: 'bg-green-100 text-green-700',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

const CATEGORIES = ['Excell Packaging', 'Shree Enterprises', 'Personal'] as const;

interface Props {
  loggedInUser: User;
  onError: () => void;
}

const ExpensesView: React.FC<Props> = ({ loggedInUser, onError }) => {
  const canAdd = loggedInUser.can_access_expenses;
  const canApprove = loggedInUser.can_access_expense_approval;
  const [myExpenses, setMyExpenses] = useState<Expense[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('created');
  const [sortAsc, setSortAsc] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [category, setCategory] = useState<string>('Excell Packaging');
  const [partyName, setPartyName] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<Expense | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const [parties, setParties] = useState<Party[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);
  const partyContactMap = useMemo(() => Object.fromEntries(parties.filter(p => p.contact).map(p => [p.name, p.contact])), [parties]);

  const fetchParties = async () => {
    const { data } = await supabase.from('parties').select('*').order('name');
    if (data) setParties(data);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (canAdd || canApprove) {
        let query = supabase.from('expenses').select('*');
        if (canAdd) query = query.eq('added_by_name', loggedInUser.username);
        const { data } = await query.order('created', { ascending: false });
        if (data) setMyExpenses(data);
      }
      if (canApprove) {
        const { data } = await supabase.from('expenses')
          .select('*')
          .eq('status', 'pending')
          .order('created', { ascending: false });
        if (data) setPendingExpenses(data);
      }
      await fetchParties();
    } catch { onError(); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const resetAddForm = () => {
    setCategory('Excell Packaging');
    setPartyName('');
    setAmount('');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName.trim()) { alert('Please enter a party name.'); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { alert('Please enter a valid amount.'); return; }
    setIsSubmitting(true);

    const isPersonal = category === 'Personal';
    const now = new Date().toISOString();

    const payload: Record<string, any> = {
      category,
      party_name: partyName.trim(),
      amount: amt,
      notes: notes.trim(),
      added_by_name: loggedInUser.username,
      status: isPersonal ? 'approved' : 'pending',
    };

    if (isPersonal) {
      payload.approved_by_name = 'Auto-Approved';
      payload.approved_at = now;
    }

    const { error } = await supabase.from('expenses').insert([payload]);
    if (error) {
      alert(error.message);
    } else {
      resetAddForm();
      setShowAddModal(false);
      fetchData();
    }
    setIsSubmitting(false);
  };

  const handleApprove = async (expense: Expense) => {
    const { error } = await supabase.from('expenses')
      .update({
        status: 'approved',
        approved_by_name: loggedInUser.username,
        approved_at: new Date().toISOString(),
      })
      .eq('id', expense.id);
    if (error) alert(error.message);
    else fetchData();
  };

  const openRejectModal = (expense: Expense) => {
    setRejectTarget(expense);
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) { alert('Please enter a reason for rejection.'); return; }
    setIsRejecting(true);
    const { error } = await supabase.from('expenses')
      .update({
        status: 'rejected',
        approved_by_name: loggedInUser.username,
        approved_at: new Date().toISOString(),
        reject_reason: rejectReason.trim(),
      })
      .eq('id', rejectTarget.id);
    if (error) alert(error.message);
    else {
      setRejectTarget(null);
      setRejectReason('');
      fetchData();
    }
    setIsRejecting(false);
  };

  const filteredParties = partyName
    ? parties.filter(p => p.name.toLowerCase().includes(partyName.toLowerCase()))
    : [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredMyExpenses = myExpenses.filter(e =>
    e.party_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortData = (data: Expense[]) => {
    return [...data].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'amount': cmp = (a.amount || 0) - (b.amount || 0); break;
        case 'category': cmp = (a.category || '').localeCompare(b.category || ''); break;
        case 'party_name': cmp = (a.party_name || '').localeCompare(b.party_name || ''); break;
        case 'status': cmp = (a.status || '').localeCompare(b.status || ''); break;
        case 'added_by_name': cmp = (a.added_by_name || '').localeCompare(b.added_by_name || ''); break;
        case 'created':
        default: cmp = (a.created || '').localeCompare(b.created || ''); break;
      }
      return sortAsc ? cmp : -cmp;
    });
  };

  const sortedMyExpenses = sortData(filteredMyExpenses);
  const sortedPendingExpenses = sortData(pendingExpenses);

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <span className="ml-1 text-gray-300">⇅</span>;
    return <span className="ml-1 text-blue-600">{sortAsc ? '\u2191' : '\u2193'}</span>;
  };

  const formatDate = (d: string | undefined) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {canApprove && sortedPendingExpenses.length > 0 && (
        <div className="rounded-2xl border border-orange-100 bg-white shadow-sm flex flex-col max-h-[calc(100dvh-14rem)]">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-2 bg-white flex-shrink-0">
            <AlertCircle size={16} className="text-orange-500" />
            <h3 className="text-sm font-black uppercase tracking-widest text-orange-600">
              Approvals Required ({sortedPendingExpenses.length})
            </h3>
          </div>

          <div className="overflow-y-auto min-h-0 flex-1">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-orange-50 text-[10px] font-black uppercase text-gray-500 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-orange-100" onClick={() => handleSort('created')}>Date<SortIcon field="created" /></th>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-orange-100" onClick={() => handleSort('added_by_name')}>Added By<SortIcon field="added_by_name" /></th>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-orange-100" onClick={() => handleSort('category')}>Category<SortIcon field="category" /></th>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-orange-100" onClick={() => handleSort('party_name')}>Party<SortIcon field="party_name" /></th>
                  <th className="px-4 py-3 text-right cursor-pointer select-none hover:bg-orange-100" onClick={() => handleSort('amount')}>Amount<SortIcon field="amount" /></th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedPendingExpenses.map(exp => (
                  <tr key={exp.pb_id || exp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">{formatDate(exp.created)}</td>
                    <td className="px-4 py-3 font-semibold">{exp.added_by_name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${categoryColors[exp.category] || 'bg-gray-100 text-gray-700'}`}>{exp.category}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {exp.party_name}
                      {partyContactMap[exp.party_name] && <span className="text-xs text-indigo-600 font-bold ml-2">{partyContactMap[exp.party_name]}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">₹{formatCurrency(exp.amount)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[150px] truncate">{exp.notes || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleApprove(exp)}
                          className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                          title="Approve"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <button
                          onClick={() => openRejectModal(exp)}
                          className="p-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                          title="Reject"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2 p-3">
            {pendingExpenses.map(exp => (
              <div key={exp.pb_id || exp.id} className="rounded-xl border border-orange-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold text-gray-500">{formatDate(exp.created)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${categoryColors[exp.category] || 'bg-gray-100 text-gray-700'}`}>{exp.category}</span>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500">by {exp.added_by_name || '-'}</span>
                </div>
                <div className="mt-1.5 font-semibold text-gray-800 text-sm">
                  {exp.party_name}
                  {partyContactMap[exp.party_name] && <span className="text-xs text-indigo-600 font-bold ml-2">{partyContactMap[exp.party_name]}</span>}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-lg font-black">₹{formatCurrency(exp.amount)}</span>
                  {exp.notes && <span className="text-xs text-gray-400 truncate max-w-[140px]">{exp.notes}</span>}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(exp)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-100 text-green-700 rounded-xl text-xs font-bold hover:bg-green-200 transition-colors active:scale-95"
                  >
                    <CheckCircle2 size={16} /> Approve
                  </button>
                  <button
                    onClick={() => openRejectModal(exp)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-100 text-red-700 rounded-xl text-xs font-bold hover:bg-red-200 transition-colors active:scale-95"
                  >
                    <XCircle size={16} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>
      )}

      {(canAdd || canApprove) && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm flex flex-col max-h-[calc(100dvh-14rem)]">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap bg-white flex-shrink-0">
            <div className="relative flex-1 min-w-[150px]">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border rounded-xl text-sm outline-none"
              />
            </div>
            {canAdd && (
              <>
              <button
                onClick={() => { resetAddForm(); setShowAddModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-blue-700 transition-all active:scale-95 whitespace-nowrap"
              >
                <Plus size={16} /> Add
              </button>
              <button
                onClick={() => { (window as any)._setView?.('parties'); }}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                Parties
              </button>
              </>
            )}
          </div>

          <div className="overflow-y-auto min-h-0 flex-1">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200" onClick={() => handleSort('created')}>Date<SortIcon field="created" /></th>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200" onClick={() => handleSort('category')}>Category<SortIcon field="category" /></th>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200" onClick={() => handleSort('party_name')}>Party<SortIcon field="party_name" /></th>
                  <th className="px-4 py-3 text-right cursor-pointer select-none hover:bg-gray-200" onClick={() => handleSort('amount')}>Amount<SortIcon field="amount" /></th>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200" onClick={() => handleSort('status')}>Status<SortIcon field="status" /></th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Approved By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedMyExpenses.map(exp => (
                  <tr key={exp.pb_id || exp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">{formatDate(exp.created)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${categoryColors[exp.category] || 'bg-gray-100 text-gray-700'}`}>{exp.category}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {exp.party_name}
                      {partyContactMap[exp.party_name] && <span className="text-xs text-indigo-600 font-bold ml-2">{partyContactMap[exp.party_name]}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">₹{formatCurrency(exp.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[exp.status] || 'bg-gray-100 text-gray-700'}`}>
                        {statusLabels[exp.status] || exp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[150px] truncate">{exp.notes || '-'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-600">{exp.approved_by_name || '-'}</td>
                  </tr>
                ))}
                {filteredMyExpenses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500 italic font-semibold text-sm">No expenses found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2 p-3">
            {sortedMyExpenses.length === 0 && (
              <div className="py-8 text-center text-gray-500 italic font-semibold text-sm">No expenses found.</div>
            )}
            {sortedMyExpenses.map(exp => (
              <div key={exp.pb_id || exp.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold text-gray-500">{formatDate(exp.created)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${categoryColors[exp.category] || 'bg-gray-100 text-gray-700'}`}>{exp.category}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${statusColors[exp.status] || 'bg-gray-100 text-gray-700'}`}>
                    {statusLabels[exp.status] || exp.status}
                  </span>
                </div>
                <div className="mt-1.5 font-semibold text-gray-800 text-sm">
                  {exp.party_name}
                  {partyContactMap[exp.party_name] && <span className="text-xs text-indigo-600 font-bold ml-2">{partyContactMap[exp.party_name]}</span>}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-lg font-black">₹{formatCurrency(exp.amount)}</span>
                  {exp.notes && <span className="text-xs text-gray-400 truncate max-w-[140px]">{exp.notes}</span>}
                </div>
                {exp.approved_by_name && exp.approved_by_name !== 'Auto-Approved' && (
                  <div className="mt-1 text-[10px] font-semibold text-gray-500">Approved by: {exp.approved_by_name}</div>
                )}
                {exp.status === 'rejected' && exp.reject_reason && (
                  <div className="mt-1 text-[10px] font-semibold text-red-500">Reason: {exp.reject_reason}</div>
                )}
              </div>
            ))}
          </div>
          </div>
        </div>
      )}

      {canAdd && (
        <button
          onClick={() => { resetAddForm(); setShowAddModal(true); }}
          className="lg:hidden fixed bottom-20 right-4 z-50 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all"
        >
          <Plus size={24} />
        </button>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { if (!isSubmitting) setShowAddModal(false); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] sm:max-h-[90vh]">
            <div className="px-4 sm:px-6 py-4 border-b flex justify-between items-center gap-3 bg-gray-50/50 flex-shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-800">Add Expense</h3>
              <button
                onClick={() => { if (!isSubmitting) setShowAddModal(false); }}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500">Category</label>
                  <select
                    required
                    disabled={isSubmitting}
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm disabled:opacity-60"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="relative" ref={suggestRef}>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500">Party Name</label>
                  <input
                    required
                    disabled={isSubmitting}
                    placeholder="Type to search or enter new..."
                    autoComplete="off"
                    value={partyName}
                    onFocus={() => { if (filteredParties.length > 0) setShowSuggestions(true); }}
                    onChange={e => { setPartyName(e.target.value); setShowSuggestions(e.target.value.length > 0); }}
                    className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm disabled:opacity-60"
                  />
                  {showSuggestions && filteredParties.length > 0 && (
                    <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {filteredParties.map(p => (
                        <button
                          key={p.pb_id || p.id}
                          type="button"
                          onClick={() => { setPartyName(p.name); setShowSuggestions(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-b border-gray-50 last:border-b-0 flex items-center justify-between"
                        >
                          <span>{p.name}</span>
                          {p.contact && <span className="text-[10px] text-gray-400 font-normal">{p.contact}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {partyName && filteredParties.length === 0 && !isSubmitting && (
                    <p className="mt-1 text-[10px] text-gray-400 font-semibold">New party — will be saved automatically on submit.</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500">Amount (₹)</label>
                  <input
                    required
                    disabled={isSubmitting}
                    type="number"
                    min="1"
                    placeholder="0"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500">Notes <span className="text-gray-400">(optional)</span></label>
                  <textarea
                    disabled={isSubmitting}
                    placeholder="Any remarks..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm disabled:opacity-60 resize-none"
                    rows={2}
                  />
                </div>
                {category === 'Personal' && (
                  <p className="text-xs font-semibold text-green-600 flex items-center gap-1">
                    <CheckCircle2 size={14} /> Auto-approved on submission.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm shadow-lg hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  {category === 'Personal' ? 'Submit (Auto-Approved)' : 'Submit for Approval'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { if (!isRejecting) { setRejectTarget(null); setRejectReason(''); } }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-4 sm:px-6 py-4 border-b flex justify-between items-center gap-3 bg-gray-50/50">
              <h3 className="text-base sm:text-lg font-bold text-gray-800">Reject Expense</h3>
              <button
                onClick={() => { if (!isRejecting) { setRejectTarget(null); setRejectReason(''); } }}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Rejecting expense for <span className="font-bold">{rejectTarget.party_name}</span> — ₹{formatCurrency(rejectTarget.amount)}
              </p>
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500">Reason for Rejection</label>
                <textarea
                  required
                  disabled={isRejecting}
                  placeholder="Enter reason..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm disabled:opacity-60 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                  disabled={isRejecting}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={isRejecting}
                  className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isRejecting && <Loader2 size={16} className="animate-spin" />}
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ExpensesView;

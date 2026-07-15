import React, { useState, useEffect } from 'react';
import { supabase } from './pocketbase';
import { Party } from './types';
import { Plus, Search, Loader2, X, Trash2, Phone, IndianRupee } from 'lucide-react';

interface Props {
  onError: () => void;
}

const PartiesView: React.FC<Props> = ({ onError }) => {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContact, setNewContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchParties = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('parties').select('*').order('name');
      if (data) setParties(data);
    } catch { onError(); }
    setLoading(false);
  };

  useEffect(() => { fetchParties(); }, []);

  const handleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const sortData = (data: Party[]) => {
    return [...data].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = (a.name || '').localeCompare(b.name || '');
      else if (sortField === 'contact') cmp = (a.contact || '').localeCompare(b.contact || '');
      return sortAsc ? cmp : -cmp;
    });
  };

  const filteredParties = sortData(parties.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.contact || '').includes(searchQuery)
  ));

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <span className="ml-1 text-gray-300">⇅</span>;
    return <span className="ml-1 text-blue-600">{sortAsc ? '\u2191' : '\u2193'}</span>;
  };

  const handleAdd = async () => {
    if (!newName.trim()) { alert('Enter a party name.'); return; }
    setIsSubmitting(true);
    const { error } = await supabase.from('parties').insert([{ name: newName.trim(), contact: newContact.trim() }]);
    if (error) { alert(error.message); setIsSubmitting(false); return; }
    setNewName('');
    setNewContact('');
    setShowAddModal(false);
    setIsSubmitting(false);
    await fetchParties();
  };

  const handleDelete = async (party: Party) => {
    if (!confirm(`Delete "${party.name}"?`)) return;
    const { error } = await supabase.from('parties').delete().eq('id', party.id);
    if (error) { alert(error.message); return; }
    await fetchParties();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm flex flex-col max-h-[calc(100dvh-10rem)]">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-3 bg-white flex-shrink-0 flex-wrap">
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              placeholder="Search parties..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border rounded-xl text-sm outline-none"
            />
          </div>
          <button
            onClick={() => (window as any)._setView?.('expenses')}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-xs whitespace-nowrap hover:bg-indigo-100 transition-all active:scale-95"
          >
            <IndianRupee size={14} /> Expenses
          </button>
          <button
            onClick={() => { setNewName(''); setNewContact(''); setShowAddModal(true); }}
            className="hidden lg:flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-blue-700 transition-all active:scale-95"
          >
            <Plus size={16} /> Add Party
          </button>
        </div>

        <div className="overflow-y-auto min-h-0 flex-1">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200" onClick={() => handleSort('name')}>Name<SortIcon field="name" /></th>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200" onClick={() => handleSort('contact')}>Contact<SortIcon field="contact" /></th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredParties.map(p => (
                  <tr key={p.pb_id || p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {p.contact ? <span className="flex items-center gap-1"><Phone size={13} /> {p.contact}</span> : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredParties.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-gray-500 italic font-semibold text-sm">No parties found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2 p-3">
            {filteredParties.length === 0 && (
              <div className="py-8 text-center text-gray-500 italic font-semibold text-sm">No parties found.</div>
            )}
            {filteredParties.map(p => (
              <div key={p.pb_id || p.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800">{p.name}</p>
                  {p.contact && <p className="text-xs font-semibold text-gray-500 flex items-center gap-1 mt-0.5"><Phone size={12} /> {p.contact}</p>}
                </div>
                <button onClick={() => handleDelete(p)} className="p-2.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { if (!isSubmitting) setShowAddModal(false); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-4 sm:px-6 py-4 border-b flex justify-between items-center gap-3 bg-gray-50/50">
              <h3 className="text-base sm:text-lg font-bold text-gray-800">Add Party</h3>
              <button onClick={() => { if (!isSubmitting) setShowAddModal(false); }} className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-5">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500">Party Name</label>
                <input
                  required
                  disabled={isSubmitting}
                  placeholder="Enter party name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm disabled:opacity-60"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-500">Contact <span className="text-gray-400">(optional)</span></label>
                <input
                  disabled={isSubmitting}
                  placeholder="Phone number"
                  value={newContact}
                  onChange={e => setNewContact(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm disabled:opacity-60"
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={isSubmitting}
                className="w-full py-4 bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm shadow-lg hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                Add Party
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => { setNewName(''); setNewContact(''); setShowAddModal(true); }}
        className="lg:hidden fixed bottom-20 right-4 z-50 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all"
      >
        <Plus size={24} />
      </button>
    </>
  );
};

export default PartiesView;

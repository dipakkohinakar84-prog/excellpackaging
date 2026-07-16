import React, { useState, useEffect } from 'react';
import { supabase } from './pocketbase';
import { Expense, Party } from './types';
import { FileText, Search, Loader2, CalendarDays, IndianRupee, X, ChevronDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CATEGORIES = ['Excell Packaging', 'Shree Enterprises', 'Personal'] as const;
const STATUSES = ['pending', 'approved', 'rejected'] as const;

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const categoryColors: Record<string, string> = {
  'Excell Packaging': 'bg-blue-100 text-blue-700',
  'Shree Enterprises': 'bg-purple-100 text-purple-700',
  Personal: 'bg-green-100 text-green-700',
};

const datePresets = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
  { key: 'all', label: 'All' },
] as const;

const getDateRangeFromPreset = (preset: string): [Date, Date] => {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let start: Date;
  switch (preset) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case '7d':
      start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case '30d':
      start = new Date(end);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      break;
    case '90d':
      start = new Date(end);
      start.setDate(start.getDate() - 89);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      start = new Date(2000, 0, 1);
      break;
  }
  return [start, end];
};

const formatDate = (d: string | undefined) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const formatDateFilename = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
};

const ExpenseReportView: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);

  const [datePreset, setDatePreset] = useState<string>('30d');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedParties, setSelectedParties] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(CATEGORIES));
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(['approved', 'pending', 'rejected']));
  const [searchQuery, setSearchQuery] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [sortField, setSortField] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [{ data: expData }, { data: partyData }] = await Promise.all([
          supabase.from('expenses').select('*').order('created', { ascending: false }),
          supabase.from('parties').select('*').order('name'),
        ]);
        if (expData) setExpenses(expData);
        if (partyData) setParties(partyData);
      } catch {}
      setLoading(false);
    };
    fetchData();
  }, []);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const toggleStatus = (s: string) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const toggleParty = (name: string) => {
    setSelectedParties(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const filteredExpenses = expenses.filter(exp => {
    const expenseDateStr = (exp as any).date || exp.created || '';
    const expenseDate = expenseDateStr ? new Date(expenseDateStr) : null;

    if (selectedCategories.size > 0 && !selectedCategories.has(exp.category)) return false;
    if (selectedStatuses.size > 0 && !selectedStatuses.has(exp.status)) return false;
    if (selectedParties.size > 0 && !selectedParties.has(exp.party_name)) return false;

    if (datePreset !== 'all' && datePreset !== 'custom') {
      const [start, end] = getDateRangeFromPreset(datePreset);
      if (expenseDate && (expenseDate < start || expenseDate > end)) return false;
    }
    if (datePreset === 'custom') {
      if (fromDate && expenseDate && expenseDate < new Date(fromDate)) return false;
      if (toDate && expenseDate && expenseDate > new Date(toDate + 'T23:59:59')) return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        exp.party_name.toLowerCase().includes(q) ||
        exp.category.toLowerCase().includes(q) ||
        (exp.notes || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'amount': cmp = (a.amount || 0) - (b.amount || 0); break;
      case 'category': cmp = (a.category || '').localeCompare(b.category || ''); break;
      case 'party_name': cmp = (a.party_name || '').localeCompare(b.party_name || ''); break;
      case 'status': cmp = (a.status || '').localeCompare(b.status || ''); break;
      case 'date':
      default: cmp = ((a as any).date || a.created || '').localeCompare((b as any).date || b.created || ''); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const totalAmount = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const avgAmount = filteredExpenses.length > 0 ? totalAmount / filteredExpenses.length : 0;

  const categoryTotals = CATEGORIES.map(cat => {
    const items = filteredExpenses.filter(e => e.category === cat);
    return { category: cat, count: items.length, total: items.reduce((s, e) => s + (e.amount || 0), 0) };
  }).filter(c => c.count > 0);

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <span className="ml-1 text-gray-300">⇅</span>;
    return <span className="ml-1 text-blue-600">{sortAsc ? '\u2191' : '\u2193'}</span>;
  };

  const generatePdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const ml = 14;
    const mr = 14;
    const brand = [67, 56, 202];
    const brandDark = [55, 48, 163];
    const slate = [30, 41, 59];
    const gray400 = [156, 163, 175];
    const gray200 = [229, 231, 235];
    const indigo50 = [238, 242, 255];
    let y = 20;

    const drawFooter = () => {
      doc.setDrawColor(gray200[0], gray200[1], gray200[2]); doc.setLineWidth(0.3);
      doc.line(ml, ph - 12, pw - mr, ph - 12);
      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
      doc.setTextColor(160);
      doc.text('Excell Packaging', ml, ph - 7);
      doc.text(`Generated: ${new Date().toLocaleString('en-GB')}  |  Page ${doc.internal.getCurrentPageInfo().pageNumber}`, pw - mr, ph - 7, { align: 'right' });
    };

    const addPage = () => {
      doc.addPage();
      drawFooter();
    };

    doc.setFillColor(brand[0], brand[1], brand[2]);
    doc.rect(0, 0, pw, 3, 'F');
    y = 14;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.text('EXCELL PACKAGING', ml, y);
    y += 9;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.text('Expense Report', ml, y);
    y += 6;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(gray400[0], gray400[1], gray400[2]);

    const dateLabel = datePreset === 'custom'
      ? `Date Range: ${fromDate || '...'} — ${toDate || '...'}`
      : datePreset === 'all' ? 'All Dates' : datePresets.find(p => p.key === datePreset)?.label || datePreset;
    const filterParts: string[] = [];
    if (selectedCategories.size < 3) filterParts.push('Categories: ' + [...selectedCategories].join(', '));
    if (selectedParties.size > 0) filterParts.push('Parties: ' + [...selectedParties].join(', '));
    if (selectedStatuses.size < 3) filterParts.push('Status: ' + [...selectedStatuses].map(s => statusLabels[s]).join(', '));
    const filterLabel = filterParts.length ? filterParts.join('  |  ') : '';
    doc.text(`${dateLabel}${filterLabel ? '  •  ' + filterLabel : ''}`, ml, y);
    y += 4;
    doc.setDrawColor(gray200[0], gray200[1], gray200[2]); doc.setLineWidth(0.3);
    doc.line(ml, y, pw - mr, y);
    y += 6;

    const tableHead = [['Date', 'Category', 'Party', 'Amount', 'Status', 'Approved At', 'Approved By', 'Notes']];
    const tableBody = sortedExpenses.map(exp => [
      formatDate((exp as any).date || exp.created),
      exp.category,
      exp.party_name,
      formatCurrency(exp.amount),
      statusLabels[exp.status] || exp.status,
      formatDate(exp.approved_at),
      exp.approved_by_name || '-',
      (exp.notes || '').substring(0, 40),
    ]);

    autoTable(doc, {
      startY: y,
      head: tableHead,
      body: tableBody,
      margin: { left: ml, right: mr },
      theme: 'plain',
      headStyles: { fillColor: brand, textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 7.5, textColor: slate },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      tableLineColor: gray200,
      tableLineWidth: 0.2,
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 22 },
        2: { cellWidth: 22 },
        3: { halign: 'right', cellWidth: 20 },
        4: { cellWidth: 16 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 },
        7: { cellWidth: 'auto' },
      },
    });

    let finalY = (doc as any).lastAutoTable.finalY + 6;

    if (finalY > ph - 40) { addPage(); finalY = 24; }

    doc.setDrawColor(gray200[0], gray200[1], gray200[2]); doc.setLineWidth(0.3);
    doc.line(ml, finalY, pw - mr, finalY);
    finalY += 5;

    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.text('Summary', ml, finalY);
    finalY += 6;

    const summaryBody = [
      ['Total Expenses', String(filteredExpenses.length)],
      ['Total Amount', `Rs. ${formatCurrency(totalAmount)}`],
      ['Average per Expense', `Rs. ${formatCurrency(Math.round(avgAmount))}`],
    ];

    autoTable(doc, {
      startY: finalY,
      body: summaryBody,
      margin: { left: ml, right: mr },
      theme: 'plain',
      bodyStyles: { fontSize: 8, textColor: slate, fontStyle: 'bold' },
      tableLineColor: gray200,
      tableLineWidth: 0.2,
      columnStyles: { 0: { cellWidth: 50, fillColor: indigo50 }, 1: { cellWidth: 40, halign: 'right' } },
      didParseCell: (data: any) => {
        if (data.row.index === 1) {
          data.cell.styles.fontSize = 10;
          data.cell.styles.textColor = brand;
        }
      },
    });

    finalY = (doc as any).lastAutoTable.finalY + 6;

    if (categoryTotals.length > 0) {
      if (finalY > ph - 50) { addPage(); finalY = 24; }

      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      doc.setTextColor(slate[0], slate[1], slate[2]);
      doc.text('By Category', ml, finalY);
      finalY += 6;

      const catHead = [['Category', 'Count', 'Total Amount']];
      const catBody = categoryTotals.map(c => [c.category, String(c.count), `Rs. ${formatCurrency(c.total)}`]);

      autoTable(doc, {
        startY: finalY,
        head: catHead,
        body: catBody,
        margin: { left: ml, right: mr },
        theme: 'plain',
        headStyles: { fillColor: brand, textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 8, textColor: slate, fontStyle: 'bold' },
        tableLineColor: gray200,
        tableLineWidth: 0.2,
        columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 30, halign: 'center' }, 2: { cellWidth: 45, halign: 'right' } },
      });
    }

    drawFooter();
    const df = datePreset === 'all' ? 'all-dates' : datePreset === 'custom'
      ? `${fromDate || 'start'}--${toDate || 'end'}`
      : datePreset;
    doc.save(`expense-report-${df}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-black">Expense Reports</h2>
        <button
          onClick={generatePdf}
          disabled={filteredExpenses.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <FileText size={16} /> Export PDF
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Total Amount</p>
          <p className="text-2xl font-black text-gray-800 mt-1">₹{formatCurrency(totalAmount)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Expenses</p>
          <p className="text-2xl font-black text-gray-800 mt-1">{filteredExpenses.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Average</p>
          <p className="text-2xl font-black text-gray-800 mt-1">₹{formatCurrency(Math.round(avgAmount))}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm flex flex-col max-h-[calc(100dvh-14rem)]">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col gap-3 bg-white flex-shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays size={14} className="text-gray-500 shrink-0" />
            {datePresets.map(btn => (
              <button
                key={btn.key}
                onClick={() => setDatePreset(btn.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  datePreset === btn.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
            <button
              onClick={() => setDatePreset('custom')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                datePreset === 'custom'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Custom
            </button>
          </div>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border rounded-lg text-xs"
              />
              <span className="text-xs text-gray-500">to</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border rounded-lg text-xs"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowPartyDropdown(!showPartyDropdown)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Party {selectedParties.size > 0 ? `(${selectedParties.size})` : ''}
                <ChevronDown size={12} />
              </button>
              {showPartyDropdown && (
                <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto min-w-[180px]">
                  {parties.map(p => (
                    <label key={p.pb_id || p.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 text-xs font-semibold text-gray-700">
                      <input type="checkbox" checked={selectedParties.has(p.name)} onChange={() => toggleParty(p.name)} className="rounded" />
                      {p.name}
                    </label>
                  ))}
                  {parties.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No parties saved</p>}
                </div>
              )}
            </div>

            {CATEGORIES.map(cat => (
              <label key={cat} className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                <input type="checkbox" checked={selectedCategories.has(cat)} onChange={() => toggleCategory(cat)} className="rounded" />
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${categoryColors[cat]}`}>{cat}</span>
              </label>
            ))}

            <div className="w-px h-5 bg-gray-300 hidden sm:block" />

            {STATUSES.map(s => (
              <label key={s} className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                <input type="checkbox" checked={selectedStatuses.has(s)} onChange={() => toggleStatus(s)} className="rounded" />
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[s]}`}>{statusLabels[s]}</span>
              </label>
            ))}

            {[...selectedParties].length > 0 && (
              <button
                onClick={() => setSelectedParties(new Set())}
                className="text-[10px] font-bold text-red-400 hover:text-red-600 flex items-center gap-1"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2 text-gray-400" size={14} />
            <input
              placeholder="Search by party, category, or notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 bg-gray-50 border rounded-lg text-xs outline-none"
            />
          </div>
        </div>

        <div className="overflow-y-auto min-h-0 flex-1">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200" onClick={() => handleSort('date')}>Date<SortIcon field="date" /></th>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200" onClick={() => handleSort('category')}>Category<SortIcon field="category" /></th>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200" onClick={() => handleSort('party_name')}>Party<SortIcon field="party_name" /></th>
                  <th className="px-4 py-3 text-right cursor-pointer select-none hover:bg-gray-200" onClick={() => handleSort('amount')}>Amount<SortIcon field="amount" /></th>
                  <th className="px-4 py-3 cursor-pointer select-none hover:bg-gray-200" onClick={() => handleSort('status')}>Status<SortIcon field="status" /></th>
                  <th className="px-4 py-3">Approved At</th>
                  <th className="px-4 py-3">Approved By</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedExpenses.map(exp => (
                  <tr key={exp.pb_id || exp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap">{formatDate((exp as any).date || exp.created)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${categoryColors[exp.category] || 'bg-gray-100 text-gray-700'}`}>{exp.category}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-sm">{exp.party_name}</td>
                    <td className="px-4 py-3 text-right font-bold">₹{formatCurrency(exp.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[exp.status] || 'bg-gray-100 text-gray-700'}`}>
                        {statusLabels[exp.status] || exp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px] font-semibold text-gray-500">{formatDate(exp.approved_at)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-600">{exp.approved_by_name || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate">{exp.notes || '-'}</td>
                  </tr>
                ))}
                {sortedExpenses.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-500 italic font-semibold text-sm">No expenses match the current filters.</td>
                  </tr>
                )}
              </tbody>
              {sortedExpenses.length > 0 && (
                <tfoot>
                  <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-200">
                    <td className="px-4 py-3 text-sm">Total ({sortedExpenses.length})</td>
                    <td></td>
                    <td></td>
                    <td className="px-4 py-3 text-right text-sm">₹{formatCurrency(totalAmount)}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="md:hidden space-y-2 p-3">
            {sortedExpenses.length === 0 && (
              <div className="py-8 text-center text-gray-500 italic font-semibold text-sm">No expenses match the current filters.</div>
            )}
            {sortedExpenses.map(exp => (
              <div key={exp.pb_id || exp.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold text-gray-500">{formatDate((exp as any).date || exp.created)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${categoryColors[exp.category] || 'bg-gray-100 text-gray-700'}`}>{exp.category}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[exp.status] || 'bg-gray-100 text-gray-700'}`}>
                      {statusLabels[exp.status] || exp.status}
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 font-semibold text-gray-800 text-sm">{exp.party_name}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-lg font-black">₹{formatCurrency(exp.amount)}</span>
                  {exp.notes && <span className="text-xs text-gray-400 truncate max-w-[140px]">{exp.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseReportView;

import { useState, useEffect } from 'react';
import { Calendar, UserPlus, Table, Trash2, Mail, Lock, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Clock, Users, Pencil, X, Building2, Download, Phone, ShoppingCart, TrendingUp, Tag, Receipt, Printer } from 'lucide-react';
import api from '../services/api';

interface Dean {
  id: string;
  name?: string;
  school_name?: string;
  email: string;
  created_at: string;
  total_budget?: number;
  used_budget?: number;
  remaining_budget?: number;
  total_coupons?: number;
  redeemed_coupons?: number;
}

interface EventItem {
  id: string;
  menu_item_id: string;
  quantity: number;
  price_at_time: number;
  item_name: string;
  item_image?: string;
  category?: string;
}

interface EventPreOrder {
  id: string;
  user_id: string;
  event_name: string;
  event_date: string;
  event_time: string;
  member_count: number;
  staff_name: string;
  staff_email: string;
  status: string;
  total_amount: number;
  created_at: string;
  creator_name?: string;
  creator_phone?: string;
  special_requirements?: string;
  cancellation_reason?: string;
  items: EventItem[];
}

export default function Events() {
  const [activeTab, setActiveTab] = useState<'deans' | 'calendar' | 'funds' | 'requests' | 'reports'>('deans');
  const [deans, setDeans] = useState<Dean[]>([]);
  const [events, setEvents] = useState<EventPreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedEvents, setSelectedEvents] = useState<EventPreOrder[]>([]);

  // Analytics
  const totalEvents = events.length;
  const pendingEvents = events.filter(e => e.status === 'pending').length;
  const completedEvents = events.filter(e => e.status === 'completed' || e.status === 'approved').length;

  // ─── Reports aggregations (exclude rejected/cancelled from spend) ───
  const reportEvents = events.filter(e => e.status !== 'rejected' && e.status !== 'cancelled');
  const totalCateringSpend = reportEvents.reduce((s, e) => s + Number(e.total_amount), 0);
  const avgPerEvent = reportEvents.length ? totalCateringSpend / reportEvents.length : 0;

  const perHead = Object.values(reportEvents.reduce((acc, e) => {
    const key = e.staff_email || e.staff_name || 'Unknown';
    if (!acc[key]) acc[key] = { name: e.staff_name || 'Unknown', email: e.staff_email || '—', count: 0, total: 0 };
    acc[key].count++;
    acc[key].total += Number(e.total_amount);
    return acc;
  }, {} as Record<string, { name: string; email: string; count: number; total: number }>)).sort((a, b) => b.total - a.total);

  const monthly = Object.values(reportEvents.reduce((acc, e) => {
    const d = new Date(e.event_date);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!acc[key]) acc[key] = { key, label: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }), count: 0, total: 0 };
    acc[key].count++;
    acc[key].total += Number(e.total_amount);
    return acc;
  }, {} as Record<string, { key: string; label: string; count: number; total: number }>)).sort((a, b) => a.key.localeCompare(b.key));

  const categories = Object.entries(reportEvents.reduce((acc, e) => {
    (e.items || []).forEach((it) => {
      const cat = it.category || 'Uncategorized';
      if (!acc[cat]) acc[cat] = { qty: 0, total: 0 };
      acc[cat].qty += it.quantity;
      acc[cat].total += it.quantity * Number(it.price_at_time);
    });
    return acc;
  }, {} as Record<string, { qty: number; total: number }>)).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.total - a.total);

  const maxHeadTotal = Math.max(1, ...perHead.map(h => h.total));
  const maxMonthTotal = Math.max(1, ...monthly.map(m => m.total));
  const maxCatTotal = Math.max(1, ...categories.map(c => c.total));

  // New Dean form
  const [deanName, setDeanName] = useState('');
  const [deanSchool, setDeanSchool] = useState('');
  const [deanEmail, setDeanEmail] = useState('');
  const [deanPassword, setDeanPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fund inputs
  const [fundInputs, setFundInputs] = useState<Record<string, string>>({});
  const [isUpdatingFunds, setIsUpdatingFunds] = useState<string | null>(null);

  // Edit Dean modal
  const [editDean, setEditDean] = useState<Dean | null>(null);
  const [editName, setEditName] = useState('');
  const [editSchool, setEditSchool] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Event detail modal
  const [viewEvent, setViewEvent] = useState<EventPreOrder | null>(null);

  // Requests tab
  const [pendingRequests, setPendingRequests] = useState<EventPreOrder[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [holdAmount, setHoldAmount] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleUpdateFunds = async (deanId: string, action: 'add' | 'deduct') => {
    let amount = Number(fundInputs[deanId]);
    if (!fundInputs[deanId] || isNaN(amount) || amount <= 0) return;
    
    if (action === 'deduct') amount = -amount;

    setIsUpdatingFunds(deanId);
    try {
      const res = await api.patch(`/admin/deans/${deanId}/budget`, { amount });
      setDeans((prev) => prev.map((d) => (d.id === deanId ? { ...d, ...res.data } : d)));
      setFundInputs((prev) => ({ ...prev, [deanId]: '' }));
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update funds');
    } finally {
      setIsUpdatingFunds(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Pre-fetch pending count for badge on initial load
  useEffect(() => {
    api.get('/admin/events').then(({ data }) => {
      setPendingRequests(data.filter((e: EventPreOrder) => e.status === 'pending' || e.status === 'upcoming'));
    }).catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'deans' || activeTab === 'funds') {
        const { data } = await api.get('/admin/deans');
        setDeans(data);
      } else if (activeTab === 'calendar' || activeTab === 'reports') {
        const { data } = await api.get('/admin/events');
        setEvents(data);
      } else if (activeTab === 'requests') {
        const { data } = await api.get('/admin/events');
        setPendingRequests(data.filter((e: EventPreOrder) => e.status === 'pending' || e.status === 'upcoming'));
      }
    } catch (error) {
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/admin/events/${id}/status`, { status: 'approved' });
      setPendingRequests(prev => prev.filter(r => r.id !== id));
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    setActionLoading(id);
    try {
      await api.patch(`/admin/events/${id}/status`, { status: 'rejected', rejection_reason: rejectReason.trim() });
      setPendingRequests(prev => prev.filter(r => r.id !== id));
      setRejectingId(null);
      setRejectReason('');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const handleHold = async (id: string) => {
    const amt = Number(holdAmount);
    if (!amt || amt <= 0) {
      alert('Enter a valid total amount to quote.');
      return;
    }
    setActionLoading(id);
    try {
      await api.patch(`/admin/events/${id}/status`, { status: 'on_hold', total_amount: amt });
      setPendingRequests(prev => prev.filter(r => r.id !== id));
      setHoldingId(null);
      setHoldAmount('');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to put order on hold');
    } finally {
      setActionLoading(null);
    }
  };

  const handeAddDean = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!deanEmail || !deanPassword || !deanName || !deanSchool) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    // Mirror the backend passwordSchema (validators.ts) — the API enforces these.
    if (deanPassword.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(deanPassword)) {
      setErrorMsg("Password must contain at least one uppercase letter.");
      return;
    }
    if (!/[0-9]/.test(deanPassword)) {
      setErrorMsg("Password must contain at least one number.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/admin/deans', { name: deanName, school_name: deanSchool, email: deanEmail, password: deanPassword });
      setSuccessMsg('Event Head registered successfully');
      setDeanName('');
      setDeanSchool('');
      setDeanEmail('');
      setDeanPassword('');
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error: any) {
      setErrorMsg(error.response?.data?.message || error.message || 'Failed to add event head');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDean = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event head? This action cannot be undone.')) return;
    try {
      await api.delete(`/admin/deans/${id}`);
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete event head');
    }
  };

  const openEditModal = (dean: Dean) => {
    setEditDean(dean);
    setEditName(dean.name || '');
    setEditSchool(dean.school_name || '');
    setEditEmail(dean.email);
    setEditError('');
  };

  const handleEditDean = async () => {
    if (!editDean) return;
    if (!editName.trim() || !editEmail.trim() || !editSchool.trim()) {
      setEditError('All fields are required');
      return;
    }

    setEditLoading(true);
    setEditError('');
    try {
      const res = await api.put(`/admin/deans/${editDean.id}`, {
        name: editName.trim(),
        email: editEmail.trim(),
        school_name: editSchool.trim(),
      });
      setDeans(prev => prev.map(d => d.id === editDean.id ? { ...d, ...res.data } : d));
      setEditDean(null);
    } catch (error: any) {
      setEditError(error.response?.data?.message || 'Failed to update event head');
    } finally {
      setEditLoading(false);
    }
  };

  const downloadCSV = async (type: string) => {
    try {
      const response = await api.get(`/admin/export/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_export_${new Date().toISOString().slice(0,10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert(`Failed to download ${type} export`);
    }
  };

  // Clean, print-to-PDF full catering report (maroon theme, matches the event portal look).
  const downloadReportPdf = () => {
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const money = (n: number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

    const delegateRows = perHead.map((h) => `<tr><td>${escapeHtml(h.name)}</td><td>${escapeHtml(h.email)}</td><td class="c">${h.count}</td><td class="r">${money(h.total)}</td></tr>`).join('');
    const catRows = categories.map((c) => `<tr><td>${escapeHtml(c.category)}</td><td class="c">${c.qty}</td><td class="r">${money(c.total)}</td></tr>`).join('');
    const eventRows = reportEvents.map((e) => `<tr><td>${escapeHtml(e.event_name)}</td><td>${escapeHtml(e.staff_name || '—')}</td><td>${fmtDate(e.event_date)}</td><td class="r">${money(Number(e.total_amount))}</td></tr>`).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Catering Report</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2a2a2a; margin: 0; padding: 0; }
        .wrap { max-width: 820px; margin: 0 auto; padding: 32px; }
        .head { background: #8B1C28; color: #fff; padding: 26px 32px; border-radius: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
        .head h1 { margin: 0; font-size: 24px; letter-spacing: -0.5px; }
        .head .sub { opacity: .85; font-size: 13px; margin-top: 4px; }
        .metrics { display: flex; gap: 16px; margin: 24px 0; }
        .metric { flex: 1; border: 1px solid #eee; border-radius: 12px; padding: 16px 18px; }
        .metric .label { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #888; font-weight: 700; }
        .metric .value { font-size: 22px; font-weight: 800; margin-top: 6px; color: #8B1C28; }
        h2 { font-size: 15px; margin: 28px 0 10px; color: #8B1C28; border-bottom: 2px solid #f0e0e2; padding-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        th { background: #faf3f4; text-align: left; padding: 9px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: #8B1C28; border-bottom: 1px solid #eedfe1; }
        td { padding: 9px 12px; border-bottom: 1px solid #f3f3f3; }
        td.r, th.r { text-align: right; } td.c, th.c { text-align: center; }
        .foot { margin-top: 28px; font-size: 11px; color: #aaa; text-align: center; }
        @media print { .wrap { padding: 0; } .head { border-radius: 0; } }
      </style></head><body><div class="wrap">
      <div class="head"><div><h1>Catering Report</h1><div class="sub">Full event catering summary</div></div><div style="text-align:right"><div class="sub">Generated</div><div style="font-weight:700">${today}</div></div></div>
      <div class="metrics">
        <div class="metric"><div class="label">Total Catering Spend</div><div class="value">${money(totalCateringSpend)}</div></div>
        <div class="metric"><div class="label">Delegates</div><div class="value">${perHead.length}</div></div>
        <div class="metric"><div class="label">Avg / Event</div><div class="value">${money(avgPerEvent)}</div></div>
      </div>
      <h2>Per Delegate Spending</h2>
      <table><thead><tr><th>Delegate</th><th>Email</th><th class="c">Events</th><th class="r">Total</th></tr></thead><tbody>${delegateRows}</tbody></table>
      <h2>Category-wise Consumption</h2>
      <table><thead><tr><th>Category</th><th class="c">Units</th><th class="r">Total</th></tr></thead><tbody>${catRows}</tbody></table>
      <h2>Events (${reportEvents.length})</h2>
      <table><thead><tr><th>Event</th><th>Delegate</th><th>Date</th><th class="r">Amount</th></tr></thead><tbody>${eventRows}</tbody></table>
      <div class="foot">University Canteen · Catering Report · ${today}</div>
      </div></body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Please allow pop-ups to download the report.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const escapeHtml = (s: string) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const printInvoice = (evt: EventPreOrder) => {
    const rows = (evt.items || []).map((it) => `
      <tr>
        <td>${escapeHtml(it.item_name)}${it.category ? `<span class="cat">${escapeHtml(it.category)}</span>` : ''}</td>
        <td class="num">${it.quantity}</td>
        <td class="num">₹${Number(it.price_at_time).toFixed(2)}</td>
        <td class="num">₹${(it.quantity * Number(it.price_at_time)).toFixed(2)}</td>
      </tr>`).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Interim Invoice — ${escapeHtml(evt.event_name)}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 40px; }
        .wrap { max-width: 720px; margin: 0 auto; }
        .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #8B1C28; padding-bottom: 18px; }
        .brand { font-size: 20px; font-weight: 800; color: #8B1C28; }
        .brand small { display:block; font-size: 11px; font-weight: 600; color: #777; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }
        .tag { text-align: right; }
        .tag h1 { margin: 0; font-size: 24px; letter-spacing: 1px; }
        .tag .pill { display:inline-block; margin-top:6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #b45309; background: #fef3c7; border: 1px solid #fcd34d; padding: 3px 10px; border-radius: 999px; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 24px 0; font-size: 13px; }
        .meta div span { color: #888; display:block; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
        .meta div b { font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
        th { text-align: left; background: #f5f3f0; color: #555; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; padding: 10px; }
        td { padding: 10px; border-bottom: 1px solid #eee; vertical-align: top; }
        td.num, th.num { text-align: right; }
        .cat { display:block; font-size: 11px; color: #999; margin-top: 2px; }
        tfoot td { border: none; font-weight: 700; }
        tfoot .grand { font-size: 18px; color: #8B1C28; }
        .foot { margin-top: 28px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 14px; }
        @media print { body { padding: 0; } }
      </style></head><body><div class="wrap">
      <div class="head">
        <div class="brand">Ahmedabad University Canteen<small>Catering Services</small></div>
        <div class="tag"><h1>INVOICE</h1><div class="pill">Interim</div></div>
      </div>
      <div class="meta">
        <div><span>Event</span><b>${escapeHtml(evt.event_name)}</b></div>
        <div><span>Invoice / Order ID</span><b>${escapeHtml(evt.id)}</b></div>
        <div><span>Event Date</span><b>${new Date(evt.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · ${escapeHtml(evt.event_time || '—')}</b></div>
        <div><span>Status</span><b>${escapeHtml(evt.status)}</b></div>
        <div><span>Event Head</span><b>${escapeHtml(evt.staff_name || '—')}</b></div>
        <div><span>Contact</span><b>${escapeHtml(evt.staff_email || '—')}</b></div>
        <div><span>Members</span><b>${evt.member_count}</b></div>
        <div><span>Generated</span><b>${new Date().toLocaleString('en-IN')}</b></div>
      </div>
      <table>
        <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Amount</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">No items</td></tr>'}</tbody>
        <tfoot><tr><td colspan="3" class="num">Grand Total</td><td class="num grand">₹${Number(evt.total_amount).toLocaleString('en-IN')}</td></tr></tfoot>
      </table>
      <div class="foot">This is an interim invoice generated for internal review and is not a final tax invoice. Amounts are subject to change until the event is completed.</div>
      </div></body></html>`;

    const w = window.open('', '_blank', 'width=820,height=920');
    if (!w) { alert('Please allow pop-ups to print the invoice.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  };

  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth, year, month };
  };

  const { firstDay, daysInMonth, year, month } = getDaysInMonth(currentMonth);
  // Only render leading blanks (to align the 1st under the right weekday) + the
  // actual days of the month — no trailing empty cells padding out to 6 rows.
  const calendarDays = Array.from({ length: firstDay + daysInMonth }, (_, i) => {
    if (i < firstDay) return null;
    return i - firstDay + 1;
  });

  useEffect(() => {
    const filtered = events.filter(e => {
        const d = new Date(e.event_date);
        return d.getUTCDate() === selectedDate.getDate() &&
               d.getUTCMonth() === selectedDate.getMonth() &&
               d.getUTCFullYear() === selectedDate.getFullYear();
    });
    setSelectedEvents(filtered);
  }, [selectedDate, events]);

  const today = new Date();
  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const getBudgetPct = (dean: Dean) => {
    const total = dean.total_budget || 0;
    if (total === 0) return 0;
    return Math.min(((dean.used_budget || 0) / total) * 100, 100);
  };

  const getBudgetColor = (pct: number) => {
    if (pct >= 90) return { bar: 'bg-red-500', text: 'text-red-400', glow: 'shadow-red-500/20' };
    if (pct >= 70) return { bar: 'bg-amber-500', text: 'text-amber-400', glow: 'shadow-amber-500/20' };
    return { bar: 'bg-emerald-500', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' };
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Event Management</h1>
          <p className="text-slate-400 mt-1">Manage event heads, event pre-orders, and budgets.</p>
        </div>
        <div className="flex bg-[#0a0c14] p-1 rounded-xl border border-white/5 shadow-inner">
          {(['deans', 'calendar', 'requests', 'funds', 'reports'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all relative ${
                activeTab === tab ? 'bg-[#8B1C28] text-white shadow-lg shadow-[#8B1C28]/20' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'deans' ? 'Event Heads' : tab === 'calendar' ? 'Events Calendar' : tab === 'requests' ? 'Requests' : tab === 'funds' ? 'Fund Distribution' : 'Reports'}
              {tab === 'requests' && pendingRequests.length > 0 && activeTab !== 'requests' && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 text-[10px] font-bold text-black rounded-full flex items-center justify-center animate-pulse">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════ DEANS TAB ═══════════════════════ */}
      {activeTab === 'deans' && (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Add New Dean — Premium Form Card */}
            <div className="lg:w-[380px] shrink-0">
              <div className="bg-[#0a0c16] rounded-2xl p-6 border border-white/5 relative overflow-hidden group sticky top-6">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8B1C28] via-rose-500 to-[#8B1C28]" />
                <div className="absolute inset-0 bg-gradient-to-br from-[#8B1C28]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 relative z-10">
                  <div className="p-2 bg-[#8B1C28]/10 rounded-lg border border-rose-500/10">
                    <UserPlus size={18} className="text-rose-400" />
                  </div>
                  Register New Event Head
                </h2>

                <form onSubmit={handeAddDean} className="space-y-4 relative z-10">
                  {errorMsg && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl flex items-start gap-2 animate-fade-in">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                  {successMsg && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm p-3 rounded-xl flex items-start gap-2 animate-fade-in">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  {[
                    { label: 'Full Name', icon: <UserPlus size={16} />, type: 'text', value: deanName, setter: setDeanName, placeholder: 'Dr. John Smith' },
                    { label: 'School / Department', icon: <Building2 size={16} />, type: 'text', value: deanSchool, setter: setDeanSchool, placeholder: 'School of Engineering' },
                    { label: 'Email Address', icon: <Mail size={16} />, type: 'email', value: deanEmail, setter: setDeanEmail, placeholder: 'eventhead@university.edu' },
                    { label: 'Default Password', icon: <Lock size={16} />, type: 'password', value: deanPassword, setter: setDeanPassword, placeholder: 'Min 8 chars, 1 uppercase, 1 number' },
                  ].map(field => (
                    <div key={field.label}>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        {field.label}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{field.icon}</span>
                        <input
                          type={field.type}
                          value={field.value}
                          onChange={(e) => field.setter(e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full bg-[#060810] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all placeholder:text-slate-600 outline-none"
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-4 bg-gradient-to-r from-[#8B1C28] to-rose-700 hover:from-rose-700 hover:to-[#8B1C28] text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#8B1C28]/20 hover:shadow-[#8B1C28]/40"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <UserPlus size={16} />
                    )}
                    {isSubmitting ? 'Registering...' : 'Register Event Head'}
                  </button>
                </form>
              </div>
            </div>

            {/* Dean Directory — Card Grid */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-3">
                  Registered Event Heads
                  <span className="bg-[#8B1C28]/20 text-rose-400 text-xs px-2.5 py-1 rounded-full border border-rose-500/10">
                    {deans.length} active
                  </span>
                </h2>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-[#8B1C28] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : deans.length === 0 ? (
                <div className="bg-[#0a0c16] rounded-2xl p-12 text-center border border-white/5">
                  <AlertCircle size={32} className="mx-auto mb-3 text-slate-600" />
                  <p className="text-slate-500">No event heads registered yet. Use the form to add one.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {deans.map((dean) => (
                    <div key={dean.id} className="bg-[#0a0c16] rounded-2xl border border-white/5 p-5 relative overflow-hidden group hover:border-white/10 transition-all duration-300 hover:shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#8B1C28] to-rose-900 group-hover:w-1.5 transition-all" />
                      
                      <div className="flex items-start justify-between ml-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-bold text-lg truncate">{dean.name || 'Unnamed Event Head'}</h3>
                          <p className="text-rose-400/80 text-sm font-medium mt-0.5 flex items-center gap-1.5">
                            <Building2 size={13} />
                            {dean.school_name || 'No School'}
                          </p>
                          <p className="text-slate-500 text-xs mt-2 flex items-center gap-1.5">
                            <Mail size={12} />
                            {dean.email}
                          </p>
                          <div className="flex gap-3 mt-3">
                            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
                              {dean.total_coupons || 0} coupons
                            </span>
                            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/10">
                              Since {new Date(dean.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-1 ml-2 shrink-0">
                          <button
                            onClick={() => openEditModal(dean)}
                            className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Edit Event Head"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteDean(dean.id)}
                            className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete Event Head"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ EDIT DEAN MODAL ═══════════════ */}
      {editDean && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setEditDean(null)}>
          <div className="bg-[#0d1220] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-[0_25px_80px_rgba(0,0,0,0.6)] relative" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8B1C28] via-rose-500 to-[#8B1C28] rounded-t-2xl" />
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Pencil size={16} className="text-rose-400" />
                Edit Event Head Details
              </h3>
              <button onClick={() => setEditDean(null)} className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                <X size={18} />
              </button>
            </div>

            {editError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl flex items-start gap-2 mb-4">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-4">
              {[
                { label: 'Full Name', value: editName, setter: setEditName, icon: <UserPlus size={16} /> },
                { label: 'School / Department', value: editSchool, setter: setEditSchool, icon: <Building2 size={16} /> },
                { label: 'Email Address', value: editEmail, setter: setEditEmail, icon: <Mail size={16} /> },
              ].map(field => (
                <div key={field.label}>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{field.label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{field.icon}</span>
                    <input
                      type="text"
                      value={field.value}
                      onChange={e => field.setter(e.target.value)}
                      className="w-full bg-[#060810] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditDean(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-semibold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleEditDean}
                disabled={editLoading}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#8B1C28] to-rose-700 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-[#8B1C28]/30 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {editLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={16} />}
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ CALENDAR TAB ═══════════════════════ */}
      {activeTab === 'calendar' && (
        <div className="flex flex-col gap-6">
          {/* Top Summary Ribbon */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#0a0c16] rounded-2xl border border-white/5 p-6 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#8B1C28]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-start mb-4">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-xs">Total Events</span>
                <Calendar size={18} className="text-rose-400" />
              </div>
              <h3 className="text-4xl font-bold text-white mb-2">{totalEvents}</h3>
              <p className="text-xs text-rose-400 font-medium bg-[#8B1C28]/10 inline-block px-2 py-1 rounded-md">Scheduled This Period</p>
            </div>
            
            <div className="bg-[#0a0c16] rounded-2xl border border-white/5 p-6 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-start mb-4">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-xs">Pending Review</span>
                <AlertCircle size={18} className="text-amber-400" />
              </div>
              <h3 className="text-4xl font-bold text-white mb-2">{pendingEvents}</h3>
              <p className="text-xs text-amber-400 font-medium bg-amber-500/10 inline-block px-2 py-1 rounded-md">Action Required</p>
            </div>

            <div className="bg-[#0a0c16] rounded-2xl border border-white/5 p-6 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-start mb-4">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-xs">Completed Events</span>
                <CheckCircle2 size={18} className="text-emerald-400" />
              </div>
              <h3 className="text-4xl font-bold text-white mb-2">{completedEvents}</h3>
              <p className="text-xs text-emerald-400 font-medium bg-emerald-500/10 inline-block px-2 py-1 rounded-md">Successfully Executed</p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Interactive Calendar Grid */}
            <div className="lg:w-2/3 bg-[#0a0c16] rounded-2xl border border-white/5 p-6">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="text-rose-400" /> Event Schedule
                </h2>
                <div className="flex items-center gap-4 bg-white/[0.02] p-1 rounded-xl border border-white/5">
                  <button onClick={prevMonth} className="p-2 hover:bg-white/[0.05] rounded-lg transition-colors text-slate-400 hover:text-white">
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-white font-semibold min-w-32 text-center">
                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={nextMonth} className="p-2 hover:bg-white/[0.05] rounded-lg transition-colors text-slate-400 hover:text-white">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider py-2">
                      {day}
                    </div>
                  ))}
              </div>
              
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, idx) => {
                  if (day === null) return <div key={idx} className="h-24 rounded-xl bg-white/[0.01] border border-white/[0.02]" />;
                  
                  const cellDate = new Date(year, month, day);
                  const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
                  const dayEvents = events.filter(e => {
                      const ed = new Date(e.event_date);
                      return ed.getUTCDate() === day && ed.getUTCMonth() === month && ed.getUTCFullYear() === year;
                  });
                  const todayCell = isToday(day);
                  const hasEvt = dayEvents.length > 0;

                  let cellBorder = 'border-white/5 hover:border-white/20';
                  let cellBg = 'bg-[#060810]';
                  if (isSelected) {
                    cellBorder = 'border-rose-500/50';
                    cellBg = 'bg-[#8B1C28]/10 shadow-[inset_0_0_20px_rgba(139,28,40,0.2)]';
                  } else if (todayCell) {
                    cellBorder = 'border-emerald-500/40';
                    cellBg = 'bg-emerald-500/5';
                  } else if (hasEvt) {
                    cellBorder = 'border-rose-500/30';
                    cellBg = 'bg-rose-500/5';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(cellDate)}
                      className={`h-24 rounded-xl p-2 flex flex-col items-start justify-start border transition-all text-left relative group ${cellBg} ${cellBorder}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-semibold ${isSelected ? 'text-rose-400' : todayCell ? 'text-emerald-400' : 'text-slate-400 group-hover:text-white'}`}>
                          {day}
                        </span>
                        {todayCell && (
                          <span className="text-[8px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">Today</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-auto">
                        {dayEvents.map(evt => (
                          <div 
                            key={evt.id} 
                            title={evt.event_name}
                            className={`w-2 h-2 rounded-full ${evt.status === 'pending' || evt.status === 'upcoming' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' : evt.status === 'on_hold' ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]' : evt.status === 'cancelled' || evt.status === 'rejected' ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'}`}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Event Details Side-Panel */}
            <div className="lg:w-1/3 flex flex-col gap-4">
              <div className="bg-[#0a0c16] rounded-2xl border border-rose-500/20 shadow-[0_0_40px_rgba(139,28,40,0.05)] p-6 sticky top-6">
                <div className="border-b border-white/5 pb-4 mb-6">
                  <h3 className="text-xl font-bold text-white mb-1">
                    {selectedDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    {selectedEvents.length === 0 ? 'No events scheduled' : `${selectedEvents.length} event${selectedEvents.length > 1 ? 's' : ''} scheduled`}
                  </p>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {selectedEvents.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-center">
                      <Calendar size={32} className="mb-4 opacity-20" />
                      <p>Select a different date or schedule a new event to see details here.</p>
                    </div>
                  ) : (
                    selectedEvents.map(evt => (
                      <div key={evt.id} className="bg-white/[0.02] border border-white/10 p-5 rounded-xl transition-all hover:bg-white/[0.04]">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-white font-semibold text-lg">{evt.event_name}</h4>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                            evt.status === 'upcoming' || evt.status === 'pending' ? 'bg-amber-500/10 text-amber-400'
                              : evt.status === 'on_hold' ? 'bg-yellow-500/10 text-yellow-400'
                              : evt.status === 'cancelled' || evt.status === 'rejected' ? 'bg-red-500/10 text-red-400'
                              : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {evt.status}
                          </span>
                        </div>
                        
                        <div className="space-y-3 mt-4">
                          <div className="flex items-center gap-3 text-sm text-slate-300">
                            <Clock size={16} className="text-rose-400" />
                            <span>{evt.event_time || '—'}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-slate-300">
                            <Users size={16} className="text-rose-400" />
                            <span>{evt.member_count} Members</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-slate-300">
                            <UserPlus size={16} className="text-rose-400" />
                            <span>{evt.staff_name} ({evt.staff_email})</span>
                          </div>
                        </div>

                        <div className="mt-5 pt-4 border-t border-white/5">
                          <button
                            onClick={() => setViewEvent(evt)}
                            className="w-full text-sm bg-[#8B1C28] hover:bg-rose-800 text-white py-2 rounded-lg font-semibold transition-colors"
                          >
                            View Full Details
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ EVENT DETAIL MODAL ═══════════════ */}
      {viewEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewEvent(null)}>
          <div className="bg-[#0d1220] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-[0_25px_80px_rgba(0,0,0,0.6)] relative custom-scrollbar" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8B1C28] via-rose-500 to-[#8B1C28] rounded-t-2xl" />
            
            {/* Modal Header */}
            <div className="p-6 pb-4 flex justify-between items-start border-b border-white/5">
              <div>
                <h3 className="text-xl font-bold text-white">{viewEvent.event_name}</h3>
                <p className="text-slate-500 text-xs font-mono mt-1">Order ID: {viewEvent.id}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                  viewEvent.status === 'upcoming' || viewEvent.status === 'pending'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/10'
                    : viewEvent.status === 'on_hold'
                    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/10'
                    : viewEvent.status === 'completed' || viewEvent.status === 'approved'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10'
                    : 'bg-red-500/10 text-red-400 border-red-500/10'
                }`}>
                  {viewEvent.status}
                </span>
                <button onClick={() => setViewEvent(null)} className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Detail Grid */}
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Event Date</p>
                  <p className="text-sm text-white font-semibold">{new Date(viewEvent.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Event Time</p>
                  <p className="text-sm text-white font-semibold flex items-center gap-1.5"><Clock size={14} className="text-rose-400" />{viewEvent.event_time || '—'}</p>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Members</p>
                  <p className="text-sm text-white font-semibold flex items-center gap-1.5"><Users size={14} className="text-rose-400" />{viewEvent.member_count}</p>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Total Amount</p>
                  <p className="text-lg text-emerald-400 font-bold font-mono">₹{Number(viewEvent.total_amount).toLocaleString('en-IN')}</p>
                </div>
              </div>

              {/* Staff & Creator */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">Staff Contact</p>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5 text-sm">
                      <UserPlus size={15} className="text-rose-400 shrink-0" />
                      <span className="text-white font-medium">{viewEvent.staff_name}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm">
                      <Mail size={15} className="text-rose-400 shrink-0" />
                      <span className="text-slate-300">{viewEvent.staff_email}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3">Created By</p>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5 text-sm">
                      <Users size={15} className="text-rose-400 shrink-0" />
                      <span className="text-white font-medium">{viewEvent.creator_name || 'Unknown'}</span>
                    </div>
                    {viewEvent.creator_phone && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Phone size={15} className="text-rose-400 shrink-0" />
                        <span className="text-slate-300">{viewEvent.creator_phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 text-sm">
                      <Clock size={15} className="text-slate-500 shrink-0" />
                      <span className="text-slate-400 text-xs">
                        Created {new Date(viewEvent.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cancelled by staff */}
              {viewEvent.status === 'cancelled' && viewEvent.cancellation_reason && (
                <div className="mb-6">
                  <p className="text-[10px] text-red-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                    <X size={13} /> Cancelled by Staff — Reason
                  </p>
                  <div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl p-4">
                    <p className="text-sm text-red-200/90 whitespace-pre-wrap leading-relaxed">{viewEvent.cancellation_reason}</p>
                  </div>
                </div>
              )}

              {/* Custom Order / Special Requirements */}
              {viewEvent.special_requirements && (
                <div className="mb-6">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                    <Pencil size={13} /> Custom Order / Special Requirements
                  </p>
                  <div className="bg-amber-500/[0.06] border border-amber-500/15 rounded-xl p-4">
                    <p className="text-sm text-amber-200/90 whitespace-pre-wrap leading-relaxed">{viewEvent.special_requirements}</p>
                  </div>
                </div>
              )}

              {/* Ordered Items */}
              {viewEvent.items && viewEvent.items.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
                    <ShoppingCart size={13} /> Ordered Items ({viewEvent.items.length})
                  </p>
                  <div className="bg-white/[0.02] rounded-xl border border-white/5 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-white/[0.02]">
                          <th className="text-left py-3 px-4 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Item</th>
                          <th className="text-center py-3 px-4 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Qty</th>
                          <th className="text-right py-3 px-4 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Unit Price</th>
                          <th className="text-right py-3 px-4 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {viewEvent.items.map(item => (
                          <tr key={item.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {item.item_image ? (
                                  <img src={item.item_image} alt={item.item_name} className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                                    <ShoppingCart size={14} className="text-slate-600" />
                                  </div>
                                )}
                                <span className="text-sm text-white font-medium">{item.item_name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center text-sm text-slate-300 font-mono">{item.quantity}</td>
                            <td className="py-3 px-4 text-right text-sm text-slate-400 font-mono">₹{Number(item.price_at_time).toFixed(2)}</td>
                            <td className="py-3 px-4 text-right text-sm text-emerald-400 font-bold font-mono">₹{(item.quantity * Number(item.price_at_time)).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-white/10 bg-white/[0.03]">
                          <td colSpan={3} className="py-3 px-4 text-right text-xs text-slate-400 font-semibold uppercase tracking-wider">Grand Total</td>
                          <td className="py-3 px-4 text-right text-base text-white font-bold font-mono">₹{Number(viewEvent.total_amount).toLocaleString('en-IN')}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setViewEvent(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-semibold text-sm transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ REQUESTS TAB ═══════════════════════ */}
      {activeTab === 'requests' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/10">
                <AlertCircle size={18} className="text-amber-400" />
              </div>
              Pending Catering Requests
              <span className="bg-amber-500/15 text-amber-400 text-xs px-2.5 py-1 rounded-full border border-amber-500/10">
                {pendingRequests.length} pending
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#8B1C28] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="bg-[#0a0c16] rounded-2xl p-16 text-center border border-white/5">
              <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-500/30" />
              <h3 className="text-lg font-bold text-white mb-2">All Clear</h3>
              <p className="text-slate-500">No pending catering requests to review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((req) => (
                <div key={req.id} className="bg-[#0a0c16] rounded-2xl border border-white/5 overflow-hidden hover:border-amber-500/20 transition-all">
                  {/* Request Header */}
                  <div className="p-6 pb-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-bold text-white">{req.event_name}</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/10">
                          {req.status}
                        </span>
                        {req.special_requirements && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-amber-400/15 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                            <Pencil size={10} /> Custom Order
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Calendar size={14} className="text-rose-400 shrink-0" />
                          {new Date(req.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Clock size={14} className="text-rose-400 shrink-0" />
                          {req.event_time || '—'}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Users size={14} className="text-rose-400 shrink-0" />
                          {req.member_count} members
                        </div>
                        <div className="flex items-center gap-2 text-sm text-emerald-400 font-bold font-mono">
                          ₹{Number(req.total_amount).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5"><UserPlus size={12} /> {req.staff_name}</span>
                        <span className="flex items-center gap-1.5"><Mail size={12} /> {req.staff_email}</span>
                        {req.creator_phone && <span className="flex items-center gap-1.5"><Phone size={12} /> {req.creator_phone}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Items Preview */}
                  {req.items && req.items.length > 0 && (
                    <div className="px-6 pb-3">
                      <div className="flex flex-wrap gap-2">
                        {req.items.map(item => (
                          <span key={item.id} className="text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-slate-400">
                            {item.quantity}x {item.item_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Order highlight */}
                  {req.special_requirements && (
                    <div className="px-6 pb-3">
                      <div className="bg-amber-500/[0.08] border border-amber-500/25 rounded-xl p-3.5 flex items-start gap-2.5">
                        <Pencil size={14} className="text-amber-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">Custom Order / Special Requirements</p>
                          <p className="text-sm text-amber-100/90 whitespace-pre-wrap leading-relaxed">{req.special_requirements}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="px-6 py-4 border-t border-white/5 bg-white/[0.01]">
                    {rejectingId === req.id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Reason for Rejection</label>
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={2}
                            placeholder="e.g. Budget constraints, overlapping events, insufficient notice period..."
                            className="w-full bg-[#060810] border border-red-500/20 rounded-xl py-3 px-4 text-white text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all placeholder:text-slate-600 outline-none resize-none"
                          />
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={actionLoading === req.id || !rejectReason.trim()}
                            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {actionLoading === req.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <X size={16} />}
                            Confirm Rejection
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                            className="px-6 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-semibold text-sm transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : holdingId === req.id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Quoted Total Amount (₹)</label>
                          <input
                            type="number"
                            min="1"
                            value={holdAmount}
                            onChange={(e) => setHoldAmount(e.target.value)}
                            placeholder="e.g. 25000"
                            className="w-full bg-[#060810] border border-amber-500/20 rounded-xl py-3 px-4 text-white text-sm font-mono focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-600 outline-none"
                          />
                          <p className="text-[11px] text-slate-500 mt-1.5">The requester will pay this from their wallet (voucher-funded or topped up) once on hold.</p>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleHold(req.id)}
                            disabled={actionLoading === req.id || !holdAmount || Number(holdAmount) <= 0}
                            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-[#1a1207] font-bold text-sm transition-all hover:shadow-lg hover:shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {actionLoading === req.id ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Clock size={16} />}
                            Put On Hold
                          </button>
                          <button
                            onClick={() => { setHoldingId(null); setHoldAmount(''); }}
                            className="px-6 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-semibold text-sm transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={actionLoading === req.id}
                          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {actionLoading === req.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={16} />}
                          Approve Request
                        </button>
                        {req.special_requirements && (
                          <button
                            onClick={() => { setHoldingId(req.id); setHoldAmount(req.total_amount ? String(req.total_amount) : ''); }}
                            className="flex-1 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                          >
                            <Clock size={16} /> Put On Hold
                          </button>
                        )}
                        <button
                          onClick={() => setRejectingId(req.id)}
                          className="flex-1 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/15 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                        >
                          <X size={16} /> Reject
                        </button>
                        <button
                          onClick={() => setViewEvent(req)}
                          className="px-4 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 text-slate-400 hover:text-white text-sm font-semibold transition-all"
                        >
                          Details
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ FUNDS TAB — Financial Ledger ═══════════════════════ */}
      {activeTab === 'funds' && (
        <div className="bg-[#0a0c16] rounded-2xl border border-white/5 overflow-hidden">
          {/* Ledger Header */}
          <div className="p-6 border-b border-white/5 bg-gradient-to-r from-[#0a0c16] to-[#0d1020]">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/10">
                    <Table size={18} className="text-emerald-400" />
                  </div>
                  Event Head Fund Distribution Ledger
                </h2>
                <p className="text-slate-500 text-sm mt-1 ml-12">Financial overview of all event head budget allocations</p>
              </div>
              <button
                onClick={() => downloadCSV('funds')}
                className="px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all text-white hover:border-white/20"
              >
                <Download size={16} /> Export Ledger
              </button>
            </div>

            {/* Summary Stats Row */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Total Allocated</p>
                <p className="text-xl font-bold text-emerald-400">₹{deans.reduce((sum, d) => sum + (d.total_budget || 0), 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Total Used</p>
                <p className="text-xl font-bold text-amber-400">₹{deans.reduce((sum, d) => sum + (d.used_budget || 0), 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Remaining</p>
                <p className="text-xl font-bold text-white">₹{deans.reduce((sum, d) => sum + ((d.total_budget || 0) - (d.used_budget || 0)), 0).toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="py-4 px-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Event Head</th>
                  <th className="py-4 px-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Allocated</th>
                  <th className="py-4 px-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Used</th>
                  <th className="py-4 px-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Utilization</th>
                  <th className="py-4 px-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Remaining</th>
                  <th className="py-4 px-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="w-8 h-8 border-2 border-[#8B1C28] border-t-transparent rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : deans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No event heads registered. Add event heads from the Event Heads tab first.
                    </td>
                  </tr>
                ) : (
                  deans.map((dean) => {
                    const pct = getBudgetPct(dean);
                    const colors = getBudgetColor(pct);
                    const remaining = (dean.total_budget || 0) - (dean.used_budget || 0);

                    return (
                      <tr key={dean.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-white">{dean.name || 'Unnamed'}</span>
                            <span className="text-xs text-slate-500">{dean.school_name || '—'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="text-sm text-emerald-400 font-bold font-mono">₹{(dean.total_budget || 0).toLocaleString('en-IN')}</span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="text-sm text-slate-400 font-mono">₹{(dean.used_budget || 0).toLocaleString('en-IN')}</span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3 min-w-[140px]">
                            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${colors.bar} transition-all duration-500 shadow-lg ${colors.glow}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold ${colors.text} min-w-[38px] text-right`}>{pct.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className={`text-sm font-bold font-mono ${remaining < 0 ? 'text-red-400' : 'text-white'}`}>
                            ₹{remaining.toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex justify-end items-center gap-2">
                            <input
                              type="number"
                              placeholder="Amt"
                              min="1"
                              value={fundInputs[dean.id] || ''}
                              onChange={(e) => setFundInputs({ ...fundInputs, [dean.id]: e.target.value })}
                              className="bg-[#060810] border border-white/10 rounded-lg py-1.5 px-3 text-white text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 w-20 outline-none font-mono"
                            />
                            <button
                              onClick={() => handleUpdateFunds(dean.id, 'add')}
                              disabled={isUpdatingFunds === dean.id || !fundInputs[dean.id] || Number(fundInputs[dean.id]) <= 0}
                              className="bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 disabled:opacity-30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-emerald-500/10"
                            >
                              + Add
                            </button>
                            <button
                              onClick={() => handleUpdateFunds(dean.id, 'deduct')}
                              disabled={isUpdatingFunds === dean.id || !fundInputs[dean.id] || Number(fundInputs[dean.id]) <= 0}
                              className="bg-red-500/15 hover:bg-red-500/30 text-red-400 disabled:opacity-30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-red-500/10"
                            >
                              − Deduct
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════ REPORTS TAB ═══════════════════════ */}
      {activeTab === 'reports' && (
        <div className="flex flex-col gap-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#8B1C28] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : reportEvents.length === 0 ? (
            <div className="bg-[#0a0c16] rounded-2xl p-16 text-center border border-white/5">
              <Receipt size={48} className="mx-auto mb-4 text-slate-600" />
              <h3 className="text-lg font-bold text-white mb-2">No catering data yet</h3>
              <p className="text-slate-500">Reports populate once events are scheduled and approved.</p>
            </div>
          ) : (
            <>
              {/* Download toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Catering Reports</h2>
                  <p className="text-xs text-slate-500">Full event spending breakdown</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button onClick={downloadReportPdf} className="px-4 py-2.5 rounded-xl bg-[#8B1C28]/15 border border-[#8B1C28]/30 text-rose-300 text-[12px] font-bold hover:bg-[#8B1C28]/25 transition-all flex items-center gap-2 btn-press">
                    <Printer size={14} /> Download PDF
                  </button>
                  <button onClick={() => downloadCSV('events')} className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px] font-bold hover:bg-emerald-500/20 transition-all flex items-center gap-2 btn-press">
                    <Download size={14} /> Download Excel
                  </button>
                </div>
              </div>

              {/* Summary Ribbon */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#0a0c16] rounded-2xl border border-white/5 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-xs">Total Catering Spend</span>
                    <TrendingUp size={18} className="text-emerald-400" />
                  </div>
                  <h3 className="text-3xl font-bold text-emerald-400 font-mono">₹{totalCateringSpend.toLocaleString('en-IN')}</h3>
                  <p className="text-xs text-slate-500 mt-2">Across {reportEvents.length} active event{reportEvents.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-[#0a0c16] rounded-2xl border border-white/5 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-xs">Delegates</span>
                    <Users size={18} className="text-rose-400" />
                  </div>
                  <h3 className="text-3xl font-bold text-white">{perHead.length}</h3>
                  <p className="text-xs text-slate-500 mt-2">Distinct delegates</p>
                </div>
                <div className="bg-[#0a0c16] rounded-2xl border border-white/5 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-xs">Avg / Event</span>
                    <Receipt size={18} className="text-amber-400" />
                  </div>
                  <h3 className="text-3xl font-bold text-white font-mono">₹{avgPerEvent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
                  <p className="text-xs text-slate-500 mt-2">Mean catering cost per event</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Per Event Head Spending */}
                <div className="bg-[#0a0c16] rounded-2xl border border-white/5 p-6">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-5">
                    <div className="p-2 bg-rose-500/10 rounded-lg border border-rose-500/10"><Users size={16} className="text-rose-400" /></div>
                    Per Delegate Spending
                  </h2>
                  <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                    {perHead.map((h) => (
                      <div key={h.email}>
                        <div className="flex justify-between items-center mb-1.5">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{h.name}</p>
                            <p className="text-[11px] text-slate-500 truncate">{h.email} · {h.count} event{h.count !== 1 ? 's' : ''}</p>
                          </div>
                          <span className="text-sm font-bold text-emerald-400 font-mono shrink-0 ml-3">₹{h.total.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#8B1C28] to-rose-500 rounded-full" style={{ width: `${(h.total / maxHeadTotal) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Category-wise Consumption */}
                <div className="bg-[#0a0c16] rounded-2xl border border-white/5 p-6">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-5">
                    <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/10"><Tag size={16} className="text-indigo-400" /></div>
                    Category-wise Consumption
                  </h2>
                  <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                    {categories.map((c) => (
                      <div key={c.category}>
                        <div className="flex justify-between items-center mb-1.5">
                          <p className="text-sm font-semibold text-white truncate">{c.category}</p>
                          <span className="text-xs text-slate-400 shrink-0 ml-3">
                            <span className="font-mono text-slate-300">{c.qty}</span> units · <span className="font-mono text-emerald-400">₹{c.total.toLocaleString('en-IN')}</span>
                          </span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" style={{ width: `${(c.total / maxCatTotal) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Monthly Catering Cost Analysis */}
              <div className="bg-[#0a0c16] rounded-2xl border border-white/5 p-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                  <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/10"><TrendingUp size={16} className="text-emerald-400" /></div>
                  Monthly Catering Cost Analysis
                </h2>
                <div className="flex items-end gap-3 h-52 overflow-x-auto pb-2">
                  {monthly.map((m) => (
                    <div key={m.key} className="flex flex-col items-center justify-end gap-2 flex-1 min-w-[64px] h-full">
                      <span className="text-[11px] font-bold text-emerald-400 font-mono">₹{m.total >= 1000 ? `${(m.total / 1000).toFixed(1)}k` : m.total}</span>
                      <div className="w-full bg-gradient-to-t from-[#8B1C28] to-rose-500 rounded-t-lg transition-all hover:opacity-80" style={{ height: `${Math.max((m.total / maxMonthTotal) * 100, 3)}%` }} title={`${m.label}: ₹${m.total.toLocaleString('en-IN')} (${m.count} events)`} />
                      <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-Order Interim Invoices */}
              <div className="bg-[#0a0c16] rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-6 border-b border-white/5 flex items-center gap-2">
                  <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/10"><Receipt size={16} className="text-amber-400" /></div>
                  <h2 className="text-lg font-bold text-white">Per-Order Interim Invoices</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/[0.02]">
                        <th className="py-3 px-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Event</th>
                        <th className="py-3 px-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Delegate</th>
                        <th className="py-3 px-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                        <th className="py-3 px-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Amount</th>
                        <th className="py-3 px-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {reportEvents.map((evt) => (
                        <tr key={evt.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 px-6">
                            <span className="text-sm font-semibold text-white">{evt.event_name}</span>
                          </td>
                          <td className="py-4 px-6 text-sm text-slate-400">{evt.staff_name || '—'}</td>
                          <td className="py-4 px-6 text-sm text-slate-400">{new Date(evt.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td className="py-4 px-6 text-right text-sm font-bold text-emerald-400 font-mono">₹{Number(evt.total_amount).toLocaleString('en-IN')}</td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => printInvoice(evt)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-white/20 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition-all"
                            >
                              <Printer size={13} /> Invoice
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

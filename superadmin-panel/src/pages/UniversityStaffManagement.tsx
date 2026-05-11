import { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { Users, Upload, UserPlus, Trash2, AlertTriangle, Download, FileSpreadsheet, CheckCircle, XCircle, Search } from 'lucide-react';

interface UniversityStaff {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  user_type: string;
  created_at: string;
}

interface CsvEntry {
  name: string;
  phone: string;
}

interface BulkResult {
  created: number;
  skipped: number;
  created_staff: UniversityStaff[];
  skipped_details: { phone: string; name: string; reason: string }[];
}

export default function UniversityStaffManagement() {
  const [staffList, setStaffList] = useState<UniversityStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // CSV Upload Modal
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvData, setCsvData] = useState<CsvEntry[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState<BulkResult | null>(null);
  const [csvError, setCsvError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<UniversityStaff | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Toast
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => { fetchStaff(); }, []);

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/superadmin/university-staff');
      setStaffList(data);
    } catch (err) {
      console.error('Failed to fetch university staff:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Add Single Staff ──
  const handleAdd = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      setModalError('Name and phone are required');
      return;
    }
    setModalLoading(true);
    setModalError('');
    try {
      await api.post('/superadmin/university-staff', {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
      });
      setShowAddModal(false);
      setFormData({ name: '', phone: '', email: '' });
      setSuccessMsg('Staff member created successfully');
      fetchStaff();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to create staff member');
    } finally {
      setModalLoading(false);
    }
  };

  // ── CSV Parsing ──
  const handleCsvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setCsvError('');
    setCsvResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        setCsvError('CSV must have a header row and at least one data row');
        return;
      }

      const header = lines[0].toLowerCase().split(',').map(h => h.trim());
      const nameIdx = header.findIndex(h => h === 'name');
      const phoneIdx = header.findIndex(h => h === 'phone');

      if (nameIdx === -1 || phoneIdx === -1) {
        setCsvError('CSV must have "name" and "phone" columns');
        return;
      }

      const entries: CsvEntry[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (cols[nameIdx] && cols[phoneIdx]) {
          entries.push({
            name: cols[nameIdx],
            phone: cols[phoneIdx],
          });
        }
      }

      if (entries.length === 0) {
        setCsvError('No valid entries found in CSV');
        return;
      }

      setCsvData(entries);
    };
    reader.readAsText(file);
  };

  const handleCsvUpload = async () => {
    if (csvData.length === 0) return;
    setCsvUploading(true);
    setCsvError('');
    try {
      const { data } = await api.post('/superadmin/university-staff/bulk', { staff: csvData });
      setCsvResult(data);
      setSuccessMsg(`${data.created} staff members created`);
      fetchStaff();
    } catch (err: any) {
      setCsvError(err.response?.data?.message || 'Bulk import failed');
    } finally {
      setCsvUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = 'name,phone\nJohn Doe,9876543210\nJane Smith,9123456789\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'staff_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await api.delete(`/superadmin/university-staff/${deleteTarget.id}`);
      setDeleteTarget(null);
      setDeleteConfirmed(false);
      setSuccessMsg('Staff member removed');
      fetchStaff();
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'Failed to delete');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Filtered list ──
  const filtered = staffList.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone.includes(searchQuery)
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Success Toast */}
      {successMsg && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-6 py-3 rounded-xl flex items-center gap-3 shadow-2xl animate-slide-in backdrop-blur-md">
          <CheckCircle size={18} className="shrink-0" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#e5e2e1] tracking-tight flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/20 flex items-center justify-center">
            <Users size={20} className="text-red-400" />
          </div>
          University Staff Management
        </h1>
        <p className="text-[#a38b88] text-sm mt-2 ml-[52px]">
          Create and manage university staff members who can access staff features in the app (group orders, pre-orders, catering, coupons).
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#1c1b1b]/60 border border-[#554240]/15 rounded-2xl p-5">
          <p className="text-[#a38b88] text-xs font-medium uppercase tracking-wider">Total Staff</p>
          <p className="text-3xl font-bold text-[#e5e2e1] mt-1">{staffList.length}</p>
        </div>
        <div className="bg-[#1c1b1b]/60 border border-[#554240]/15 rounded-2xl p-5">
          <p className="text-[#a38b88] text-xs font-medium uppercase tracking-wider">Added This Week</p>
          <p className="text-3xl font-bold text-[#e5e2e1] mt-1">
            {staffList.filter(s => {
              const d = new Date(s.created_at);
              const now = new Date();
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              return d >= weekAgo;
            }).length}
          </p>
        </div>
        <div className="bg-[#1c1b1b]/60 border border-[#554240]/15 rounded-2xl p-5">
          <p className="text-[#a38b88] text-xs font-medium uppercase tracking-wider">Active Staff</p>
          <p className="text-3xl font-bold text-[#e5e2e1] mt-1">
            {staffList.length}
          </p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a38b88]" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-[#1c1b1b]/60 border border-[#554240]/20 rounded-xl text-[#e5e2e1] placeholder-[#a38b88]/50 text-sm focus:outline-none focus:border-red-500/40 transition-colors"
          />
        </div>
        <div className="flex items-center gap-3 ml-4">
          <button
            onClick={() => { setShowCsvModal(true); setCsvData([]); setCsvFileName(''); setCsvResult(null); setCsvError(''); }}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#554240]/20 bg-[#1c1b1b]/60 text-[#dcc0bd] text-sm font-medium hover:bg-[#1c1b1b] hover:text-red-400 hover:border-red-500/30 transition-all"
          >
            <Upload size={16} />
            Import CSV
          </button>
          <button
            onClick={() => { setShowAddModal(true); setFormData({ name: '', phone: '', email: '' }); setModalError(''); }}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#f0513e] to-[#8B1C28] text-white text-sm font-semibold hover:shadow-lg hover:shadow-red-600/20 transition-all"
          >
            <UserPlus size={16} />
            Add Staff
          </button>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-[#1c1b1b]/60 border border-[#554240]/15 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#554240]/15">
              <th className="text-left px-6 py-4 text-xs font-semibold text-[#a38b88] uppercase tracking-wider">Name</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[#a38b88] uppercase tracking-wider">Phone</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[#a38b88] uppercase tracking-wider">Email</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-[#a38b88] uppercase tracking-wider">Created</th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-[#a38b88] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-16 text-[#a38b88]">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-16 text-[#a38b88]">
                {searchQuery ? 'No matching staff found' : 'No university staff members yet. Click "Add Staff" or "Import CSV" to get started.'}
              </td></tr>
            ) : (
              filtered.map((staff) => (
                <tr key={staff.id} className="border-b border-[#554240]/10 hover:bg-[#1c1b1b]/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                        <span className="text-red-400 text-sm font-semibold">{staff.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="text-[#e5e2e1] font-medium text-sm">{staff.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[#dcc0bd] text-sm font-mono">+91 {staff.phone}</td>
                  <td className="px-6 py-4 text-[#dcc0bd] text-sm">{staff.email || '—'}</td>
                  <td className="px-6 py-4 text-[#a38b88] text-sm">
                    {new Date(staff.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => { setDeleteTarget(staff); setDeleteConfirmed(false); setDeleteError(''); }}
                      className="p-2 rounded-lg text-[#a38b88] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ══ Add Staff Modal ══ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="bg-[#181717] border border-[#554240]/20 rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#e5e2e1] mb-6 flex items-center gap-3">
              <UserPlus size={20} className="text-red-400" />
              Add University Staff
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#a38b88] mb-1.5 uppercase tracking-wider">Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0e0e0e] border border-[#554240]/20 rounded-xl text-[#e5e2e1] text-sm focus:outline-none focus:border-red-500/40"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a38b88] mb-1.5 uppercase tracking-wider">Phone Number *</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0e0e0e] border border-[#554240]/20 rounded-xl text-[#e5e2e1] text-sm focus:outline-none focus:border-red-500/40"
                  placeholder="9876543210"
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#a38b88] mb-1.5 uppercase tracking-wider">Email Address *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-[#0e0e0e] border border-[#554240]/20 rounded-xl text-[#e5e2e1] text-sm focus:outline-none focus:border-red-500/40"
                  placeholder="staff@university.edu"
                />
              </div>
            </div>

            {modalError && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{modalError}</div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-5 py-2.5 rounded-xl border border-[#554240]/20 text-[#dcc0bd] text-sm font-medium hover:bg-[#1c1b1b] transition-colors">Cancel</button>
              <button onClick={handleAdd} disabled={modalLoading} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#f0513e] to-[#8B1C28] text-white text-sm font-semibold hover:shadow-lg hover:shadow-red-600/20 transition-all disabled:opacity-50">
                {modalLoading ? 'Creating...' : 'Create Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CSV Upload Modal ══ */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCsvModal(false)}>
          <div className="bg-[#181717] border border-[#554240]/20 rounded-2xl p-8 w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#e5e2e1] mb-2 flex items-center gap-3">
              <FileSpreadsheet size={20} className="text-red-400" />
              Import Staff from CSV
            </h2>
            <p className="text-[#a38b88] text-sm mb-6">Upload a CSV file with columns: <code className="bg-[#0e0e0e] px-2 py-0.5 rounded text-red-400 text-xs">name,phone</code></p>

            <div className="flex-1 overflow-y-auto">
              {/* Upload Area */}
              {csvData.length === 0 && !csvResult && (
                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#554240]/30 rounded-2xl p-12 text-center cursor-pointer hover:border-red-500/40 hover:bg-red-500/5 transition-all"
                  >
                    <Upload size={40} className="mx-auto text-[#a38b88] mb-4" />
                    <p className="text-[#e5e2e1] font-medium">Click to upload CSV file</p>
                    <p className="text-[#a38b88] text-sm mt-1">or drag and drop</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvFileSelect} className="hidden" />

                  <button onClick={downloadTemplate} className="flex items-center gap-2 text-red-400 text-sm font-medium hover:text-red-300 transition-colors">
                    <Download size={14} />
                    Download CSV template
                  </button>
                </div>
              )}

              {/* CSV Preview */}
              {csvData.length > 0 && !csvResult && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[#e5e2e1] text-sm font-medium">
                      📄 {csvFileName} — <span className="text-red-400">{csvData.length} entries</span>
                    </p>
                    <button onClick={() => { setCsvData([]); setCsvFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-[#a38b88] text-sm hover:text-red-400 transition-colors">Clear</button>
                  </div>
                  <div className="max-h-60 overflow-y-auto rounded-xl border border-[#554240]/15">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-[#0e0e0e]">
                        <tr className="border-b border-[#554240]/15">
                          <th className="text-left px-4 py-2 text-xs text-[#a38b88]">#</th>
                          <th className="text-left px-4 py-2 text-xs text-[#a38b88]">Name</th>
                          <th className="text-left px-4 py-2 text-xs text-[#a38b88]">Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.map((row, i) => (
                          <tr key={i} className="border-b border-[#554240]/10">
                            <td className="px-4 py-2 text-[#a38b88]">{i + 1}</td>
                            <td className="px-4 py-2 text-[#e5e2e1]">{row.name}</td>
                            <td className="px-4 py-2 text-[#dcc0bd] font-mono">{row.phone}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Results */}
              {csvResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                      <CheckCircle size={24} className="mx-auto text-emerald-400 mb-2" />
                      <p className="text-2xl font-bold text-emerald-400">{csvResult.created}</p>
                      <p className="text-xs text-emerald-400/70">Created</p>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                      <XCircle size={24} className="mx-auto text-amber-400 mb-2" />
                      <p className="text-2xl font-bold text-amber-400">{csvResult.skipped}</p>
                      <p className="text-xs text-amber-400/70">Skipped</p>
                    </div>
                  </div>

                  {csvResult.skipped_details.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-[#a38b88] mb-2">Skipped entries:</p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {csvResult.skipped_details.map((s, i) => (
                          <div key={i} className="flex items-center justify-between bg-[#0e0e0e] rounded-lg px-3 py-2 text-sm">
                            <span className="text-[#dcc0bd]">{s.name} ({s.phone})</span>
                            <span className="text-amber-400 text-xs">{s.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {csvError && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{csvError}</div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#554240]/15">
              <button onClick={() => setShowCsvModal(false)} className="px-5 py-2.5 rounded-xl border border-[#554240]/20 text-[#dcc0bd] text-sm font-medium hover:bg-[#1c1b1b] transition-colors">
                {csvResult ? 'Done' : 'Cancel'}
              </button>
              {csvData.length > 0 && !csvResult && (
                <button onClick={handleCsvUpload} disabled={csvUploading} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#f0513e] to-[#8B1C28] text-white text-sm font-semibold hover:shadow-lg hover:shadow-red-600/20 transition-all disabled:opacity-50">
                  {csvUploading ? 'Importing...' : `Import ${csvData.length} Staff`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Delete Confirmation Modal ══ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="bg-[#181717] border border-[#554240]/20 rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="text-red-400" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#e5e2e1]">Remove Staff Member</h3>
                <p className="text-[#a38b88] text-sm">This will delete {deleteTarget.name}'s account</p>
              </div>
            </div>

            {!deleteConfirmed ? (
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteTarget(null)} className="px-5 py-2.5 rounded-xl border border-[#554240]/20 text-[#dcc0bd] text-sm font-medium hover:bg-[#1c1b1b] transition-colors">Cancel</button>
                <button onClick={() => setDeleteConfirmed(true)} className="px-5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-colors">Continue</button>
              </div>
            ) : (
              <div>
                <p className="text-amber-400 text-sm mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  ⚠️ Are you absolutely sure? This action cannot be undone. The user will lose access to all staff features.
                </p>
                {deleteError && <p className="text-red-400 text-sm mb-3">{deleteError}</p>}
                <div className="flex justify-end gap-3">
                  <button onClick={() => setDeleteTarget(null)} className="px-5 py-2.5 rounded-xl border border-[#554240]/20 text-[#dcc0bd] text-sm font-medium hover:bg-[#1c1b1b] transition-colors">Cancel</button>
                  <button onClick={handleDelete} disabled={deleteLoading} className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">
                    {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

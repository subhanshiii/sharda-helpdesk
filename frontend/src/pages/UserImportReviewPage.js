import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiCheck, FiUpload } from 'react-icons/fi';
import API from '../utils/api';
import { Alert, ConfirmDialog, PageHeader } from '../components/ui';
import { usePermissions } from '../context/PermissionContext';

const EMPTY_ROW = { systemId: '', name: '', email: '', role: 'student' };
const ROLE_OPTIONS = ['student', 'faculty', 'staff', 'admin'];

const parseCsvText = (csvText) => {
  const sanitized = String(csvText || '').replace(/^\uFEFF/, '');
  const lines = sanitized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) {
    throw new Error('CSV file is empty');
  }

  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(',').map((part) => part.trim());
  const expected = ['systemId', 'name', 'email', 'role'];
  if (headers.join(',') !== expected.join(',')) {
    throw new Error('CSV header must be: systemId,name,email,role');
  }

  return rows.map((line, index) => {
    const [systemId = '', name = '', email = '', role = 'student'] = line.split(',').map((part) => part.trim());
    return { id: `${index + 1}`, rowNumber: index + 2, systemId, name, email, role: role || 'student' };
  });
};

const buildCsvText = (rows) => [
  'systemId,name,email,role',
  ...rows.map((row) => [row.systemId, row.name, row.email, row.role].join(',')),
].join('\n');

export default function UserImportReviewPage() {
  const navigate = useNavigate();
  const { isSuperAdmin } = usePermissions();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsedRows = parseCsvText(text);
      setRows(parsedRows);
      setFileName(file.name);
      setError('');
      setImportResult(null);
    } catch (parseError) {
      setRows([]);
      setFileName(file.name || '');
      setError(parseError.message || 'Could not read the CSV file');
    } finally {
      event.target.value = '';
    }
  };

  const updateRow = (id, key, value) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const handleConfirmImport = async () => {
    setUploading(true);
    try {
      const csv = buildCsvText(rows);
      const res = await API.post('/users/import', { csv });
      setImportResult(res.data);
      toast.success(res.data?.message || 'Import completed');
      setConfirmOpen(false);
    } catch (requestError) {
      const payload = requestError.response?.data || { message: 'Import failed' };
      setImportResult(payload);
      setError(payload.message || 'Import failed');
      toast.error(payload.message || 'Import failed');
      setConfirmOpen(false);
    } finally {
      setUploading(false);
    }
  };

  const hasRows = rows.length > 0;
  const createdCount = useMemo(() => importResult?.summary?.created || 0, [importResult]);

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmOpen}
        title="Confirm CSV import"
        description={`Add ${rows.length} reviewed users to the system now? Users will only be created after you confirm.`}
        confirmLabel="Add Users"
        loading={uploading}
        onConfirm={handleConfirmImport}
        onClose={() => setConfirmOpen(false)}
      />

      <PageHeader
        title="Import Users"
        subtitle="Upload a CSV, review every row, edit details if needed, then confirm before creating accounts."
        action={(
          <button type="button" onClick={() => navigate('/users')} className="btn-secondary">
            <FiArrowLeft size={14} />
            Back to Identity & Access
          </button>
        )}
      />

      {error ? <Alert type="error" message={error} /> : null}
      {importResult?.summary ? (
        <Alert
          type={createdCount ? 'success' : 'warning'}
          message={`Processed ${importResult.summary.totalRows} rows. Created ${importResult.summary.created}. Failed ${importResult.summary.failed}. Imported users will verify email first, then set their password before signing in.`}
        />
      ) : null}

      <div className="card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-gray-900">CSV Review</h2>
            <p className="mt-1 text-sm text-gray-500">Expected header: <span className="font-mono">systemId,name,email,role</span></p>
          </div>
          <label className="btn-secondary cursor-pointer">
            <FiUpload size={14} />
            {fileName ? `Replace ${fileName}` : 'Upload CSV'}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </label>
        </div>

        {!hasRows ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-200 px-6 py-10 text-center text-sm text-gray-400">
            Upload a CSV file to review users before importing.
          </div>
        ) : (
          <>
          <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Row', 'System ID', 'Name', 'Email', 'Role'].map((heading) => (
                      <th key={heading} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-3 text-gray-400">{row.rowNumber}</td>
                      <td className="px-3 py-3"><input className="input" value={row.systemId} onChange={(event) => updateRow(row.id, 'systemId', event.target.value)} /></td>
                      <td className="px-3 py-3"><input className="input" value={row.name} onChange={(event) => updateRow(row.id, 'name', event.target.value)} /></td>
                      <td className="px-3 py-3"><input className="input" type="email" value={row.email} onChange={(event) => updateRow(row.id, 'email', event.target.value)} /></td>
                      <td className="px-3 py-3">
                        <select className="input" value={row.role} onChange={(event) => updateRow(row.id, 'role', event.target.value)}>
                          {ROLE_OPTIONS.filter((role) => isSuperAdmin || role !== 'admin').map((role) => <option key={role} value={role}>{role}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Imported users do not receive a usable password at creation time. Their access flow is: email verification, password setup, then sign in.
            </div>

            {importResult?.errors?.length ? (
              <div className="mt-5 max-h-52 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {importResult.errors.map((rowError, index) => (
                  <p key={`${rowError.row || index}-${rowError.message}`}>Row {rowError.row || '—'}: {rowError.message}</p>
                ))}
              </div>
            ) : null}

            {importResult?.data?.length ? (
              <div className="mt-5 max-h-56 overflow-y-auto rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {importResult.data.map((createdUser) => (
                  <p key={createdUser.systemId}>
                    {createdUser.name} ({createdUser.systemId}) — verification: {createdUser.verificationDelivery === 'preview' ? 'preview link generated' : 'email sent'}, password setup required after verification.
                  </p>
                ))}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setRows((current) => [...current, { ...EMPTY_ROW, id: `${Date.now()}-${current.length}`, rowNumber: current.length + 2 }])} className="btn-secondary">
                Add Row
              </button>
              <button type="button" onClick={() => setConfirmOpen(true)} disabled={!rows.length || uploading} className="btn-primary">
                <FiCheck size={14} />
                {uploading ? 'Importing...' : 'Review & Confirm'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

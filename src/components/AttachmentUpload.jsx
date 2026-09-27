import { useState } from 'react';
import { uploadAttachment } from '../lib/data';

// bucket: 'event-posters'; folder: 'Events Folder' | 'Notice Folder'
// accept: 'image/*' | 'application/pdf,image/*'
export default function AttachmentUpload({ bucket, folder, accept, label, helperText, value, onChange, onBusyChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    try {
      const url = await uploadAttachment(bucket, file, folder);
      onChange({ url, name: file.name, type: file.type.startsWith('image/') ? 'image' : 'pdf' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
      e.target.value = '';
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-mute">{label}</label>
      {helperText && <p className="mb-2 text-xs leading-5 text-mute">{helperText}</p>}
      {value?.url ? (
        <div className="flex items-center justify-between rounded-xl border border-line bg-soft/40 px-3 py-2">
          <a href={value.url} target="_blank" rel="noreferrer" className="truncate text-sm font-semibold text-primary">
            {value.name || 'View file'}
          </a>
          <button type="button" onClick={() => onChange(null)} className="text-sm font-semibold text-danger">
            Remove
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-line py-6 text-sm font-semibold text-mute hover:border-primary hover:text-primary">
          {busy ? 'Uploading…' : 'Click to upload'}
          <input type="file" accept={accept} className="hidden" onChange={handleFile} disabled={busy} />
        </label>
      )}
      {error && <p className="mt-1 text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}

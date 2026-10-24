import { useState } from 'react';
import { ACCEPTED_TYPES, MAX_PHOTO_MB } from '../constants/issueConstants';
import { useObjectUrl } from '../utils/useObjectUrl';

export default function PhotoUpload({ file, onChange, error }) {
  const preview = useObjectUrl(file);
  const [localError, setLocalError] = useState('');

  const handleSelect = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';                       // lets the user pick the same file again
    if (!picked) return;
    if (!ACCEPTED_TYPES.includes(picked.type)) return setLocalError('Only JPG, PNG or WebP images are allowed');
    if (picked.size > MAX_PHOTO_MB * 1024 * 1024) return setLocalError(`Image must be smaller than ${MAX_PHOTO_MB} MB`);
    setLocalError('');
    onChange(picked);
  };

  const shownError = localError || error;
  return (
    <div>
      <label htmlFor="photo" className="block text-sm font-medium mb-2">Photo of the problem</label>
      {preview ? (
        <div>
          <img src={preview} alt="Selected issue" className="w-full max-h-72 rounded object-cover" />
          <button type="button" onClick={() => onChange(null)} className="mt-2 text-sm text-red-700 underline">
            Remove photo
          </button>
        </div>
      ) : (
        <input
          id="photo" type="file" accept="image/jpeg,image/png,image/webp"
          onChange={handleSelect}
          className="block w-full rounded border border-dashed border-gray-400 p-4"
        />
      )}
      {shownError && <p role="alert" className="mt-1 text-sm text-red-700">{shownError}</p>}
    </div>
  );
}

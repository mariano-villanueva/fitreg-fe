import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadFile, deleteFile } from '../api/files';
import type { FileResponse } from '../types';
import AuthImage from './AuthImage';

interface ImageUploadProps {
  value: FileResponse | null;
  onChange: (file: FileResponse | null) => void;
  disabled?: boolean;
}

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function ImageUpload({ value, onChange, disabled }: ImageUploadProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    e.target.value = '';

    setError('');

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(t('file_upload_error_type'));
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(t('file_upload_error_size'));
      return;
    }

    setUploading(true);
    try {
      const result = await uploadFile(file);
      onChange(result);
    } catch {
      setError(t('file_upload_error_generic'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!value) return;
    if (!confirm(t('file_delete_confirm'))) return;

    try {
      await deleteFile(value.uuid);
      onChange(null);
    } catch {
      setError(t('file_upload_error_generic'));
    }
  };

  // Strip /api suffix from VITE_API_URL since value.url already includes /api
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/api\/?$/, '');
  const imageUrl = value ? `${apiBase}${value.url}` : null;

  return (
    <div className="image-upload">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled || uploading}
      />

      <div className="image-upload-row">
        <div className="image-upload-preview">
          {uploading ? (
            <div className="image-upload-spinner" />
          ) : value && imageUrl ? (
            <AuthImage src={imageUrl} alt={value.original_name} />
          ) : (
            <div className="image-upload-placeholder">📷</div>
          )}
        </div>

        <div className="image-upload-actions">
          {value ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleDelete}
              disabled={disabled}
            >
              {t('file_delete')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || uploading}
            >
              {uploading ? t('file_uploading') : t('file_upload_button')}
            </button>
          )}
          {!value && !uploading && (
            <span className="image-upload-hint">{t('file_upload_hint')}</span>
          )}
        </div>
      </div>

      {error && <div className="image-upload-error">{error}</div>}
    </div>
  );
}

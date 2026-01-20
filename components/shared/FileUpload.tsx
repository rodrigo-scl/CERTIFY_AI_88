// Componente de carga de archivos - Rodrigo Osorio v0.3
import React, { useState, useRef, useCallback, memo } from 'react';
import { Upload, X, FileText, Image, File, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { validateFile, FileValidation } from '../../services/storageService';

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  disabled?: boolean;
  accept?: string;
}

const getFileIcon = (file: File) => {
  if (file.type.startsWith('image/')) return Image;
  if (file.type === 'application/pdf') return FileText;
  return File;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

export const FileUpload = memo(({ onFileSelect, selectedFile, disabled, accept }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [validation, setValidation] = useState<FileValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File | null) => {
    if (!file) {
      setValidation(null);
      onFileSelect(null);
      return;
    }

    setIsValidating(true);
    try {
      const result = await validateFile(file);
      setValidation(result);
      
      if (result.valid) {
        onFileSelect(file);
      } else {
        onFileSelect(null);
      }
    } catch (error) {
      setValidation({ valid: false, error: 'Error al validar el archivo' });
      onFileSelect(null);
    } finally {
      setIsValidating(false);
    }
  }, [onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [disabled, handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleClick = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled]);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    handleFile(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [handleFile]);

  const FileIcon = selectedFile ? getFileIcon(selectedFile) : Upload;

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${disabled || isValidating ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}
          ${isDragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'}
          ${selectedFile && validation?.valid ? 'border-green-400 bg-green-50' : ''}
          ${validation && !validation.valid ? 'border-red-400 bg-red-50' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          onChange={handleInputChange}
          accept={accept || ".pdf,.jpg,.jpeg,.png,.doc,.docx"}
          className="hidden"
          disabled={disabled || isValidating}
        />

        {isValidating ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
              <Loader2 size={28} className="text-blue-600 animate-spin" />
            </div>
            <div>
              <p className="font-medium text-slate-700">Validando archivo...</p>
              <p className="text-sm text-slate-500 mt-1">Verificando integridad y tipo</p>
            </div>
          </div>
        ) : selectedFile && validation?.valid ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
              <FileIcon size={28} className="text-green-600" />
            </div>
            <div className="max-w-full">
              <p className="font-medium text-slate-900 truncate max-w-[250px]" title={selectedFile.name}>
                {selectedFile.name}
              </p>
              <p className="text-sm text-slate-500">{formatFileSize(selectedFile.size)}</p>
            </div>
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <CheckCircle size={16} />
              <span>Archivo válido</span>
            </div>
            <button
              onClick={handleRemove}
              className="absolute top-3 right-3 p-1.5 bg-slate-200 hover:bg-red-100 rounded-full text-slate-500 hover:text-red-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isDragging ? 'bg-brand-100' : 'bg-slate-100'}`}>
              <Upload size={28} className={isDragging ? 'text-brand-600' : 'text-slate-400'} />
            </div>
            <div>
              <p className="font-medium text-slate-700">
                {isDragging ? 'Suelta el archivo aquí' : 'Arrastra o haz clic para seleccionar'}
              </p>
              <p className="text-sm text-slate-500 mt-1">PDF, JPG, PNG, DOC (máx. 10MB)</p>
            </div>
          </div>
        )}
      </div>

      {validation && !validation.valid && (
        <div className="mt-3 flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span className="text-sm">{validation.error}</span>
        </div>
      )}
    </div>
  );
});


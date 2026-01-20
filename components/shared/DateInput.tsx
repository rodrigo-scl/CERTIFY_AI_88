// Componente de input de fecha con máscara dd-mm-aaaa - Rodrigo Osorio v0.1
import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { autoFormatDate, isValidDateFormat } from '../../services/dateUtils';

interface DateInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export const DateInput: React.FC<DateInputProps> = ({
  label,
  value,
  onChange,
  required = false,
  error,
  disabled = false,
  placeholder = 'dd-mm-aaaa',
  className = ''
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  // Validar cuando el usuario sale del campo
  useEffect(() => {
    if (showValidation && value && !isValidDateFormat(value)) {
      setLocalError('Formato inválido. Use dd-mm-aaaa');
    } else {
      setLocalError(null);
    }
  }, [value, showValidation]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Aplicar formato automático
    const formatted = autoFormatDate(inputValue);

    // Limitar a 10 caracteres (dd-mm-aaaa)
    if (formatted.length <= 10) {
      onChange(formatted);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    setShowValidation(true);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  // Determinar estado visual
  const isValid = value && isValidDateFormat(value);
  const hasError = error || localError;
  const isComplete = value.length === 10;

  // Clases CSS dinámicas
  const inputClasses = `
    w-full px-3 py-2 rounded-lg border text-sm
    transition-all duration-200
    ${disabled ? 'bg-slate-50 cursor-not-allowed' : 'bg-white'}
    ${hasError ? 'border-red-400 focus:ring-red-500' :
      isValid ? 'border-green-400 focus:ring-green-500' :
        isFocused ? 'border-brand-500 focus:ring-brand-500' :
          'border-slate-300'}
    focus:outline-none focus:ring-2
    text-slate-900
    placeholder:text-slate-400
  `.trim();

  return (
    <div className={`${className}`}>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={10}
          className={inputClasses}
        />

        {/* Icono indicador */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {hasError ? (
            <AlertCircle size={18} className="text-red-500" />
          ) : isValid ? (
            <CheckCircle size={18} className="text-green-500" />
          ) : isComplete && !isValid ? (
            <AlertCircle size={18} className="text-red-500" />
          ) : (
            <Calendar size={18} className="text-slate-400" />
          )}
        </div>
      </div>

      {/* Mensaje de error */}
      {hasError && (
        <div className="mt-1.5 flex items-start gap-1.5 text-red-600 text-xs">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error || localError}</span>
        </div>
      )}

      {/* Ayuda visual */}
      {!hasError && isFocused && !isValid && (
        <div className="mt-1.5 text-xs text-slate-500">
          Formato: día-mes-año (ejemplo: 15-03-2024)
        </div>
      )}
    </div>
  );
};


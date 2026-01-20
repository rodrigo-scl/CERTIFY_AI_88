// Utilidades de formato y validación de fechas - Rodrigo Osorio v0.1

/**
 * Convierte fecha de formato dd-mm-aaaa a yyyy-mm-dd (para guardar en BD)
 * @param ddmmyyyy - Fecha en formato dd-mm-aaaa (ej: "15-03-2024")
 * @returns Fecha en formato yyyy-mm-dd (ej: "2024-03-15") o cadena vacía si es inválida
 */
export const formatDateForDB = (ddmmyyyy: string): string => {
  if (!ddmmyyyy || ddmmyyyy === 'N/A') return '';

  const parts = ddmmyyyy.split('-');
  if (parts.length !== 3) return '';

  const [day, month, year] = parts;
  return `${year}-${month}-${day}`;
};

/**
 * Convierte fecha de formato yyyy-mm-dd a dd-mm-aaaa (para mostrar al usuario)
 * @param yyyymmdd - Fecha en formato yyyy-mm-dd (ej: "2024-03-15")
 * @returns Fecha en formato dd-mm-aaaa (ej: "15-03-2024") o "N/A" si es inválida
 */
export const formatDateForDisplay = (yyyymmdd: string): string => {
  if (!yyyymmdd) return 'N/A';

  const parts = yyyymmdd.split('-');
  if (parts.length !== 3) return 'N/A';

  const [year, month, day] = parts;
  return `${day}-${month}-${year}`;
};

/**
 * Valida que una fecha tenga el formato correcto dd-mm-aaaa
 * @param date - Fecha a validar
 * @returns true si el formato es válido, false en caso contrario
 */
export const isValidDateFormat = (date: string): boolean => {
  if (!date) return false;

  // Verificar formato básico dd-mm-aaaa
  const regex = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = date.match(regex);

  if (!match) return false;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  // Validar rangos
  if (day < 1 || day > 31) return false;
  if (month < 1 || month > 12) return false;
  if (year < 1900 || year > 2100) return false;

  // Validar que la fecha sea real (no 31-02-2024)
  const dateObj = new Date(year, month - 1, day);
  return (
    dateObj.getFullYear() === year &&
    dateObj.getMonth() === month - 1 &&
    dateObj.getDate() === day
  );
};

/**
 * Valida que la fecha de emisión sea anterior o igual a la fecha de vencimiento
 * @param issueDate - Fecha de emisión en formato dd-mm-aaaa
 * @param expiryDate - Fecha de vencimiento en formato dd-mm-aaaa
 * @returns true si emisión <= vencimiento, false en caso contrario
 */
export const validateDateRange = (issueDate: string, expiryDate: string): boolean => {
  if (!isValidDateFormat(issueDate) || !isValidDateFormat(expiryDate)) {
    return false;
  }

  const issueDateDB = formatDateForDB(issueDate);
  const expiryDateDB = formatDateForDB(expiryDate);

  return issueDateDB <= expiryDateDB;
};

/**
 * Verifica si una fecha ya está vencida
 * @param expiryDate - Fecha de vencimiento en formato dd-mm-aaaa
 * @returns true si la fecha ya pasó, false si aún no vence
 */
export const isExpired = (expiryDate: string): boolean => {
  if (!isValidDateFormat(expiryDate)) return false;

  const dateDB = formatDateForDB(expiryDate);
  const today = new Date().toISOString().split('T')[0];

  return dateDB < today;
};

/**
 * Obtiene la fecha actual en formato dd-mm-aaaa
 * @returns Fecha actual en formato dd-mm-aaaa
 */
export const getCurrentDate = (): string => {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();

  return `${day}-${month}-${year}`;
};

/**
 * Aplica formato automático mientras el usuario escribe
 * Convierte "15032024" -> "15-03-2024"
 * @param value - Valor actual del input
 * @returns Valor formateado con guiones
 */
export const autoFormatDate = (value: string): string => {
  // Remover todo excepto números
  const numbers = value.replace(/\D/g, '');

  // Aplicar formato progresivo
  if (numbers.length <= 2) {
    return numbers;
  } else if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
  } else {
    return `${numbers.slice(0, 2)}-${numbers.slice(2, 4)}-${numbers.slice(4, 8)}`;
  }
};

/**
 * Valida día del mes según el mes y año (considera años bisiestos)
 * @param day - Día (1-31)
 * @param month - Mes (1-12)
 * @param year - Año
 * @returns true si el día es válido para ese mes/año
 */
export const isValidDay = (day: number, month: number, year: number): boolean => {
  if (day < 1 || day > 31) return false;

  // Días por mes
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Año bisiesto
  if (month === 2 && isLeapYear(year)) {
    return day <= 29;
  }

  return day <= daysInMonth[month - 1];
};

/**
 * Verifica si un año es bisiesto
 * @param year - Año a verificar
 * @returns true si es bisiesto
 */
export const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

/**
 * Parsea una fecha dd-mm-aaaa y retorna sus componentes
 * @param date - Fecha en formato dd-mm-aaaa
 * @returns Objeto con day, month, year o null si es inválida
 */
export const parseDateDMY = (date: string): { day: number; month: number; year: number } | null => {
  const regex = /^(\d{2})-(\d{2})-(\d{4})$/;
  const match = date.match(regex);

  if (!match) return null;

  return {
    day: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    year: parseInt(match[3], 10)
  };
};

/**
 * Formatea un timestamp ISO a una cadena legible en hora local
 * @param isoString - Timestamp ISO (ej: "2024-03-15T14:30:00Z")
 * @returns Cadena formateada (ej: "15-03-2024 11:30")
 */
export const formatTimestampToLocal = (isoString: string | null | undefined): string => {
  if (!isoString) return 'N/A';

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'N/A';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}-${month}-${year} ${hours}:${minutes}`;
  } catch (e) {
    return 'N/A';
  }
};

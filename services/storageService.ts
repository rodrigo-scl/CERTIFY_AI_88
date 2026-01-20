// Servicio de almacenamiento - Rodrigo Osorio v0.8
import { supabase } from './supabaseClient';
import { logger, logOperation } from './logger';
import { encryptFile, decryptFile, isEncrypted } from './cryptoService';

// Configuracion
const TECHNICIAN_BUCKET = 'technician-docs';
const COMPANY_BUCKET = 'company-docs';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Rodrigo Osorio v0.7 - Habilitar encriptación de archivos
const ENCRYPTION_ENABLED = true;

// Rodrigo Osorio v0.12 - Duración de URLs firmadas (1 hora)
const SIGNED_URL_EXPIRY = 3600;
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];

// Mapeo de extensiones a MIME types permitidos
const EXTENSION_TO_MIME: Record<string, string[]> = {
  'pdf': ['application/pdf'],
  'jpg': ['image/jpeg', 'image/jpg'],
  'jpeg': ['image/jpeg', 'image/jpg'],
  'png': ['image/png'],
  'doc': ['application/msword'],
  'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

// Magic numbers para validacion de firma de archivo
const FILE_SIGNATURES: Record<string, number[][]> = {
  'pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'jpg': [[0xFF, 0xD8, 0xFF]], // JPEG
  'png': [[0x89, 0x50, 0x4E, 0x47]], // PNG
  'doc': [[0xD0, 0xCF, 0x11, 0xE0]], // MS Office (legacy)
  'docx': [[0x50, 0x4B, 0x03, 0x04]] // ZIP format (docx es ZIP)
};

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

export interface FileValidation {
  valid: boolean;
  error?: string;
}

// Rodrigo Osorio v0.6 - Progress callback para tracking de subida
export interface UploadProgressCallback {
  onProgress?: (progress: number) => void; // 0-100
  onStart?: () => void;
  onComplete?: () => void;
}

// Configuración de compresión de imágenes
const IMAGE_COMPRESSION_CONFIG = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.85, // 85% quality
  enableCompression: true
};

// Rodrigo Osorio v0.8 - Configuración de sanitización de imágenes
const IMAGE_SANITIZATION_CONFIG = {
  enabled: true,
  jpegQuality: 0.95, // 95% quality para mantener calidad visual
};

// Rodrigo Osorio v0.8 - Sanitizar imagen re-codificándola via Canvas
// Esto elimina metadatos (EXIF) y cualquier payload malicioso (polyglot attacks)
export const sanitizeImage = async (file: File): Promise<File> => {
  // Solo sanitizar imágenes
  if (!file.type.startsWith('image/') || !IMAGE_SANITIZATION_CONFIG.enabled) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      logger.warn('No se pudo crear contexto Canvas, retornando archivo original');
      resolve(file);
      return;
    }

    img.onload = () => {
      // Usar dimensiones originales para mantener calidad
      canvas.width = img.width;
      canvas.height = img.height;

      // Re-dibujar la imagen (esto elimina cualquier payload malicioso)
      ctx.drawImage(img, 0, 0);

      // Determinar formato de salida
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = outputType === 'image/jpeg' ? IMAGE_SANITIZATION_CONFIG.jpegQuality : undefined;

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const sanitizedFile = new File([blob], file.name, {
              type: outputType,
              lastModified: file.lastModified
            });
            logger.log(`Imagen sanitizada: ${file.name} (${(file.size / 1024).toFixed(0)}KB → ${(blob.size / 1024).toFixed(0)}KB)`);
            resolve(sanitizedFile);
          } else {
            // Si falla la conversión, devolver original
            logger.warn('Error al sanitizar imagen, retornando original');
            resolve(file);
          }
        },
        outputType,
        quality
      );

      // Limpiar URL object
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      // Si falla la carga, la imagen puede estar corrupta o ser maliciosa
      logger.warn(`No se pudo cargar imagen para sanitizar: ${file.name}`);
      URL.revokeObjectURL(img.src);
      resolve(file);
    };

    img.src = URL.createObjectURL(file);
  });
};

// Rodrigo Osorio v0.6 - Comprimir imagen antes de subir
export const compressImage = async (file: File): Promise<File> => {
  // Solo comprimir imágenes
  if (!file.type.startsWith('image/') || !IMAGE_COMPRESSION_CONFIG.enableCompression) {
    return file;
  }

  // No comprimir si ya es pequeña (menos de 500KB)
  if (file.size < 500 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    img.onload = () => {
      let { width, height } = img;
      const { maxWidth, maxHeight, quality } = IMAGE_COMPRESSION_CONFIG;

      // Calcular nuevo tamaño manteniendo aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      // Dibujar imagen redimensionada
      ctx.drawImage(img, 0, 0, width, height);

      // Convertir a blob comprimido
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            // Solo usar versión comprimida si es más pequeña
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: file.lastModified
            });
            logger.log(`Imagen comprimida: ${(file.size / 1024).toFixed(0)}KB → ${(blob.size / 1024).toFixed(0)}KB`);
            resolve(compressedFile);
          } else {
            // Mantener original si la compresión no reduce el tamaño
            resolve(file);
          }
        },
        file.type,
        quality
      );
    };

    img.onerror = () => {
      // Si falla la carga, devolver archivo original
      resolve(file);
    };

    img.src = URL.createObjectURL(file);
  });
};

// Verificar firma de archivo (magic numbers)
const checkFileSignature = async (file: File, extension: string): Promise<boolean> => {
  const signatures = FILE_SIGNATURES[extension];
  if (!signatures || signatures.length === 0) return true;

  try {
    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Verificar si alguna firma coincide
    return signatures.some(signature => {
      return signature.every((byte, index) => bytes[index] === byte);
    });
  } catch (err) {
    logger.warn('No se pudo verificar la firma del archivo:', err);
    return true; // En caso de error, permitir el archivo
  }
};

// Validar archivo antes de subir
export const validateFile = async (file: File): Promise<FileValidation> => {
  if (!file) {
    return { valid: false, error: 'No se seleccionó ningún archivo' };
  }

  // Validar tamaño
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `El archivo excede el límite de 10MB (${(file.size / 1024 / 1024).toFixed(2)}MB)` };
  }

  // Validar extension
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
    return { valid: false, error: `Tipo de archivo no permitido. Permitidos: ${ALLOWED_EXTENSIONS.join(', ')}` };
  }

  // Validar MIME type (sin permitir vacios)
  if (!file.type) {
    return { valid: false, error: 'El archivo no tiene tipo MIME válido' };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Tipo MIME no válido para este archivo' };
  }

  // Validar que extension y MIME coincidan
  const allowedMimes = EXTENSION_TO_MIME[extension];
  if (allowedMimes && !allowedMimes.includes(file.type)) {
    return { valid: false, error: `El tipo de archivo (${file.type}) no coincide con la extensión (.${extension})` };
  }

  // Verificar firma del archivo (magic numbers)
  const signatureValid = await checkFileSignature(file, extension);
  if (!signatureValid) {
    return { valid: false, error: 'El contenido del archivo no coincide con su extensión' };
  }

  return { valid: true };
};

// Sanitizar nombre de archivo
const sanitizeFileName = (fileName: string): string => {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Reemplazar caracteres especiales
    .substring(0, 100); // Limitar longitud
};

// Generar nombre unico para archivo con colision-proof
const generateUniqueFileName = (docTypeName: string, originalFileName: string): string => {
  const extension = originalFileName.split('.').pop()?.toLowerCase() || 'pdf';
  const sanitizedDocType = docTypeName
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
    .substring(0, 30);

  // Generar ID unico con timestamp + random para evitar colisiones
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substr(2, 9);
  const uniqueId = `${timestamp}_${randomId}`;

  return `${sanitizedDocType}_${uniqueId}.${extension}`;
};

// Eliminar archivo antiguo antes de subir uno nuevo
export const deleteOldFileBeforeUpload = async (
  bucket: 'technician' | 'company',
  oldFileUrl?: string
): Promise<void> => {
  if (!oldFileUrl) return;

  try {
    const path = extractPathFromUrl(oldFileUrl, bucket);
    if (path) {
      await deleteDocument(bucket, path);
      logger.log(`Archivo antiguo eliminado: ${path}`);
    }
  } catch (err) {
    // Error silencioso - el archivo antiguo puede no existir
    logger.warn('No se pudo eliminar archivo antiguo:', err);
  }
};

// Logging estructurado para operaciones de storage (solo en desarrollo)
const logStorageOperation = (
  operation: 'upload' | 'download' | 'delete',
  bucket: string,
  details: Record<string, any>
) => {
  logOperation(operation, 'Storage', {
    bucket,
    ...details
  });
};

// Subir documento de tecnico
export const uploadTechnicianDocument = async (
  technicianId: string,
  docTypeName: string,
  file: File,
  oldFileUrl?: string
): Promise<UploadResult> => {
  const startTime = Date.now();

  // Validar archivo
  const validation = await validateFile(file);
  if (!validation.valid) {
    logStorageOperation('upload', TECHNICIAN_BUCKET, {
      status: 'validation_failed',
      technicianId,
      docType: docTypeName,
      error: validation.error,
      fileSize: file.size,
      fileName: file.name
    });
    return { success: false, error: validation.error };
  }

  try {
    // Eliminar archivo antiguo si existe
    if (oldFileUrl) {
      await deleteOldFileBeforeUpload('technician', oldFileUrl);
    }

    // Rodrigo Osorio v0.8 - Sanitizar imagen (re-codifica via Canvas para eliminar payloads maliciosos)
    let fileToUpload = await sanitizeImage(file);
    // Rodrigo Osorio v0.6 - Comprimir imagen si aplica
    fileToUpload = await compressImage(fileToUpload);

    // Rodrigo Osorio v0.7 - Encriptar archivo si está habilitado
    if (ENCRYPTION_ENABLED) {
      fileToUpload = await encryptFile(fileToUpload);
    }

    const fileName = generateUniqueFileName(docTypeName, file.name); // Usar nombre original
    const filePath = `${technicianId}/${fileName}`;

    // Subir nuevo archivo (encriptado si ENCRYPTION_ENABLED)
    const { data, error } = await supabase.storage
      .from(TECHNICIAN_BUCKET)
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type // Usar tipo original para pasar validacion de bucket
      });

    if (error) {
      logStorageOperation('upload', TECHNICIAN_BUCKET, {
        status: 'failed',
        technicianId,
        docType: docTypeName,
        error: error.message,
        duration: Date.now() - startTime
      });

      // Mensaje más claro para bucket no encontrado
      if (error.message.includes('not found') || error.message.includes('Bucket not found')) {
        return {
          success: false,
          error: 'El bucket de almacenamiento no está configurado. Por favor, ejecuta el script de inicialización (scripts/initStorage.sql) en Supabase Dashboard o contacta al administrador.'
        };
      }

      return { success: false, error: error.message };
    }

    // Obtener URL firmada (funciona con buckets privados)
    const { data: urlData, error: urlError } = await supabase.storage
      .from(TECHNICIAN_BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

    if (urlError || !urlData?.signedUrl) {
      logger.error('Error generando URL firmada:', urlError);
      return { success: false, error: 'Error al generar URL del archivo' };
    }

    logStorageOperation('upload', TECHNICIAN_BUCKET, {
      status: 'success',
      technicianId,
      docType: docTypeName,
      fileSize: file.size,
      filePath,
      duration: Date.now() - startTime
    });

    return {
      success: true,
      url: urlData.signedUrl,
      path: filePath
    };
  } catch (err: any) {
    logStorageOperation('upload', TECHNICIAN_BUCKET, {
      status: 'error',
      technicianId,
      docType: docTypeName,
      error: err.message,
      duration: Date.now() - startTime
    });
    return { success: false, error: err.message || 'Error al subir el archivo' };
  }
};

// Subir documento de empresa
export const uploadCompanyDocument = async (
  companyId: string,
  docTypeName: string,
  file: File,
  oldFileUrl?: string
): Promise<UploadResult> => {
  const startTime = Date.now();

  // Validar archivo
  const validation = await validateFile(file);
  if (!validation.valid) {
    logStorageOperation('upload', COMPANY_BUCKET, {
      status: 'validation_failed',
      companyId,
      docType: docTypeName,
      error: validation.error,
      fileSize: file.size,
      fileName: file.name
    });
    return { success: false, error: validation.error };
  }

  try {
    // Eliminar archivo antiguo si existe
    if (oldFileUrl) {
      await deleteOldFileBeforeUpload('company', oldFileUrl);
    }

    // Rodrigo Osorio v0.8 - Sanitizar imagen (re-codifica via Canvas para eliminar payloads maliciosos)
    let fileToUpload = await sanitizeImage(file);
    // Rodrigo Osorio v0.6 - Comprimir imagen si aplica
    fileToUpload = await compressImage(fileToUpload);

    // Rodrigo Osorio v0.7 - Encriptar archivo si está habilitado
    if (ENCRYPTION_ENABLED) {
      fileToUpload = await encryptFile(fileToUpload);
    }

    const fileName = generateUniqueFileName(docTypeName, file.name); // Usar nombre original
    const filePath = `${companyId}/${fileName}`;

    // Subir nuevo archivo (encriptado si ENCRYPTION_ENABLED)
    const { data, error } = await supabase.storage
      .from(COMPANY_BUCKET)
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type // Usar tipo original para pasar validacion de bucket
      });

    if (error) {
      logStorageOperation('upload', COMPANY_BUCKET, {
        status: 'failed',
        companyId,
        docType: docTypeName,
        error: error.message,
        duration: Date.now() - startTime
      });

      // Mensaje más claro para bucket no encontrado
      if (error.message.includes('not found') || error.message.includes('Bucket not found')) {
        return {
          success: false,
          error: 'El bucket de almacenamiento no está configurado. Por favor, ejecuta el script de inicialización (scripts/initStorage.sql) en Supabase Dashboard o contacta al administrador.'
        };
      }

      return { success: false, error: error.message };
    }

    // Obtener URL firmada (funciona con buckets privados)
    const { data: urlData, error: urlError } = await supabase.storage
      .from(COMPANY_BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

    if (urlError || !urlData?.signedUrl) {
      logger.error('Error generando URL firmada:', urlError);
      return { success: false, error: 'Error al generar URL del archivo' };
    }

    logStorageOperation('upload', COMPANY_BUCKET, {
      status: 'success',
      companyId,
      docType: docTypeName,
      fileSize: file.size,
      filePath,
      duration: Date.now() - startTime
    });

    return {
      success: true,
      url: urlData.signedUrl,
      path: filePath
    };
  } catch (err: any) {
    logStorageOperation('upload', COMPANY_BUCKET, {
      status: 'error',
      companyId,
      docType: docTypeName,
      error: err.message,
      duration: Date.now() - startTime
    });
    return { success: false, error: err.message || 'Error al subir el archivo' };
  }
};

// Descargar archivo individual (encriptado)
export const downloadDocument = async (
  bucket: 'technician' | 'company',
  filePath: string
): Promise<{ success: boolean; blob?: Blob; error?: string }> => {
  const startTime = Date.now();
  const bucketName = bucket === 'technician' ? TECHNICIAN_BUCKET : COMPANY_BUCKET;

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(filePath);

    if (error) {
      logStorageOperation('download', bucketName, {
        status: 'failed',
        filePath,
        error: error.message,
        duration: Date.now() - startTime
      });

      // Mensaje más claro para bucket no encontrado
      if (error.message.includes('not found') || error.message.includes('Bucket not found')) {
        return {
          success: false,
          error: 'El bucket de almacenamiento no está configurado. Por favor, ejecuta el script de inicialización (scripts/initStorage.sql) en Supabase Dashboard o contacta al administrador.'
        };
      }
      return { success: false, error: error.message };
    }

    logStorageOperation('download', bucketName, {
      status: 'success',
      filePath,
      size: data.size,
      duration: Date.now() - startTime
    });

    return { success: true, blob: data };
  } catch (err: any) {
    logStorageOperation('download', bucketName, {
      status: 'error',
      filePath,
      error: err.message,
      duration: Date.now() - startTime
    });
    return { success: false, error: err.message || 'Error al descargar' };
  }
};

// Rodrigo Osorio v0.7 - Descargar y desencriptar archivo
export const downloadAndDecrypt = async (
  bucket: 'technician' | 'company',
  filePath: string,
  originalFileName: string,
  originalMimeType: string
): Promise<{ success: boolean; file?: File; error?: string }> => {
  const startTime = Date.now();

  try {
    // Descargar archivo encriptado
    const downloadResult = await downloadDocument(bucket, filePath);

    if (!downloadResult.success || !downloadResult.blob) {
      return { success: false, error: downloadResult.error };
    }

    // Verificar si está encriptado y desencriptar
    const encrypted = await isEncrypted(downloadResult.blob);

    if (encrypted) {
      const decryptedFile = await decryptFile(
        downloadResult.blob,
        originalFileName,
        originalMimeType
      );

      logger.log(`Archivo desencriptado: ${originalFileName} (${Date.now() - startTime}ms)`);

      return { success: true, file: decryptedFile };
    } else {
      // Archivo no encriptado, devolver tal cual
      const file = new File([downloadResult.blob], originalFileName, {
        type: originalMimeType
      });
      return { success: true, file };
    }
  } catch (err: any) {
    logger.error('Error al descargar y desencriptar:', err);
    return { success: false, error: err.message || 'Error al desencriptar' };
  }
};

// Obtener URL de descarga directa (firmada para buckets privados)
export const getDocumentUrl = async (
  bucket: 'technician' | 'company',
  filePath: string
): Promise<string> => {
  const bucketName = bucket === 'technician' ? TECHNICIAN_BUCKET : COMPANY_BUCKET;
  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

  if (error || !data?.signedUrl) {
    logger.error('Error generando URL firmada:', error);
    return '';
  }
  return data.signedUrl;
};

// Eliminar documento
export const deleteDocument = async (
  bucket: 'technician' | 'company',
  filePath: string
): Promise<{ success: boolean; error?: string }> => {
  const startTime = Date.now();
  const bucketName = bucket === 'technician' ? TECHNICIAN_BUCKET : COMPANY_BUCKET;

  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      logStorageOperation('delete', bucketName, {
        status: 'failed',
        filePath,
        error: error.message,
        duration: Date.now() - startTime
      });

      // Mensaje más claro para bucket no encontrado
      if (error.message.includes('not found') || error.message.includes('Bucket not found')) {
        return {
          success: false,
          error: 'El bucket de almacenamiento no está configurado. Por favor, ejecuta el script de inicialización (scripts/initStorage.sql) en Supabase Dashboard o contacta al administrador.'
        };
      }
      return { success: false, error: error.message };
    }

    logStorageOperation('delete', bucketName, {
      status: 'success',
      filePath,
      duration: Date.now() - startTime
    });

    return { success: true };
  } catch (err: any) {
    logStorageOperation('delete', bucketName, {
      status: 'error',
      filePath,
      error: err.message,
      duration: Date.now() - startTime
    });
    return { success: false, error: err.message || 'Error al eliminar' };
  }
};

// Extraer path del archivo desde URL completa
export const extractPathFromUrl = (url: string, bucket: 'technician' | 'company'): string | null => {
  const bucketName = bucket === 'technician' ? TECHNICIAN_BUCKET : COMPANY_BUCKET;
  const marker = `/${bucketName}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.substring(index + marker.length);
};

// Descargar multiples archivos como ZIP
export const downloadMultipleAsZip = async (
  files: Array<{ url: string; name: string; folder: string }>
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Importar JSZip dinamicamente solo cuando se necesita
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const file of files) {
      try {
        const response = await fetch(file.url);
        if (response.ok) {
          const blob = await response.blob();
          const folderPath = file.folder ? `${file.folder}/` : '';
          zip.file(`${folderPath}${file.name}`, blob);
        }
      } catch (e) {
        logger.warn(`No se pudo descargar: ${file.name}`);
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });

    // Crear enlace de descarga
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `documentos_${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    return { success: true };
  } catch (err: any) {
    logger.error('Error creating ZIP:', err);
    return { success: false, error: err.message || 'Error al crear ZIP' };
  }
};

// Descargar archivo individual desde URL
export const downloadFromUrl = async (url: string, fileName: string): Promise<void> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al descargar');

    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (err) {
    logger.error('Download error:', err);
    throw err;
  }
};

// Wrapper con rollback automatico para operaciones de upload + DB
export interface UploadWithRollbackOptions {
  bucket: 'technician' | 'company';
  entityId: string;
  docTypeName: string;
  file: File;
  oldFileUrl?: string;
  dbOperation: (fileUrl: string) => Promise<void>;
}

export const uploadWithRollback = async (
  options: UploadWithRollbackOptions
): Promise<UploadResult> => {
  const { bucket, entityId, docTypeName, file, oldFileUrl, dbOperation } = options;
  const startTime = Date.now();
  let uploadedFileUrl: string | undefined;
  let uploadedFilePath: string | undefined;

  try {
    // Paso 1: Subir archivo a storage
    const uploadFn = bucket === 'technician' ? uploadTechnicianDocument : uploadCompanyDocument;
    const uploadResult = await uploadFn(entityId, docTypeName, file, oldFileUrl);

    if (!uploadResult.success) {
      return uploadResult; // Falló el upload, no hay nada que revertir
    }

    uploadedFileUrl = uploadResult.url;
    uploadedFilePath = uploadResult.path;

    // Paso 2: Ejecutar operacion de base de datos
    try {
      await dbOperation(uploadedFileUrl!);

      logStorageOperation('upload', bucket === 'technician' ? TECHNICIAN_BUCKET : COMPANY_BUCKET, {
        status: 'committed',
        entityId,
        docType: docTypeName,
        fileSize: file.size,
        duration: Date.now() - startTime
      });

      return uploadResult; // Todo OK
    } catch (dbError: any) {
      // Paso 3: ROLLBACK - Eliminar archivo recién subido
      logger.error('Error en operación de BD, iniciando rollback...', dbError);

      if (uploadedFilePath) {
        try {
          await deleteDocument(bucket, uploadedFilePath);
          logStorageOperation('upload', bucket === 'technician' ? TECHNICIAN_BUCKET : COMPANY_BUCKET, {
            status: 'rolled_back',
            entityId,
            docType: docTypeName,
            error: dbError.message,
            duration: Date.now() - startTime
          });
        } catch (rollbackError) {
          logger.error('Error durante rollback:', rollbackError);
          logStorageOperation('upload', bucket === 'technician' ? TECHNICIAN_BUCKET : COMPANY_BUCKET, {
            status: 'rollback_failed',
            entityId,
            docType: docTypeName,
            error: `DB: ${dbError.message}, Rollback: ${rollbackError}`,
            duration: Date.now() - startTime
          });
        }
      }

      return {
        success: false,
        error: `Error al guardar en base de datos: ${dbError.message}`
      };
    }
  } catch (err: any) {
    logStorageOperation('upload', bucket === 'technician' ? TECHNICIAN_BUCKET : COMPANY_BUCKET, {
      status: 'error',
      entityId,
      docType: docTypeName,
      error: err.message,
      duration: Date.now() - startTime
    });
    return {
      success: false,
      error: err.message || 'Error en operación de upload con rollback'
    };
  }
};

// === FUNCIONES UTILITARIAS PARA DESCARGA - Rodrigo Osorio v0.5 ===

// Extraer extensión de archivo desde URL de Supabase Storage
export const extractFileExtension = (url: string): string => {
  try {
    // Remover parámetros de query si existen
    const urlWithoutParams = url.split('?')[0];

    // Extraer el nombre del archivo de la URL
    const parts = urlWithoutParams.split('/');
    const fileName = parts[parts.length - 1];

    // Buscar la última extensión
    const extensionMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);

    if (extensionMatch && extensionMatch[1]) {
      const ext = extensionMatch[1].toLowerCase();
      // Validar que sea una extensión permitida
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        return `.${ext}`;
      }
    }

    // Por defecto retornar .pdf
    return '.pdf';
  } catch (err) {
    logger.warn('No se pudo extraer extensión de URL:', url, err);
    return '.pdf';
  }
};

// Sanitizar texto para uso en nombres de archivo
export const sanitizeForFileName = (text: string): string => {
  return text
    .trim()
    // Normalizar caracteres con acentos
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    // Reemplazar espacios con guiones bajos
    .replace(/\s+/g, '_')
    // Remover caracteres especiales, mantener solo letras, números, guiones y guiones bajos
    .replace(/[^a-zA-Z0-9_-]/g, '')
    // Remover guiones bajos o guiones múltiples consecutivos
    .replace(/[_-]+/g, '_')
    // Limitar longitud
    .substring(0, 100);
};

// Obtener fecha actual en formato YYYYMMDD
export const getFormattedDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

// === FUNCIONES DE DESCARGA - Rodrigo Osorio v0.5 ===

// Abrir un Blob/File en una nueva ventana usando Object URL
export const openBlobInNewWindow = (blob: Blob | File, fileName: string): void => {
  try {
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');

    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      alert('Bloqueador de popups detectado. Por favor, permite popups para ver el documento.');
      return;
    }

    // Limpiar URL después de un tiempo para liberar memoria
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    logger.error('Error al abrir blob en ventana:', err);
    alert('No se pudo abrir el documento.');
  }
};

// Rodrigo Osorio v0.17 - Función central para ver documentos con soporte de desencriptación
export const viewDocument = async (
  bucket: 'technician' | 'company',
  filePath: string,
  fileName: string,
  mimeType: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Si no hay filePath, no podemos hacer nada
    if (!filePath) return { success: false, error: 'Ruta de archivo no válida' };

    // Descargar y desencriptar
    const result = await downloadAndDecrypt(bucket, filePath, fileName, mimeType);

    if (result.success && result.file) {
      openBlobInNewWindow(result.file, fileName);
      return { success: true };
    } else {
      return { success: false, error: result.error || 'Error al procesar el archivo' };
    }
  } catch (err: any) {
    logger.error('Error en viewDocument:', err);
    return { success: false, error: err.message || 'Error inesperado al abrir documento' };
  }
};

// Abrir documento en nueva ventana (Directo - Solo para archivos NO encriptados o públicos)
export const openDocumentInNewWindow = (url: string): void => {
  try {
    const newWindow = window.open(url, '_blank');

    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      alert('No se pudo abrir el documento en una nueva ventana. Por favor, verifica el bloqueador de popups de tu navegador.');
    }
  } catch (err) {
    logger.error('Error al abrir documento en nueva ventana:', err);
    alert('No se pudo abrir el documento.');
  }
};

// Descargar todos los documentos de un técnico como ZIP
export interface TechnicianZipOptions {
  technician: {
    id: string;
    name: string;
    rut: string;
  };
  credentials: Array<{
    id: string;
    documentTypeId: string;
    documentTypeName: string;
    fileUrl?: string;
  }>;
  documentTypes: Array<{
    id: string;
    name: string;
  }>;
}

export const downloadTechnicianZip = async (
  options: TechnicianZipOptions
): Promise<{ success: boolean; error?: string }> => {
  const { technician, credentials, documentTypes } = options;

  try {
    // Filtrar solo credenciales con archivo
    const credentialsWithFile = credentials.filter(cred => cred.fileUrl);

    if (credentialsWithFile.length === 0) {
      return {
        success: false,
        error: 'No hay documentos con archivo para descargar'
      };
    }

    // Importar JSZip
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    const dateStr = getFormattedDate();
    const technicianName = sanitizeForFileName(technician.name);

    // Descargar cada archivo y agregarlo al ZIP
    for (const cred of credentialsWithFile) {
      try {
        const filePath = extractPathFromUrl(cred.fileUrl!, 'technician');
        if (!filePath) {
          logger.warn(`No se pudo extraer el path para: ${cred.documentTypeName}`);
          continue;
        }

        // Rodrigo Osorio v0.17 - Desencriptar antes de añadir al ZIP
        const result = await downloadAndDecrypt(
          'technician',
          filePath,
          cred.documentTypeName,
          'application/pdf' // El servicio detectará el tipo real
        );

        if (result.success && result.file) {
          // Obtener nombre del documento
          const docType = documentTypes.find(dt => dt.id === cred.documentTypeId);
          const docName = sanitizeForFileName(docType?.name || cred.documentTypeName);

          // Extraer extensión de la URL original
          const extension = extractFileExtension(cred.fileUrl!);

          // Formato: {NombreDocumento}_{NombreTecnico}_{Fecha}.{ext}
          const fileName = `${docName}_${technicianName}_${dateStr}${extension}`;

          zip.file(fileName, result.file);
        } else {
          logger.warn(`No se pudo descargar/desencriptar: ${cred.documentTypeName}. Error: ${result.error}`);
        }
      } catch (err) {
        logger.warn(`Error al procesar documento ${cred.documentTypeName}:`, err);
      }
    }

    // Generar el ZIP
    const content = await zip.generateAsync({ type: 'blob' });

    // Generar nombre del ZIP: {NombreTecnico}_{RUT}.zip
    const rutSanitized = technician.rut ? sanitizeForFileName(technician.rut) : 'SinRUT';
    const zipFileName = `${technicianName}_${rutSanitized}.zip`;

    // Descargar el ZIP
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = zipFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    return { success: true };
  } catch (err: any) {
    logger.error('Error al generar ZIP de técnico:', err);
    return {
      success: false,
      error: err.message || 'Error al generar el archivo ZIP'
    };
  }
};

// Tipos de descarga para empresa
export type CompanyZipType =
  | 'valid_all'           // Documentos válidos de técnicos y empresa
  | 'valid_techs'         // Solo documentos válidos de técnicos
  | 'compliant_techs'     // Documentos de técnicos que cumplen (100% válidos)
  | 'all_techs'          // Todos los documentos de técnicos
  | 'company_only';      // Solo documentos de la empresa

// Descargar documentos de empresa como ZIP con múltiples opciones
export interface CompanyZipOptions {
  company: {
    id: string;
    name: string;
    rut: string;
  };
  companyCredentials: Array<{
    id: string;
    documentTypeId: string;
    documentTypeName: string;
    fileUrl?: string;
    status: string; // ComplianceStatus
  }>;
  technicians: Array<{
    id: string;
    name: string;
    rut: string;
    complianceScore: number;
    credentials: Array<{
      id: string;
      documentTypeId: string;
      documentTypeName: string;
      fileUrl?: string;
      status: string; // ComplianceStatus
    }>;
  }>;
  documentTypes: Array<{
    id: string;
    name: string;
  }>;
  zipType: CompanyZipType;
}

export const downloadCompanyZip = async (
  options: CompanyZipOptions
): Promise<{ success: boolean; error?: string }> => {
  const { company, companyCredentials, technicians, documentTypes, zipType } = options;

  try {
    // Importar JSZip
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    const dateStr = getFormattedDate();
    const companyName = sanitizeForFileName(company.name);
    const companyRut = sanitizeForFileName(company.rut || 'SinRUT');

    let filesAdded = 0;

    // ===== DOCUMENTOS DE EMPRESA =====
    if (zipType === 'valid_all' || zipType === 'company_only') {
      // Filtrar documentos según tipo
      const companyDocsToInclude = companyCredentials.filter(doc => {
        if (!doc.fileUrl) return false;
        if (zipType === 'valid_all') {
          return doc.status === 'VALID';
        }
        // company_only: incluir todos los que tengan archivo
        return true;
      });

      if (companyDocsToInclude.length > 0) {
        // Crear carpeta para empresa
        const companyFolderName = `Acreditacion_Empresa_${companyName}`;

        for (const doc of companyDocsToInclude) {
          try {
            const filePath = extractPathFromUrl(doc.fileUrl!, 'company');
            if (!filePath) {
              logger.warn(`No se pudo extraer path para documento de empresa: ${doc.documentTypeName}`);
              continue;
            }

            // Rodrigo Osorio v0.17 - Desencriptar antes de añadir al ZIP
            const result = await downloadAndDecrypt(
              'company',
              filePath,
              doc.documentTypeName,
              'application/pdf'
            );

            if (result.success && result.file) {
              // Obtener nombre del documento
              const docType = documentTypes.find(dt => dt.id === doc.documentTypeId);
              const docName = sanitizeForFileName(docType?.name || doc.documentTypeName);

              // Extraer extensión de la URL original
              const extension = extractFileExtension(doc.fileUrl!);

              // Formato: {NombreDocumento}_Acred_Empresa_{NombreEmpresa}_{RUT}_{Fecha}.{ext}
              const fileName = `${docName}_Acred_Empresa_${companyName}_${companyRut}_${dateStr}${extension}`;

              zip.file(`${companyFolderName}/${fileName}`, result.file);
              filesAdded++;
            } else {
              logger.warn(`No se pudo descargar/desencriptar documento de empresa: ${doc.documentTypeName}. Error: ${result.error}`);
            }
          } catch (err) {
            logger.warn(`Error al procesar documento de empresa ${doc.documentTypeName}:`, err);
          }
        }
      }
    }

    // ===== DOCUMENTOS DE TÉCNICOS =====
    if (zipType !== 'company_only') {
      // Filtrar técnicos según el tipo de descarga
      let techniciansToInclude = technicians;

      if (zipType === 'compliant_techs') {
        // Solo técnicos con score 100%
        techniciansToInclude = technicians.filter(tech => tech.complianceScore === 100);
      }

      // Para cada técnico
      for (const tech of techniciansToInclude) {
        // Filtrar credenciales del técnico
        const techCredentials = tech.credentials.filter(cred => {
          if (!cred.fileUrl) return false;

          // Aplicar filtros según tipo de descarga
          if (zipType === 'valid_all' || zipType === 'valid_techs') {
            return cred.status === 'VALID';
          }

          // Para compliant_techs y all_techs: incluir todos los que tengan archivo
          return true;
        });

        if (techCredentials.length > 0) {
          // Crear carpeta para el técnico
          const techName = sanitizeForFileName(tech.name);
          const techRut = sanitizeForFileName(tech.rut || 'SinRUT');
          const techFolderName = `${techName}_${techRut}`;

          for (const cred of techCredentials) {
            try {
              const filePath = extractPathFromUrl(cred.fileUrl!, 'technician');
              if (!filePath) {
                logger.warn(`No se pudo extraer path para documento de técnico ${tech.name}: ${cred.documentTypeName}`);
                continue;
              }

              // Rodrigo Osorio v0.17 - Desencriptar antes de añadir al ZIP
              const result = await downloadAndDecrypt(
                'technician',
                filePath,
                cred.documentTypeName,
                'application/pdf'
              );

              if (result.success && result.file) {
                // Obtener nombre del documento
                const docType = documentTypes.find(dt => dt.id === cred.documentTypeId);
                const docName = sanitizeForFileName(docType?.name || cred.documentTypeName);

                // Extraer extensión de la URL original
                const extension = extractFileExtension(cred.fileUrl!);

                // Formato: {NombreDocumento}_{NombreTecnico}_{Fecha}.{ext}
                const fileName = `${docName}_${techName}_${dateStr}${extension}`;

                zip.file(`${techFolderName}/${fileName}`, result.file);
                filesAdded++;
              } else {
                logger.warn(`No se pudo descargar/desencriptar documento de técnico ${tech.name}: ${cred.documentTypeName}. Error: ${result.error}`);
              }
            } catch (err) {
              logger.warn(`Error al procesar documento ${cred.documentTypeName} de técnico ${tech.name}:`, err);
            }
          }
        }
      }
    }

    // Verificar que se agregaron archivos
    if (filesAdded === 0) {
      return {
        success: false,
        error: 'No hay documentos para descargar con los filtros seleccionados'
      };
    }

    // Generar el ZIP
    const content = await zip.generateAsync({ type: 'blob' });

    // Nombre del ZIP: {NombreEmpresa}_{RUT}_{Fecha}.zip
    const zipFileName = `${companyName}_${companyRut}_${dateStr}.zip`;

    // Descargar el ZIP
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = zipFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    return { success: true };
  } catch (err: any) {
    logger.error('Error al generar ZIP de empresa:', err);
    return {
      success: false,
      error: err.message || 'Error al generar el archivo ZIP'
    };
  }
};


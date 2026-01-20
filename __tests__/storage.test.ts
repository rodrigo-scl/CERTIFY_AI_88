// Tests de integración para el sistema de storage - Rodrigo Osorio v0.1
// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  validateFile,
  uploadTechnicianDocument,
  uploadCompanyDocument,
  downloadDocument,
  deleteDocument,
  extractPathFromUrl,
  uploadWithRollback
} from '../services/storageService';

/**
 * Tests de integración para el sistema de almacenamiento
 * 
 * NOTA: Estos tests requieren una configuración válida de Supabase
 * y los buckets deben estar creados. Para ejecutar estos tests:
 * 
 * 1. Ejecutar scripts/initStorage.sql en Supabase Dashboard
 * 2. Asegurar que las credenciales en supabaseClient.ts son válidas
 * 3. Ejecutar: npm test
 * 
 * Los tests limpian automáticamente los archivos creados al finalizar.
 */

describe('Storage Service - Validación de Archivos', () => {

  it('debe rechazar archivos sin tipo MIME', async () => {
    const file = new File(['content'], 'test.pdf', { type: '' });
    const result = await validateFile(file);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('tipo MIME');
  });

  it('debe rechazar archivos demasiado grandes', async () => {
    // Crear un archivo de 11MB (excede el límite de 10MB)
    const largeContent = new Uint8Array(11 * 1024 * 1024);
    const file = new File([largeContent], 'large.pdf', { type: 'application/pdf' });
    const result = await validateFile(file);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('excede el límite');
  });

  it('debe rechazar extensiones no permitidas', async () => {
    const file = new File(['content'], 'test.exe', { type: 'application/x-msdownload' });
    const result = await validateFile(file);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('no permitido');
  });

  it('debe rechazar cuando extensión y MIME no coinciden', async () => {
    const file = new File(['content'], 'test.pdf', { type: 'image/jpeg' });
    const result = await validateFile(file);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('no coincide');
  });

  it('debe aceptar PDF válido', async () => {
    // PDF mínimo válido con signature correcta
    const pdfContent = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, // %PDF-1.4
      0x0A, 0x25, 0xC3, 0xA4, 0xC3, 0xBC, 0xC3, 0xB6
    ]);
    const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });
    const result = await validateFile(file);

    expect(result.valid).toBe(true);
  });

  it('debe aceptar imagen JPEG válida', async () => {
    // JPEG mínimo con signature correcta
    const jpegContent = new Uint8Array([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46
    ]);
    const file = new File([jpegContent], 'test.jpg', { type: 'image/jpeg' });
    const result = await validateFile(file);

    expect(result.valid).toBe(true);
  });

  it('debe rechazar archivo con signature incorrecta', async () => {
    // Contenido que no corresponde a un PDF real
    const fakeContent = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    const file = new File([fakeContent], 'fake.pdf', { type: 'application/pdf' });
    const result = await validateFile(file);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('contenido del archivo no coincide');
  });
});

describe('Storage Service - Extracción de Path', () => {

  it('debe extraer path correctamente de URL de técnico', () => {
    const url = 'https://example.supabase.co/storage/v1/object/public/technician-docs/tech123/DOC_12345.pdf';
    const path = extractPathFromUrl(url, 'technician');

    expect(path).toBe('tech123/DOC_12345.pdf');
  });

  it('debe extraer path correctamente de URL de empresa', () => {
    const url = 'https://example.supabase.co/storage/v1/object/public/company-docs/comp456/CERT_67890.pdf';
    const path = extractPathFromUrl(url, 'company');

    expect(path).toBe('comp456/CERT_67890.pdf');
  });

  it('debe retornar null si no encuentra el bucket en la URL', () => {
    const url = 'https://example.com/some/other/path.pdf';
    const path = extractPathFromUrl(url, 'technician');

    expect(path).toBeNull();
  });
});

describe('Storage Service - Integración completa', () => {
  const testTechnicianId = 'test-tech-' + Date.now();
  const testCompanyId = 'test-company-' + Date.now();
  const uploadedFiles: Array<{ bucket: 'technician' | 'company', path: string }> = [];

  // Limpiar archivos de prueba al finalizar
  afterAll(async () => {
    console.log('Limpiando archivos de prueba...');
    for (const file of uploadedFiles) {
      try {
        await deleteDocument(file.bucket, file.path);
      } catch (err) {
        console.warn(`No se pudo eliminar ${file.path}:`, err);
      }
    }
  });

  it('debe subir, descargar y eliminar documento de técnico', async () => {
    // Crear archivo de prueba válido
    const pdfContent = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A
    ]);
    const file = new File([pdfContent], 'test-tech.pdf', { type: 'application/pdf' });

    // 1. Upload
    const uploadResult = await uploadTechnicianDocument(
      testTechnicianId,
      'CERTIFICADO_PRUEBA',
      file
    );

    expect(uploadResult.success).toBe(true);
    expect(uploadResult.url).toBeDefined();
    expect(uploadResult.path).toBeDefined();

    if (uploadResult.path) {
      uploadedFiles.push({ bucket: 'technician', path: uploadResult.path });
    }

    // 2. Download
    const downloadResult = await downloadDocument('technician', uploadResult.path!);
    expect(downloadResult.success).toBe(true);
    expect(downloadResult.blob).toBeDefined();

    // 3. Delete
    const deleteResult = await deleteDocument('technician', uploadResult.path!);
    expect(deleteResult.success).toBe(true);
  }, 15000); // Timeout de 15s para operaciones de red

  it('debe subir, descargar y eliminar documento de empresa', async () => {
    const pdfContent = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A
    ]);
    const file = new File([pdfContent], 'test-company.pdf', { type: 'application/pdf' });

    // 1. Upload
    const uploadResult = await uploadCompanyDocument(
      testCompanyId,
      'DOCUMENTO_CORPORATIVO',
      file
    );

    expect(uploadResult.success).toBe(true);
    expect(uploadResult.url).toBeDefined();
    expect(uploadResult.path).toBeDefined();

    if (uploadResult.path) {
      uploadedFiles.push({ bucket: 'company', path: uploadResult.path });
    }

    // 2. Download
    const downloadResult = await downloadDocument('company', uploadResult.path!);
    expect(downloadResult.success).toBe(true);

    // 3. Delete
    const deleteResult = await deleteDocument('company', uploadResult.path!);
    expect(deleteResult.success).toBe(true);
  }, 15000);

  it('debe reemplazar archivo antiguo al subir uno nuevo', async () => {
    const pdfContent1 = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A]);
    const file1 = new File([pdfContent1], 'old.pdf', { type: 'application/pdf' });

    // Subir primer archivo
    const upload1 = await uploadTechnicianDocument(
      testTechnicianId,
      'DOC_ACTUALIZABLE',
      file1
    );
    expect(upload1.success).toBe(true);

    if (upload1.path) {
      uploadedFiles.push({ bucket: 'technician', path: upload1.path });
    }

    // Subir segundo archivo, pasando URL del primero para eliminarlo
    const pdfContent2 = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x35, 0x0A]);
    const file2 = new File([pdfContent2], 'new.pdf', { type: 'application/pdf' });

    const upload2 = await uploadTechnicianDocument(
      testTechnicianId,
      'DOC_ACTUALIZABLE',
      file2,
      upload1.url // Eliminar archivo antiguo
    );
    expect(upload2.success).toBe(true);

    if (upload2.path) {
      uploadedFiles.push({ bucket: 'technician', path: upload2.path });
    }

    // Verificar que el archivo antiguo ya no existe
    const downloadOld = await downloadDocument('technician', upload1.path!);
    expect(downloadOld.success).toBe(false);

    // Verificar que el nuevo archivo sí existe
    const downloadNew = await downloadDocument('technician', upload2.path!);
    expect(downloadNew.success).toBe(true);
  }, 20000);
});

describe('Storage Service - Rollback en Fallo de BD', () => {
  const testTechnicianId = 'test-rollback-' + Date.now();

  it('debe hacer rollback si falla la operación de BD', async () => {
    const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A]);
    const file = new File([pdfContent], 'rollback-test.pdf', { type: 'application/pdf' });

    // Simular operación de BD que falla
    const failingDbOperation = async (fileUrl: string) => {
      throw new Error('Error simulado de base de datos');
    };

    const result = await uploadWithRollback({
      bucket: 'technician',
      entityId: testTechnicianId,
      docTypeName: 'DOC_ROLLBACK',
      file,
      dbOperation: failingDbOperation
    });

    // La operación completa debe fallar
    expect(result.success).toBe(false);
    expect(result.error).toContain('base de datos');

    // El archivo no debe existir en storage (rollback exitoso)
    if (result.path) {
      const downloadResult = await downloadDocument('technician', result.path);
      expect(downloadResult.success).toBe(false);
    }
  }, 15000);

  it('debe completar exitosamente si BD funciona correctamente', async () => {
    const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A]);
    const file = new File([pdfContent], 'success-test.pdf', { type: 'application/pdf' });

    let savedFileUrl: string | undefined;

    // Simular operación de BD exitosa
    const successDbOperation = async (fileUrl: string) => {
      savedFileUrl = fileUrl;
      // Simular escritura a BD (sin error)
    };

    const result = await uploadWithRollback({
      bucket: 'technician',
      entityId: testTechnicianId,
      docTypeName: 'DOC_SUCCESS',
      file,
      dbOperation: successDbOperation
    });

    expect(result.success).toBe(true);
    expect(savedFileUrl).toBeDefined();

    // Limpiar archivo de prueba
    if (result.path) {
      await deleteDocument('technician', result.path);
    }
  }, 15000);
});

describe('Storage Service - Manejo de Errores', () => {

  it('debe manejar bucket inexistente correctamente', async () => {
    const result = await downloadDocument('technician', 'nonexistent/file.pdf');

    expect(result.success).toBe(false);
    // Puede ser error de bucket o de archivo no encontrado
    expect(result.error).toBeDefined();
  });

  it('debe rechazar archivo sin seleccionar', async () => {
    const result = await validateFile(null as any);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('No se seleccionó');
  });
});


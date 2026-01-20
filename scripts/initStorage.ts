// Script de inicialización de buckets de Storage - Rodrigo Osorio v0.1
// Este script crea los buckets necesarios para el almacenamiento de documentos

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mxjpeadstmfzkeitvnhy.supabase.co';
// Nota: Para crear buckets necesitas usar la service_role key o tener permisos adecuados
// Si usas anon key, asegúrate de tener las políticas correctas configuradas
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14anBlYWRzdG1memtlaXR2bmh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTgxMzAsImV4cCI6MjA4MDQzNDEzMH0.Xrw2XDWMMQn76WYBWj-XVG20aFcMcegw6IJSkuP9GO4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BUCKETS = [
  {
    id: 'technician-docs',
    name: 'technician-docs',
    public: false, // Bucket privado para mayor seguridad
    fileSizeLimit: '10MB', // Límite de 10MB por archivo
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  },
  {
    id: 'company-docs',
    name: 'company-docs',
    public: false, // Bucket privado para mayor seguridad
    fileSizeLimit: '10MB', // Límite de 10MB por archivo
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  }
];

/**
 * Verifica si un bucket existe
 */
async function bucketExists(bucketId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.getBucket(bucketId);
    if (error && error.message.includes('not found')) {
      return false;
    }
    return !!data;
  } catch (err) {
    return false;
  }
}

/**
 * Crea un bucket si no existe
 */
async function createBucketIfNotExists(bucketConfig: typeof BUCKETS[0]): Promise<{ success: boolean; message: string }> {
  const exists = await bucketExists(bucketConfig.id);
  
  if (exists) {
    return {
      success: true,
      message: `Bucket '${bucketConfig.id}' ya existe`
    };
  }

  try {
    const { data, error } = await supabase.storage.createBucket(bucketConfig.id, {
      public: bucketConfig.public,
      fileSizeLimit: bucketConfig.fileSizeLimit,
      allowedMimeTypes: bucketConfig.allowedMimeTypes
    });

    if (error) {
      // Si el error es que el bucket ya existe, lo consideramos éxito
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        return {
          success: true,
          message: `Bucket '${bucketConfig.id}' ya existe`
        };
      }
      return {
        success: false,
        message: `Error al crear bucket '${bucketConfig.id}': ${error.message}`
      };
    }

    return {
      success: true,
      message: `Bucket '${bucketConfig.id}' creado exitosamente`
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Error inesperado al crear bucket '${bucketConfig.id}': ${err.message}`
    };
  }
}

/**
 * Función principal para inicializar los buckets
 */
export async function initializeStorageBuckets(): Promise<void> {
  console.log('🚀 Iniciando configuración de buckets de Storage...\n');

  const results = [];

  for (const bucketConfig of BUCKETS) {
    console.log(`📦 Verificando bucket '${bucketConfig.id}'...`);
    const result = await createBucketIfNotExists(bucketConfig);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${result.message}\n`);
    } else {
      console.error(`❌ ${result.message}\n`);
    }
  }

  // Resumen
  console.log('\n📊 Resumen:');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Buckets creados/verificados: ${successful}`);
  console.log(`❌ Buckets con errores: ${failed}`);

  if (failed > 0) {
    console.log('\n⚠️  Algunos buckets no pudieron ser creados.');
    console.log('💡 Sugerencias:');
    console.log('   1. Verifica que tengas permisos para crear buckets');
    console.log('   2. Si usas anon key, considera usar service_role key para este script');
    console.log('   3. También puedes crear los buckets manualmente desde el Dashboard de Supabase');
    console.log('   4. O usar SQL directamente en el editor SQL de Supabase:');
    console.log('\n   INSERT INTO storage.buckets (id, name, public)');
    console.log('   VALUES');
    console.log("     ('technician-docs', 'technician-docs', false),");
    console.log("     ('company-docs', 'company-docs', false);");
  } else {
    console.log('\n🎉 ¡Todos los buckets están configurados correctamente!');
  }
}

// Si se ejecuta directamente (no como módulo)
if (require.main === module) {
  initializeStorageBuckets()
    .then(() => {
      console.log('\n✨ Proceso completado');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n💥 Error fatal:', err);
      process.exit(1);
    });
}


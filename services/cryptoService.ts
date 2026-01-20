// Servicio de Encriptación - Rodrigo Osorio v0.7
// Encriptación AES-256-GCM client-side para máxima seguridad
// Los archivos se encriptan ANTES de subir a Supabase Storage

import { logger } from './logger';

// Configuración de encriptación
const ENCRYPTION_CONFIG = {
    algorithm: 'AES-GCM',
    keyLength: 256,
    ivLength: 12,   // 96 bits recomendado para GCM
    saltLength: 16,
    iterations: 100000 // PBKDF2 iterations
};

// Prefijo para identificar archivos encriptados
const ENCRYPTED_FILE_PREFIX = new Uint8Array([0xCA, 0xFE, 0xBA, 0xBE]); // Magic bytes

/**
 * Deriva una clave AES-256 desde una contraseña usando PBKDF2
 */
export const deriveEncryptionKey = async (
    password: string,
    salt: Uint8Array
): Promise<CryptoKey> => {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: ENCRYPTION_CONFIG.iterations,
            hash: 'SHA-256'
        },
        keyMaterial,
        {
            name: ENCRYPTION_CONFIG.algorithm,
            length: ENCRYPTION_CONFIG.keyLength
        },
        false, // No exportable por seguridad
        ['encrypt', 'decrypt']
    );
};

/**
 * Genera un salt único para la organización
 * En producción, este salt debería almacenarse de forma segura
 */
export const getOrganizationSalt = (): Uint8Array => {
    // Salt fijo por organización (debe ser consistente para poder desencriptar)
    // En producción, esto vendría de una variable de entorno o Supabase Secrets
    const saltString = import.meta.env.VITE_ENCRYPTION_SALT || 'certify-ai-default-salt-2026';
    const encoder = new TextEncoder();
    const encoded = encoder.encode(saltString);

    // Asegurar longitud correcta
    const salt = new Uint8Array(ENCRYPTION_CONFIG.saltLength);
    for (let i = 0; i < ENCRYPTION_CONFIG.saltLength; i++) {
        salt[i] = encoded[i % encoded.length];
    }
    return salt;
};

/**
 * Obtiene la clave de encriptación para la sesión actual
 * Usa una contraseña maestra desde variables de entorno
 */
let cachedKey: CryptoKey | null = null;

export const getEncryptionKey = async (): Promise<CryptoKey> => {
    if (cachedKey) return cachedKey;

    const masterPassword = import.meta.env.VITE_ENCRYPTION_KEY || 'certify-ai-master-key-2026';
    const salt = getOrganizationSalt();

    cachedKey = await deriveEncryptionKey(masterPassword, salt);
    return cachedKey;
};

/**
 * Encripta un archivo usando AES-256-GCM
 * Formato: [4 bytes magic] + [12 bytes IV] + [encrypted data]
 */
export const encryptFile = async (file: File): Promise<File> => {
    try {
        const key = await getEncryptionKey();

        // Generar IV único
        const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.ivLength));

        // Leer archivo como ArrayBuffer
        const fileBuffer = await file.arrayBuffer();

        // Encriptar
        const encryptedData = await crypto.subtle.encrypt(
            {
                name: ENCRYPTION_CONFIG.algorithm,
                iv
            },
            key,
            fileBuffer
        );

        // Combinar: magic + iv + encrypted
        const combined = new Uint8Array(
            ENCRYPTED_FILE_PREFIX.length + iv.length + encryptedData.byteLength
        );
        combined.set(ENCRYPTED_FILE_PREFIX, 0);
        combined.set(iv, ENCRYPTED_FILE_PREFIX.length);
        combined.set(new Uint8Array(encryptedData), ENCRYPTED_FILE_PREFIX.length + iv.length);

        // Crear nuevo archivo encriptado
        const encryptedFile = new File([combined], file.name, {
            type: 'application/octet-stream', // Tipo genérico para archivos encriptados
            lastModified: file.lastModified
        });

        logger.log(`Archivo encriptado: ${file.name} (${(file.size / 1024).toFixed(0)}KB → ${(encryptedFile.size / 1024).toFixed(0)}KB)`);

        return encryptedFile;
    } catch (error) {
        logger.error('Error al encriptar archivo:', error);
        throw new Error('No se pudo encriptar el archivo');
    }
};

/**
 * Desencripta un archivo encriptado con AES-256-GCM
 */
export const decryptFile = async (
    encryptedBlob: Blob,
    originalFileName: string,
    originalMimeType: string
): Promise<File> => {
    try {
        const key = await getEncryptionKey();

        // Leer blob como ArrayBuffer
        const encryptedBuffer = await encryptedBlob.arrayBuffer();
        const encryptedArray = new Uint8Array(encryptedBuffer);

        // Verificar magic bytes
        const magic = encryptedArray.slice(0, ENCRYPTED_FILE_PREFIX.length);
        const isMagicValid = magic.every((byte, i) => byte === ENCRYPTED_FILE_PREFIX[i]);

        if (!isMagicValid) {
            // El archivo no está encriptado, devolverlo sin cambios
            logger.log(`Archivo no encriptado, devolviendo original: ${originalFileName}`);
            return new File([encryptedBlob], originalFileName, {
                type: originalMimeType
            });
        }

        // Extraer IV y datos encriptados
        const iv = encryptedArray.slice(
            ENCRYPTED_FILE_PREFIX.length,
            ENCRYPTED_FILE_PREFIX.length + ENCRYPTION_CONFIG.ivLength
        );
        const data = encryptedArray.slice(
            ENCRYPTED_FILE_PREFIX.length + ENCRYPTION_CONFIG.ivLength
        );

        // Desencriptar
        const decryptedData = await crypto.subtle.decrypt(
            {
                name: ENCRYPTION_CONFIG.algorithm,
                iv
            },
            key,
            data
        );

        // Crear archivo desencriptado
        const decryptedFile = new File([decryptedData], originalFileName, {
            type: originalMimeType
        });

        logger.log(`Archivo desencriptado: ${originalFileName}`);

        return decryptedFile;
    } catch (error) {
        logger.error('Error al desencriptar archivo:', error);
        throw new Error('No se pudo desencriptar el archivo. La clave puede ser incorrecta.');
    }
};

/**
 * Verifica si un blob está encriptado (tiene magic bytes)
 */
export const isEncrypted = async (blob: Blob): Promise<boolean> => {
    if (blob.size < ENCRYPTED_FILE_PREFIX.length) return false;

    const header = await blob.slice(0, ENCRYPTED_FILE_PREFIX.length).arrayBuffer();
    const headerArray = new Uint8Array(header);

    return headerArray.every((byte, i) => byte === ENCRYPTED_FILE_PREFIX[i]);
};

/**
 * Encripta un texto simple (para RUT, etc.)
 */
export const encryptText = async (text: string): Promise<string> => {
    try {
        const key = await getEncryptionKey();
        const encoder = new TextEncoder();
        const data = encoder.encode(text);

        const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.ivLength));

        const encrypted = await crypto.subtle.encrypt(
            { name: ENCRYPTION_CONFIG.algorithm, iv },
            key,
            data
        );

        // Combinar IV + encrypted y convertir a base64
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);

        return btoa(String.fromCharCode(...combined));
    } catch (error) {
        logger.error('Error al encriptar texto:', error);
        throw error;
    }
};

/**
 * Desencripta un texto encriptado
 */
export const decryptText = async (encryptedBase64: string): Promise<string> => {
    try {
        const key = await getEncryptionKey();

        // Decodificar base64
        const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

        // Extraer IV y datos
        const iv = combined.slice(0, ENCRYPTION_CONFIG.ivLength);
        const data = combined.slice(ENCRYPTION_CONFIG.ivLength);

        const decrypted = await crypto.subtle.decrypt(
            { name: ENCRYPTION_CONFIG.algorithm, iv },
            key,
            data
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (error) {
        logger.error('Error al desencriptar texto:', error);
        throw error;
    }
};

export default {
    encryptFile,
    decryptFile,
    encryptText,
    decryptText,
    isEncrypted,
    getEncryptionKey
};

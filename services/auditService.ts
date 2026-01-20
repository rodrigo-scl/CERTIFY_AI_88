// Servicio de Auditoría - Rodrigo Osorio v0.1
// Registra accesos a datos sensibles como contraseñas de portales

import { supabase } from './supabaseClient';
import { logger } from './logger';

export interface PasswordAccessLog {
    id: string;
    userId: string;
    userEmail: string;
    userName?: string;
    entityType: 'supplier_portal' | 'company';
    entityId: string;
    entityName: string;
    accessedAt: string;
}

/**
 * Registra el acceso a una contraseña de portal
 * Esta función se llama automáticamente cuando un usuario hace clic en "Ver contraseña"
 */
export const logPasswordAccess = async (
    entityType: 'supplier_portal' | 'company',
    entityId: string,
    entityName: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        // Obtener usuario actual
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: 'Usuario no autenticado' };
        }

        // Obtener nombre del usuario desde app_users
        const { data: appUser } = await supabase
            .from('app_users')
            .select('name')
            .eq('email', user.email)
            .single();

        // Registrar acceso
        const { error } = await supabase
            .from('password_access_log')
            .insert({
                user_id: user.id,
                user_email: user.email,
                user_name: appUser?.name || user.email?.split('@')[0],
                entity_type: entityType,
                entity_id: entityId,
                entity_name: entityName
            });

        if (error) {
            logger.error('Error registrando acceso a contraseña:', error);
            return { success: false, error: error.message };
        }

        logger.log(`Acceso a contraseña registrado: ${entityType}/${entityName}`);
        return { success: true };
    } catch (err: any) {
        logger.error('Error en logPasswordAccess:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Obtiene el historial de accesos a contraseñas (solo para admins)
 */
export const getPasswordAccessLogs = async (
    filters?: {
        entityType?: 'supplier_portal' | 'company';
        entityId?: string;
        startDate?: string;
        endDate?: string;
        limit?: number;
    }
): Promise<PasswordAccessLog[]> => {
    try {
        let query = supabase
            .from('password_access_log')
            .select('*')
            .order('accessed_at', { ascending: false });

        if (filters?.entityType) {
            query = query.eq('entity_type', filters.entityType);
        }
        if (filters?.entityId) {
            query = query.eq('entity_id', filters.entityId);
        }
        if (filters?.startDate) {
            query = query.gte('accessed_at', filters.startDate);
        }
        if (filters?.endDate) {
            query = query.lte('accessed_at', filters.endDate);
        }
        if (filters?.limit) {
            query = query.limit(filters.limit);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Error obteniendo logs de acceso:', error);
            return [];
        }

        return (data || []).map(log => ({
            id: log.id,
            userId: log.user_id,
            userEmail: log.user_email,
            userName: log.user_name,
            entityType: log.entity_type,
            entityId: log.entity_id,
            entityName: log.entity_name,
            accessedAt: log.accessed_at
        }));
    } catch (err: any) {
        logger.error('Error en getPasswordAccessLogs:', err);
        return [];
    }
};

/**
 * Obtiene el conteo de accesos por entidad (para mostrar en UI)
 */
export const getAccessCountByEntity = async (
    entityType: 'supplier_portal' | 'company',
    entityId: string
): Promise<number> => {
    try {
        const { count, error } = await supabase
            .from('password_access_log')
            .select('*', { count: 'exact', head: true })
            .eq('entity_type', entityType)
            .eq('entity_id', entityId);

        if (error) return 0;
        return count || 0;
    } catch {
        return 0;
    }
};

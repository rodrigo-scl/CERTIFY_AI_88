import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { AppUser } from '../types';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  canEdit: boolean; // True for Admin and Supervisor
  isBranchManager: boolean;
  permissions: string[]; // List of enabled permission keys
  hasPermission: (key: string) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (authUser: { id: string; email?: string; user_metadata?: any }): Promise<{ profile: AppUser; perms: string[] }> => {
    // Perfil base con valores por defecto - Rodrigo Osorio v0.10
    // RESILIENCIA: Usar user_metadata.role como fallback si la DB no responde
    const metadataRole = authUser.user_metadata?.role;
    const baseProfile: AppUser = {
      id: authUser.id,
      name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuario',
      email: authUser.email || '',
      role: metadataRole || 'Visualizador', // Usa metadata primero, luego mínimo privilegio
      status: 'ACTIVE',
      lastLogin: null,
      assignedBranchIds: []
    };

    let userPerms: string[] = [];

    // Enriquecer con datos de app_users con reintentos automáticos
    // v0.14 - Optimizado: incluye permisos en el mismo fetch con timeout
    const fetchWithRetry = async (attempt = 1, maxAttempts = 2): Promise<{ result: any; branchesResult: any; permResult: any }> => {
      // Timeouts cortos: 3s, 5s - prioriza carga rápida
      const timeouts = [3000, 5000];
      const timeout = timeouts[attempt - 1] || timeouts[timeouts.length - 1];

      const queryPromise = supabase
        .from('app_users')
        .select('*')
        .eq('email', authUser.email)
        .maybeSingle();

      const branchesPromise = supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', authUser.id);

      // Incluir permisos en el mismo fetch (usando role de metadata como fallback)
      const roleForPerms = metadataRole || 'Visualizador';
      const permPromise = supabase
        .from('role_permissions')
        .select('permission_key')
        .eq('role_id', roleForPerms)
        .eq('enabled', true);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeout)
      );

      try {
        const [result, branchesResult, permResult] = await Promise.race([
          Promise.all([queryPromise, branchesPromise, permPromise]),
          timeoutPromise.then(() => { throw new Error('timeout'); })
        ]);
        return { result, branchesResult, permResult };
      } catch (err: any) {
        if (attempt < maxAttempts && err.message?.includes('timeout')) {
          return fetchWithRetry(attempt + 1, maxAttempts);
        }
        throw err;
      }
    };

    try {
      const { result, branchesResult, permResult } = await fetchWithRetry();

      if (result?.data) {
        baseProfile.name = result.data.name || baseProfile.name;
        baseProfile.role = result.data.role || baseProfile.role;
        baseProfile.status = result.data.status || 'ACTIVE';
        baseProfile.id = result.data.id || baseProfile.id;
      }

      if (branchesResult?.data && !branchesResult?.error) {
        baseProfile.assignedBranchIds = branchesResult.data.map((b: any) => b.branch_id);
      }

      // Permisos ya vienen del fetch con timeout
      if (permResult?.data && !permResult?.error) {
        userPerms = permResult.data.map((p: any) => p.permission_key);
      }

      (baseProfile as any)._isFullProfile = true;

    } catch (err: any) {
      // Silencioso: el fallback funciona bien
      (baseProfile as any)._isFullProfile = false;
    }

    return { profile: baseProfile, perms: userPerms };
  };

  const refreshProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { profile, perms } = await fetchProfile({
        id: session.user.id,
        email: session.user.email,
        user_metadata: session.user.user_metadata
      });

      // RESILIENCIA: No aplicar perfil degradado si ya tenemos uno válido
      if (!(profile as any)._isFullProfile && user) {
        return;
      }

      setUser(profile);
      setPermissions(perms);
    } else {
      setUser(null);
      setPermissions([]);
    }
  }, [user]);

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { profile, perms } = await fetchProfile({
          id: session.user.id,
          email: session.user.email,
          user_metadata: session.user.user_metadata
        });
        setUser(profile);
        setPermissions(perms);
      } else {
        setUser(null);
        setPermissions([]);
      }
      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setPermissions([]);
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          const { profile, perms } = await fetchProfile({
            id: session.user.id,
            email: session.user.email,
            user_metadata: session.user.user_metadata
          });

          // Solo actualizar si el perfil es el principal o si el fetch fue exitoso
          if (!(profile as any)._isFullProfile && user && event === 'TOKEN_REFRESHED') {
            console.warn('Token refreshed but profile fetch failed. Maintaining previous security context.');
            return;
          }

          setUser(profile);
          setPermissions(perms);
          setLoading(false);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Optimización v0.10 - Rodrigo Osorio: Memoizar cálculos para evitar re-renders innecesarios
  const isAdmin = useMemo(() =>
    user?.role === 'Administrador' || user?.role === 'Superadministrador' || user?.role === 'Gestor',
    [user?.role]
  );

  const canEdit = useMemo(() =>
    user?.role === 'Administrador' || user?.role === 'Superadministrador' || user?.role === 'Gestor' || user?.role === 'Supervisor' || user?.role === 'Gerente de Sucursal',
    [user?.role]
  );

  const isBranchManager = useMemo(() =>
    user?.role === 'Gerente de Sucursal',
    [user?.role]
  );

  const hasPermission = (key: string) => {
    // El Superadministrador siempre tiene todos los permisos
    if (user?.role === 'Superadministrador') return true;
    return permissions.includes(key);
  };

  // Memoizar el valor del contexto completo para evitar re-renders cuando no hay cambios reales
  const contextValue = useMemo(() => ({
    user,
    loading,
    isAdmin,
    canEdit,
    isBranchManager,
    permissions,
    hasPermission,
    refreshProfile
  }), [user, loading, isAdmin, canEdit, isBranchManager, permissions, refreshProfile]);


  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
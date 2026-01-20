import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { AppUser } from '../types';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  canEdit: boolean; // True for Admin and Supervisor
  isBranchManager: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (authUser: { id: string; email?: string; user_metadata?: any }): Promise<AppUser> => {
    // Perfil base con valores por defecto - Rodrigo Osorio v0.9
    const baseProfile: AppUser = {
      id: authUser.id,
      name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuario',
      email: authUser.email || '',
      role: 'Administrador',
      status: 'ACTIVE',
      lastLogin: null,
      assignedBranchIds: []
    };

    // Enriquecer con datos de app_users (timeout 3s para evitar bloqueos)
    try {
      // Usar Promise.all para cargar perfil y sucursales en paralelo
      const queryPromise = supabase
        .from('app_users')
        .select('*')
        .eq('email', authUser.email)
        .maybeSingle();

      const branchesPromise = supabase
        .from('user_branches')
        .select('branch_id')
        .eq('user_id', authUser.id);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 3000)
      );

      const [result, branchesResult] = await Promise.race([
        Promise.all([queryPromise, branchesPromise]),
        timeoutPromise
      ]) as any;

      if (result?.data && !result?.error) {
        baseProfile.name = result.data.name || baseProfile.name;
        baseProfile.role = result.data.role || baseProfile.role;
        baseProfile.status = result.data.status || 'ACTIVE';
        baseProfile.id = result.data.id || baseProfile.id; // Asegurar que usamos el ID de la tabla app_users si es distinto
      }

      if (branchesResult?.data && !branchesResult?.error) {
        baseProfile.assignedBranchIds = branchesResult.data.map((b: any) => b.branch_id);
      }
    } catch {
      // Si falla o timeout, continúa con perfil base
    }

    return baseProfile;
  };

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const profile = await fetchProfile({
        id: session.user.id,
        email: session.user.email,
        user_metadata: session.user.user_metadata
      });
      setUser(profile);
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const profile = await fetchProfile({
          id: session.user.id,
          email: session.user.email,
          user_metadata: session.user.user_metadata
        });
        setUser(profile);
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          setLoading(true);
          const profile = await fetchProfile({
            id: session.user.id,
            email: session.user.email,
            user_metadata: session.user.user_metadata
          });
          setUser(profile);
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
    user?.role === 'Administrador' || user?.role === 'Superadministrador',
    [user?.role]
  );

  const canEdit = useMemo(() =>
    user?.role === 'Administrador' || user?.role === 'Superadministrador' || user?.role === 'Supervisor' || user?.role === 'Gerente de Sucursal',
    [user?.role]
  );

  const isBranchManager = useMemo(() =>
    user?.role === 'Gerente de Sucursal',
    [user?.role]
  );

  // Memoizar el valor del contexto completo para evitar re-renders cuando no hay cambios reales
  const contextValue = useMemo(() => ({
    user,
    loading,
    isAdmin,
    canEdit,
    isBranchManager,
    refreshProfile
  }), [user, loading, isAdmin, canEdit, isBranchManager, refreshProfile]);


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
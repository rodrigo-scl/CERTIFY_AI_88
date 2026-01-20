import { supabase } from './supabaseClient';

export const signIn = async (email: string, pass: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });
  if (error) throw error;
  
  // Update last login
  if (data.user) {
    await supabase
      .from('app_users')
      .update({ last_login: new Date().toISOString() })
      .eq('email', data.user.email);
  }
  
  return data;
};

export const signOut = async () => {
  // Limpiar sesión de Supabase
  await supabase.auth.signOut();
  
  // Limpiar cualquier cache local
  // Generar el key dinámicamente desde la URL del proyecto
  const projectId = import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0];
  if (projectId) {
    localStorage.removeItem(`sb-${projectId}-auth-token`);
  }
  sessionStorage.clear();
};

export const getCurrentUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
};

export const onAuthStateChange = (callback: (user: any) => void) => {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
};
// Rodrigo Osorio v0.10 - Code splitting optimizado para mejor performance inicial
import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthGuard } from './components/AuthGuard';
import { AuthProvider } from './context/AuthContext';

// Lazy loading de páginas para reducir el bundle inicial
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Technicians = lazy(() => import('./pages/Technicians').then(m => ({ default: m.Technicians })));
const Companies = lazy(() => import('./pages/Companies').then(m => ({ default: m.Companies })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Areas = lazy(() => import('./pages/Areas').then(m => ({ default: m.Areas })));
const Branches = lazy(() => import('./pages/Branches').then(m => ({ default: m.Branches })));
const Parameters = lazy(() => import('./pages/Parameters').then(m => ({ default: m.Parameters })));
const Availability = lazy(() => import('./pages/Availability').then(m => ({ default: m.Availability })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const AuditLogs = lazy(() => import('./pages/AuditLogs').then(m => ({ default: m.AuditLogs })));

// Componente de carga mientras se cargan las páginas
const PageLoader = () => (
  <div className="flex h-screen items-center justify-center bg-slate-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-500 border-t-transparent mx-auto mb-4"></div>
      <p className="text-slate-600">Cargando...</p>
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Protected Routes */}
            <Route path="/" element={
              <AuthGuard>
                <Layout>
                  <Dashboard />
                </Layout>
              </AuthGuard>
            } />

            <Route path="/technicians" element={
              <AuthGuard>
                <Layout>
                  <Technicians />
                </Layout>
              </AuthGuard>
            } />

            <Route path="/companies" element={
              <AuthGuard>
                <Layout>
                  <Companies />
                </Layout>
              </AuthGuard>
            } />

            <Route path="/branches" element={
              <AuthGuard>
                <Layout>
                  <Branches />
                </Layout>
              </AuthGuard>
            } />

            <Route path="/areas" element={
              <AuthGuard>
                <Layout>
                  <Areas />
                </Layout>
              </AuthGuard>
            } />

            <Route path="/settings" element={
              <AuthGuard>
                <Layout>
                  <Settings />
                </Layout>
              </AuthGuard>
            } />

            <Route path="/parameters" element={
              <AuthGuard>
                <Layout>
                  <Parameters />
                </Layout>
              </AuthGuard>
            } />

            <Route path="/availability" element={
              <AuthGuard>
                <Layout>
                  <Availability />
                </Layout>
              </AuthGuard>
            } />

            <Route path="/audit" element={
              <AuthGuard>
                <Layout>
                  <AuditLogs />
                </Layout>
              </AuthGuard>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
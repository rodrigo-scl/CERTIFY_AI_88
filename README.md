<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Certify AI - Sistema de Gestión de Certificaciones

Sistema completo de gestión de certificaciones para técnicos con IA integrada.

**Versión:** 0.11 - Seguridad y Performance  
**Desarrollador:** Rodrigo Osorio  
**Stack:** React 19 + TypeScript + Supabase + Google AI

View your app in AI Studio: https://ai.studio/apps/drive/1Vy7yjSa8wk1n2mvz5rCqUWDwRo8hpElr

## ⚡ Optimizaciones de Performance v0.10

Esta versión incluye optimizaciones significativas que mejoran el rendimiento en un **40-80%**:

- ✅ **Memoización completa** de AuthContext, Layout y componentes principales
- ✅ **Code Splitting** con React.lazy para reducir bundle inicial en ~50%
- ✅ **Optimización de re-renders** con useMemo y useCallback
- ✅ **Lazy loading** de todas las rutas principales

📊 **Ver detalles completos:** [PERFORMANCE_OPTIMIZATIONS.md](./PERFORMANCE_OPTIMIZATIONS.md)

## 🔐 Configuración de Seguridad v0.11

Esta versión implementa mejoras críticas de seguridad:

- ✅ **Variables de entorno** para credenciales sensibles
- ✅ **Logging condicional** (solo en desarrollo)
- ✅ **Protección de API Keys** en el cliente
- ✅ **Sanitización de errores** en producción

## Run Locally

**Prerequisites:**  Node.js v18+

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **⚠️ IMPORTANTE - Configurar variables de entorno:**
   
   Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:
   
   ```env
   # Configuración de Supabase
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-anonima-aqui
   ```
   
   **Obtener las credenciales:**
   - Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
   - Navega a Settings > API
   - Copia la URL del proyecto y la clave `anon/public`
   
   **NOTA DE SEGURIDAD:** 
   - El archivo `.env` ya está protegido en `.gitignore`
   - **NUNCA** subas este archivo a git
   - La API Key de Gemini NO debe estar en el cliente
   - Configúrala como secret en Supabase Edge Functions:
     ```bash
     supabase secrets set GEMINI_API_KEY=tu-api-key
     ```

3. **Ejecutar en desarrollo:**
   ```bash
   npm run dev
   ```
   
   La app estará disponible en `http://localhost:3000`

4. **Construir para producción:**
   ```bash
   npm run build
   ```

5. **Analizar bundle (opcional):**
   ```bash
   npm run build:analyze
   ```

## 🎯 Características Principales

- 📊 **Dashboard** con métricas en tiempo real
- 👥 **Gestión de Técnicos** con documentación completa
- 🏢 **Gestión de Empresas** y sucursales
- 🤖 **Certify AI** - Asistente inteligente con Google Gemini
- 📈 **Reportes de Acreditación** por empresa
- 🔔 **Sistema de Alertas** de cumplimiento
- 🔐 **Autenticación segura** con Supabase Auth
- 🛡️ **Logging condicional** para proteger información sensible
- 📱 **Responsive Design** optimizado para móvil

## 🏗️ Arquitectura

```
certify-ai/
├── components/        # Componentes reutilizables
│   ├── Layout.tsx    # Layout principal con sidebar
│   ├── AuthGuard.tsx # Protección de rutas
│   └── shared/       # Componentes compartidos
├── context/          # Contextos de React
│   └── AuthContext.tsx
├── pages/            # Páginas principales (lazy loaded)
│   ├── Dashboard.tsx
│   ├── Technicians.tsx
│   ├── Companies.tsx
│   └── ...
├── services/         # Servicios y APIs
│   ├── dataService.ts
│   ├── geminiService.ts
│   ├── supabaseClient.ts
│   └── logger.ts     # Utilidad de logging condicional
└── types.ts          # Definiciones de TypeScript
```

## 📈 Métricas de Performance

| Métrica | Antes v0.9 | Después v0.10 | Mejora |
|---------|------------|---------------|--------|
| Bundle inicial | ~800KB | ~400KB | **-50%** |
| First Contentful Paint | ~2.5s | ~1.5s | **-40%** |
| Re-renders/min | ~100 | ~30 | **-70%** |
| Tiempo render Dashboard | ~500ms | ~100ms | **-80%** |

## 🛡️ Seguridad y Mejores Prácticas

### Variables de Entorno
- Todas las credenciales se gestionan mediante variables de entorno
- El archivo `.env` está excluido de git automáticamente
- Las API keys nunca se exponen en el bundle del cliente

### Logging
- Los logs están deshabilitados en producción
- Solo errores críticos se registran (sin detalles técnicos)
- En desarrollo, logs completos para debugging

### Edge Functions
- La API Key de Gemini se configura como secret en Supabase
- Nunca se envía al cliente
- Acceso solo desde el servidor

## 🚀 Próximas Mejoras

- [ ] Virtualización de listas largas con react-window
- [ ] Implementación de PWA con Service Workers
- [ ] Prefetching de datos para navegación más rápida
- [ ] Optimización de imágenes con lazy loading
- [ ] Web Workers para procesamiento pesado
- [ ] Auditoría de seguridad automatizada

## 📝 Changelog

### v0.11 (Diciembre 2025)
- 🔐 **SEGURIDAD:** Migración a variables de entorno para credenciales
- 🔐 **SEGURIDAD:** Eliminación de API keys hardcodeadas
- 🔐 **SEGURIDAD:** Logging condicional (solo desarrollo)
- 🔐 **SEGURIDAD:** Sanitización de errores en producción
- 🛡️ Protección de información sensible en consola
- 📚 Documentación de configuración segura

### v0.10 (Diciembre 2025)
- ✨ Optimizaciones masivas de performance
- ✨ Code splitting con React.lazy
- ✨ Memoización completa de componentes críticos
- 🐛 Corrección de re-renders innecesarios
- 📚 Documentación completa de optimizaciones

### v0.9 (Noviembre 2025)
- ✨ Sistema de alertas de cumplimiento
- ✨ Empresas Prestadoras de Servicio (EPS)
- 🎨 Mejoras de UI/UX

## 👨‍💻 Desarrollo

**Autor:** Rodrigo Osorio  
**Licencia:** Privado  
**Contacto:** [Tu contacto]

# Instrucciones de Despliegue - Edge Functions

## certify-ai

### Paso 1: Ir a Supabase Dashboard
1. Abre https://supabase.com/dashboard
2. Selecciona el proyecto `mxjpeadstmfzkeitvnhy`
3. Ve a **Edge Functions** en el menú lateral

### Paso 2: Crear/Actualizar la función
1. Click en **New Function** (o editar si ya existe)
2. Nombre: `certify-ai`
3. Copia todo el contenido de `certify-ai/index.ts`
4. Click en **Deploy**

### Paso 3: Configurar Secrets
1. Ve a **Project Settings** > **Secrets**
2. Agrega el secret:
   - Nombre: `GEMINI_API_KEY`
   - Valor: Tu API key de Google AI Studio

### Verificar despliegue
La URL de la función será:
```
https://mxjpeadstmfzkeitvnhy.supabase.co/functions/v1/certify-ai
```

---

## Versiones

| Función | Versión | Fecha | Cambios |
|---------|---------|-------|---------|
| certify-ai | 0.9 | 2024-12 | Rate limiting, validación de input, mejor contexto |

---
Desarrollado por Rodrigo Osorio


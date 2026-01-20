# Implementación de Fechas de Emisión y Vencimiento

**Autor**: Rodrigo Osorio  
**Versión**: 0.1  
**Fecha**: Diciembre 2025

## Resumen

Se ha implementado un sistema completo de gestión de fechas para documentos con formato dd-mm-aaaa. Tanto para carga inicial como para renovación se requieren ambas fechas: emisión y vencimiento.

## ✅ Cambios Implementados

### 1. Nuevas Utilidades de Fecha (`services/dateUtils.ts`)

**Funciones creadas**:
- `formatDateForDB(ddmmyyyy)` - Convierte dd-mm-aaaa → yyyy-mm-dd
- `formatDateForDisplay(yyyymmdd)` - Convierte yyyy-mm-dd → dd-mm-aaaa
- `isValidDateFormat(date)` - Valida formato dd-mm-aaaa
- `validateDateRange(issueDate, expiryDate)` - Valida que emisión <= vencimiento
- `autoFormatDate(value)` - Aplica formato automático mientras se escribe
- `isExpired(expiryDate)` - Verifica si ya venció
- `getCurrentDate()` - Obtiene fecha actual en dd-mm-aaaa
- `parseDateDMY(date)` - Parsea fecha en componentes

**Validaciones implementadas**:
- Formato dd-mm-aaaa con guiones
- Día válido (01-31) según mes
- Mes válido (01-12)
- Año válido (1900-2100)
- Fechas reales (considera años bisiestos)

### 2. Componente DateInput (`components/shared/DateInput.tsx`)

**Características**:
- Input de texto con máscara dd-mm-aaaa
- Auto-formateo mientras el usuario escribe
  - Usuario escribe "15032024" → se convierte a "15-03-2024"
- Validación en tiempo real
- Indicadores visuales:
  - ✅ Verde: fecha válida
  - ❌ Rojo: fecha inválida
  - 📅 Gris: en progreso
- Mensajes de error contextuales
- Ayuda visual al hacer foco

### 3. Modal de Carga de Documentos NUEVOS (actualizado)

**Archivo**: `pages/Companies.tsx` - Componente `UploadDocModal`

**Campos agregados**:
1. **Fecha de Emisión** (OBLIGATORIO)
   - Formato: dd-mm-aaaa
   - Validación en tiempo real
   - Auto-formateo

2. **Fecha de Vencimiento** (OBLIGATORIO)
   - Formato: dd-mm-aaaa
   - Validación en tiempo real
   - Auto-formateo
   - Debe ser >= Fecha de Emisión

**Validaciones**:
- Ambas fechas obligatorias
- Formato válido dd-mm-aaaa
- Emisión <= Vencimiento
- Fechas reales (no 32-13-2024)

**Conversión automática**:
- Frontend: Usuario ve dd-mm-aaaa
- Backend: Sistema guarda yyyy-mm-dd

### 4. Modal de RENOVACIÓN (actualizado)

**Archivo**: `pages/Technicians.tsx` - Modal de actualización

**Cambios**:
- Solicita **Nueva Fecha de Emisión** (OBLIGATORIO)
- Solicita **Nueva Fecha de Vencimiento** (OBLIGATORIO)
- Formato dd-mm-aaaa para ambas fechas
- Validación en tiempo real
- Validación que emisión <= vencimiento
- Auto-carga fechas sugeridas (hoy + 1 año)

**Lógica**:
- Al abrir: sugiere fecha actual como emisión y +1 año como vencimiento
- Al guardar: convierte ambas fechas dd-mm-aaaa → yyyy-mm-dd

### 5. Funciones Backend Actualizadas

**Archivo**: `services/dataService.ts`

#### `addCredentialToTechnician`
```typescript
export const addCredentialToTechnician = async (
    techId: string, 
    docTypeId: string, 
    expiryDate: string,      // OBLIGATORIO (yyyy-mm-dd)
    fileUrl: string | undefined,
    issueDate: string        // OBLIGATORIO (yyyy-mm-dd)
)
```

#### `addCompanyCredential`
```typescript
export const addCompanyCredential = async (
    companyId: string, 
    docTypeId: string, 
    expiryDate: string,      // OBLIGATORIO (yyyy-mm-dd)
    fileUrl: string | undefined,
    issueDate: string        // OBLIGATORIO (yyyy-mm-dd)
)
```

#### `updateCredential` (sin cambios)
```typescript
export const updateCredential = async (
    techId: string, 
    credentialId: string, 
    newDate: string,         // Solo vencimiento
    fileUrl?: string,
    issueDate?: string       // Sigue opcional (renovación)
)
```

### 6. Visualización Actualizada

**Archivos**: `pages/Companies.tsx` y `pages/Technicians.tsx`

**Cambios**:
- Fechas mostradas en formato dd-mm-aaaa
- Agregada visualización de fecha de emisión en Companies.tsx
- Formato consistente en todas las vistas

**Ejemplo**:
```
Emitido: 15-03-2024
Vence: 31-12-2025
```

## Flujos de Usuario

### 📝 Cargar Documento NUEVO

1. Usuario hace clic en "Cargar Documento"
2. Modal se abre con:
   - Tipo de documento (dropdown)
   - **Fecha de Emisión** (input dd-mm-aaaa) ⭐ OBLIGATORIO
   - **Fecha de Vencimiento** (input dd-mm-aaaa) ⭐ OBLIGATORIO
   - Archivo (upload)
3. Usuario escribe fechas:
   - Puede escribir "15032024" → auto-formatea a "15-03-2024"
   - O escribir con guiones: "15-03-2024"
4. Validaciones en tiempo real:
   - ✅ Formato válido
   - ✅ Emisión <= Vencimiento
   - ✅ Fechas reales
5. Al guardar:
   - Convierte a yyyy-mm-dd
   - Sube archivo
   - Guarda en BD con ambas fechas

### 🔄 Renovar Documento Existente

1. Usuario hace clic en "Actualizar" en un documento
2. Modal se abre con:
   - Nombre del documento (readonly)
   - **Nueva Fecha de Vencimiento** (input dd-mm-aaaa) ⭐ OBLIGATORIO
   - Fecha actual pre-cargada en formato dd-mm-aaaa
   - Archivo nuevo (opcional)
3. Usuario modifica fecha: "31-12-2026"
4. Al guardar:
   - Convierte a yyyy-mm-dd
   - Sube archivo (si hay uno nuevo)
   - Actualiza solo `expiry_date` (NO toca `issue_date`)

## Formato de Fechas

### Frontend (Usuario ve)
```
Formato: dd-mm-aaaa
Ejemplo: 15-03-2024
```

### Backend (Base de datos)
```
Formato: yyyy-mm-dd
Ejemplo: 2024-03-15
Tipo SQL: DATE
```

### Conversión Automática
```typescript
// Usuario escribe → BD guarda
"15-03-2024"    →  "2024-03-15"

// BD devuelve → Usuario ve
"2024-03-15"    →  "15-03-2024"
```

## Validaciones Implementadas

### Cliente (Frontend)
- ✅ Formato dd-mm-aaaa válido
- ✅ Campos obligatorios no vacíos
- ✅ Fecha de emisión <= Fecha de vencimiento
- ✅ Fechas reales (día válido según mes)
- ✅ Años bisiestos considerados
- ✅ Rango de años: 1900-2100

### Servidor (Backend)
- ✅ Recibe fechas en formato yyyy-mm-dd
- ✅ Almacena en tipo DATE nativo
- ✅ Calcula estado automáticamente

## Compatibilidad con Datos Existentes

**Documentos sin fecha de emisión**:
- Se mostrarán como "N/A" en la UI
- Al renovarlos, NO se pedirá fecha de emisión
- Solo documentos NUEVOS requieren fecha de emisión
- Migración gradual

## Archivos Creados/Modificados

### Creados
1. `services/dateUtils.ts` - Utilidades de fecha
2. `components/shared/DateInput.tsx` - Componente de input
3. `FECHAS_IMPLEMENTACION.md` - Esta documentación

### Modificados
1. `pages/Companies.tsx` - Modal de carga y visualización
2. `pages/Technicians.tsx` - Modal de renovación y visualización
3. `services/dataService.ts` - Funciones backend actualizadas

## Ejemplos de Uso

### Validar fecha manualmente
```typescript
import { isValidDateFormat } from '../services/dateUtils';

if (isValidDateFormat("15-03-2024")) {
  console.log("Fecha válida!");
}
```

### Convertir fechas
```typescript
import { formatDateForDB, formatDateForDisplay } from '../services/dateUtils';

// Para enviar a BD
const dbDate = formatDateForDB("15-03-2024"); // "2024-03-15"

// Para mostrar al usuario
const displayDate = formatDateForDisplay("2024-03-15"); // "15-03-2024"
```

### Usar componente DateInput
```typescript
import { DateInput } from '../components/shared/DateInput';

<DateInput
  label="Fecha de Emisión"
  value={issueDate}
  onChange={setIssueDate}
  required
/>
```

## Notas Técnicas

### Base de Datos
- Columnas: `issue_date` y `expiry_date`
- Tipo: DATE (nativo PostgreSQL)
- Nullable: Sí (compatibilidad con datos existentes)
- Sin zona horaria (son fechas, no timestamps)

### Auto-formateo
- Solo permite números y guiones
- Inserta guiones automáticamente
- Máximo 10 caracteres (dd-mm-aaaa)
- No se puede escribir texto

### Validación de Días
- Considera meses con 28, 30 y 31 días
- Detecta años bisiestos correctamente
- Febrero 29 solo en años bisiestos

## Testing Manual

### Casos a Probar

1. **Cargar documento nuevo**:
   - ✅ Con ambas fechas válidas
   - ❌ Sin fecha de emisión → debe fallar
   - ❌ Sin fecha de vencimiento → debe fallar
   - ❌ Con emisión > vencimiento → debe fallar
   - ❌ Con formato 15/03/2024 → debe fallar
   - ✅ Auto-formato: escribir "15032024" → "15-03-2024"

2. **Renovar documento**:
   - ✅ Con nueva fecha de vencimiento
   - ❌ Sin fecha → debe fallar
   - ✅ Fecha existente se muestra en dd-mm-aaaa

3. **Visualización**:
   - ✅ Fechas se muestran en dd-mm-aaaa
   - ✅ Fecha de emisión visible (si existe)
   - ✅ "N/A" para fechas vacías

## Estado Final

✅ **Todas las tareas completadas**

1. ✅ Utilidades de fecha creadas
2. ✅ Componente DateInput creado
3. ✅ Modal de carga actualizado
4. ✅ Modal de renovación actualizado
5. ✅ Backend actualizado
6. ✅ Visualización actualizada
7. ✅ Validaciones implementadas
8. ✅ Documentación creada

---

**Implementación completada por**: Rodrigo Osorio  
**Versión**: 0.1  
**Sistema listo para uso**


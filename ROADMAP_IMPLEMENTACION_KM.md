# 🚀 ROADMAP DE IMPLEMENTACIÓN - SISTEMA DE KILÓMETROS

## 📋 Resumen Ejecutivo

Este documento define el plan de implementación por fases para integrar el sistema de registro de kilómetros al bot de Telegram existente. La estrategia prioriza la estabilidad del sistema actual, implementación gradual y testing exhaustivo entre cada fase.

### Principios de Implementación
- **Zero Downtime**: Mantener el bot operativo durante todo el proceso
- **Backward Compatibility**: Los registros existentes deben seguir funcionando
- **Incremental Testing**: Validar cada fase antes de continuar
- **Rollback Ready**: Capacidad de revertir cambios si es necesario

---

## 🔄 Análisis de Dependencias

### Dependencias Críticas Identificadas

1. **Base de Datos**
   - Nuevas columnas en tabla `Fuel` (kilometers, pricePerLiter)
   - Nueva tabla `KilometerLog` para registros de turno
   - Índices y constraints necesarios

2. **Flujo de Registro**
   - Modificación del flujo existente de cargas
   - Nuevo paso de captura de kilómetros
   - Cálculo automático de montos

3. **Sistema de Validaciones**
   - Validación contra histórico de kilómetros
   - Búsqueda combinada en múltiples tablas
   - Manejo de primer registro

4. **Nuevas Funcionalidades**
   - Sistema de turnos (inicio/fin de día)
   - Procesamiento batch de unidades
   - Sistema de omisión de registros

5. **Reportes**
   - Nuevas columnas en PDF/Excel
   - Manejo de registros sin kilómetros (N/A)

---

## 📊 FASE 0: PREPARACIÓN Y ANÁLISIS (2-3 días)

### Objetivos
- Preparar el entorno de desarrollo
- Crear rama feature específica
- Documentar estado actual

### Tareas
```
□ Crear rama feature/sistema-kilometros
□ Backup completo de base de datos de producción
□ Clonar datos de producción a entorno de desarrollo
□ Documentar flujo actual con capturas de pantalla
□ Crear casos de prueba para flujo existente
□ Configurar entorno de testing aislado
```

### Criterios de Éxito
- Entorno de desarrollo espejo de producción
- Flujo actual documentado y respaldado
- Suite de pruebas del flujo existente funcionando

### Riesgos
- **Riesgo**: Diferencias entre desarrollo y producción
- **Mitigación**: Sincronización completa de esquemas y datos

---

## 📊 FASE 1: MIGRACIÓN DE BASE DE DATOS (3-4 días)

### Objetivos
- Actualizar schema de Prisma
- Crear migraciones necesarias
- Validar integridad de datos

### Tareas Detalladas

#### 1.1 Actualización del Schema
```prisma
// Modificar modelo Fuel
model Fuel {
  // ... campos existentes ...
  kilometers    Decimal?  @db.Decimal(10, 2)
  pricePerLiter Decimal?  @db.Decimal(10, 2)
}

// Nuevo modelo KilometerLog
model KilometerLog {
  id         String           @id @default(uuid())
  tenantId   String
  unitId     String
  kilometers Decimal          @db.Decimal(10, 2)
  logType    KilometerLogType
  logDate    DateTime         @db.Date
  logTime    DateTime         @default(now())
  userId     String
  isOmitted  Boolean          @default(false)
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt
  
  tenant     Tenant           @relation(fields: [tenantId], references: [id])
  unit       Unit             @relation(fields: [unitId], references: [id])
  
  @@unique([tenantId, unitId, logDate, logType])
  @@index([tenantId, logDate])
  @@index([unitId, logDate])
}

enum KilometerLogType {
  INICIO_TURNO
  FIN_TURNO
}
```

#### 1.2 Generación de Migraciones
```bash
# Generar migración
npx prisma migrate dev --name add_kilometers_system

# Validar migración generada
# Revisar SQL generado antes de aplicar
```

#### 1.3 Testing de Migraciones
```
□ Aplicar migración en base de desarrollo
□ Verificar que registros existentes mantienen NULL en nuevos campos
□ Insertar registros de prueba con nuevos campos
□ Validar constraints y relaciones
□ Probar rollback de migración
```

### Criterios de Éxito
- Migración aplicada sin errores
- Datos existentes intactos
- Nuevas tablas y campos creados correctamente
- Índices funcionando para queries optimizadas

### Puntos de Validación
1. ¿Los registros existentes siguen funcionando?
2. ¿Las consultas actuales no se ven afectadas?
3. ¿Los nuevos campos aceptan valores correctamente?

---

## 📊 FASE 2: CAPA DE SERVICIOS (4-5 días)

### Objetivos
- Crear servicios para manejo de kilómetros
- Implementar validaciones de negocio
- Mantener compatibilidad con código existente

### Tareas Detalladas

#### 2.1 Crear KilometerService
```javascript
// src/services/kilometerService.js
class KilometerService {
  // Obtener último kilómetro registrado
  async getLastKilometer(tenantId, unitId)
  
  // Validar nuevo kilómetro
  async validateKilometer(tenantId, unitId, newKilometer)
  
  // Registrar log de turno
  async createTurnLog(data)
  
  // Obtener logs de turno por fecha
  async getTurnLogsByDate(tenantId, date)
  
  // Verificar unidades sin registro
  async getUnitsWithoutLog(tenantId, date, logType)
}
```

#### 2.2 Actualizar FuelService
```javascript
// Modificaciones en src/services/fuelService.js
- Agregar parámetros kilometers y pricePerLiter
- Implementar cálculo automático de monto
- Mantener compatibilidad con registros sin kilómetros
- Agregar validación de kilómetros antes de guardar
```

#### 2.3 Implementar Validaciones
```
□ Validación de kilómetros >= último registrado
□ Búsqueda combinada en Fuel + KilometerLog
□ Manejo de primer registro (sin histórico)
□ Formato de decimales (2 decimales máximo)
□ Cálculo preciso de monto total
```

### Testing de Servicios
```javascript
// Tests a implementar
- Test: Primer registro de kilómetros
- Test: Validación contra histórico
- Test: Cálculo de monto con decimales
- Test: Registros sin kilómetros (compatibilidad)
- Test: Logs de turno únicos por día
```

### Criterios de Éxito
- Todos los tests de servicios pasando
- Sin breaking changes en servicios existentes
- Validaciones funcionando correctamente

---

## 📊 FASE 3: CONTROLADORES - FLUJO DE CARGAS (5-6 días)

### Objetivos
- Modificar flujo de registro de cargas
- Integrar captura de kilómetros
- Implementar cálculo automático

### Tareas Detalladas

#### 3.1 Modificar RegistroController
```javascript
// Nuevo flujo de estados
STATES = {
  SELECTING_UNIT: 'selecting_unit',
  ENTERING_KILOMETERS: 'entering_kilometers',    // NUEVO
  ENTERING_LITERS: 'entering_liters',
  ENTERING_PRICE_PER_LITER: 'entering_price',   // NUEVO
  // ENTERING_AMOUNT: 'entering_amount',         // ELIMINADO
  SELECTING_FUEL_TYPE: 'selecting_fuel_type',
  // ... resto sin cambios
}
```

#### 3.2 Implementar Nuevos Pasos

**Paso Kilómetros:**
```
□ Mensaje: "Por favor ingrese los kilómetros actuales de la unidad:"
□ Validación numérica con decimales
□ Validación contra histórico
□ Mensaje de error con referencia si es menor
□ Reintentos ilimitados hasta valor válido
```

**Paso Precio por Litro:**
```
□ Mensaje: "Ingrese el precio por litro:"
□ Validación numérica con 2 decimales
□ Mostrar cálculo: X litros × Y precio = Z total
□ Confirmación del monto calculado
```

#### 3.3 Testing del Flujo
```
□ Flujo completo con kilómetros válidos
□ Flujo con kilómetros menores (error + retry)
□ Primer registro sin histórico
□ Cálculo correcto con decimales
□ Cancelación en cualquier paso
```

### Puntos Críticos de Validación
1. ¿El usuario puede completar el flujo sin errores?
2. ¿Los mensajes de error son claros?
3. ¿El cálculo automático es preciso?
4. ¿Se puede cancelar en cualquier momento?

---

## 📊 FASE 4: SISTEMA DE TURNOS (4-5 días)

### Objetivos
- Implementar registro de inicio/fin de turno
- Procesar múltiples unidades en batch
- Sistema de omisión de registros

### Tareas Detalladas

#### 4.1 Crear TurnoController
```javascript
// src/controllers/turnoController.js
- Comando /turnos para acceder al menú
- Botones: "Inicio del día" | "Fin del día"
- Procesamiento secuencial de unidades
- Opción de omitir registros
```

#### 4.2 Flujo de Inicio de Turno
```
1. Obtener unidades activas del tenant
2. Filtrar las que ya tienen registro del día
3. Para cada unidad pendiente:
   - Mostrar: "Registrar km para [Operador] - [Unidad]"
   - Solicitar kilómetros
   - Botones: "Registrar" | "Omitir"
4. Mostrar resumen al finalizar
```

#### 4.3 Manejo de Re-ejecución
```
□ Detectar registros existentes del día
□ Mostrar mensaje informativo para ya registradas
□ Procesar solo unidades pendientes
□ Permitir completar proceso interrumpido
```

### Testing de Turnos
```
□ Registro completo de todas las unidades
□ Omisión de unidades específicas
□ Re-ejecución el mismo día
□ Validación de kilómetros en turnos
□ Concurrencia (múltiples usuarios)
```

---

## 📊 FASE 5: REORGANIZACIÓN DE MENÚS (2-3 días)

### Objetivos
- Reestructurar menú principal
- Implementar submenús
- Separar funciones por roles

### Nueva Estructura de Menús

```
MENÚ PRINCIPAL
├── 🚛 Registrar carga
├── 🕐 Turnos
│   ├── Inicio del día
│   └── Fin del día
├── 📊 Consultas
│   ├── Saldo pendiente
│   └── Generar reporte
└── 🔧 Administración [Solo Admin]
    ├── Registrar unidad
    ├── Editar registros
    ├── Buscar por nota
    └── Gestión usuarios
```

### Implementación
```
□ Actualizar mainMenu.js con nueva estructura
□ Crear submenú para Turnos
□ Crear submenú para Consultas
□ Validar permisos en menú Administración
□ Actualizar navegación entre menús
```

### Testing de Navegación
- Acceso correcto a cada opción
- Permisos funcionando (admin vs usuario)
- Botón "Volver" en cada submenú
- Navegación fluida sin loops

---

## 📊 FASE 6: ACTUALIZACIÓN DE REPORTES (3-4 días)

### Objetivos
- Agregar columnas de kilómetros y precio
- Manejar registros sin datos (N/A)
- Mantener formato existente

### Modificaciones en Reportes

#### 6.1 Estructura de Columnas
```
Antes: Fecha | Operador | Unidad | Combustible | Litros | Monto | Estado | Fecha Pago | Nota
Ahora: Fecha | Operador | Unidad | Kilómetros | Combustible | Litros | Precio/L | Monto | Estado | Fecha Pago | Nota
```

#### 6.2 Cambios en PDF
```javascript
// Modificar pdfReportService.js
□ Agregar columna Kilómetros (width: 60)
□ Agregar columna Precio/L (width: 50)
□ Ajustar anchos de otras columnas
□ Mostrar "N/A" para registros sin datos
```

#### 6.3 Cambios en Excel
```javascript
// Modificar excelReportService.js
□ Agregar columnas D (Kilómetros) y G (Precio/L)
□ Actualizar fórmulas si las hay
□ Ajustar formato de celdas numéricas
□ Aplicar estilos consistentes
```

### Testing de Reportes
```
□ Generar reporte con registros mixtos (con/sin km)
□ Verificar alineación de columnas
□ Validar totales y cálculos
□ Probar exportación en ambos formatos
□ Verificar legibilidad en dispositivos móviles
```

---

## 📊 FASE 7: TESTING INTEGRAL (3-4 días)

### Objetivos
- Validar sistema completo
- Pruebas de regresión
- Testing con usuarios reales

### Plan de Testing

#### 7.1 Testing Funcional
```
□ Flujo completo de registro con kilómetros
□ Sistema de turnos (inicio/fin)
□ Validaciones funcionando
□ Reportes con nuevas columnas
□ Navegación de menús
```

#### 7.2 Testing de Regresión
```
□ Registros sin kilómetros siguen funcionando
□ Reportes históricos se generan
□ Búsquedas existentes operativas
□ Sistema de pagos sin cambios
```

#### 7.3 Testing de Usuario
```
□ Seleccionar 2-3 usuarios piloto
□ Capacitación básica del nuevo flujo
□ Registro de feedback
□ Ajustes basados en retroalimentación
```

### Escenarios Críticos
1. Usuario registra primera carga del día
2. Usuario intenta kilómetros menores
3. Admin genera reporte mixto
4. Procesamiento de turnos con 10+ unidades
5. Múltiples usuarios simultáneos

---

## 📊 FASE 8: DESPLIEGUE A PRODUCCIÓN (2-3 días)

### Objetivos
- Migrar cambios a producción
- Monitoreo post-despliegue
- Documentación final

### Plan de Despliegue

#### 8.1 Pre-despliegue
```
□ Backup completo de producción
□ Preparar scripts de rollback
□ Comunicar ventana de mantenimiento
□ Preparar guía rápida para usuarios
```

#### 8.2 Despliegue
```
□ Aplicar migraciones de base de datos
□ Desplegar nueva versión del código
□ Verificar servicios activos
□ Testing smoke en producción
```

#### 8.3 Post-despliegue
```
□ Monitoreo activo primeras 24 horas
□ Verificar logs de errores
□ Atender issues inmediatos
□ Recopilar feedback de usuarios
```

---

## 🚨 GESTIÓN DE RIESGOS

### Riesgos Identificados y Mitigaciones

1. **Corrupción de Datos**
   - **Mitigación**: Backups antes de cada fase
   - **Plan B**: Scripts de rollback preparados

2. **Incompatibilidad con Flujo Existente**
   - **Mitigación**: Testing exhaustivo de regresión
   - **Plan B**: Feature flags para activar/desactivar

3. **Resistencia al Cambio de Usuarios**
   - **Mitigación**: Comunicación clara y capacitación
   - **Plan B**: Período de transición con ambos flujos

4. **Performance Degradado**
   - **Mitigación**: Índices optimizados y queries eficientes
   - **Plan B**: Cache de validaciones frecuentes

5. **Errores en Cálculos**
   - **Mitigación**: Testing exhaustivo con decimales
   - **Plan B**: Logs detallados para auditoría

---

## 📅 CRONOGRAMA ESTIMADO

### Timeline Total: 30-40 días hábiles

```
FASE 0: Preparación          [###] 2-3 días
FASE 1: Base de Datos        [####] 3-4 días
FASE 2: Servicios            [#####] 4-5 días
FASE 3: Flujo Cargas         [######] 5-6 días
FASE 4: Sistema Turnos       [#####] 4-5 días
FASE 5: Menús                [###] 2-3 días
FASE 6: Reportes             [####] 3-4 días
FASE 7: Testing Integral     [####] 3-4 días
FASE 8: Despliegue           [###] 2-3 días
```

### Checkpoints Críticos
- ✓ Después de Fase 1: Validar integridad de datos
- ✓ Después de Fase 3: Validar nuevo flujo completo
- ✓ Después de Fase 6: Validar sistema integral
- ✓ Antes de Fase 8: Go/No-Go decision

---

## 📝 RECOMENDACIONES FINALES

1. **Comunicación Continua**
   - Updates diarios del progreso
   - Escalación inmediata de blockers
   - Demos al final de cada fase

2. **Documentación**
   - Actualizar documentación técnica
   - Crear guías de usuario
   - Documentar decisiones de diseño

3. **Calidad sobre Velocidad**
   - No saltarse fases de testing
   - Validar cada cambio exhaustivamente
   - Preferir retrasos sobre bugs en producción

4. **Preparación para Rollback**
   - Tener plan de reversión por fase
   - Mantener versión anterior disponible
   - Documentar procedimiento de rollback

---

**Documento preparado por:** Sistema de Análisis  
**Fecha:** Junio 2025  
**Versión:** 1.0  
**Estado:** Listo para revisión y aprobación
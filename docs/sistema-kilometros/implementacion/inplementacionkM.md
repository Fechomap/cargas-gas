# Requerimientos Técnicos - Sistema de Registro de Kilómetros

## 📋 Información General del Proyecto

**Proyecto:** Bot de Telegram para Registro de Cargas de Combustible  
**Versión:** Mejora - Sistema de Kilómetros v1.0  
**Fecha:** Junio 2025  
**Sistema:** Multi-tenant en producción  
**Tecnologías:** Node.js, Telegraf, Prisma ORM, PostgreSQL  

---

## 🎯 Objetivo

Implementar un sistema robusto de registro de kilómetros integrado al flujo existente de cargas de combustible, incluyendo funcionalidades de registro por turno (inicio/fin de día) con validaciones automáticas y controles de administración.

---

## 🔄 Cambios en el Flujo Principal de Registro de Cargas

### Flujo Actual
```
Seleccionar unidad → Litros → Monto → Tipo combustible → Foto ticket → Número venta → Estado pago → Confirmar
```

### Nuevo Flujo Requerido
```
Seleccionar unidad → KILÓMETROS → Litros → PRECIO POR LITRO → [Cálculo automático monto] → Tipo combustible → Foto ticket → Número venta → Estado pago → Confirmar
```

### Detalles de Implementación del Nuevo Flujo

1. **Paso Kilómetros** (nuevo):
   - Solicitar kilómetros de la unidad seleccionada
   - Validar que sea mayor o igual al último registrado
   - Si es menor: mostrar error + último kilómetro como referencia
   - Permitir reintentos ilimitados hasta valor válido

2. **Paso Litros** (sin cambios):
   - Permitir hasta 2 decimales (ej: 1.15)
   - Validación de número positivo

3. **Paso Precio por Litro** (nuevo):
   - Solicitar precio unitario del combustible
   - Permitir hasta 2 decimales (ej: 9.50)
   - Validación de número positivo

4. **Cálculo Automático del Monto** (nuevo):
   - Fórmula: `Litros × Precio por Litro = Monto Total`
   - Mantener 2 decimales en el resultado
   - Mostrar cálculo al usuario para confirmación
   - Eliminar captura manual del monto total

5. **Resto del flujo** (sin cambios):
   - Tipo de combustible, foto, número de venta, estado de pago

---

## 🗃️ Cambios en la Base de Datos

### Modificaciones a Tabla Existente `Fuel`

```sql
-- Agregar nuevas columnas a la tabla Fuel
ALTER TABLE "Fuel" ADD COLUMN "kilometers" DECIMAL(10,2);
ALTER TABLE "Fuel" ADD COLUMN "pricePerLiter" DECIMAL(10,2);
```

**Campos nuevos:**
- `kilometers`: DECIMAL(10,2) - Kilómetros registrados al momento de la carga
- `pricePerLiter`: DECIMAL(10,2) - Precio unitario del litro de combustible

### Nueva Tabla `KilometerLog`

```sql
-- Crear nueva tabla para registros de turno
CREATE TABLE "KilometerLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "kilometers" DECIMAL(10,2) NOT NULL,
    "logType" "KilometerLogType" NOT NULL,
    "logDate" DATE NOT NULL,
    "logTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "isOmitted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KilometerLog_pkey" PRIMARY KEY ("id")
);

-- Crear enum para tipos de registro
CREATE TYPE "KilometerLogType" AS ENUM ('INICIO_TURNO', 'FIN_TURNO');

-- Crear índices
CREATE INDEX "KilometerLog_tenantId_logDate_idx" ON "KilometerLog"("tenantId", "logDate");
CREATE INDEX "KilometerLog_unitId_logDate_idx" ON "KilometerLog"("unitId", "logDate");
CREATE UNIQUE INDEX "KilometerLog_tenantId_unitId_logDate_logType_key" ON "KilometerLog"("tenantId", "unitId", "logDate", "logType");

-- Relaciones
ALTER TABLE "KilometerLog" ADD CONSTRAINT "KilometerLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KilometerLog" ADD CONSTRAINT "KilometerLog_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

**Propósito de la tabla:**
- Registrar kilómetros de inicio y fin de turno independientes de las cargas
- Un registro por unidad por día por tipo (inicio/fin)
- Trazabilidad completa con usuario y timestamps

---

## 🔧 Funcionalidades Nuevas

### 1. Registro de Turno - Inicio del Día

**Ubicación:** Nuevo submenú "Turnos" en menú principal  
**Botón:** "Inicio del día"

**Funcionalidad:**
1. Obtener todas las unidades activas del tenant
2. Verificar cuáles YA tienen registro de inicio para la fecha actual
3. Procesar en secuencia las unidades sin registro:
   - Mostrar: "Registrar kilómetros para [Operador] - [Unidad]"
   - Solicitar kilómetros (validación contra histórico)
   - Opciones: "Registrar" | "Omitir"
   - Si omite: marcar como `isOmitted: true`
4. Al finalizar: mostrar resumen de registros realizados/omitidos

**Lógica de Re-ejecución:**
- Si se ejecuta nuevamente el mismo día:
  - Mostrar unidades ya registradas con mensaje informativo
  - Procesar solo las unidades faltantes
  - Permitir completar registros pendientes

### 2. Registro de Turno - Fin del Día

**Ubicación:** Submenú "Turnos"  
**Botón:** "Fin del día"

**Funcionalidad:**
- Misma lógica que inicio de turno
- Validar contra kilómetros del día (inicio de turno Y cargas del día)
- Permitir registro independiente (no requiere inicio registrado)

### 3. Validaciones de Kilómetros

**Reglas de Negocio:**
- Kilómetro actual >= último kilómetro registrado (cualquier fuente)
- Fuentes de validación: tabla `Fuel` + tabla `KilometerLog`
- Buscar el máximo entre ambas tablas para la unidad
- Mostrar referencia solo cuando hay error de validación

**Algoritmo de validación:**
```sql
-- Obtener último kilómetro registrado para una unidad
SELECT MAX(kilometers) as lastKilometers 
FROM (
    SELECT kilometers FROM "Fuel" 
    WHERE "unitId" = $unitId AND "tenantId" = $tenantId AND "isActive" = true
    UNION ALL
    SELECT kilometers FROM "KilometerLog" 
    WHERE "unitId" = $unitId AND "tenantId" = $tenantId
) combined_kilometers
WHERE kilometers IS NOT NULL;
```

---

## 👥 Sistema de Permisos y Roles

### Usuarios Regulares
**Pueden:**
- Registrar cargas con kilómetros
- Usar funciones de inicio/fin de turno
- Ver reportes propios

**No pueden:**
- Editar kilómetros registrados
- Eliminar registros
- Forzar kilómetros menores al histórico

### Administradores
**Pueden:**
- Todas las funciones de usuarios regulares
- Editar registros de kilómetros (ambas tablas)
- Eliminar registros (borrado lógico)
- Forzar registros con validaciones especiales

### Reorganización de Menús

**Estructura propuesta:**
```
Menú Principal:
├── Registrar carga (usuarios + admin)
├── Turnos (usuarios + admin)
│   ├── Inicio del día
│   └── Fin del día
├── Consultas (usuarios + admin)
│   ├── Saldo pendiente
│   └── Generar reporte
└── Administración (solo admin)
    ├── Registrar unidad
    ├── Editar registros
    ├── Buscar por nota
    └── Gestión usuarios
```

---

## 📊 Modificaciones en Reportes

### Reportes Existentes (PDF/Excel)

**Cambios requeridos:**
1. Agregar columna "Kilómetros" después de "Unidad"
2. Agregar columna "Precio/Litro" después de "Litros"
3. Mantener columna "Monto" como calculado
4. Si no hay kilómetros registrados: mostrar "N/A"

**Estructura de columnas actualizada:**
```
Fecha | Operador | Unidad | Kilómetros | Combustible | Litros | Precio/Litro | Monto | Estado Pago | Fecha Pago | Nota
```

### Reportes Futuros (no implementar ahora)
- Reporte específico de kilómetros por unidad
- Análisis de rendimiento combustible/kilómetro
- Reporte de turnos (inicio/fin por día)

---

## ⚠️ Consideraciones Técnicas

### Retrocompatibilidad
- Los registros existentes NO se migran
- Campos nuevos permiten NULL para registros históricos
- El sistema funciona normalmente con registros sin kilómetros
- Implementación inicia desde la fecha de despliegue

### Manejo de Errores
- Validación de kilómetros: reintentos ilimitados
- Solo mostrar referencia al fallar validación
- No generar excepciones por datos de usuario incorrectos
- Logs detallados para debugging administrativo

### Performance
- Índices en nueva tabla para consultas por fecha/unidad
- Consulta optimizada para obtener último kilómetro
- Cache de validaciones en sesión del usuario

### Testing
- Validar flujo completo nuevo vs. flujo anterior
- Probar casos edge: unidades sin histórico, primer registro
- Verificar cálculos con decimales
- Testear concurrencia en registros de turno

---

## 🚀 Plan de Implementación

### Fase 1: Base de Datos
- [ ] Crear migración para nuevas columnas en `Fuel`
- [ ] Crear tabla `KilometerLog` con enum
- [ ] Crear índices requeridos
- [ ] Verificar en ambiente de desarrollo

### Fase 2: Servicios Backend
- [ ] Modificar `FuelService` para manejar kilómetros y precio/litro
- [ ] Crear `KilometerService` para gestión de turnos
- [ ] Implementar validaciones de kilómetros
- [ ] Actualizar cálculo automático de montos

### Fase 3: Controladores de Bot
- [ ] Modificar `RegistroController` para nuevo flujo
- [ ] Crear `TurnoController` para inicio/fin de día
- [ ] Actualizar manejo de estados de conversación
- [ ] Implementar nuevos teclados/botones

### Fase 4: UI/UX
- [ ] Reorganizar estructura de menús
- [ ] Implementar submenú "Turnos"
- [ ] Actualizar mensajes y validaciones
- [ ] Ajustar flujo de conversación

### Fase 5: Reportes
- [ ] Modificar generación de PDF
- [ ] Actualizar exportación Excel
- [ ] Ajustar consultas de datos
- [ ] Verificar formato de columnas

### Fase 6: Testing y Deployment
- [ ] Testing integral en desarrollo
- [ ] Pruebas de usuario con datos reales
- [ ] Deployment a producción
- [ ] Monitoreo post-deployment

---

## 🔍 Criterios de Aceptación

### Funcionalidad Principal
- [x] El nuevo flujo de registro incluye kilómetros y precio/litro
- [x] El cálculo de monto es automático y preciso (2 decimales)
- [x] Las validaciones de kilómetros funcionan correctamente
- [x] Los registros se guardan en las tablas correspondientes

### Funcionalidad de Turnos
- [x] Los botones de inicio/fin de turno procesan todas las unidades activas
- [x] Se puede omitir registros individuales
- [x] La re-ejecución el mismo día funciona correctamente
- [x] Los registros se marcan como omitidos cuando corresponde

### Administración
- [x] Los permisos de usuario vs. admin funcionan correctamente
- [x] Los administradores pueden editar registros de kilómetros
- [x] La reorganización de menús es funcional y clara

### Reportes
- [x] Los reportes incluyen las nuevas columnas
- [x] Los registros sin kilómetros muestran "N/A"
- [x] Los formatos PDF y Excel son correctos

### Performance y Estabilidad
- [x] El sistema mantiene la performance actual
- [x] No hay errores con registros existentes
- [x] Los logs funcionan correctamente para debugging

---

## 📝 Notas Adicionales

- Este requerimiento NO incluye implementación de código
- Se requiere coordinación con equipo de DevOps para deployment
- Considerar backup de base de datos antes de aplicar migraciones
- Documentar nuevos endpoints/servicios para futuras integraciones
- Mantener logs detallados durante la implementación inicial

---

**Documento generado:** Junio 2025  
**Revisión:** v1.0  
**Estado:** Listo para desarrollo
# Requerimiento de Reorganización de Menús y Gestión de Documentos - Bot Cargas de Combustible

## 📋 Resumen Ejecutivo

### Contexto
- **Sistema actual**: Bot de Telegram multi-tenant para registro de cargas de combustible
- **Estado**: En producción con sistema de storage implementado (Cloudflare R2)
- **Problema**: Estructura de menús confusa y falta de integración con el nuevo sistema de almacenamiento
- **Objetivo**: Reorganizar menús por función lógica e integrar descarga de documentos

---

## 🎯 Alcance del Requerimiento

### 1. Reorganización de Estructura de Menús
- Mover funciones entre menús según su naturaleza
- Separar claramente funciones administrativas
- Mejorar la experiencia de usuario

### 2. Integración con Sistema de Storage
- Agregar descarga de documentos al buscar notas
- Aprovechar el sistema de almacenamiento recién implementado

### 3. Gestión Completa de Registros (Admin)
- Transformar funciones de solo lectura a CRUD completo
- Permitir edición y eliminación de registros
- Incluir gestión de kilometrajes

### 4. Control de Acceso por Roles
- Restringir funciones administrativas
- Mantener acceso a funciones básicas para todos

---

## 📐 Arquitectura de Menús Propuesta

### Estructura Actual vs Nueva

```
ACTUAL:                          NUEVA:
├── Registrar carga             ├── Registrar carga
├── Turnos                      ├── Turnos  
├── Consultas                   ├── Consultas
│   ├── Saldo pendiente         │   ├── Saldo pendiente
│   └── Generar reporte         │   ├── Generar reporte [Admin]
├── Administración              │   └── Buscar nota [MOVIDO]
│   ├── Gestionar unidades      ├── Administración [Solo Admin]
│   ├── Buscar/desactivar       │   ├── Gestionar unidades
│   └── Buscar/marcar pagado    │   └── Gestionar registros [NUEVO]
└── Ayuda                       └── Ayuda
```

---

## 🔧 Requerimientos Detallados

### REQ-001: Mover "Buscar y Marcar Pagado" a Consultas

#### Estado Actual
- Ubicación: Menú Administración → "Buscar/marcar pagado"
- Callback: `search_note_for_payment`
- Funcionalidad: Busca nota por número y permite marcarla como pagada

#### Cambios Requeridos
1. **Nueva ubicación**: Menú Consultas → "Buscar nota"
2. **Nuevo texto del botón**: "🔍 Buscar nota"
3. **Mantener callback**: `search_note_for_payment` (para compatibilidad)
4. **Acceso**: Disponible para todos los usuarios

#### Implementación Técnica
```javascript
// En getConsultasKeyboard()
export function getConsultasKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💰 Saldo pendiente', 'check_balance')],
    [Markup.button.callback('📊 Generar reporte', 'generate_report')],
    [Markup.button.callback('🔍 Buscar nota', 'search_note_for_payment')], // NUEVO
    [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
  ]);
}
```

---

### REQ-002: Agregar Descarga de Documentos al Buscar Nota

#### Contexto
- Sistema de storage implementado con Cloudflare R2
- Archivos guardados con referencia en tabla `FileStorage`
- URLs firmadas disponibles vía `storageService.getSignedUrl()`

#### Cambios Requeridos

1. **Al mostrar resultado de búsqueda**, agregar botón de descarga:
   ```
   📄 Nota #12345
   Operador: Juan Pérez
   Monto: $500.00
   
   [📥 Descargar documento] [✅ Marcar pagado] [❌ Cancelar]
   ```

2. **Lógica de descarga**:
   - Buscar en `FileStorage` por `relatedId = fuel.id`
   - Si existe archivo: Mostrar botón de descarga
   - Si no existe: No mostrar botón
   - Al presionar: Generar URL firmada y enviar al usuario

#### Implementación Técnica
```javascript
// En PagosController.handleNoteSearchInput()
async handleNoteSearchInput(ctx) {
  // ... búsqueda existente ...
  
  // Buscar archivo asociado
  const attachment = await prisma.fileStorage.findFirst({
    where: {
      relatedId: fuel.id,
      relatedType: 'fuel',
      isActive: true
    }
  });
  
  // Construir botones dinámicamente
  const buttons = [];
  
  if (attachment) {
    buttons.push([{ 
      text: '📥 Descargar documento', 
      callback_data: `download_file_${attachment.id}` 
    }]);
  }
  
  buttons.push([
    { text: '✅ PAGAR', callback_data: 'mark_note_as_paid' },
    { text: '❌ CANCELAR', callback_data: 'cancel_note_search' }
  ]);
  
  await ctx.reply(noteDetails, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons }
  });
}
```

3. **Nuevo callback para descarga**:
```javascript
// Agregar en commands/fuel/payment.command.js
bot.action(/^download_file_(.+)$/, async (ctx) => {
  const fileId = ctx.match[1];
  
  try {
    // Generar URL firmada
    const url = await storageService.getSignedUrl(fileId, 3600); // 1 hora
    
    // Enviar documento
    await ctx.replyWithDocument(url, {
      caption: 'Documento de respaldo de la carga'
    });
    
    await ctx.answerCbQuery('Descargando documento...');
  } catch (error) {
    await ctx.answerCbQuery('Error al descargar archivo');
  }
});
```

---

### REQ-003: Transformar "Buscar/Desactivar" en "Gestionar Registros"

#### Estado Actual
- Nombre: "Buscar/desactivar registros"
- Funcionalidad: Solo permite desactivar (borrado lógico)
- Limitaciones: No permite editar ni eliminar

#### Cambios Requeridos

1. **Nuevo nombre**: "📝 Gestionar registros"
2. **Callback**: `manage_fuel_records` (nuevo)
3. **Funcionalidades**:
   - Buscar por número de nota
   - **EDITAR** cualquier campo del registro
   - **ELIMINAR** permanentemente (con confirmación)
   - Mantener opción de desactivar

4. **Flujo de gestión**:
   ```
   1. Buscar nota → Mostrar resultados
   2. Seleccionar registro → Mostrar opciones:
      [✏️ Editar] [🗑️ Eliminar] [🚫 Desactivar] [❌ Cancelar]
   3. Según selección:
      - Editar → Menú de campos editables
      - Eliminar → Confirmación → Borrado permanente
      - Desactivar → Flujo actual
   ```

#### Implementación de Edición

```javascript
// Nuevo GestionRegistrosController
class GestionRegistrosController {
  async showEditMenu(ctx, fuelId) {
    const fuel = await fuelService.getById(fuelId);
    
    const editButtons = [
      [{ text: '📏 Kilómetros', callback_data: `edit_field_km_${fuelId}` }],
      [{ text: '💧 Litros', callback_data: `edit_field_liters_${fuelId}` }],
      [{ text: '💰 Monto', callback_data: `edit_field_amount_${fuelId}` }],
      [{ text: '⛽ Tipo combustible', callback_data: `edit_field_type_${fuelId}` }],
      [{ text: '📝 Número de nota', callback_data: `edit_field_sale_${fuelId}` }],
      [{ text: '💳 Estado de pago', callback_data: `edit_field_payment_${fuelId}` }],
      [{ text: '🏠 Volver', callback_data: 'admin_menu' }]
    ];
    
    await ctx.reply(
      `Editando registro:\n${this.formatFuelRecord(fuel)}\n\nSelecciona el campo a editar:`,
      { reply_markup: { inline_keyboard: editButtons } }
    );
  }
  
  async handleFieldEdit(ctx, field, fuelId) {
    // Solicitar nuevo valor según el campo
    ctx.session.editing = { fuelId, field };
    
    const prompts = {
      km: 'Ingresa los nuevos kilómetros:',
      liters: 'Ingresa los nuevos litros:',
      amount: 'Ingresa el nuevo monto:',
      sale: 'Ingresa el nuevo número de nota:'
    };
    
    await ctx.reply(prompts[field] || 'Ingresa el nuevo valor:');
    await updateConversationState(ctx, 'editing_fuel_field');
  }
}
```

---

### REQ-004: Gestión de Registros de Kilómetros

#### Contexto
- Tabla `KilometerLog` guarda registros de inicio/fin de turno
- Actualmente no hay forma de editar estos registros

#### Cambios Requeridos

1. **Agregar a Gestión de Registros**:
   - Nueva opción: "📏 Gestionar kilómetros"
   - Buscar por: Unidad, Fecha, Tipo (inicio/fin)

2. **Funcionalidades**:
   ```
   - Ver registros de kilómetros
   - Editar valor de kilómetros
   - Eliminar registro completo
   - Filtrar por unidad/fecha
   ```

3. **Implementación**:
```javascript
// En menú de Gestión de Registros
const gestionButtons = [
  [{ text: '⛽ Gestionar cargas', callback_data: 'manage_fuel_records' }],
  [{ text: '📏 Gestionar kilómetros', callback_data: 'manage_km_records' }], // NUEVO
  [{ text: '🏠 Volver', callback_data: 'admin_menu' }]
];

// Controller para gestión de kilómetros
async showKmRecords(ctx) {
  const records = await prisma.kilometerLog.findMany({
    where: { tenantId: ctx.tenant.id },
    include: { Unit: true },
    orderBy: { logDate: 'desc' },
    take: 10
  });
  
  // Mostrar lista con opciones de edición
}
```

---

### REQ-005: Control de Acceso por Roles

#### Reglas de Acceso

1. **Usuarios Regulares** pueden acceder a:
   - ✅ Registrar carga
   - ✅ Turnos
   - ✅ Consultas → Saldo pendiente
   - ✅ Consultas → Buscar nota
   - ❌ Consultas → Generar reporte (SOLO ADMIN)
   - ❌ Administración (NO VISIBLE)
   - ✅ Ayuda

2. **Administradores** tienen acceso completo a todo

#### Implementación

```javascript
// En getConsultasKeyboard() - condicional para reportes
export function getConsultasKeyboard(isAdmin = false) {
  const buttons = [
    [Markup.button.callback('💰 Saldo pendiente', 'check_balance')],
    [Markup.button.callback('🔍 Buscar nota', 'search_note_for_payment')]
  ];
  
  // Solo mostrar Generar reporte a admins
  if (isAdmin) {
    buttons.push([Markup.button.callback('📊 Generar reporte', 'generate_report')]);
  }
  
  buttons.push([Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]);
  
  return Markup.inlineKeyboard(buttons);
}

// Validar en el callback
bot.action('generate_report', async (ctx) => {
  const isAdmin = await isAdminUser(ctx.from?.id);
  
  if (!isAdmin) {
    await ctx.answerCbQuery('❌ Acceso denegado');
    return ctx.reply('Solo los administradores pueden generar reportes.');
  }
  
  // Continuar con generación de reporte...
});
```

---

### REQ-006: Actualizar Mensaje de Ayuda

#### Contenido Actualizado

```markdown
*Instrucciones de Uso* ❓

*FUNCIONES PRINCIPALES:*

*1. 🚛 Registrar Carga*
   - Selecciona unidad
   - Ingresa kilómetros actuales
   - Ingresa litros y precio por litro
   - El sistema calcula el monto automáticamente
   - Toma foto del ticket (opcional)
   - Ingresa número de nota

*2. 🕐 Turnos*
   - Inicio de día: Registra kilómetros iniciales
   - Fin de día: Registra kilómetros finales
   - Sistema válida que no haya retrocesos

*3. 📊 Consultas*
   - Saldo pendiente: Ver cargas no pagadas
   - Buscar nota: Buscar por número y descargar documentos
   - Generar reporte: PDF/Excel con filtros [Solo Admin]

*4. 🔧 Administración* [Solo Administradores]
   - Gestionar unidades: Alta/baja de operadores
   - Gestionar registros: Editar/eliminar cargas y kilómetros

*NOVEDADES:*
✅ Sistema de kilómetros mejorado
✅ Descarga de documentos respaldados
✅ Gestión completa de registros (admins)
✅ Menús reorganizados por función

Para soporte contacta a tu administrador.
```

---

## 📅 Plan de Implementación Sugerido

### Fase 1: Reorganización de Menús (2 días)
- [ ] Mover "Buscar nota" a Consultas
- [ ] Actualizar keyboards.js con nueva estructura
- [ ] Implementar control de acceso en Generar reporte
- [ ] Actualizar mensaje de ayuda

### Fase 2: Integración Storage (3 días)
- [ ] Agregar botón de descarga en búsqueda de notas
- [ ] Implementar callback download_file
- [ ] Manejar casos sin archivo adjunto
- [ ] Testing de descarga de diferentes tipos de archivo

### Fase 3: Gestión de Registros (5 días)
- [ ] Crear GestionRegistrosController
- [ ] Implementar edición de campos de combustible
- [ ] Implementar eliminación con confirmación
- [ ] Agregar gestión de registros de kilómetros
- [ ] Testing exhaustivo de CRUD

### Fase 4: Testing y Deploy (2 días)
- [ ] Pruebas de integración completas
- [ ] Validación de permisos por rol
- [ ] Documentación actualizada
- [ ] Deploy a producción

---

## 🔐 Consideraciones de Seguridad

1. **Validación de Permisos**
   - Verificar isAdmin en cada acción administrativa
   - No confiar solo en la visibilidad del botón

2. **Confirmaciones**
   - Doble confirmación para eliminaciones
   - Mostrar resumen antes de editar

3. **Auditoría**
   - Registrar quién editó/eliminó qué y cuándo
   - Mantener log de cambios

4. **Integridad de Datos**
   - Validar consistencia al editar kilómetros
   - No permitir datos que rompan la lógica de negocio

---

## 📊 Criterios de Aceptación

### ✅ Menús Reorganizados
- [ ] "Buscar nota" aparece en Consultas para todos
- [ ] "Generar reporte" solo visible para admins
- [ ] Menú Administración solo visible para admins

### ✅ Descarga de Documentos
- [ ] Botón de descarga aparece cuando hay archivo
- [ ] Descarga funciona con URL firmada temporal
- [ ] Manejo de errores si falla la descarga

### ✅ Gestión Completa
- [ ] Se puede editar cualquier campo de una carga
- [ ] Se puede eliminar permanentemente con confirmación
- [ ] Se pueden gestionar registros de kilómetros

### ✅ Control de Acceso
- [ ] Usuarios normales no ven opciones de admin
- [ ] Intentos de acceso no autorizado son bloqueados
- [ ] Mensajes claros de acceso denegado

---

## 🚀 Beneficios Esperados

1. **Mejora en UX**: Menús organizados lógicamente
2. **Aprovechamiento del Storage**: Descarga fácil de documentos
3. **Flexibilidad Administrativa**: Corrección de errores sin SQL directo
4. **Seguridad Mejorada**: Control granular de accesos
5. **Reducción de Soporte**: Admins pueden resolver problemas directamente

---

**Documento preparado para**: Equipo de Desarrollo - Bot Cargas de Combustible  
**Fecha**: Junio 30, 2025  
**Versión**: 1.0  
**Estado**: Pendiente de Revisión y Aprobación
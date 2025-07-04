// src/views/keyboards.js
import { Markup } from 'telegraf';

/**
 * Obtiene el teclado principal con las opciones básicas
 * @param {boolean} isAdmin - Si el usuario es administrador
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getMainKeyboard(isAdmin = false) {
  const buttons = [
    [Markup.button.callback('🚛 Registrar carga', 'register_fuel_start')],
    [Markup.button.callback('🕐 Turnos', 'turnos_menu')],
    [Markup.button.callback('📊 Consultas', 'consultas_menu')]
  ];

  // Solo mostrar menú de Administración a usuarios admin
  if (isAdmin) {
    buttons.push([Markup.button.callback('🔧 Administración', 'admin_menu')]);
  }

  buttons.push([Markup.button.callback('❓ Ayuda', 'show_help')]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * Genera un teclado con las unidades registradas
 * @param {Array} units - Lista de unidades registradas
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getUnitsKeyboard(units) {
  // Primero, verificar si hay unidades
  if (!units || units.length === 0) {
    return Markup.inlineKeyboard([
      [Markup.button.callback('➕ Registrar nueva unidad', 'register_unit')],
      [Markup.button.callback('🏠 Menú principal', 'main_menu')]
    ]);
  }

  // Crear botones para cada unidad (máximo 10 para evitar límites de Telegram)
  const unitButtons = units.slice(0, 10).map(unit => {
    return [Markup.button.callback(
      `${unit.operatorName} - ${unit.unitNumber}`,
      unit.buttonId
    )];
  });

  // Añadir botones adicionales
  unitButtons.push([Markup.button.callback('➕ Registrar nueva unidad', 'register_unit')]);
  unitButtons.push([Markup.button.callback('🏠 Menú principal', 'main_menu')]);

  return Markup.inlineKeyboard(unitButtons);
}

/**
 * Obtiene el teclado para selección de tipos de combustible
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getFuelTypeKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Gas ⛽', 'fuel_type_gas'),
      Markup.button.callback('Gasolina 🚗', 'fuel_type_gasolina')
    ],
    [
      Markup.button.callback('Diésel 🚛', 'fuel_type_diesel'),
      Markup.button.callback('❌ Cancelar', 'cancel_fuel_entry')
    ]
  ]);
}

/**
 * Obtiene el teclado para selección de estatus de pago
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getPaymentStatusKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Pagada', 'payment_status_pagada'),
      Markup.button.callback('❌ No pagada', 'payment_status_no_pagada')
    ],
    [Markup.button.callback('Cancelar', 'cancel_fuel_entry')]
  ]);
}

/**
 * Obtiene el teclado para confirmación final de carga
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getFuelConfirmKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Guardar carga', 'fuel_confirm_save'),
      Markup.button.callback('❌ Cancelar', 'fuel_confirm_cancel')
    ]
  ]);
}

/**
 * Obtiene el teclado para opciones de reporte
 * @param {Object} filters - Filtros aplicados
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getReportOptionsKeyboard(filters = {}) {
  const buttons = [];
  const hasFilters = Object.keys(filters || {}).length > 0;

  // Opciones de filtrado con indicadores visuales para filtros activos
  const hasDateFilter = filters.startDate && filters.endDate;
  const hasOperatorFilter = !!filters.operatorName;
  const hasFuelTypeFilter = !!filters.fuelType;
  const hasPaymentStatusFilter = !!filters.paymentStatus;

  buttons.push([Markup.button.callback(
    `${hasDateFilter ? '✅ ' : ''}📅 Filtrar por fechas`,
    'filter_by_date'
  )]);

  buttons.push([Markup.button.callback(
    `${hasOperatorFilter ? '✅ ' : ''}👤 Filtrar por operador`,
    'filter_by_operator'
  )]);

  buttons.push([Markup.button.callback(
    `${hasFuelTypeFilter ? '✅ ' : ''}⛽ Filtrar por tipo de combustible`,
    'filter_by_fuel_type'
  )]);

  buttons.push([Markup.button.callback(
    `${hasPaymentStatusFilter ? '✅ ' : ''}💰 Filtrar por estatus de pago`,
    'filter_by_payment_status'
  )]);

  // Botón para generar reporte global (siempre visible)
  buttons.push([Markup.button.callback('📊 Generar Reporte Global', 'generate_global_report')]);

  // Botón para generar reporte por filtros (solo visible cuando hay filtros)
  if (hasFilters) {
    buttons.push([Markup.button.callback('🔍 Generar Reporte por Filtros', 'generate_filtered_report')]);
  }

  // Botón para limpiar filtros (si hay filtros aplicados)
  if (hasFilters) {
    buttons.push([Markup.button.callback('🗑️ Limpiar filtros', 'clear_all_filters')]);
  }

  // Botón para cancelar
  buttons.push([Markup.button.callback('❌ Cancelar', 'cancel_report')]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * Obtiene teclado para cancelar cualquier operación
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getCancelKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('❌ Cancelar', 'cancel_operation')]
  ]);
}

/**
 * Obtiene el teclado para post-operación
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getPostOperationKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
  ]);
}

/**
 * Obtiene el teclado del submenú de Consultas
 * @param {boolean} isAdmin - Si el usuario es administrador
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getConsultasKeyboard(isAdmin = false) {
  const buttons = [
    [Markup.button.callback('💰 Saldo pendiente', 'check_balance')],
    [Markup.button.callback('🔍 Buscar nota', 'search_note_for_payment')]
  ];

  // Solo mostrar Generar reporte a administradores
  if (isAdmin) {
    buttons.push([Markup.button.callback('📊 Generar reporte', 'generate_report')]);
  }

  buttons.push([Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * Obtiene el teclado del submenú de Administración (solo para admins)
 * @returns {Object} - Objeto de teclado para Telegraf
 */
export function getAdminKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('👁️ Gestionar unidades', 'manage_units')],
    [Markup.button.callback('📝 Gestionar registros', 'manage_fuel_records')],
    [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
  ]);
}
// src/views/messages.js

/**
 * Obtiene el mensaje de bienvenida personalizado
 * @param {string} name - Nombre del usuario
 * @returns {string} - Mensaje de bienvenida
 */
export function getWelcomeMessage(name) {
  return `¡Hola ${name}! 👋
  
*Bienvenido al Bot de Registro de Cargas de Combustible* ⛽

Para comenzar, selecciona una opción del menú.`;
}

/**
 * Obtiene el mensaje de ayuda
 * @returns {string} - Instrucciones de uso
 */
export function getHelpMessage() {
  return `*Instrucciones de Uso* ❓

*1. Registrar una unidad:*
   • Presiona "Registrar unidad"
   • Ingresa el nombre del operador
   • Ingresa el número económico
   • Confirma los datos

*2. Registrar carga de combustible:*
   • Selecciona una unidad de la lista
   • Ingresa la cantidad de litros
   • Ingresa el monto en pesos
   • Selecciona el tipo de combustible
   • Envía foto del ticket (opcional)
   • Ingresa el número de venta (4 dígitos)
   • Selecciona el estatus de pago

*3. Consultar saldo pendiente:*
   • Presiona "Saldo pendiente"
   • Se mostrará el total de cargas no pagadas

*4. Generar reportes:*
   • Presiona "Generar reporte"
   • Aplica los filtros deseados
   • Selecciona el formato (PDF o Excel)
   • Usa la opción para marcar como pagadas si es necesario

Para cualquier duda adicional, contacta al administrador del sistema.`;
}

/**
 * Obtiene el mensaje de saldo pendiente
 * @param {number} amount - Monto total pendiente
 * @returns {string} - Mensaje con el saldo pendiente
 */
export function getBalanceMessage(amount) {
  return `💰 *Saldo Pendiente Total*

El monto total de cargas no pagadas es:
*$${amount.toFixed(2)}*`;
}

/**
 * Obtiene el resumen de una carga
 * @param {Object} fuelData - Datos de la carga
 * @returns {string} - Resumen formateado
 */
export function getFuelEntrySummary(fuelData) {
  return `📝 *Resumen de la carga*

👤 *Operador:* ${fuelData.operatorName}
🚚 *Unidad:* ${fuelData.unitNumber}
⛽ *Tipo:* ${fuelData.fuelType}
🔢 *Litros:* ${fuelData.liters}
💰 *Monto:* $${fuelData.amount.toFixed(2)}
🧾 *Número de venta:* ${fuelData.saleNumber || 'No registrado'}
💳 *Estatus:* ${fuelData.paymentStatus}
🧾 *Ticket:* ${fuelData.ticketPhoto ? 'Incluido' : 'No incluido'}`;
}

/**
 * Obtiene el mensaje de confirmación de registro de unidad
 * @param {Object} unitData - Datos de la unidad
 * @returns {string} - Mensaje de confirmación
 */
export function getUnitConfirmationMessage(unitData) {
  return `¿Deseas registrar esta unidad?

👤 *Operador:* ${unitData.operatorName}
🚚 *Número económico:* ${unitData.unitNumber}`;
}

/**
 * Obtiene el mensaje de reporte generado
 * @param {Object} reportSummary - Resumen del reporte
 * @returns {string} - Mensaje con el resumen del reporte
 */
export function getReportSummaryMessage(reportSummary) {
  return `📊 *Resumen del Reporte*

📄 *Total de registros:* ${reportSummary.totalEntries}
⛽ *Total de litros:* ${reportSummary.totalLiters.toFixed(2)}
💰 *Monto total:* $${reportSummary.totalAmount.toFixed(2)}

*Desglose por tipo:*
• Gas: ${reportSummary.countByFuelType.gas} registros
• Gasolina: ${reportSummary.countByFuelType.gasolina} registros

*Desglose por estatus:*
• Pagadas: ${reportSummary.countByPaymentStatus.pagada} registros
• No pagadas: ${reportSummary.countByPaymentStatus['no pagada']} registros`;
}

/**
 * Obtiene el mensaje para cuando no hay datos
 * @param {string} type - Tipo de datos (unidades, cargas, etc.)
 * @returns {string} - Mensaje informativo
 */
export function getNoDataMessage(type) {
  return `No se encontraron ${type} registrados en el sistema.`;
}

/**
 * Obtiene el mensaje de error genérico
 * @returns {string} - Mensaje de error
 */
export function getErrorMessage() {
  return 'Ocurrió un error al procesar tu solicitud. Por favor, intenta nuevamente o contacta al administrador.';
}
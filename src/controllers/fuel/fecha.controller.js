// src/controllers/fuel/fecha.controller.js
import { Markup } from 'telegraf';
import { FuelService } from '../../services/fuel.adapter.service.js';
import { updateConversationState } from '../../state/conversation.js';
import { logger } from '../../utils/logger.js';

// Crear instancia del servicio de combustible
const fuelService = new FuelService();

/**
 * Controlador para gestionar fechas en cargas de combustible
 */
export class FechaController {
  /**
   * Verifica si la fecha de registro debe ser ajustada
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {Object} savedFuel - Registro de combustible guardado
   */
  async checkRecordDate(ctx, savedFuel) {
    try {
      logger.info(`Verificando fecha de registro para carga ${savedFuel.id}`);

      // Guardar el ID de la carga guardada en la sesión para referencia posterior
      ctx.session.data.savedFuelId = savedFuel.id;
      await updateConversationState(ctx, 'fuel_date_confirm');

      // Preguntar si la carga se realizó hoy
      await ctx.reply('¿La recarga se realizó hoy?',
        Markup.inlineKeyboard([
          [Markup.button.callback('✅ Sí, es de hoy', 'fuel_date_today')],
          [Markup.button.callback('❌ No, es de otra fecha', 'fuel_date_other')]
        ])
      );
    } catch (error) {
      logger.error(`Error al verificar fecha: ${error.message}`);
      await ctx.reply('Ocurrió un error al verificar la fecha, pero la carga ha sido guardada correctamente.');

      // Continuar con el proceso normal como fallback
      const registroController = await import('./registro.controller.js').then(m => new m.RegistroController());
      await registroController.completeFuelRegistration(ctx);
    }
  }

  /**
   * Muestra opciones para seleccionar una fecha reciente
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async showDateOptions(ctx) {
    try {
      await ctx.answerCbQuery('Selecciona la fecha real de la carga');
      await updateConversationState(ctx, 'fuel_date_select');

      const buttons = [];

      // Ayer
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      buttons.push([Markup.button.callback(
        `Ayer (${this.formatDate(yesterday)})`,
        'fuel_date_day_1'
      )]);

      // Antier
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      buttons.push([Markup.button.callback(
        `Antier (${this.formatDate(twoDaysAgo)})`,
        'fuel_date_day_2'
      )]);

      // Días 3 al 7
      for (let i = 3; i <= 7; i++) {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - i);
        buttons.push([Markup.button.callback(
          `Hace ${i} días (${this.formatDate(pastDate)})`,
          `fuel_date_day_${i}`
        )]);
      }

      // Opción personalizada y cancelar
      buttons.push([Markup.button.callback('📅 Elegir otra fecha', 'fuel_date_custom')]);
      buttons.push([Markup.button.callback('Cancelar (usar fecha actual)', 'fuel_date_cancel')]);

      await ctx.reply('Selecciona la fecha real de la carga:',
        Markup.inlineKeyboard(buttons)
      );
    } catch (error) {
      logger.error(`Error al mostrar opciones de fecha: ${error.message}`);
      await ctx.reply('Ocurrió un error al mostrar las opciones de fecha.');

      // Volver al menú de confirmación como fallback
      await this.checkRecordDate(ctx, { id: ctx.session.data.fuelId, recordDate: new Date() });
    }
  }

  /**
   * Ajusta la fecha de registro según los días seleccionados
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   * @param {number} daysAgo - Días hacia atrás desde hoy
   */
  async updateRecordDate(ctx, daysAgo) {
    try {
      if (!ctx.session.data.savedFuelId) {
        throw new Error('No se encontró referencia a la carga guardada');
      }

      const newDate = new Date();
      newDate.setDate(newDate.getDate() - daysAgo);
      newDate.setHours(12, 0, 0, 0); // Mediodía para evitar problemas de zona horaria

      // Verificar que el contexto tiene un tenant
      if (!ctx.tenant) {
        throw new Error('No se encontró tenant en el contexto');
      }

      // Obtener tenantId del contexto
      const tenantId = ctx.tenant.id;
      logger.info(`Actualizando fecha para carga ${ctx.session.data.savedFuelId} y tenant: ${tenantId}`);

      const updatedFuel = await fuelService.updateRecordDate(
        ctx.session.data.savedFuelId,
        newDate,
        tenantId
      );

      await ctx.answerCbQuery('Fecha actualizada correctamente');
      await ctx.reply(`✅ Fecha de carga actualizada a: ${this.formatDate(newDate)}`);

      // Completar el registro
      const registroController = await import('./registro.controller.js').then(m => new m.RegistroController());
      await registroController.completeFuelRegistration(ctx);
    } catch (error) {
      logger.error(`Error al actualizar fecha de registro: ${error.message}`);
      await ctx.answerCbQuery('Error al actualizar fecha');
      await ctx.reply('Ocurrió un error al actualizar la fecha. La carga se registró con la fecha actual.');

      // Completar el registro a pesar del error
      const registroController = await import('./registro.controller.js').then(m => new m.RegistroController());
      await registroController.completeFuelRegistration(ctx);
    }
  }

  /**
   * Solicita al usuario ingresar una fecha manual
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async requestCustomDate(ctx) {
    try {
      await ctx.answerCbQuery('Ingresa la fecha manualmente');
      await updateConversationState(ctx, 'fuel_date_custom_input');
      await ctx.reply(
        'Por favor, ingresa la fecha en formato DD/MM/AAAA\n' +
        'Ejemplo: 25/04/2025\n\n' +
        'La fecha no puede ser posterior a hoy ni anterior a 30 días'
      );
    } catch (error) {
      logger.error(`Error al solicitar fecha personalizada: ${error.message}`);
      await ctx.reply('Ocurrió un error al procesar la solicitud.');

      // Completar el registro a pesar del error
      const registroController = await import('./registro.controller.js').then(m => new m.RegistroController());
      await registroController.completeFuelRegistration(ctx);
    }
  }

  /**
   * Procesa la entrada de fecha manual del usuario
   * @param {TelegrafContext} ctx - Contexto de Telegraf
   */
  async handleCustomDateInput(ctx) {
    try {
      const dateText = ctx.message.text.trim();
      const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
      const match = dateText.match(dateRegex);

      if (!match) {
        return await ctx.reply(
          '❌ Formato de fecha incorrecto.\n' +
          'Por favor, usa el formato DD/MM/AAAA (ejemplo: 25/04/2025):'
        );
      }

      const [, day, month, year] = match;
      const inputDate = new Date(year, month - 1, day, 12, 0, 0, 0);

      if (isNaN(inputDate.getTime())) {
        return await ctx.reply('❌ Fecha inválida. Por favor, ingresa una fecha real:');
      }

      const today = new Date();
      if (inputDate > today) {
        return await ctx.reply('❌ La fecha no puede ser posterior a hoy. Por favor, ingresa otra fecha:');
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (inputDate < thirtyDaysAgo) {
        return await ctx.reply('❌ La fecha no puede ser anterior a 30 días. Por favor, ingresa otra fecha:');
      }

      // Actualizar fecha en la base de datos
      const fuelId = ctx.session.data.savedFuelId;

      if (!fuelId) {
        throw new Error('No se encontró ID de la carga en la sesión');
      }

      // Verificar que el contexto tiene un tenant
      if (!ctx.tenant) {
        throw new Error('No se encontró tenant en el contexto');
      }

      // Obtener tenantId del contexto
      const tenantId = ctx.tenant.id;
      logger.info(`Actualizando fecha para carga ${fuelId} y tenant: ${tenantId}`);

      // Actualizar en la base de datos
      const updatedFuel = await fuelService.updateRecordDate(fuelId, inputDate, tenantId);

      // Confirmar actualización
      await ctx.reply(`✅ Fecha actualizada a: ${this.formatDate(updatedFuel.recordDate)}`);

      // Guardar fecha actualizada en sesión para el resumen
      ctx.session.data.customDate = updatedFuel.recordDate;

      // Completar el registro
      const registroController = await import('./registro.controller.js').then(m => new m.RegistroController());
      await registroController.completeFuelRegistration(ctx);
    } catch (error) {
      logger.error(`Error al procesar fecha manual: ${error.message}`);
      await ctx.reply('Ocurrió un error al procesar la fecha, pero la carga ha sido guardada correctamente.');

      // Completar el registro a pesar del error
      const registroController = await import('./registro.controller.js').then(m => new m.RegistroController());
      await registroController.completeFuelRegistration(ctx);
    }
  }

  /**
   * Formatea una fecha para mostrar
   * @param {Date} date - Fecha a formatear
   * @returns {string} - Fecha formateada
   */
  formatDate(date) {
    if (!date) return 'No especificada';
    return new Date(date).toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

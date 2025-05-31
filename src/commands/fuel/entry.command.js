// src/commands/fuel/entry.command.js
import { Markup } from 'telegraf';
import { fuelController } from '../../controllers/index.js';
import { unitController } from '../../controllers/unit/index.js';
import { isInState, updateConversationState } from '../../state/conversation.js';
import { getMainKeyboard } from '../../views/keyboards.js';
import { logger } from '../../utils/logger.js';

/**
 * Configura los comandos para el registro de cargas de combustible
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupFuelEntryCommands(bot) {
  // Acción para iniciar el registro de carga de combustible (desde el menú principal)
  bot.action('register_fuel_start', async (ctx) => {
    try {
      logger.info(`Usuario ${ctx.from.id} inició registro de carga desde menú`);
      await ctx.answerCbQuery('Iniciando registro de carga...');
      await unitController.showRegisteredUnits(ctx, 'fuel_entry');
    } catch (error) {
      logger.error(`Error al iniciar carga: ${error.message}`);
      await ctx.answerCbQuery('Error al iniciar registro');
      await ctx.reply('Ocurrió un error al iniciar el registro de carga.');
    }
  });

  // Manejar la selección de unidad para carga de combustible
  bot.action(/fuel_entry_unit_(.+)/, async (ctx) => {
    try {
      // Extraer el ID de la unidad del botón
      const unitButtonId = ctx.match[1];
      logger.info(`Usuario ${ctx.from.id} seleccionó unidad ${unitButtonId} para carga`);
      
      // Usar el controlador para iniciar la captura
      await fuelController.startFuelEntry(ctx, unitButtonId);
    } catch (error) {
      logger.error(`Error al iniciar carga: ${error.message}`);
      await ctx.answerCbQuery('Error al seleccionar unidad');
      await ctx.reply('Ocurrió un error al seleccionar la unidad.');
    }
  });
  
  // Manejar respuestas según el estado de la conversación para el registro de combustible
  bot.on('text', async (ctx, next) => {
    if (isInState(ctx, 'fuel_entry_liters')) {
      await fuelController.handleLitersEntry(ctx);
      return;
    }
    
    if (isInState(ctx, 'fuel_entry_amount')) {
      await fuelController.handleAmountEntry(ctx);
      return;
    }
    
    if (isInState(ctx, 'fuel_entry_sale_number')) {
      await fuelController.handleSaleNumberEntry(ctx);
      return;
    }
    
    // Continuar con el siguiente middleware si no estamos en un estado de carga
    return next();
  });
  
  // Manejar selección de tipo de combustible
  bot.action('fuel_type_gas', async (ctx) => {
    if (isInState(ctx, 'fuel_entry_type')) {
      await fuelController.handleFuelTypeSelection(ctx, 'gas');
    }
  });
  
  bot.action('fuel_type_gasolina', async (ctx) => {
    if (isInState(ctx, 'fuel_entry_type')) {
      await fuelController.handleFuelTypeSelection(ctx, 'gasolina');
    }
  });
  
  // Manejar fotografía del ticket o su omisión
  bot.on(['photo', 'text'], async (ctx, next) => {
    if (isInState(ctx, 'fuel_entry_photo')) {
      await fuelController.handleTicketPhoto(ctx);
      return;
    }
    
    return next();
  });
  
  // Manejar selección de estatus de pago
  bot.action('payment_status_pagada', async (ctx) => {
    if (isInState(ctx, 'fuel_entry_payment')) {
      await fuelController.handlePaymentStatusSelection(ctx, 'pagada');
    }
  });
  
  bot.action('payment_status_no_pagada', async (ctx) => {
    if (isInState(ctx, 'fuel_entry_payment')) {
      await fuelController.handlePaymentStatusSelection(ctx, 'no pagada');
    }
  });
  
  // Manejar confirmación final
  bot.action('fuel_confirm_save', async (ctx) => {
    logger.info(`BOTÓN DE CONFIRMACIÓN PRESIONADO: fuel_confirm_save`);
    try {
      logger.info(`Usuario ${ctx.from.id} confirmó guardar carga`);
      
      if (!ctx.session || !ctx.session.state || ctx.session.state !== 'fuel_entry_confirm') {
        logger.error(`Error: Estado incorrecto para guardar carga. Estado actual: ${ctx.session?.state}`);
        await ctx.answerCbQuery('Error: Flujo incorrecto');
        await ctx.reply('Ocurrió un error en el flujo de registro. Por favor, inicia el proceso nuevamente.');
        return;
      }
      
      logger.info('Llamando a fuelController.saveFuelEntry para guardar la carga');
      await fuelController.saveFuelEntry(ctx);
    } catch (error) {
      logger.error(`Error en botón de confirmación: ${error.message}`);
      await ctx.answerCbQuery('Error al guardar');
      await ctx.reply('Ocurrió un error al guardar la carga. Por favor, intenta nuevamente.');
      
      // Mostrar menú principal como fallback
      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: getMainKeyboard()
      });
    }
  });
  
  // Manejar cancelación
  bot.action('fuel_confirm_cancel', async (ctx) => {
    logger.info(`Usuario ${ctx.from.id} canceló guardar carga`);
    await ctx.answerCbQuery('Operación cancelada');
    await ctx.reply('Operación cancelada.');
    
    // Limpiar estado de conversación
    await updateConversationState(ctx, 'idle', {});
    
    // Mostrar menú principal
    await ctx.reply('¿Qué deseas hacer ahora?', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
      ])
    });
  });
  
  // Manejar el botón main_menu de forma adecuada
  bot.action('main_menu', async (ctx) => {
    try {
      await ctx.answerCbQuery('Volviendo al menú principal');
      
      // Limpiar el estado de conversación
      if (ctx.session) {
        ctx.session.state = 'idle';
        ctx.session.data = {};
      }
      
      // Mostrar mensaje con menú principal usando la función importada
      await ctx.reply('🏠 Menú Principal', {
        reply_markup: getMainKeyboard()
      });
    } catch (error) {
      logger.error(`Error al volver al menú principal: ${error.message}`);
      await ctx.answerCbQuery('Error al mostrar menú');
      
      // Intento directo con botones en línea básicos
      await ctx.reply('Menú Principal (alternativo)', 
        Markup.inlineKeyboard([
          [Markup.button.callback('📝 Registrar unidad', 'register_unit')],
          [Markup.button.callback('💰 Saldo pendiente', 'check_balance')],
          [Markup.button.callback('📊 Generar reporte', 'generate_report')]
        ])
      );
    }
  });
}

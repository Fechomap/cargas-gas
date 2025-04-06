// src/commands/fuel.command.js
import { Markup } from 'telegraf';
import { fuelController } from '../controllers/fuel.controller.js';
import { unitController } from '../controllers/unit.controller.js';
import { isInState } from '../state/conversation.js';
import { logger } from '../utils/logger.js';

/**
 * Configura los comandos de carga de combustible
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupFuelCommand(bot) {
  // Comando para mostrar saldo pendiente
  bot.command('saldo', async (ctx) => {
    try {
      logger.info(`Usuario ${ctx.from.id} solicitó saldo pendiente`);
      const totalAmount = await fuelController.getTotalPendingBalance();
      
      await ctx.reply(`💰 *Saldo pendiente total: $${totalAmount.toFixed(2)}*`, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error(`Error al mostrar saldo: ${error.message}`);
      await ctx.reply('Ocurrió un error al consultar el saldo pendiente.');
    }
  });
  
  // Acción para mostrar saldo pendiente desde el botón
  bot.action('check_balance', async (ctx) => {
    try {
      await ctx.answerCbQuery('Consultando saldo pendiente...');
      const totalAmount = await fuelController.getTotalPendingBalance();
      
      await ctx.reply(`💰 *Saldo pendiente total: $${totalAmount.toFixed(2)}*`, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error(`Error al mostrar saldo: ${error.message}`);
      await ctx.answerCbQuery('Error al consultar saldo');
      await ctx.reply('Ocurrió un error al consultar el saldo pendiente.');
    }
  });
  
  // Manejar selección de unidad para registrar carga
  bot.action(/^unit_.*/, async (ctx) => {
    try {
      const unitButtonId = ctx.match[0];
      await fuelController.startFuelEntry(ctx, unitButtonId);
    } catch (error) {
      logger.error(`Error al iniciar carga: ${error.message}`);
      await ctx.answerCbQuery('Error al seleccionar unidad');
      await ctx.reply('Ocurrió un error al seleccionar la unidad.');
    }
  });
  
  // Manejar respuestas según el estado de la conversación
  bot.on('text', async (ctx, next) => {
    if (isInState(ctx, 'fuel_entry_liters')) {
      await fuelController.handleLitersEntry(ctx);
      return;
    }
    
    if (isInState(ctx, 'fuel_entry_amount')) {
      await fuelController.handleAmountEntry(ctx);
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
    if (isInState(ctx, 'fuel_entry_confirm')) {
      await fuelController.saveFuelEntry(ctx);
    }
  });
  
  bot.action('fuel_confirm_cancel', async (ctx) => {
    if (isInState(ctx, 'fuel_entry_confirm')) {
      await ctx.answerCbQuery('Registro cancelado');
      await ctx.reply('Registro cancelado. ¿Qué deseas hacer?', 
        Markup.inlineKeyboard([
          [Markup.button.callback('Intentar nuevamente', ctx.session.data.unitButtonId)],
          [Markup.button.callback('Volver al menú', 'main_menu')]
        ])
      );
    }
  });
  
  // Manejar botón para volver al menú principal
  bot.action('main_menu', async (ctx) => {
    await ctx.answerCbQuery('Volviendo al menú principal');
    
    // Mostrar menú principal (implementado en start.command.js)
    ctx.telegram.sendMessage(ctx.chat.id, '🏠 Menú Principal', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('📝 Registrar unidad', 'register_unit')],
        [Markup.button.callback('📋 Ver unidades', 'show_units')],
        [Markup.button.callback('💰 Saldo pendiente', 'check_balance')],
        [Markup.button.callback('📊 Generar reporte', 'generate_report')]
      ])
    });
  });
}
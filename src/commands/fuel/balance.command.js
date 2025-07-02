// src/commands/fuel/balance.command.js
import { fuelController } from '../../controllers/index.js';
import { getMainKeyboard } from '../../views/keyboards.js';
import { logger } from '../../utils/logger.js';

/**
 * Configura los comandos para consulta de saldos pendientes
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupBalanceCommands(bot) {
  // Comando para mostrar saldo pendiente
  bot.command('saldo', async (ctx) => {
    try {
      logger.info(`Usuario ${ctx.from.id} solicitó saldo pendiente`);
      // Pasar el contexto al método
      logger.info('Llamando a fuelController.getTotalPendingBalance() con contexto');
      const totalAmount = await fuelController.getTotalPendingBalance(ctx);
      logger.info(`Saldo recuperado: ${totalAmount}`);

      await ctx.reply(`💰 *Saldo pendiente total: $${totalAmount.toFixed(2)}*`, {
        parse_mode: 'Markdown'
      });

      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: getMainKeyboard()
      });
    } catch (error) {
      logger.error(`Error al mostrar saldo: ${error.message}`, error);
      await ctx.reply('Ocurrió un error al consultar el saldo pendiente.');
      // Mostrar menú incluso después del error
      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: getMainKeyboard()
      });
    }
  });

  // Acción para mostrar saldo pendiente desde el botón
  bot.action('check_balance', async (ctx) => {
    try {
      logger.info(`Usuario ${ctx.from.id} solicitó saldo pendiente mediante botón`);
      await ctx.answerCbQuery('Consultando saldo pendiente...');

      // Pasar el contexto al método
      logger.info('Llamando a fuelController.getTotalPendingBalance() con contexto');
      const totalAmount = await fuelController.getTotalPendingBalance(ctx);
      logger.info(`Saldo recuperado: ${totalAmount}`);

      await ctx.reply(`💰 *Saldo pendiente total: $${totalAmount.toFixed(2)}*`, {
        parse_mode: 'Markdown'
      });

      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: getMainKeyboard()
      });
    } catch (error) {
      logger.error(`Error al mostrar saldo: ${error.message}`, error);
      await ctx.answerCbQuery('Error al consultar saldo');
      await ctx.reply('Ocurrió un error al consultar el saldo pendiente.');

      // Mostrar menú incluso después del error
      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: getMainKeyboard()
      });
    }
  });
}

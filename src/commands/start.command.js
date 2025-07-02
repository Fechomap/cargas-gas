// src/commands/start.command.js
import { logger } from '../utils/logger.js';
import { getMainKeyboard } from '../views/keyboards.js';
import { getWelcomeMessage } from '../views/messages.js';
import { Markup } from 'telegraf';
import { TenantService } from '../services/tenant.service.js';
import { isAdminUser } from '../utils/admin.js';

export function setupStartCommand(bot) {
  // Comando /start
  bot.start(async (ctx) => {
    try {
      logger.info(`Usuario ${ctx.from.id} inició el bot`);
      
      // Inicializar estado de sesión si no existe
      if (!ctx.session) {
        ctx.session = { state: 'idle', data: {} };
      }
      
      // Verificar si es un chat privado
      const isPrivateChat = ctx.chat?.type === 'private';
      
      // Verificar si es administrador
      const isAdmin = await isAdminUser(ctx.from?.id);
      
      // Verificar si el usuario ya tiene un Tenant ID (si está en un grupo registrado)
      const chatId = ctx.chat?.id?.toString();
      const tenant = chatId ? await TenantService.findTenantByChatId(chatId) : null;
      
      // Determinar qué tipo de menú mostrar
      if (tenant || (isPrivateChat && isAdmin)) {
        // Si tiene tenant o es admin en chat privado, mostrar menú completo
        logger.info(`Mostrando menú completo para usuario ${ctx.from.id} (admin: ${isAdmin})`);
        const { reply_markup } = getMainKeyboard(isAdmin); // Pasar el estado de admin
        await ctx.reply(getWelcomeMessage(ctx.from.first_name), {
          parse_mode: 'Markdown',
          reply_markup: reply_markup
        });
      } else {
        // Si no tiene tenant, mostrar un mensaje directo con un solo botón
        logger.info(`Mostrando mensaje simplificado para registro a usuario: ${ctx.from.id}`);
        
        // Mensaje simple y directo sin formato Markdown para evitar errores
        const welcomeMessage = 
          `¡Hola ${ctx.from.first_name}!\n\n` +
          `Para utilizar este bot, primero debes registrar tu empresa.\n\n` +
          `Presiona el botón de abajo para comenzar:`;
        
        // Un solo botón para registrar empresa que llame a un callback
        await ctx.reply(welcomeMessage, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📝 Registrar Empresa', callback_data: 'start_registration' }]
            ]
          }
        });
      }
      
    } catch (error) {
      logger.error(`Error en comando start: ${error.message}`, error);
      ctx.reply('Ocurrió un error al iniciar el bot. Por favor, intenta nuevamente.');
      
      // Intento alternativo con botones básicos en caso de error
      try {
        await ctx.reply('Menú alternativo:', Markup.inlineKeyboard([
          [Markup.button.callback('📝 Registrar', 'register_unit')],
          [Markup.button.callback('💰 Saldo', 'check_balance')],
          [Markup.button.callback('📊 Reporte', 'generate_report')]
        ]));
      } catch (buttonError) {
        logger.error(`Error al mostrar botones alternativos: ${buttonError.message}`);
      }
    }
  });

  // Manejar botón de registro de empresa
  bot.action('start_registration', async (ctx) => {
    try {
      await ctx.answerCbQuery('Iniciando registro de empresa');
      
      // Ejecutar directamente la función de registro sin enviar el comando
      logger.info(`Iniciando registro de empresa desde botón para usuario ${ctx.from.id}`);
      
      // Importar el comando y la función startCompanyRegistration desde la nueva estructura modular
      const { startCompanyRegistration } = await import('./registration/start-registration.command.js');
      
      // Llamar directamente a la función de registro
      await startCompanyRegistration(ctx);
      
    } catch (error) {
      logger.error(`Error al iniciar registro de empresa: ${error.message}`);
      await ctx.reply('Ocurrió un error al iniciar el registro. Por favor, escribe /registrar_empresa para intentar nuevamente.');
    }
  });
  
  // NOTA: El callback 'main_menu' se maneja globalmente en commands/index.js
  // para evitar duplicación de handlers y conflictos
}

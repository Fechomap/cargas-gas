// src/commands/registration/group-linking.command.js
import { Markup } from 'telegraf';
import { logger } from '../../utils/logger.js';
import { registrationService } from '../../services/registration.service.js';

/**
 * Configura el comando para vincular grupos con tokens
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupGroupLinkingCommand(bot) {
  // Comando para vincular grupo con token
  bot.command(['vincular', 'activar'], linkGroupWithToken);
}

/**
 * Vincula un grupo con un token de registro
 * @param {TelegrafContext} ctx - Contexto de Telegraf
 */
export async function linkGroupWithToken(ctx) {
  try {
    // Verificar que estemos en un grupo o supergrupo
    if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
      return ctx.reply('⚠️ Este comando solo puede ser utilizado en un grupo.');
    }
    
    // Obtener token del comando
    const text = ctx.message.text.trim();
    const parts = text.split(' ');
    
    if (parts.length !== 2) {
      return ctx.reply(
        '⚠️ Formato incorrecto. Uso:\n' +
        '/vincular TOKEN',
        { reply_to_message_id: ctx.message.message_id }
      );
    }
    
    const token = parts[1];
    
    // Verificar token y vincular grupo
    const result = await registrationService.linkGroupWithToken({
      token,
      chatId: String(ctx.chat.id),
      chatTitle: ctx.chat.title
    });
    
    if (result.success) {
      // Enviar mensaje de éxito
      await ctx.reply(
        '✅ *¡Grupo Vinculado Exitosamente!*\n\n' +
        `Este grupo ha sido registrado como *${result.tenant.companyName}*.\n\n` +
        'El bot está ahora activo y listo para registrar unidades y cargas de combustible.\n\n' +
        'Usa el comando /start para comenzar.',
        { parse_mode: 'Markdown' }
      );
      
      // Enviar mensaje con botones principales
      setTimeout(async () => {
        try {
          await ctx.reply('🏠 *Menú Principal*', {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('📝 Registrar unidad', 'register_unit')],
              [Markup.button.callback('👁️ Ver unidades', 'show_units')],
              [Markup.button.callback('📊 Generar reporte', 'generate_report')],
              [Markup.button.callback('❓ Ayuda', 'show_help')]
            ])
          });
        } catch (error) {
          logger.error(`Error al enviar menú principal: ${error.message}`);
        }
      }, 1000);
      
      logger.info(`Grupo ${ctx.chat.id} vinculado exitosamente como ${result.tenant.companyName}`);
    } else {
      // Enviar mensaje de error
      await ctx.reply(
        `❌ *Error al vincular grupo*\n\n${result.error}`,
        { 
          parse_mode: 'Markdown',
          reply_to_message_id: ctx.message.message_id 
        }
      );
    }
  } catch (error) {
    logger.error(`Error al vincular grupo: ${error.message}`);
    await ctx.reply('❌ Ocurrió un error al procesar la vinculación. Por favor, verifica el token e intenta nuevamente.');
  }
}

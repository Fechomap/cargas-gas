// src/commands/registration/start-registration.command.js
import { Markup } from 'telegraf';
import { logger } from '../../utils/logger.js';
import { updateConversationState } from '../../state/conversation.js';
import { registrationService } from '../../services/registration.service.js';
import { notificationService } from '../../services/notification.service.js';

// Estados del flujo de registro
const STATES = {
  IDLE: 'idle',
  COMPANY_NAME: 'register_company_name',
  CONTACT_NAME: 'register_company_contact',
  PHONE: 'register_company_phone',
  EMAIL: 'register_company_email',
  CONFIRM: 'register_company_confirm'
};

/**
 * Configura el comando para iniciar el registro de empresa
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupStartRegistrationCommand(bot) {
  // Comando para iniciar registro de empresa (solo en chat privado)
  bot.command('registrar_empresa', startCompanyRegistration);
  
  // Manejar el flujo de conversación para el registro
  bot.on('text', handleRegistrationConversation);
  
  // Configurar los callbacks para los botones de confirmación/cancelación
  setupRegistrationCallbacks(bot);
  
  // Registrar explícitamente los callbacks de confirmación/cancelación para asegurar que funcionen
  logger.info('Registrando callbacks específicos para confirm_registration y cancel_registration');
  
  // Callback directo para confirmar registro
  bot.action('confirm_registration', async (ctx) => {
    logger.info('🔄 Botón CONFIRMAR presionado por usuario ' + ctx.from.id);
    if (!ctx.session || !ctx.session.data) {
      return ctx.answerCbQuery('❌ Datos de registro no encontrados. Inicia nuevamente.');
    }
    
    try {
      await ctx.answerCbQuery('✅ Procesando solicitud...');
      
      // Crear solicitud de registro
      const { data } = ctx.session;
      const request = await registrationService.createRegistrationRequest({
        companyName: data.companyName,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        requesterId: ctx.from.id,
        requesterUsername: ctx.from.username,
      });
      
      // Notificar a administradores
      await notificationService.notifyAdminsAboutRequest(bot, request);
      
      // Enviar mensaje de confirmación
      await ctx.editMessageText(
        ' *Solicitud Enviada Exitosamente*\n\n' +
        'Tu solicitud de registro ha sido recibida y está siendo procesada.\n\n' +
        'Un administrador revisará tu solicitud y te notificará cuando sea aprobada.\n\n' +
        'ID de solicitud: `' + request.id + '`',
        { parse_mode: 'Markdown' }
      );
      
      // Resetear estado
      updateConversationState(ctx, 'idle');
    } catch (error) {
      logger.error(`Error al confirmar registro: ${error.message}`);
      await ctx.reply(' Ocurrió un error al procesar la solicitud. Por favor, intenta nuevamente.');
      updateConversationState(ctx, 'idle');
    }
  });
  
  // Callback directo para cancelar registro
  bot.action('cancel_registration', async (ctx) => {
    logger.info(' Botón CANCELAR presionado por usuario ' + ctx.from.id);
    try {
      await ctx.answerCbQuery(' Registro cancelado');
      await ctx.editMessageText(' Proceso de registro cancelado. Puedes iniciarlo nuevamente con el comando /registrar_empresa.');
      
      // Resetear estado
      updateConversationState(ctx, 'idle');
    } catch (error) {
      logger.error(`Error al cancelar registro: ${error.message}`);
      await ctx.reply(' Error al cancelar el registro.');
    }
  });
}

/**
 * Inicia el proceso de registro de empresa
 * @param {TelegrafContext} ctx - Contexto de Telegraf
 */
export async function startCompanyRegistration(ctx) {
  try {
    // Verificar que estemos en un chat privado
    if (ctx.chat.type !== 'private') {
      return ctx.reply(' Este comando solo puede ser utilizado en un chat privado con el bot.');
    }
    
    // Iniciar el flujo de registro
    ctx.session = ctx.session || {};
    updateConversationState(ctx, 'register_company_name');
    
    await ctx.reply(
      ' *Registro de Nueva Empresa*\n\n' +
      'Vamos a registrar tu empresa en el sistema.\n' +
      'Por favor, proporciona la siguiente información:\n\n' +
      '*Paso 1:* Ingresa el nombre de tu empresa:',
      { 
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback(' Cancelar registro', 'cancel_registration')]
        ]) 
      }
    );
    
    logger.info(`Usuario ${ctx.from.id} inició proceso de registro de empresa`);
  } catch (error) {
    logger.error(`Error al iniciar registro de empresa: ${error.message}`);
    await ctx.reply(' Ocurrió un error al iniciar el proceso de registro. Por favor, intenta nuevamente.');
  }
}

/**
 * Maneja el flujo de conversación para el registro
 * @param {TelegrafContext} ctx - Contexto de Telegraf
 * @param {Function} next - Función para continuar middleware
 */
async function handleRegistrationConversation(ctx, next) {
  try {
    // Si no hay una sesión o no estamos en un flujo de registro, continuar
    if (!ctx.session || !ctx.session.state || !ctx.session.state.startsWith('register_company')) {
      return next();
    }
    
    const { state } = ctx.session;
    const text = ctx.message.text;
    
    logger.info(`Procesando texto para estado: ${state}, mensaje: "${text}", usuario: ${ctx.from?.id}`);
    
    switch (state) {
      case STATES.COMPANY_NAME:
        // Guardar nombre de la empresa
        ctx.session.data = ctx.session.data || {};
        ctx.session.data.companyName = text;
        
        // Solicitar nombre de contacto
        updateConversationState(ctx, 'register_company_contact');
        await ctx.reply('✅ Nombre de empresa registrado.\n\n*Paso 2:* Ingresa el nombre de la persona de contacto:', 
          { 
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('❌ Cancelar registro', 'cancel_registration')]
            ])
          }
        );
        break;
        
      case STATES.CONTACT_NAME:
        // Guardar nombre de contacto
        ctx.session.data = ctx.session.data || {};
        ctx.session.data.contactName = text;
        
        // Solicitar teléfono de contacto
        updateConversationState(ctx, 'register_company_phone');
        await ctx.reply('✅ Nombre de contacto registrado.\n\n*Paso 3:* Ingresa el número de teléfono de contacto:\n\n_(Puedes escribir "N/A" si no deseas proporcionar esta información)_', 
          { 
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('❌ Cancelar registro', 'cancel_registration')]
            ])
          }
        );
        break;
        
      case STATES.PHONE:
        // Guardar teléfono
        ctx.session.data = ctx.session.data || {};
        ctx.session.data.contactPhone = text === 'N/A' ? null : text;
        
        // Solicitar email de contacto
        updateConversationState(ctx, 'register_company_email');
        await ctx.reply('✅ Teléfono de contacto registrado.\n\n*Paso 4:* Ingresa el correo electrónico de contacto:\n\n_(Puedes escribir "N/A" si no deseas proporcionar esta información)_', 
          { 
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('❌ Cancelar registro', 'cancel_registration')]
            ])
          }
        );
        break;
        
      case STATES.EMAIL:
        // Guardar email
        ctx.session.data = ctx.session.data || {};
        ctx.session.data.contactEmail = text === 'N/A' ? null : text;
        
        // Mostrar resumen y confirmar
        await showRegistrationSummary(ctx);
        break;
      
      default:
        // Si no es ninguno de los estados anteriores, continuar
        return next();
    }
  } catch (error) {
    logger.error(`Error en flujo de registro: ${error.message}`);
    await ctx.reply('❌ Ocurrió un error en el proceso de registro. Por favor, intenta nuevamente con /registrar_empresa.');
    updateConversationState(ctx, 'idle');
  }
}

/**
 * Muestra el resumen de la solicitud y pide confirmación
 * @param {TelegrafContext} ctx - Contexto de Telegraf
 */
async function showRegistrationSummary(ctx) {
  try {
    const { data } = ctx.session;
    
    // Actualizar estado
    updateConversationState(ctx, 'register_company_confirm');
    
    // Formar mensaje de resumen
    const summaryMessage = 
      '📋 *Resumen de Solicitud*\n\n' +
      `*Empresa:* ${data.companyName}\n` +
      `*Contacto:* ${data.contactName}\n` +
      (data.contactPhone ? `*Teléfono:* ${data.contactPhone}\n` : '') +
      (data.contactEmail ? `*Email:* ${data.contactEmail}\n` : '') +
      '\n*¿Confirmas estos datos?*';
    
    // Enviar resumen con botones de confirmación
    logger.info(`Mostrando resumen con botones de confirmación para usuario ${ctx.from.id}`);
    
    // Usar el formato exacto que sí funciona en otras partes de la aplicación
    // (No crear un objeto separado para el teclado)
    const sentMsg = await ctx.reply(summaryMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ CONFIRMAR', callback_data: 'confirm_registration' },
            { text: '❌ CANCELAR', callback_data: 'cancel_registration' }
          ]
        ]
      }
    });
    
    logger.info(`Mensaje con botones enviado: ID ${sentMsg.message_id}`);
    
    // Registro adicional para depuración
    logger.info('Estructura del teclado enviado: ' + JSON.stringify({
      inline_keyboard: [
        [
          { text: '✅ CONFIRMAR', callback_data: 'confirm_registration' },
          { text: '❌ CANCELAR', callback_data: 'cancel_registration' }
        ]
      ]
    }));
  } catch (error) {
    logger.error(`Error al mostrar resumen: ${error.message}`);
    await ctx.reply('❌ Ocurrió un error al procesar los datos. Por favor, intenta nuevamente.');
    updateConversationState(ctx, 'idle');
  }
}

// Configurar callbacks para los botones
function setupRegistrationCallbacks(bot) {
  // Callback para confirmar registro
  bot.action('confirm_registration', async (ctx) => {
    try {
      if (!ctx.session || !ctx.session.data) {
        return ctx.answerCbQuery('❌ Datos de registro no encontrados. Inicia nuevamente.');
      }
      
      await ctx.answerCbQuery('Procesando solicitud...');
      
      // Crear solicitud de registro
      const { data } = ctx.session;
      const request = await registrationService.createRegistrationRequest({
        companyName: data.companyName,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        requesterId: ctx.from.id,
        requesterUsername: ctx.from.username,
      });
      
      // Notificar a administradores usando el servicio de notificaciones
      await notificationService.notifyAdminsAboutRequest(bot, request);
      
      // Enviar mensaje de confirmación
      await ctx.editMessageText(
        '✅ *Solicitud Enviada Exitosamente*\n\n' +
        'Tu solicitud de registro ha sido recibida y está siendo procesada.\n\n' +
        'Un administrador revisará tu solicitud y te notificará cuando sea aprobada.\n\n' +
        'ID de solicitud: `' + request.id + '`',
        { parse_mode: 'Markdown' }
      );
      
      // Resetear estado
      updateConversationState(ctx, 'idle');
      
    } catch (error) {
      logger.error(`Error al confirmar registro: ${error.message}`);
      await ctx.answerCbQuery('❌ Error al procesar la solicitud.');
      await ctx.reply('❌ Ocurrió un error al procesar la solicitud. Por favor, intenta nuevamente.');
      updateConversationState(ctx, 'idle');
    }
  });
  
  // Callback para cancelar registro
  bot.action('cancel_registration', async (ctx) => {
    try {
      await ctx.answerCbQuery('Registro cancelado');
      await ctx.editMessageText('❌ Proceso de registro cancelado. Puedes iniciarlo nuevamente con el comando /registrar_empresa.');
      
      // Resetear estado
      updateConversationState(ctx, 'idle');
    } catch (error) {
      logger.error(`Error al cancelar registro: ${error.message}`);
      await ctx.answerCbQuery('❌ Error al cancelar el registro.');
    }
  });
}

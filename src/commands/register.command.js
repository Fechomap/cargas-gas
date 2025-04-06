// src/commands/register.command.js
import { Markup } from 'telegraf';
import { logger } from '../utils/logger.js';
import { unitController } from '../controllers/unit.controller.js';
import { updateConversationState } from '../state/conversation.js';

/**
 * Configura el comando y botones para registrar unidades
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function setupRegisterUnitCommand(bot) {
  // Comando /registrar
  bot.command('registrar', startUnitRegistration);
  
  // Botón "Registrar unidad"
  bot.action('register_unit', startUnitRegistration);
  
  // Manejar respuestas según el estado de la conversación
  bot.on('text', async (ctx, next) => {
    // Solo procesar si estamos en un estado de registro de unidad
    if (!ctx.session?.state?.startsWith('register_unit_')) {
      return next();
    }
    
    try {
      switch (ctx.session.state) {
        case 'register_unit_name':
          // Guardar nombre del operador y solicitar número de unidad
          ctx.session.data.operatorName = ctx.message.text;
          await updateConversationState(ctx, 'register_unit_number');
          return await ctx.reply('Por favor, ingresa el número económico de la unidad:');
          
        case 'register_unit_number':
          // Guardar número de unidad y solicitar confirmación
          ctx.session.data.unitNumber = ctx.message.text;
          await updateConversationState(ctx, 'register_unit_confirm');
          
          return await ctx.reply(
            `¿Deseas registrar esta unidad: ${ctx.session.data.operatorName} - ${ctx.session.data.unitNumber}?`,
            Markup.inlineKeyboard([
              Markup.button.callback('Sí', 'register_unit_confirm_yes'),
              Markup.button.callback('No', 'register_unit_confirm_no')
            ])
          );
      }
    } catch (error) {
      logger.error(`Error en registro de unidad: ${error.message}`);
      ctx.reply('Ocurrió un error en el registro. Por favor, intenta nuevamente.');
      await updateConversationState(ctx, 'idle');
    }
    
    return next();
  });
  
  // Manejar confirmación de registro
  bot.action('register_unit_confirm_yes', async (ctx) => {
    try {
      // Registrar la unidad en la base de datos
      const result = await unitController.registerUnit({
        operatorName: ctx.session.data.operatorName,
        unitNumber: ctx.session.data.unitNumber
      });
      
      // Actualizar teclado personalizado con la nueva unidad
      await ctx.answerCbQuery('Unidad registrada correctamente');
      await ctx.reply(`✅ Unidad registrada: ${result.operatorName} - ${result.unitNumber}`);
      
      // Limpiar estado de conversación
      await updateConversationState(ctx, 'idle', {});
      
      // Mostrar teclado actualizado con la nueva unidad
      // Este método debería obtener todas las unidades registradas y crear botones para cada una
      await unitController.showRegisteredUnits(ctx);
    } catch (error) {
      logger.error(`Error al confirmar registro: ${error.message}`);
      await ctx.answerCbQuery('Error al registrar unidad');
      await ctx.reply('Ocurrió un error al registrar la unidad. Por favor, intenta nuevamente.');
      await updateConversationState(ctx, 'idle', {});
    }
  });
  
  bot.action('register_unit_confirm_no', async (ctx) => {
    await ctx.answerCbQuery('Registro cancelado');
    await ctx.reply('Registro cancelado. ¿Deseas intentar nuevamente?', 
      Markup.inlineKeyboard([
        Markup.button.callback('Sí, registrar otra unidad', 'register_unit'),
        Markup.button.callback('No, volver al menú', 'main_menu')
      ])
    );
    await updateConversationState(ctx, 'idle', {});
  });
}

/**
 * Inicia el flujo de registro de unidad
 */
async function startUnitRegistration(ctx) {
  try {
    logger.info(`Usuario ${ctx.from.id} inició registro de unidad`);
    
    // CORRECCIÓN: Asegurar que ctx.session existe
    if (!ctx.session) {
      logger.info('Inicializando sesión ya que no existe');
      ctx.session = { state: 'idle', data: {} };
    }
    
    // Iniciar el estado de conversación para registro
    logger.info('Actualizando estado a register_unit_name');
    await updateConversationState(ctx, 'register_unit_name', {});
    logger.info('Estado actualizado correctamente');
    
    await ctx.reply('Por favor, ingresa el nombre del operador:');
    logger.info('Solicitud de nombre de operador enviada');
  } catch (error) {
    logger.error(`Error al iniciar registro: ${error.message}`, error);
    await ctx.reply('Ocurrió un error al iniciar el registro. Por favor, intenta nuevamente.');
    
    // Mostrar menú principal como fallback
    await ctx.reply('¿Qué deseas hacer ahora?', {
      reply_markup: getMainKeyboard()
    });
  }
}
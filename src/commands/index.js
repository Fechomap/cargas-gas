// src/commands/index.js
import { Markup } from 'telegraf';
import { setupStartCommand } from './start.command.js';
import { setupRegisterUnitCommand } from './register.command.js';
import { setupFuelCommand } from './fuel.command.js';
import { setupUnifiedReportCommand } from './unified-report.command.js';
import { setupCompanyRegisterCommands } from './company-register.command.js';
import { logger } from '../utils/logger.js';
import { unitController } from '../controllers/unit.controller.js';

/**
 * Configurar callback global para el menú principal
 */
function setupGlobalCallbacks(bot) {
  // Manejar el botón main_menu de forma global
  bot.action('main_menu', async (ctx) => {
    try {
      await ctx.answerCbQuery('Volviendo al menú principal');
      
      // Limpiar el estado de conversación
      if (ctx.session) {
        ctx.session.state = 'idle';
        ctx.session.data = {};
      }
      
      // Mostrar mensaje con menú principal usando Markup directamente
      await ctx.reply('🏠 Menú Principal', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('📝 Registrar unidad', 'register_unit')],
          [Markup.button.callback('👁️ Ver unidades', 'show_units')],
          [Markup.button.callback('💰 Consultar saldo pendiente', 'check_balance')],
          [Markup.button.callback('📊 Generar reporte', 'generate_report')],
          [Markup.button.callback('❓ Ayuda', 'show_help')]
        ])
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
  
  // Manejar botón de ayuda
  bot.action('show_help', async (ctx) => {
    try {
      await ctx.answerCbQuery('Mostrando ayuda');
      
      const helpMessage = `
*Instrucciones de Uso* ❓

*1. Registrar una unidad:*
   • Usa el botón "Registrar unidad"
   • Ingresa el nombre del operador
   • Ingresa el número económico
   • Confirma los datos

*2. Registrar carga de combustible:*
   • Ve a "Ver unidades" y selecciona una unidad
   • Sigue las instrucciones para ingresar litros, monto, etc.
   • Confirma para guardar

*3. Consultar saldo pendiente:*
   • Usa el botón "Consultar saldo pendiente"

*4. Generar reportes:*
   • Usa el botón "Generar reporte"
   • Aplica los filtros deseados
   • Selecciona PDF o Excel
      `;
      
      await ctx.reply(helpMessage, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
        ])
      });
    } catch (error) {
      logger.error(`Error al mostrar ayuda: ${error.message}`);
      await ctx.reply('Ocurrió un error al mostrar la ayuda.');
    }
  });
  
  // Manejar botón de ver unidades
  bot.action('show_units', async (ctx) => {
    try {
      await ctx.answerCbQuery('Cargando unidades');
      
      // Llamar al controlador para mostrar unidades
      await unitController.showRegisteredUnits(ctx);
    } catch (error) {
      logger.error(`Error al mostrar unidades: ${error.message}`);
      await ctx.reply('Ocurrió un error al cargar las unidades.');
      
      // Mostrar menú principal como fallback
      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
        ])
      });
    }
  });
  
  // Manejar botón de saldo pendiente
  bot.action('check_balance', async (ctx) => {
    try {
      await ctx.answerCbQuery('Consultando saldo pendiente...');
      
      // Simular el comando /saldo
      await bot.telegram.sendMessage(ctx.chat.id, '/saldo');
    } catch (error) {
      logger.error(`Error al consultar saldo: ${error.message}`);
      await ctx.reply('Ocurrió un error al consultar el saldo pendiente.');
      
      // Volver al menú principal
      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
        ])
      });
    }
  });
  
  // Manejar botón para generar reporte
  bot.action('generate_report', async (ctx) => {
    try {
      await ctx.answerCbQuery('Iniciando generación de reporte...');
      
      // Importar dinámicamente el controlador para evitar dependencias circulares
      const { unifiedReportController } = await import('../controllers/unified-report.controller.js');
      
      // Llamar directamente al controlador en lugar de simular el comando
      await unifiedReportController.startReportGeneration(ctx);
      
      logger.info('Generador de reportes iniciado directamente desde el botón');
    } catch (error) {
      logger.error(`Error al iniciar reporte: ${error.message}`);
      await ctx.reply('Ocurrió un error al iniciar la generación del reporte.');
      
      // Volver al menú principal
      await ctx.reply('¿Qué deseas hacer ahora?', {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
        ])
      });
    }
  });
}

/**
 * Registra todos los comandos del bot
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function registerCommands(bot) {
  try {
    logger.info('Iniciando registro de comandos');
    
    // Registrar comandos principales
    logger.info('Configurando comando start');
    setupStartCommand(bot);
    
    logger.info('Configurando comando register');
    setupRegisterUnitCommand(bot);
    
    logger.info('Configurando comando fuel');
    setupFuelCommand(bot);
    
    logger.info('Configurando comando report');
    setupUnifiedReportCommand(bot);
    
    logger.info('Configurando sistema de registro de empresas');
    setupCompanyRegisterCommands(bot);
    
    // Configurar callbacks globales
    setupGlobalCallbacks(bot);
    
    // Definir comandos para usuarios registrados (con tenant)
    const registeredUserCommands = [
      { command: 'start', description: 'Iniciar el bot' },
      { command: 'registrar', description: 'Registrar una nueva unidad' },
      { command: 'saldo', description: 'Ver saldo pendiente total' },
      { command: 'reporte', description: 'Generar reportes de cargas' },
      { command: 'ayuda', description: 'Ver instrucciones de uso' }
    ];
    
    // Definir comandos para usuarios no registrados (sin tenant)
    const unregisteredUserCommands = [
      { command: 'start', description: 'Iniciar el bot' },
      { command: 'registrar_empresa', description: 'Solicitar registro de empresa' },
      { command: 'vincular', description: 'Vincular grupo con token de empresa' }
    ];
    
    // Establecer comandos en la interfaz de Telegram según el ámbito
    logger.info('Registrando comandos en API de Telegram para diferentes ámbitos');
    
    // 1. Comandos para chats privados (usuarios no registrados) - limitado a registro
    bot.telegram.setMyCommands(unregisteredUserCommands, { scope: { type: 'all_private_chats' } });
    logger.info('Comandos para chats privados registrados');
    
    // 2. Comandos para grupos (usuarios registrados) - menú completo
    bot.telegram.setMyCommands(registeredUserCommands, { scope: { type: 'all_group_chats' } });
    logger.info('Comandos para grupos registrados');
    
    // Añadir manejador para comandos no registrados
    bot.on('text', (ctx, next) => {
      logger.info(`Recibido texto: ${ctx.message.text}`);
      return next();
    });
    
    logger.info('Comandos registrados correctamente');
  } catch (error) {
    logger.error('Error al registrar comandos:', error);
    throw error;
  }
}
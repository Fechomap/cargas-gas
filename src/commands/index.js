// src/commands/index.js
import { Markup } from 'telegraf';
import { setupStartCommand } from './start.command.js';
import { configurarComandosUnidades } from './unidades/index.js';
import { setupFuelCommands } from './fuel/index.js';
import { configurarComandosReportes } from './reportes/index.js';
import { setupCompanyRegisterCommands } from './registration/index.js';
import { setupTurnosCommands } from './turnos/index.js';
import { logger } from '../utils/logger.js';
import { unitController } from '../controllers/unit/index.js';
import { isAdminUser } from '../utils/admin.js';
import { getConsultasKeyboard, getAdminKeyboard } from '../views/keyboards.js';
import { gestionRegistrosController } from '../controllers/gestionRegistrosController.js';

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

      // Verificar si es administrador (pasando el contexto para verificar admins de Telegram)
      const isAdmin = await isAdminUser(ctx.from?.id, ctx);

      // Crear menú con estructura nueva
      const buttons = [
        [Markup.button.callback('🚛 Registrar carga', 'register_fuel_start')],
        [Markup.button.callback('🕐 Turnos', 'turnos_menu')],
        [Markup.button.callback('📊 Consultas', 'consultas_menu')]
      ];

      // Solo mostrar menú de Administración a usuarios admin
      if (isAdmin) {
        buttons.push([Markup.button.callback('🔧 Administración', 'admin_menu')]);
      }

      buttons.push([Markup.button.callback('❓ Ayuda', 'show_help')]);

      // Mostrar mensaje con menú principal
      await ctx.reply('🏠 Menú Principal',
        Markup.inlineKeyboard(buttons)
      );
    } catch (error) {
      logger.error(`Error al volver al menú principal: ${error.message}`);
      await ctx.answerCbQuery('Error al mostrar menú');

      // Intento directo con botones en línea básicos
      const isAdmin = await isAdminUser(ctx.from?.id);
      const fallbackButtons = [
        [Markup.button.callback('🚛 Registrar carga', 'register_fuel_start')],
        [Markup.button.callback('🕐 Turnos', 'turnos_menu')],
        [Markup.button.callback('📊 Consultas', 'consultas_menu')]
      ];

      if (isAdmin) {
        fallbackButtons.push([Markup.button.callback('🔧 Administración', 'admin_menu')]);
      }

      await ctx.reply('Menú Principal (alternativo)',
        Markup.inlineKeyboard(fallbackButtons)
      );
    }
  });

  // Manejar botón de ayuda
  bot.action('show_help', async (ctx) => {
    try {
      await ctx.answerCbQuery('Mostrando ayuda');

      const helpMessage = `
*Instrucciones de Uso* ❓

*FUNCIONES PRINCIPALES:*

*1. 🚛 Registrar Carga*
   • Selecciona unidad y operador
   • Ingresa kilómetros actuales
   • Ingresa litros y precio por litro
   • El sistema calcula el monto automáticamente
   • Toma foto del ticket (opcional)
   • Ingresa número de nota

*2. 🕐 Turnos*
   • Inicio de día: Registra kilómetros iniciales
   • Fin de día: Registra kilómetros finales
   • Sistema válida que no haya retrocesos

*3. 📊 Consultas*
   • Saldo pendiente: Ver cargas no pagadas
   • Buscar nota: Buscar por número y descargar documentos
   • Generar reporte: PDF/Excel con filtros [Solo Admin]

*4. 🔧 Administración* [Solo Administradores]
   • Gestionar unidades: Alta/baja de operadores
   • Gestionar registros: Editar/eliminar cargas y kilómetros

*NOVEDADES:*
✅ Sistema de kilómetros integrado
✅ Descarga de documentos respaldados
✅ Gestión completa de registros (admins)
✅ Menús reorganizados por función

Para soporte contacta a tu administrador.
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

  // NOTA: El callback 'check_balance' se maneja en fuel/balance.command.js
  // Eliminado handler que simulaba comando /saldo

  // Manejar botón para gestionar unidades
  bot.action('manage_units', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.reply('Selecciona una opción para gestionar las unidades:',
        Markup.inlineKeyboard([
          [Markup.button.callback('📝 Ver unidades', 'show_units')],
          [Markup.button.callback('➕ Registrar unidad', 'register_unit')],
          [Markup.button.callback('🚮 Desactivar unidad', 'deactivate_unit_menu')],
          [Markup.button.callback('🏠 Menú principal', 'main_menu')]
        ])
      );
    } catch (error) {
      logger.error(`Error al mostrar menú de gestión de unidades: ${error.message}`);
      await ctx.reply('Error al mostrar el menú. Por favor, intenta de nuevo más tarde.',
        Markup.inlineKeyboard([
          [Markup.button.callback('🏠 Menú principal', 'main_menu')]
        ])
      );
    }
  });

  // Manejar botón de turnos
  bot.action('turnos_menu', async (ctx) => {
    try {
      await ctx.answerCbQuery('Accediendo al menú de turnos');

      // Importar dinámicamente el controlador para evitar dependencias circulares
      const { TurnoController } = await import('../controllers/turno.controller.js');
      const turnoController = new TurnoController();

      await turnoController.showTurnosMenu(ctx);
    } catch (error) {
      logger.error(`Error al acceder al menú de turnos: ${error.message}`);
      await ctx.answerCbQuery('Error al acceder al menú');
      await ctx.reply('Error al acceder al menú de turnos. Por favor, intenta nuevamente.');
    }
  });

  // Manejar botón del submenú de Consultas
  bot.action('consultas_menu', async (ctx) => {
    try {
      await ctx.answerCbQuery('Accediendo al menú de consultas');

      // Verificar si es administrador para mostrar opciones apropiadas (pasando el contexto para verificar admins de Telegram)
      const isAdmin = await isAdminUser(ctx.from?.id, ctx);

      await ctx.reply('📊 Menú de Consultas\n\nSelecciona la consulta que deseas realizar:', {
        reply_markup: getConsultasKeyboard(isAdmin).reply_markup
      });
    } catch (error) {
      logger.error(`Error al acceder al menú de consultas: ${error.message}`);
      await ctx.answerCbQuery('Error al acceder al menú');
      await ctx.reply('Error al acceder al menú de consultas. Por favor, intenta nuevamente.');
    }
  });

  // Manejar botón del submenú de Administración
  bot.action('admin_menu', async (ctx) => {
    try {
      // Verificar permisos de administrador (pasando el contexto para verificar admins de Telegram)
      const isAdmin = await isAdminUser(ctx.from?.id, ctx);

      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        await ctx.reply('❌ No tienes permisos de administrador para acceder a esta sección.');
        return;
      }

      await ctx.answerCbQuery('Accediendo al menú de administración');

      await ctx.reply('🔧 Menú de Administración\n\nSelecciona la función administrativa que deseas realizar:', {
        reply_markup: getAdminKeyboard().reply_markup
      });
    } catch (error) {
      logger.error(`Error al acceder al menú de administración: ${error.message}`);
      await ctx.answerCbQuery('Error al acceder al menú');
      await ctx.reply('Error al acceder al menú de administración. Por favor, intenta nuevamente.');
    }
  });

  // Manejar botón de gestión de registros (CRUD completo)
  bot.action('manage_fuel_records', async (ctx) => {
    try {
      // Verificar permisos de administrador (pasando el contexto para verificar admins de Telegram)
      const isAdmin = await isAdminUser(ctx.from?.id, ctx);

      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        await ctx.reply('❌ No tienes permisos de administrador para gestionar registros.');
        return;
      }

      await ctx.answerCbQuery('Accediendo a gestión de registros');
      await gestionRegistrosController.showMainMenu(ctx);
    } catch (error) {
      logger.error(`Error al acceder a gestión de registros: ${error.message}`);
      await ctx.answerCbQuery('Error al acceder');
      await ctx.reply('Error al acceder a la gestión de registros.');
    }
  });

  // NOTA: El manejador para 'search_fuel_records' se ha movido a src/commands/fuel/desactivacion.command.js
  // para evitar duplicados y conflictos de manejadores

  // Manejar botón para generar reporte (solo admins)
  bot.action('generate_report', async (ctx) => {
    try {
      // Verificar permisos de administrador (pasando el contexto para verificar admins de Telegram)
      const isAdmin = await isAdminUser(ctx.from?.id, ctx);

      if (!isAdmin) {
        await ctx.answerCbQuery('❌ Acceso denegado');
        await ctx.reply('❌ Solo los administradores pueden generar reportes.');
        return;
      }

      await ctx.answerCbQuery('Iniciando generación de reporte...');

      // Importar dinámicamente el controlador para evitar dependencias circulares
      const { reportController } = await import('../controllers/reportes/index.js');

      // Llamar directamente al controlador en lugar de simular el comando
      await reportController.startReportGeneration(ctx);

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

    logger.info('Configurando sistema de unidades');
    configurarComandosUnidades(bot);

    logger.info('Configurando comandos de combustible');
    setupFuelCommands(bot);

    logger.info('Configurando sistema de reportes');
    configurarComandosReportes(bot);

    logger.info('Configurando sistema de registro de empresas');
    setupCompanyRegisterCommands(bot);

    logger.info('Configurando sistema de turnos');
    setupTurnosCommands(bot);

    // Configurar callbacks globales
    setupGlobalCallbacks(bot);

    // Definir comandos para usuarios registrados (con tenant)
    const registeredUserCommands = [
      { command: 'start', description: 'Iniciar el bot' },
      { command: 'registrar', description: 'Registrar una nueva unidad' },
      { command: 'turnos', description: 'Gestionar turnos de trabajo' },
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

    // Implementar comando /ayuda
    bot.command('ayuda', async (ctx) => {
      try {
        logger.info(`Usuario ${ctx.from?.id} solicitó ayuda via comando`);

        const helpMessage = `
*Instrucciones de Uso* ❓

*FUNCIONES PRINCIPALES:*

*1. 🚛 Registrar Carga*
   • Selecciona unidad y operador
   • Ingresa kilómetros actuales
   • Ingresa litros y precio por litro
   • El sistema calcula el monto automáticamente
   • Toma foto del ticket (opcional)
   • Ingresa número de nota

*2. 🕐 Turnos*
   • Inicio de día: Registra kilómetros iniciales
   • Fin de día: Registra kilómetros finales
   • Sistema válida que no haya retrocesos

*3. 📊 Consultas*
   • Saldo pendiente: Ver cargas no pagadas
   • Buscar nota: Buscar por número y descargar documentos
   • Generar reporte: PDF/Excel con filtros [Solo Admin]

*4. 🔧 Administración* [Solo Administradores]
   • Gestionar unidades: Alta/baja de operadores
   • Gestionar registros: Editar/eliminar cargas y kilómetros

*NOVEDADES:*
✅ Sistema de kilómetros integrado
✅ Descarga de documentos respaldados
✅ Gestión completa de registros (admins)
✅ Menús reorganizados por función

Para soporte contacta a tu administrador.
        `;

        await ctx.reply(helpMessage, {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('🏠 Volver al menú principal', 'main_menu')]
          ])
        });
      } catch (error) {
        logger.error(`Error al mostrar ayuda por comando: ${error.message}`);
        await ctx.reply('Ocurrió un error al mostrar la ayuda.');
      }
    });

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
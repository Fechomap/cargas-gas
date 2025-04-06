// index.js - Punto de entrada principal
import 'dotenv/config';
import { botConfig } from './config/bot.config.js';
import { connectToDatabase } from './src/db/connection.js';
import { initializeBot } from './src/api/telegram.api.js';
import { registerCommands } from './src/commands/index.js';
import { setupMiddleware } from './src/utils/middleware.js';
import { logger } from './src/utils/logger.js';

async function startBot() {
  try {
    logger.info('=== INICIANDO BOT DE TELEGRAM ===');
    logger.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    
    // Conectar a la base de datos
    logger.info('Intentando conexión a MongoDB...');
    await connectToDatabase();
    logger.info('Conexión a la base de datos establecida');

    // Inicializar el bot
    logger.info('Inicializando bot de Telegram...');
    const bot = initializeBot(botConfig);
    logger.info('Bot inicializado');

    // Añadir manejador de debug para callbacks
    bot.on('callback_query', (ctx, next) => {
      const data = ctx.callbackQuery.data;
      logger.info(`🔍 DEBUG - Callback recibido: ${data}`);
      return next();
    });

    // Configurar middleware
    logger.info('Configurando middleware...');
    setupMiddleware(bot);
    logger.info('Middleware configurado');

    // Registrar comandos
    logger.info('Registrando comandos...');
    registerCommands(bot);
    logger.info('Comandos registrados');

    // Añadir manejador global de errores
    bot.catch((err, ctx) => {
      logger.error(`Error no capturado en el bot: ${err.message}`);
      logger.error(err.stack);
      
      // Intentar responder al usuario
      try {
        ctx.reply('Lo siento, ocurrió un error inesperado. Por favor, intenta de nuevo o contacta al administrador.');
      } catch (replyError) {
        logger.error(`No se pudo enviar mensaje de error: ${replyError.message}`);
      }
    });

    // Iniciar el bot
    logger.info('Lanzando bot...');
    await bot.launch();
    logger.info('Bot iniciado correctamente');

    // Registrar información del bot
    const botInfo = await bot.telegram.getMe();
    logger.info(`Bot activo como: @${botInfo.username} (ID: ${botInfo.id})`);
    logger.info('=== BOT LISTO PARA RECIBIR COMANDOS ===');

    // Manejar cierre adecuado
    process.once('SIGINT', () => {
      bot.stop('SIGINT');
      logger.info('Bot detenido por SIGINT');
    });
    process.once('SIGTERM', () => {
      bot.stop('SIGTERM');
      logger.info('Bot detenido por SIGTERM');
    });
  } catch (error) {
    logger.error('Error al iniciar el bot:', error);
    process.exit(1);
  }
}

// Configurar manejo de excepciones no capturadas
process.on('uncaughtException', (error) => {
  logger.error(`Excepción no capturada: ${error.message}`);
  logger.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Rechazo de promesa no manejado:');
  logger.error(reason);
});

// Iniciar el bot
startBot();
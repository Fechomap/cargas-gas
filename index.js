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
    // Conectar a la base de datos
    await connectToDatabase();
    logger.info('Conexión a la base de datos establecida');

    // Inicializar el bot
    const bot = initializeBot(botConfig);
    logger.info('Bot inicializado');

    // Configurar middleware
    setupMiddleware(bot);
    logger.info('Middleware configurado');

    // Registrar comandos
    registerCommands(bot);
    logger.info('Comandos registrados');

    // Iniciar el bot
    await bot.launch();
    logger.info('Bot iniciado correctamente');

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

startBot();
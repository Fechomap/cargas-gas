// src/commands/reportes/index.js
import { logger } from '../../utils/logger.js';
import { configurarComandosGeneracion } from './generacion.command.js';
import { configurarComandosFiltros } from './filtros.command.js';
import { configurarComandosAcciones } from './acciones.command.js';

/**
 * Configura todos los comandos relacionados con reportes
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function configurarComandosReportes(bot) {
  logger.info('⭐ Configurando sistema unificado de reportes');

  // Registrar los diferentes módulos de comandos
  configurarComandosGeneracion(bot);
  configurarComandosFiltros(bot);
  configurarComandosAcciones(bot);

  logger.info('✅ Comandos de reportes configurados exitosamente');
}

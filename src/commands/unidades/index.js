// src/commands/unidades/index.js
import { logger } from '../../utils/logger.js';
import { configurarComandosRegistro } from './registro.command.js';
import { configurarComandosListado } from './listado.command.js';

/**
 * Configura todos los comandos relacionados con unidades
 * @param {Telegraf} bot - Instancia del bot de Telegram
 */
export function configurarComandosUnidades(bot) {
  logger.info("⭐ Configurando sistema de unidades");

  // Registrar los diferentes módulos de comandos
  configurarComandosRegistro(bot);
  configurarComandosListado(bot);

  logger.info("✅ Comandos de unidades configurados exitosamente");
}

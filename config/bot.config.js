// config/bot.config.js
import { env } from './environment.js';

export const botConfig = {
  token: env.TELEGRAM_BOT_TOKEN,
  options: {
    polling: true,
    // Opciones adicionales del bot
  }
};
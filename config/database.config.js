// config/database.config.js
import 'dotenv/config';

/**
 * Configuración de la base de datos
 * Sistema ahora está usando exclusivamente PostgreSQL 
 */
export const dbConfig = {
  // Modo de base de datos fijo a PostgreSQL
  mode: 'postgresql',
};

/**
 * Verifica si se debe usar MongoDB para lecturas - Ahora siempre false
 * @returns {boolean} - siempre false
 */
export function useMongoDBForReads() {
  // MongoDB ya no se usa
  return false;
}

/**
 * Verifica si se debe usar MongoDB para escrituras - Ahora siempre false
 * @returns {boolean} - siempre false
 */
export function useMongoDBForWrites() {
  // MongoDB ya no se usa
  return false;
}

/**
 * Verifica si se debe usar PostgreSQL para lecturas - Ahora siempre true
 * @returns {boolean} - siempre true
 */
export function usePostgreSQLForReads() {
  // PostgreSQL es la única base de datos
  return true;
}

/**
 * Verifica si se debe usar PostgreSQL para escrituras - Ahora siempre true
 * @returns {boolean} - siempre true
 */
export function usePostgreSQLForWrites() {
  // PostgreSQL es la única base de datos
  return true;
}

/**
 * Funciones de logging para el servidor MCP de Figma
 * Escribe a stderr en lugar de stdout para evitar que los mensajes sean capturados por el flujo principal
 */

/**
 * Logger básico para la aplicación
 */
export const logger = {
  /**
   * Mensaje informativo
   */
  info: (message: string) => process.stderr.write(`[INFO] ${message}\n`),
  
  /**
   * Mensaje de depuración
   */
  debug: (message: string) => process.stderr.write(`[DEBUG] ${message}\n`),
  
  /**
   * Mensaje de advertencia
   */
  warn: (message: string) => process.stderr.write(`[WARN] ${message}\n`),
  
  /**
   * Mensaje de error
   */
  error: (message: string) => process.stderr.write(`[ERROR] ${message}\n`),
  
  /**
   * Mensaje genérico de log
   */
  log: (message: string) => process.stderr.write(`[LOG] ${message}\n`)
};
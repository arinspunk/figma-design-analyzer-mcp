/**
 * Configuración del servidor MCP para Figma
 */

/**
 * Interfaz para la configuración del servidor
 */
export interface ServerConfig {
  serverUrl: string;
  defaultPort: number;
  reconnectInterval: number;
  wsUrl: string;
}

/**
 * Inicializa la configuración a partir de los argumentos de línea de comandos
 */
export function initConfig(args: string[]): ServerConfig {
  const serverArg = args.find(arg => arg.startsWith('--server='));
  const portArg = args.find(arg => arg.startsWith('--port='));
  const reconnectArg = args.find(arg => arg.startsWith('--reconnect-interval='));

  const serverUrl = serverArg ? serverArg.split('=')[1] : 'localhost';
  const defaultPort = portArg ? parseInt(portArg.split('=')[1], 10) : 3055;
  const reconnectInterval = reconnectArg ? parseInt(reconnectArg.split('=')[1], 10) : 2000;

  const wsUrl = serverUrl === 'localhost' ? `ws://${serverUrl}` : `wss://${serverUrl}`;

  return {
    serverUrl,
    defaultPort,
    reconnectInterval,
    wsUrl
  };
}
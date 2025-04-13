/**
 * Tipos relacionados con la API de Figma
 */

/**
 * Respuesta estándar de Figma
 */
export interface FigmaResponse {
  id: string;
  result?: any;
  error?: string;
}

/**
 * Información de progreso de comandos enviados a Figma
 */
export interface CommandProgressUpdate {
  type: 'command_progress';
  commandId: string;
  commandType: string;
  status: 'started' | 'in_progress' | 'completed' | 'error';
  progress: number;
  totalItems: number;
  processedItems: number;
  currentChunk?: number;
  totalChunks?: number;
  chunkSize?: number;
  message: string;
  payload?: any;
  timestamp: number;
}

/**
 * Estructura para una solicitud pendiente
 */
export interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
  lastActivity: number;
}

/**
 * Tipos de comandos soportados para enviar a Figma
 */
export type FigmaCommand =
  | "get_document_info"
  | "get_selection"
  | "get_node_info"
  | "get_nodes_info"
  | "export_node_as_image"
  | "get_styles"
  | "get_local_components"
  | "get_remote_components"
  | "get_styled_text_segments"
  | "scan_text_nodes"
  | "join"
  | "analyze_design_system" 
  | "extract_design_tokens"
  | "analyze_component_hierarchy";
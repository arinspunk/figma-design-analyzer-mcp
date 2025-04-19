/**
 * Herramientas para analizar componentes de Figma
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerComponentHierarchyTool } from "./component-hierarchy-tool";
import { registerUIPatternsDetectionTool } from "./ui-patterns-tool";
import { registerComponentStatesTool } from "./component-states-tool";

/**
 * Registra las herramientas de análisis de componentes en el servidor MCP
 */
export function registerComponentTools(server: McpServer): void {
  // Registrar herramienta de análisis de jerarquía de componentes
  registerComponentHierarchyTool(server);
  
  // Registrar herramienta de detección de patrones de UI
  registerUIPatternsDetectionTool(server);
  
  // Registrar herramienta de análisis de estados de componentes
  registerComponentStatesTool(server);
}
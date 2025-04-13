#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Importar configuración
import { initConfig } from './config/server-config';

// Importar módulos principales
import { logger } from './core/logger';
import { connectToFigma, configureConnection } from './core/figma-connection';

// Importar registradores de herramientas
import { registerBasicTools } from './tools/basic-tools';
import { registerAnalysisTools } from './tools/analysis-tools';
import { registerComponentTools } from './tools/component-tools';

// Crear instancia del servidor MCP
const server = new McpServer({
  name: "FigmaDevMCP",
  version: "1.0.0",
});

// Cargar configuración desde argumentos de línea de comandos
const config = initConfig(process.argv.slice(2));

// Configurar la conexión WebSocket
configureConnection(
  config.serverUrl,
  config.defaultPort,
  config.reconnectInterval,
  config.wsUrl
);

// Registrar todas las herramientas
registerBasicTools(server);
registerAnalysisTools(server);
registerComponentTools(server);

// Registrar prompts
server.prompt(
  "read_design_strategy",
  "Best practices for reading Figma designs",
  (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `# Mejores prácticas para analizar diseños de Figma

## 1. Comprensión inicial del documento
   - Usa \`get_document_info()\` para entender la estructura general del documento
   - Identifica páginas, frames principales y la organización general
   - Busca sistemas de diseño o patrones de componentes

## 2. Analiza la selección actual
   - Utiliza \`get_selection()\` para ver qué elementos ha seleccionado el usuario
   - Si no hay selección, pide al usuario que seleccione los elementos relevantes
   - Evalúa si la selección es suficiente para el análisis solicitado

## 3. Extracción de información detallada
   - Para elementos individuales: \`get_node_info(nodeId: "id")\`
   - Para múltiples elementos: \`get_nodes_info(nodeIds: ["id1", "id2", ...])\`
   - Para jerarquías complejas: analiza la estructura padre-hijo en la respuesta

## 4. Análisis de componentes y estilos
   - Examina \`get_local_components()\` para entender los componentes del documento
   - Revisa \`get_styles()\` para identificar el sistema de diseño (colores, tipografía, etc.)
   - Conecta los estilos con los componentes para entender la consistencia del diseño

## 5. Análisis de texto
   - Usa \`scan_text_nodes(nodeId: "id")\` para extraer todo el texto de una sección
   - Examina \`get_styled_text_segments()\` para identificar diferentes estilos de texto
   - Identifica jerarquía tipográfica y estructura de contenido

## 6. Visualización para confirmación
   - Utiliza \`export_node_as_image()\` para visualizar partes específicas del diseño
   - Verifica elementos visuales que son difíciles de describir solo con datos

## 7. Interpretación para desarrolladores front-end
   - Traduce los elementos visuales a estructuras HTML/CSS
   - Identifica sistemas de layout (Flexbox/Grid) basados en la disposición
   - Sugiere implementaciones semánticas y accesibles
   - Extrae tokens de diseño para implementación consistente

## 8. Estructura de análisis
   1. **Macro**: Estructura general y layout
   2. **Micro**: Componentes y elementos individuales
   3. **Detalles**: Especificaciones precisas (dimensiones, colores, tipografía)
   4. **Comportamiento**: Estados de componentes y variaciones
   5. **Implementación**: Sugerencias de código front-end

## 9. Comunicación de resultados
   - Organiza la información en categorías claras
   - Proporciona contexto visual cuando sea necesario
   - Ofrece recomendaciones prácticas para desarrollo
   - Indica posibles desafíos de implementación

Este enfoque sistemático te permitirá extraer el máximo valor de los diseños de Figma para implementaciones front-end precisas y eficientes.`,
          },
        },
      ],
      description: "Best practices for reading Figma designs",
    };
  }
);

// Función principal para iniciar el servidor
async function main() {
  try {
    // Conectar con el servidor Figma
    connectToFigma(config.defaultPort);
    
    // Iniciar el servidor MCP
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info('FigmaMCP server running');
  } catch (error) {
    logger.error(`Error starting FigmaMCP server: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Iniciar el servidor
main();


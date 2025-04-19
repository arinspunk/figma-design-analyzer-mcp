/**
 * Herramientas básicas para la interacción con Figma
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendCommandToFigma, joinChannel } from "../core/figma-connection";
import { filterFigmaNode } from "../utils/figma-utils";

/**
 * Registra las herramientas básicas en el servidor MCP
 */
export function registerBasicTools(server: McpServer): void {
  // Document Info Tool
  server.tool(
    "get_document_info",
    "Get detailed information about the current Figma document",
    {},
    async () => {
      try {
        const result = await sendCommandToFigma("get_document_info");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting document info: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Selection Tool
  server.tool(
    "get_selection",
    "Get information about the current selection in Figma",
    {},
    async () => {
      try {
        const result = await sendCommandToFigma("get_selection");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting selection: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Node Info Tool
  server.tool(
    "get_node_info",
    "Get detailed information about a specific node in Figma",
    {
      nodeId: z.string().describe("The ID of the node to get information about"),
    },
    async ({ nodeId }) => {
      try {
        const result = await sendCommandToFigma("get_node_info", { nodeId });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(filterFigmaNode(result))
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting node info: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Nodes Info Tool
  server.tool(
    "get_nodes_info",
    "Get detailed information about multiple nodes in Figma",
    {
      nodeIds: z.array(z.string()).describe("Array of node IDs to get information about")
    },
    async ({ nodeIds }) => {
      try {
        const results = await Promise.all(
          nodeIds.map(async (nodeId) => {
            const result = await sendCommandToFigma('get_node_info', { nodeId });
            return { nodeId, info: result };
          })
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results.map((result) => filterFigmaNode(result.info)))
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting nodes info: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Export Node as Image Tool
  server.tool(
    "export_node_as_image",
    "Export a node as an image from Figma",
    {
      nodeId: z.string().describe("The ID of the node to export"),
      format: z
        .enum(["PNG", "JPG", "SVG", "PDF"])
        .optional()
        .describe("Export format"),
      scale: z.number().positive().optional().describe("Export scale"),
    },
    async ({ nodeId, format, scale }) => {
      try {
        console.log(`[DIAGNÓSTICO] Iniciando exportación de nodo como imagen: ${nodeId}`);
        console.log(`[DIAGNÓSTICO] Parámetros de exportación: formato=${format || "PNG"}, escala=${scale || 1}`);
        
        // Asegurarnos de que los parámetros son correctos
        const exportParams = {
          nodeId,
          format: format || "PNG",
          scale: scale || 1,
        };
        
        console.log(`[DIAGNÓSTICO] Enviando comando al plugin de Figma:`, JSON.stringify(exportParams));
        
        // Enviar el comando al plugin de Figma
        const result = await sendCommandToFigma("export_node_as_image", exportParams);
        
        console.log(`[DIAGNÓSTICO] Respuesta recibida del plugin de Figma:`, typeof result);
        if (!result) {
          console.error(`[DIAGNÓSTICO] La respuesta es nula o indefinida`);
          throw new Error('La respuesta del plugin es nula o indefinida');
        }

        console.log(`[DIAGNÓSTICO] Claves disponibles en la respuesta:`, Object.keys(result));
        
        // Comprobar si la respuesta tiene la estructura esperada
        if (!('imageData' in result) || !('mimeType' in result)) {
          console.error(`[DIAGNÓSTICO] Estructura de respuesta incorrecta. Faltan campos requeridos`);
          console.error(`[DIAGNÓSTICO] Respuesta recibida:`, JSON.stringify(result));
          throw new Error('Estructura de respuesta incorrecta del plugin de Figma');
        }
        
        // Verificar los datos de imagen
        if (!result.imageData) {
          console.error(`[DIAGNÓSTICO] Los datos de imagen están vacíos`);
          throw new Error('Los datos de imagen recibidos están vacíos');
        }
        
        console.log(`[DIAGNÓSTICO] Tamaño de los datos de imagen: ${result.imageData.length} caracteres`);
        console.log(`[DIAGNÓSTICO] Tipo MIME: ${result.mimeType}`);
        console.log(`[DIAGNÓSTICO] Primeros 30 caracteres de imageData:`, result.imageData.substring(0, 30) + '...');

        // Construir la URL de datos para la imagen
        const dataUrl = `data:${result.mimeType};base64,${result.imageData}`;
        
        // Devolver tanto la imagen como texto de diagnóstico
        return {
          content: [
            {
              type: "text" as const,
              text: `Imagen exportada correctamente desde el nodo ${nodeId}. Formato: ${format || "PNG"}. Escala: ${scale || 1}.`
            },
            {
              type: "image" as const,
              data: dataUrl,
              mimeType: result.mimeType
            }
          ]
        };
      } catch (error) {
        console.error(`[DIAGNÓSTICO] ERROR en export_node_as_image:`, error);
        if (error instanceof Error) {
          console.error(`[DIAGNÓSTICO] Mensaje de error: ${error.message}`);
          console.error(`[DIAGNÓSTICO] Stack trace: ${error.stack}`);
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Error al exportar nodo como imagen: ${error instanceof Error ? error.message : String(error)}\n\nAsegúrate de que el nodo existe y es un tipo de nodo que puede ser exportado (frames, componentes, grupos, etc).`,
            },
          ],
        };
      }
    }
  );

  // Join Channel Tool
  server.tool(
    "join_channel",
    "Join a specific channel to communicate with Figma",
    {
      channel: z.string().describe("The name of the channel to join").default(""),
    },
    async ({ channel }) => {
      try {
        if (!channel) {
          // If no channel provided, ask the user for input
          return {
            content: [
              {
                type: "text",
                text: "Please provide a channel name to join:",
              },
            ],
            followUp: {
              tool: "join_channel",
              description: "Join the specified channel",
            },
          };
        }

        await joinChannel(channel);
        return {
          content: [
            {
              type: "text",
              text: `Successfully joined channel: ${channel}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error joining channel: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Get Styles Tool (mejorado para detectar estilos aunque no estén formalmente definidos)
  server.tool(
    "get_styles",
    "Get all styles from the current Figma document",
    {
      inferStyles: z.boolean().default(true).describe("Intentar inferir estilos aunque no estén formalmente definidos")
    },
    async ({ inferStyles }) => {
      try {
        // Obtener estilos formalmente definidos
        const formalStyles = await sendCommandToFigma("get_styles");
        
        // Si ya hay estilos definidos o no se solicita inferencia, retornar resultado
        if ((formalStyles.colors && formalStyles.colors.length > 0) || 
            (formalStyles.texts && formalStyles.texts.length > 0) || 
            !inferStyles) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(formalStyles, null, 2)
              }
            ]
          };
        }
        
        // Si no hay estilos formales, intentar inferirlos del documento actual
        const documentInfo = await sendCommandToFigma("get_document_info");
        
        // Inferir estilos analizando el documento
        const inferredStyles = await inferStylesFromDocument(documentInfo);
        
        // Combinar estilos formales con inferidos
        const combinedStyles = {
          colors: [...(formalStyles.colors || []), ...(inferredStyles.colors || [])],
          texts: [...(formalStyles.texts || []), ...(inferredStyles.texts || [])],
          effects: [...(formalStyles.effects || []), ...(inferredStyles.effects || [])],
          grids: [...(formalStyles.grids || []), ...(inferredStyles.grids || [])]
        };
        
        return {
          content: [
            {
              type: "text",
              text: `Se han inferido estilos adicionales del documento ya que no se encontraron estilos formalmente definidos.`
            },
            {
              type: "text",
              text: JSON.stringify(combinedStyles, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting styles: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  /**
   * Infiere estilos analizando el documento
   */
  async function inferStylesFromDocument(documentInfo: any): Promise<any> {
    // Estructuras para almacenar estilos inferidos
    const colors = new Map();
    const texts = new Map();
    const effects = new Map();
    
    // Función recursiva para extraer estilos
    const extractStyles = (node: any) => {
      // Extraer colores de rellenos
      if (node.fills && Array.isArray(node.fills)) {
        node.fills.forEach((fill: any) => {
          if (fill.type === 'SOLID' && fill.color) {
            // Generar clave única para este color
            const r = Math.round(fill.color.r * 255);
            const g = Math.round(fill.color.g * 255);
            const b = Math.round(fill.color.b * 255);
            const colorKey = `${r}-${g}-${b}`;
            
            if (!colors.has(colorKey)) {
              // Crear nombre basado en valores RGB para facilitar reconocimiento
              const colorName = `color-${r}-${g}-${b}`;
              colors.set(colorKey, {
                id: `inferred-${colorKey}`,
                key: colorName,
                name: colorName,
                type: 'FILL',
                paints: [fill],
                description: 'Color inferido del documento'
              });
            }
          }
        });
      }
      
      // Extraer estilos de texto
      if (node.type === 'TEXT' && node.style) {
        const { fontFamily, fontWeight, fontSize, lineHeight, letterSpacing } = node.style || {};
        // Crear clave única para este estilo de texto
        const textKey = `${fontFamily}-${fontWeight}-${fontSize}`;
        
        if (!texts.has(textKey) && fontFamily && fontSize) {
          // Determinar categoría de texto por tamaño
          let category = 'text';
          if (fontSize >= 24) category = 'h1';
          else if (fontSize >= 20) category = 'h2';
          else if (fontSize >= 16) category = 'h3';
          else if (fontSize >= 14) category = 'h4';
          
          texts.set(textKey, {
            id: `inferred-${textKey}`,
            key: `${category}-${fontWeight || 'regular'}`,
            name: `${category}/${fontWeight || 'regular'}`,
            type: 'TEXT',
            style: {
              fontFamily,
              fontWeight,
              fontSize,
              lineHeight,
              letterSpacing
            },
            description: `Estilo de texto inferido (${category})`
          });
        }
      }
      
      // Extraer efectos (sombras)
      if (node.effects && Array.isArray(node.effects) && node.effects.length > 0) {
        node.effects.forEach((effect: any, index: number) => {
          if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
            const effectKey = `${effect.type}-${effect.offset?.x || 0}-${effect.offset?.y || 0}-${effect.radius || 0}`;
            
            if (!effects.has(effectKey)) {
              const effectName = `${effect.type === 'DROP_SHADOW' ? 'shadow' : 'inner-shadow'}-${index}`;
              effects.set(effectKey, {
                id: `inferred-${effectKey}`,
                key: effectName,
                name: effectName,
                type: 'EFFECT',
                effects: [effect],
                description: 'Efecto inferido del documento'
              });
            }
          }
        });
      }
      
      // Procesar hijos recursivamente
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(extractStyles);
      }
    };
    
    // Iniciar extracción desde la raíz
    extractStyles(documentInfo);
    
    // Convertir Maps a arrays para el resultado final
    return {
      colors: Array.from(colors.values()),
      texts: Array.from(texts.values()),
      effects: Array.from(effects.values()),
      grids: []
    };
  }

  // Get Local Components Tool
  server.tool(
    "get_local_components",
    "Get all local components from the Figma document",
    {},
    async () => {
      try {
        const result = await sendCommandToFigma("get_local_components");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting local components: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // Get Remote Components Tool
  server.tool(
    "get_remote_components",
    "Get available components from team libraries in Figma",
    {},
    async () => {
      try {
        // Implementación mejorada con manejo de error específico para API no disponible
        const result = await sendCommandToFigma("get_remote_components");
        
        // Si el resultado contiene un error de API no disponible, formatearlo adecuadamente
        if (result && typeof result === 'object' && 'error' in result) {
          const typedResult = result as {
            error: boolean,
            message: string,
            apiAvailable: boolean
          };
          
          // Si el error es específicamente sobre la API no disponible, dar una respuesta más informativa
          if (!typedResult.apiAvailable) {
            return {
              content: [
                {
                  type: "text",
                  text: `El método getAvailableComponentsAsync no está disponible en esta versión de la API de Figma.\n\nEsto puede ocurrir por las siguientes razones:\n1. Estás usando una versión antigua del plugin de Figma.\n2. La API no está disponible en el entorno actual.\n3. El usuario no tiene los permisos necesarios para acceder a los componentes remotos.`
                }
              ]
            };
          }
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting remote components: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Get Styled Text Segments Tool
  server.tool(
    "get_styled_text_segments",
    "Get text segments with specific styling in a text node",
    {
      nodeId: z.string().describe("The ID of the text node to analyze"),
      property: z.enum([
        "fillStyleId", 
        "fontName", 
        "fontSize", 
        "textCase", 
        "textDecoration", 
        "textStyleId", 
        "fills", 
        "letterSpacing", 
        "lineHeight", 
        "fontWeight"
      ]).describe("The style property to analyze segments by"),
    },
    async ({ nodeId, property }) => {
      try {
        const result = await sendCommandToFigma("get_styled_text_segments", {
          nodeId,
          property
        });
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting styled text segments: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Scan Text Nodes Tool
  server.tool(
    "scan_text_nodes",
    "Scan all text nodes in the selected Figma node",
    {
      nodeId: z.string().describe("ID of the node to scan"),
    },
    async ({ nodeId }) => {
      try {
        // Initial response to indicate we're starting the process
        const initialStatus = {
          type: "text" as const,
          text: "Starting text node scanning. This may take a moment for large designs...",
        };

        // Use the plugin's scan_text_nodes function with chunking flag
        const result = await sendCommandToFigma("scan_text_nodes", {
          nodeId,
          useChunking: true,  // Enable chunking on the plugin side
          chunkSize: 10       // Process 10 nodes at a time
        });

        // If the result indicates chunking was used, format the response accordingly
        if (result && typeof result === 'object' && 'chunks' in result) {
          const typedResult = result as {
            success: boolean,
            totalNodes: number,
            processedNodes: number,
            chunks: number,
            textNodes: Array<any>
          };

          const summaryText = `
          Scan completed:
          - Found ${typedResult.totalNodes} text nodes
          - Processed in ${typedResult.chunks} chunks
          `;

          return {
            content: [
              initialStatus,
              {
                type: "text" as const,
                text: summaryText
              },
              {
                type: "text" as const,
                text: JSON.stringify(typedResult.textNodes, null, 2)
              }
            ],
          };
        }

        // If chunking wasn't used or wasn't reported in the result format, return the result as is
        return {
          content: [
            initialStatus,
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error scanning text nodes: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
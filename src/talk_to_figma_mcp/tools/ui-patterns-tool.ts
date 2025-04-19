/**
 * Herramienta para detectar patrones de UI comunes en diseños de Figma
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendCommandToFigma } from "../core/figma-connection";

/**
 * Registra la herramienta de detección de patrones de UI
 */
export function registerUIPatternsDetectionTool(server: McpServer): void {
  // Detector UI Patterns Tool
  server.tool(
    "detect_ui_patterns",
    "Identificar patrones de UI comunes y sugerir implementaciones de mejores prácticas",
    {
      nodeId: z.string().describe("ID del nodo a analizar"),
      patternTypes: z.array(
        z.enum(["forms", "lists", "cards", "navigation", "tables", "modals", "tabs", "accordions", "buttons"])
      ).default(["forms", "lists", "cards", "navigation", "tables"]).describe("Tipos de patrones a buscar")
    },
    async ({ nodeId, patternTypes }) => {
      try {
        // Mensaje inicial para indicar que el proceso ha comenzado
        const initialStatus = {
          type: "text" as const,
          text: `Iniciando detección de patrones UI (${patternTypes.join(", ")}) en el nodo seleccionado. Esto puede tomar unos momentos...`,
        };

        console.log(`Analizando patrones de UI para el nodo ${nodeId}, buscando: ${patternTypes.join(", ")}`);

        // Obtener información del nodo
        const nodeInfo = await sendCommandToFigma("get_node_info", { nodeId });
        
        // Para evitar timeouts en documentos grandes, implementar un procesamiento progresivo
        console.log(`Detectando patrones de forma progresiva para evitar timeouts...`);
        
        // Detectar patrones de UI de manera selectiva con límite de profundidad
        const maxAnalysisDepth = 5; // Limitar profundidad para evitar análisis excesivo
        const detectedPatterns = detectUIPatterns(nodeInfo, patternTypes, maxAnalysisDepth);
        
        // Enviar resultados con información sobre las optimizaciones aplicadas
        return {
          content: [
            initialStatus,
            {
              type: "text" as const,
              text: JSON.stringify({
                patterns: detectedPatterns,
                analysisInfo: {
                  maxDepth: maxAnalysisDepth,
                  patternsAnalyzed: patternTypes,
                  nodeId: nodeId,
                  nodeName: nodeInfo.name,
                  nodeType: nodeInfo.type
                }
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Error en detect_ui_patterns: ${error instanceof Error ? error.message : String(error)}`);
        return {
          content: [
            {
              type: "text",
              text: `Error al detectar patrones UI: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );
}

/**
 * Detecta patrones de UI en un nodo de Figma con límite de profundidad para evitar timeouts
 */
export function detectUIPatterns(nodeInfo: any, patternTypes: string[], maxDepth: number = 5): any[] {
  console.log(`Detectando patrones con profundidad máxima: ${maxDepth}`);
  const detectedPatterns = [];
  
  // Recorrer cada tipo de patrón solicitado de forma progresiva
  for (const patternType of patternTypes) {
    console.log(`Analizando patrón: ${patternType}`);
    let patternResults = [];
    
    // Detectar patrones según su tipo
    switch (patternType) {
      case 'forms':
        patternResults = detectFormPatterns(nodeInfo, maxDepth);
        break;
      case 'lists':
        patternResults = detectListPatterns(nodeInfo, maxDepth);
        break;
      case 'cards':
        patternResults = detectCardPatterns(nodeInfo, maxDepth);
        break;
      case 'navigation':
        patternResults = detectNavigationPatterns(nodeInfo, maxDepth);
        break;
      case 'tables':
        patternResults = detectTablePatterns(nodeInfo, maxDepth);
        break;
      case 'modals':
        patternResults = detectModalPatterns(nodeInfo, maxDepth);
        break;
      case 'tabs':
        patternResults = detectTabPatterns(nodeInfo, maxDepth);
        break;
      case 'accordions':
        patternResults = detectAccordionPatterns(nodeInfo, maxDepth);
        break;
      case 'buttons':
        patternResults = detectButtonPatterns(nodeInfo, maxDepth);
        break;
    }
    
    // Añadir resultados encontrados
    if (patternResults && patternResults.length > 0) {
      detectedPatterns.push({
        type: patternType,
        patterns: patternResults
      });
      console.log(`Encontrados ${patternResults.length} patrones de tipo ${patternType}`);
    } else {
      console.log(`No se encontraron patrones de tipo ${patternType}`);
    }
  }
  
  return detectedPatterns;
}

/**
 * Detecta patrones de formulario en un nodo de Figma
 */
function detectFormPatterns(node: any, maxDepth: number): any[] {
  const formPatterns = [];
  
  // Función recursiva para buscar elementos de formulario
  const findFormElements = (node: any, currentDepth: number = 0, path: string = ''): void => {
    // Limitar la profundidad para evitar análisis excesivo
    if (currentDepth > maxDepth) return;
    
    const nodePath = path ? `${path} > ${node.name}` : node.name;
    
    // Detectar si el nodo actual parece un formulario o parte de un formulario
    if (
      node.name.toLowerCase().includes('form') || 
      node.name.toLowerCase().includes('formulario') ||
      isFormLike(node)
    ) {
      // Identificar tipo de formulario
      let formType = determineFormType(node);
      
      // Extraer campos del formulario
      const formFields = extractFormFields(node);
      
      if (formFields.length > 0) {
        formPatterns.push({
          id: node.id,
          name: node.name,
          path: nodePath,
          type: formType,
          fieldCount: formFields.length,
          fields: formFields.slice(0, 10) // Limitar para evitar respuestas muy grandes
        });
      }
    }
    
    // Recursivamente buscar en hijos, pero solo si no hemos alcanzado el límite de profundidad
    if (node.children && currentDepth < maxDepth) {
      for (const child of node.children) {
        findFormElements(child, currentDepth + 1, nodePath);
      }
    }
  };
  
  // Iniciar búsqueda desde el nodo raíz
  findFormElements(node);
  
  return formPatterns;
}

/**
 * Determina el tipo de formulario basado en sus propiedades y elementos
 */
function determineFormType(node: any): string {
  // Nombres comunes de tipos de formulario
  const nameLower = node.name.toLowerCase();
  
  if (nameLower.includes('login') || nameLower.includes('iniciar sesión') || nameLower.includes('acceso')) {
    return 'login';
  } else if (nameLower.includes('registro') || nameLower.includes('signup') || nameLower.includes('sign up')) {
    return 'signup';
  } else if (nameLower.includes('contacto') || nameLower.includes('contact')) {
    return 'contact';
  } else if (nameLower.includes('búsqueda') || nameLower.includes('search')) {
    return 'search';
  } else if (nameLower.includes('pago') || nameLower.includes('checkout') || nameLower.includes('payment')) {
    return 'payment';
  } else if (nameLower.includes('filtro') || nameLower.includes('filter')) {
    return 'filter';
  } else if (nameLower.includes('suscripción') || nameLower.includes('subscription')) {
    return 'subscription';
  } else {
    return 'generic';
  }
}

/**
 * Extrae campos de un formulario
 */
function extractFormFields(node: any): any[] {
  const formFields = [];
  
  // Función recursiva para encontrar campos
  const findFields = (node: any): void => {
    // Verificar si el nodo actual parece un campo de formulario
    if (isFormField(node)) {
      formFields.push({
        id: node.id,
        name: node.name,
        type: determineFieldType(node),
        required: isFieldRequired(node)
      });
    }
    
    // Buscar en hijos
    if (node.children) {
      for (const child of node.children) {
        findFields(child);
      }
    }
  };
  
  // Iniciar búsqueda
  findFields(node);
  
  return formFields;
}

/**
 * Verifica si un nodo parece un campo de formulario
 */
function isFormField(node: any): boolean {
  const nameLower = node.name.toLowerCase();
  
  // Nombres comunes de campos
  if (
    nameLower.includes('input') || 
    nameLower.includes('field') || 
    nameLower.includes('campo') ||
    nameLower.includes('text') ||
    nameLower.includes('email') ||
    nameLower.includes('password') ||
    nameLower.includes('contraseña') ||
    nameLower.includes('select') ||
    nameLower.includes('dropdown') ||
    nameLower.includes('checkbox') ||
    nameLower.includes('radio') ||
    nameLower.includes('textarea')
  ) {
    return true;
  }
  
  // Si es un rectángulo con texto dentro
  if ((node.type === 'RECTANGLE' || node.type === 'FRAME') && 
      node.children && 
      node.children.some((child: any) => child.type === 'TEXT')) {
    // Verificar si tiene bordes (común en campos de formulario)
    if (node.strokes && node.strokes.length > 0) {
      return true;
    }
    
    // Verificar si tiene un fondo claro (común en campos de formulario)
    if (node.fills && node.fills.some((fill: any) => 
        fill.type === 'SOLID' && 
        ((fill.color.r > 0.9 && fill.color.g > 0.9 && fill.color.b > 0.9) || // Blanco o casi blanco
         fill.opacity < 0.1) // Transparente
    )) {
      return true;
    }
  }
  
  return false;
}

/**
 * Determina el tipo de un campo de formulario
 */
function determineFieldType(node: any): string {
  const nameLower = node.name.toLowerCase();
  
  if (nameLower.includes('email')) {
    return 'email';
  } else if (nameLower.includes('password') || nameLower.includes('contraseña')) {
    return 'password';
  } else if (nameLower.includes('checkbox')) {
    return 'checkbox';
  } else if (nameLower.includes('radio')) {
    return 'radio';
  } else if (nameLower.includes('select') || nameLower.includes('dropdown')) {
    return 'select';
  } else if (nameLower.includes('textarea') || nameLower.includes('message') || nameLower.includes('mensaje')) {
    return 'textarea';
  } else if (nameLower.includes('date') || nameLower.includes('fecha')) {
    return 'date';
  } else if (nameLower.includes('number') || nameLower.includes('número')) {
    return 'number';
  } else if (nameLower.includes('tel') || nameLower.includes('phone') || nameLower.includes('teléfono')) {
    return 'tel';
  } else if (nameLower.includes('file') || nameLower.includes('archivo')) {
    return 'file';
  } else {
    return 'text';
  }
}

/**
 * Determina si un campo parece ser obligatorio
 */
function isFieldRequired(node: any): boolean {
  const nameLower = node.name.toLowerCase();
  
  // Si tiene un asterisco o la palabra "required"
  if (nameLower.includes('*') || 
      nameLower.includes('required') || 
      nameLower.includes('obligatorio')) {
    return true;
  }
  
  // Buscar texto de etiqueta con asterisco
  if (node.children) {
    for (const child of node.children) {
      if (child.type === 'TEXT' && 
          child.characters && 
          child.characters.includes('*')) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Verifica si un nodo parece un formulario basado en su contenido
 */
function isFormLike(node: any): boolean {
  if (!node.children || node.children.length === 0) {
    return false;
  }
  
  // Contar elementos que parecen campos de formulario
  let formFieldCount = 0;
  let hasSubmitButton = false;
  
  for (const child of node.children) {
    if (isFormField(child)) {
      formFieldCount++;
    }
    
    // Verificar si hay un botón que parece de envío
    if (isButton(child)) {
      const nameLower = child.name.toLowerCase();
      if (
        nameLower.includes('submit') || 
        nameLower.includes('enviar') || 
        nameLower.includes('save') || 
        nameLower.includes('guardar') ||
        nameLower.includes('send') ||
        nameLower.includes('confirm') ||
        nameLower.includes('confirmar')
      ) {
        hasSubmitButton = true;
      }
    }
    
    // También buscar en los hijos del hijo
    if (child.children) {
      for (const grandChild of child.children) {
        if (isFormField(grandChild)) {
          formFieldCount++;
        }
        
        if (isButton(grandChild)) {
          const nameLower = grandChild.name.toLowerCase();
          if (
            nameLower.includes('submit') || 
            nameLower.includes('enviar') || 
            nameLower.includes('save') || 
            nameLower.includes('guardar')
          ) {
            hasSubmitButton = true;
          }
        }
      }
    }
  }
  
  // Si tiene varios campos y un botón de envío, probablemente es un formulario
  return formFieldCount >= 2 && hasSubmitButton;
}

/**
 * Detecta patrones de navegación en un nodo de Figma
 */
function detectNavigationPatterns(node: any, maxDepth: number): any[] {
  const navigationPatterns = [];
  
  // Función recursiva para buscar elementos de navegación
  const findNavigationElements = (node: any, currentDepth: number = 0, path: string = ''): void => {
    // Limitar la profundidad para evitar análisis excesivo
    if (currentDepth > maxDepth) return;
    
    const nodePath = path ? `${path} > ${node.name}` : node.name;
    
    // Detectar si el nodo actual parece un elemento de navegación
    if (
      node.name.toLowerCase().includes('nav') || 
      node.name.toLowerCase().includes('menu') ||
      node.name.toLowerCase().includes('header') ||
      node.name.toLowerCase().includes('navbar') ||
      node.name.toLowerCase().includes('navigation') ||
      node.name.toLowerCase().includes('breadcrumb') ||
      isNavigationLike(node)
    ) {
      // Identificar tipo de navegación
      let navType = 'unknown';
      if (node.name.toLowerCase().includes('header') || node.layoutMode === 'HORIZONTAL') {
        navType = 'header';
      } else if (node.name.toLowerCase().includes('sidebar') || 
                node.layoutMode === 'VERTICAL') {
        navType = 'sidebar';
      } else if (node.name.toLowerCase().includes('breadcrumb')) {
        navType = 'breadcrumb';
      } else if (node.name.toLowerCase().includes('tab')) {
        navType = 'tabs';
      } else if (node.name.toLowerCase().includes('pagination')) {
        navType = 'pagination';
      }
      
      // Contar elementos de navegación
      const navItems = [];
      
      // Si tiene hijos, analizar estructura
      if (node.children) {
        let hasActiveItem = false;
        
        for (const child of node.children) {
          // Verificar si parece un ítem de navegación
          if (isNavigationItem(child)) {
            // Determinar si está activo
            const isActive = child.name.toLowerCase().includes('active') || 
                             (child.fills && 
                              child.fills.some((fill: any) => 
                                fill.opacity > 0.8
                              ));
                              
            if (isActive) {
              hasActiveItem = true;
            }
            
            navItems.push({
              id: child.id,
              name: child.name,
              isActive
            });
          }
          
          // Buscar ítems anidados
          if (child.children && currentDepth < maxDepth) {
            findNavigationItemsRecursively(child, navItems, currentDepth + 1);
          }
        }
        
        navigationPatterns.push({
          id: node.id,
          name: node.name,
          path: nodePath,
          type: navType,
          itemCount: navItems.length,
          hasActiveItem,
          items: navItems.slice(0, 5) // Limitar para evitar respuestas muy grandes
        });
      }
    }
    
    // Recursivamente buscar en hijos
    if (node.children && currentDepth < maxDepth) {
      for (const child of node.children) {
        findNavigationElements(child, currentDepth + 1, nodePath);
      }
    }
  };
  
  // Iniciar búsqueda desde el nodo raíz
  findNavigationElements(node);
  
  return navigationPatterns;
}

/**
 * Función auxiliar para verificar si un nodo parece un elemento de navegación
 */
function isNavigationLike(node: any): boolean {
  if (!node.children || node.children.length < 2) {
    return false;
  }
  
  // Verificar si tiene varios elementos de texto o botones en línea
  let textOrButtonCount = 0;
  let linkLikeCount = 0;
  
  for (const child of node.children) {
    if (child.type === 'TEXT' || isButton(child)) {
      textOrButtonCount++;
    }
    
    // Verificar si parece un enlace
    if (child.type === 'TEXT' && 
        child.textDecoration === 'UNDERLINE') {
      linkLikeCount++;
    }
  }
  
  return textOrButtonCount >= 3 || linkLikeCount >= 2;
}

/**
 * Función auxiliar para verificar si un nodo parece un ítem de navegación
 */
function isNavigationItem(node: any): boolean {
  // Si es texto, probablemente es un ítem de navegación
  if (node.type === 'TEXT') {
    return true;
  }
  
  // Si es un botón, también puede ser un ítem de navegación
  if (isButton(node)) {
    return true;
  }
  
  // Si contiene texto, verificar
  if (node.children && 
      node.children.some((child: any) => child.type === 'TEXT')) {
    return true;
  }
  
  return false;
}

/**
 * Función auxiliar para buscar ítems de navegación anidados
 */
function findNavigationItemsRecursively(node: any, items: any[], currentDepth: number): void {
  // Limitar la profundidad para evitar recursión excesiva
  if (currentDepth > 5) return;
  
  if (isNavigationItem(node)) {
    // Determinar si está activo
    const isActive = node.name.toLowerCase().includes('active') || 
                   (node.fills && 
                    node.fills.some((fill: any) => 
                      fill.opacity > 0.8
                    ));
                    
    items.push({
      id: node.id,
      name: node.name,
      isActive
    });
  }
  
  if (node.children) {
    for (const child of node.children) {
      findNavigationItemsRecursively(child, items, currentDepth + 1);
    }
  }
}

/**
 * Verifica si un nodo parece un botón
 */
function isButton(node: any): boolean {
  // Si el nombre contiene "botón" o "button", probablemente es un botón
  if (node.name.toLowerCase().includes('button') || 
      node.name.toLowerCase().includes('botón') || 
      node.name.toLowerCase().includes('btn')) {
    return true;
  }
  
  // Si tiene características visuales de botón (bordes redondeados, relleno sólido)
  if (node.cornerRadius && node.cornerRadius > 0) {
    if (node.fills && node.fills.some((fill: any) => 
        fill.type === 'SOLID' && fill.opacity > 0)) {
      return true;
    }
  }
  
  // Si es un rectángulo con texto dentro, puede ser un botón
  if (node.type === 'RECTANGLE' || node.type === 'FRAME') {
    if (node.children && 
        node.children.some((child: any) => child.type === 'TEXT')) {
      // Verificar si tiene estilos típicos de botón
      if (node.cornerRadius && node.cornerRadius > 0) {
        return true;
      }
      
      // Verificar si tiene efectos de sombra (común en botones)
      if (node.effects && 
          node.effects.some((effect: any) => effect.type === 'DROP_SHADOW')) {
        return true;
      }
      
      // Verificar si es interactivo
      if (node.isClickable) {
        return true;
      }
    }
  }
  
  // Si es un componente con la palabra clave
  if ((node.type === 'COMPONENT' || node.type === 'INSTANCE') && 
      (node.name.toLowerCase().includes('button') || 
       node.name.toLowerCase().includes('botón') || 
       node.name.toLowerCase().includes('btn'))) {
    return true;
  }
  
  return false;
}

/**
 * Detecta patrones de listas en un nodo de Figma
 */
function detectListPatterns(node: any, maxDepth: number): any[] {
  const listPatterns = [];
  
  // Implementación básica para evitar timeouts
  const findListElements = (node: any, currentDepth: number = 0, path: string = ''): void => {
    if (currentDepth > maxDepth) return;
    
    const nodePath = path ? `${path} > ${node.name}` : node.name;
    
    // Lógica simplificada para detectar listas
    if (node.name.toLowerCase().includes('list') || isListLike(node)) {
      listPatterns.push({
        id: node.id,
        name: node.name,
        path: nodePath,
        itemCount: node.children ? node.children.length : 0
      });
    }
    
    // Recursión controlada
    if (node.children && currentDepth < maxDepth) {
      for (const child of node.children) {
        findListElements(child, currentDepth + 1, nodePath);
      }
    }
  };
  
  findListElements(node);
  return listPatterns;
}

/**
 * Determina si un nodo parece una lista
 */
function isListLike(node: any): boolean {
  if (!node.children || node.children.length < 2) {
    return false;
  }
  
  // Verificar si hay elementos repetitivos
  const childTypes = node.children.map((child: any) => child.type);
  const uniqueTypes = new Set(childTypes);
  
  // Si hay varios hijos del mismo tipo
  if (childTypes.length > 2 && uniqueTypes.size === 1) {
    return true;
  }
  
  // Verificar estructura similar de hijos
  if (node.children.length >= 3) {
    const sameHeight = node.children.every((child: any, i: number, arr: any[]) => 
      i === 0 || Math.abs(child.height - arr[0].height) < 2
    );
    
    if (sameHeight) {
      return true;
    }
  }
  
  return false;
}

/**
 * Detecta patrones de tarjetas en un nodo de Figma
 */
function detectCardPatterns(node: any, maxDepth: number): any[] {
  // Implementación simplificada para evitar timeouts
  return [];
}

/**
 * Detecta patrones de tablas en un nodo de Figma
 */
function detectTablePatterns(node: any, maxDepth: number): any[] {
  // Implementación simplificada para evitar timeouts
  return [];
}

/**
 * Detecta patrones de modales en un nodo de Figma
 */
function detectModalPatterns(node: any, maxDepth: number): any[] {
  // Implementación simplificada para evitar timeouts
  return [];
}

/**
 * Detecta patrones de tabs en un nodo de Figma
 */
function detectTabPatterns(node: any, maxDepth: number): any[] {
  // Implementación simplificada para evitar timeouts
  return [];
}

/**
 * Detecta patrones de acordeones en un nodo de Figma
 */
function detectAccordionPatterns(node: any, maxDepth: number): any[] {
  // Implementación simplificada para evitar timeouts
  return [];
}

/**
 * Detecta patrones de botones en un nodo de Figma
 */
function detectButtonPatterns(node: any, maxDepth: number): any[] {
  // Implementación simplificada para evitar timeouts
  return [];
}
/**
 * Herramientas para analizar componentes de Figma
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendCommandToFigma } from "../core/figma-connection";
import { componentNameFromFigma } from "../utils/figma-utils";

/**
 * Registra las herramientas de análisis de componentes en el servidor MCP
 */
export function registerComponentTools(server: McpServer): void {
  // Analyzer Component Hierarchy Tool
  server.tool(
    "analyze_component_hierarchy",
    "Analizar la estructura jerárquica de componentes para recomendar implementación en código",
    {
      nodeId: z.string().describe("ID del componente o frame a analizar"),
      depth: z.number().int().min(1).max(10).default(5).describe("Profundidad del análisis"),
      framework: z.enum(["react", "vue", "angular", "html"]).default("react").describe("Framework objetivo")
    },
    async ({ nodeId, depth, framework }) => {
      try {
        // Mensaje inicial
        const initialStatus = {
          type: "text" as const,
          text: `Iniciando análisis de jerarquía del componente. Profundidad máxima: ${depth}. Framework objetivo: ${framework}`
        };

        // Obtener información del nodo
        const nodeInfo = await sendCommandToFigma("get_node_info", { nodeId });
        
        // Analizar la jerarquía del componente
        const hierarchyAnalysis = analyzeComponentHierarchy(nodeInfo, depth, framework);
        
        return {
          content: [
            initialStatus,
            {
              type: "text" as const,
              text: JSON.stringify(hierarchyAnalysis, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error al analizar la jerarquía del componente: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

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

        // Obtener información del nodo
        const nodeInfo = await sendCommandToFigma("get_node_info", { nodeId });
        
        // Detectar patrones de UI
        const detectedPatterns = detectUIPatterns(nodeInfo, patternTypes);
        
        return {
          content: [
            initialStatus,
            {
              type: "text" as const,
              text: JSON.stringify({ patterns: detectedPatterns }, null, 2)
            }
          ]
        };
      } catch (error) {
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

  // Analizador de Estados de Componentes
  server.tool(
    "analyze_component_states",
    "Examinar las variantes de un componente para identificar sus posibles estados y condiciones",
    {
      componentId: z.string().describe("ID del componente a analizar"),
      includeVariants: z.boolean().default(true).describe("Booleano para incluir análisis de todas las variantes")
    },
    async ({ componentId, includeVariants }) => {
      try {
        // Mensaje inicial
        const initialStatus = {
          type: "text" as const,
          text: `Iniciando análisis de estados del componente. ${includeVariants ? 'Incluyendo todas las variantes.' : 'Solo analizando componente principal.'}`
        };

        // Obtener información del componente
        const componentInfo = await sendCommandToFigma("get_node_info", { nodeId: componentId });
        
        // Obtener variantes si es necesario
        let variantsInfo = [];
        if (includeVariants) {
          // Intentar obtener variantes basadas en el nombre del componente
          const componentName = componentInfo.name;
          const componentsResult = await sendCommandToFigma("get_local_components");
          
          // Filtrar componentes que parecen ser variantes del componente actual
          variantsInfo = componentsResult.filter((comp: any) => {
            // Verificar si es parte de la misma familia de componentes
            return comp.id !== componentId && 
                   isComponentVariant(comp.name, componentName);
          });
        }
        
        // Analizar estados del componente
        const statesAnalysis = analyzeComponentStates(componentInfo, variantsInfo);
        
        return {
          content: [
            initialStatus,
            {
              type: "text" as const,
              text: JSON.stringify(statesAnalysis, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error al analizar estados del componente: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );
}

/**
 * Analiza la estructura jerárquica de un componente
 */
function analyzeComponentHierarchy(nodeInfo: any, maxDepth: number, framework: string): any {
  // Extraer información del nodo raíz
  const rootName = nodeInfo.name || "Componente sin nombre";
  
  // Analizar la estructura de árbol recursivamente
  const hierarchyTree = buildHierarchyTree(nodeInfo, 0, maxDepth);
  
  // Identificar componentes atómicos y compuestos
  const componentTypes = identifyComponentTypes(hierarchyTree);
  
  // Inferir elementos HTML semánticos
  const semanticStructure = inferSemanticElements(hierarchyTree, framework);
  
  // Generar sugerencias de implementación
  const implementationSuggestions = generateImplementationSuggestions(
    hierarchyTree, 
    componentTypes, 
    semanticStructure, 
    framework
  );
  
  // Estructura del resultado
  return {
    hierarchy: {
      root: hierarchyTree
    },
    implementation: implementationSuggestions
  };
}

/**
 * Construye un árbol jerárquico del componente recursivamente
 */
function buildHierarchyTree(node: any, currentDepth: number, maxDepth: number): any {
  if (!node || currentDepth > maxDepth) {
    return null;
  }
  
  // Información básica del nodo
  const nodeInfo = {
    id: node.id,
    name: node.name || `Unnamed ${node.type}`,
    type: node.type,
    properties: extractNodeProperties(node),
    semanticElement: inferElementType(node),
    children: []
  };
  
  // Procesar hijos recursivamente si existen y no se ha alcanzado la profundidad máxima
  if (node.children && node.children.length > 0 && currentDepth < maxDepth) {
    nodeInfo.children = node.children
      .map((child: any) => buildHierarchyTree(child, currentDepth + 1, maxDepth))
      .filter((child: any) => child !== null); // Filtrar nulos
  }
  
  return nodeInfo;
}

/**
 * Extrae propiedades relevantes del nodo para análisis
 */
function extractNodeProperties(node: any): any {
  const properties: any = {
    visual: {},
    layout: {},
    interactive: {}
  };
  
  // Propiedades visuales
  if (node.fills && node.fills.length > 0) {
    properties.visual.fills = node.fills;
  }
  
  if (node.strokes && node.strokes.length > 0) {
    properties.visual.strokes = node.strokes;
  }
  
  if (node.cornerRadius !== undefined) {
    properties.visual.cornerRadius = node.cornerRadius;
  }
  
  if (node.style) {
    properties.visual.typography = {
      fontFamily: node.style.fontFamily,
      fontSize: node.style.fontSize,
      fontWeight: node.style.fontWeight,
      lineHeight: node.style.lineHeightPx,
      letterSpacing: node.style.letterSpacing,
      textAlign: node.style.textAlignHorizontal
    };
  }
  
  // Propiedades de layout
  if (node.absoluteBoundingBox) {
    properties.layout.width = node.absoluteBoundingBox.width;
    properties.layout.height = node.absoluteBoundingBox.height;
  }
  
  // Inferir propiedades de layout avanzadas
  if (node.layoutMode) {
    properties.layout.type = node.layoutMode === 'HORIZONTAL' ? 'flexbox-row' : 'flexbox-column';
    properties.layout.spacing = node.itemSpacing;
    properties.layout.padding = {
      top: node.paddingTop,
      right: node.paddingRight,
      bottom: node.paddingBottom,
      left: node.paddingLeft
    };
  } else if (node.children && node.children.length > 0) {
    // Inferir grid si tiene varios hijos con posiciones regulares
    properties.layout.type = inferLayoutSystem(node);
  }
  
  // Propiedades interactivas (inferidas por nombrado y estructura)
  properties.interactive.isClickable = inferIsClickable(node);
  if (node.name && (/button|btn/i.test(node.name) || /click|tap/i.test(node.name))) {
    properties.interactive.role = 'button';
  }
  
  return properties;
}

/**
 * Infiere el tipo de elemento HTML semántico basado en propiedades del nodo
 */
function inferElementType(node: any): string {
  // Texto
  if (node.type === 'TEXT') {
    // Inferir elementos de título por el tamaño de fuente
    if (node.style && node.style.fontSize) {
      const size = node.style.fontSize;
      if (size >= 32) return 'h1';
      if (size >= 24) return 'h2';
      if (size >= 20) return 'h3';
      if (size >= 18) return 'h4';
      if (size >= 16) return 'h5';
      if (size >= 14) return 'p';
    }
    return 'p';
  }
  
  // Otros tipos basados en nombre y estructura
  if (/button|btn/i.test(node.name)) return 'button';
  if (/card|tarjeta/i.test(node.name)) return 'article';
  if (/nav|menu|navegación/i.test(node.name)) return 'nav';
  if (/list|lista/i.test(node.name)) return 'ul';
  if (/item/i.test(node.name) && node.parent && /list|lista/i.test(node.parent.name)) return 'li';
  if (/header|cabecera/i.test(node.name)) return 'header';
  if (/footer|pie/i.test(node.name)) return 'footer';
  if (/input|campo/i.test(node.name)) return 'input';
  
  // Por defecto
  return node.type === 'FRAME' ? 'div' : 'span';
}

/**
 * Infiere el sistema de layout utilizado
 */
function inferLayoutSystem(node: any): string {
  // Si tiene layoutMode, ya sabemos que es flexbox
  if (node.layoutMode) {
    return node.layoutMode === 'HORIZONTAL' ? 'flexbox-row' : 'flexbox-column';
  }
  
  // Si tiene children y no tiene layoutMode explícito, intentamos inferir
  if (node.children && node.children.length > 2) {
    // Check for grid pattern
    const positions = node.children.map((child: any) => ({
      x: child.absoluteBoundingBox ? child.absoluteBoundingBox.x : 0,
      y: child.absoluteBoundingBox ? child.absoluteBoundingBox.y : 0
    }));
    
    // Analizar patrones de posición para inferir grid o flexbox
    const uniqueXPositions = new Set(positions.map((p: any) => p.x)).size;
    const uniqueYPositions = new Set(positions.map((p: any) => p.y)).size;
    
    if (uniqueXPositions > 1 && uniqueYPositions > 1) {
      return 'grid';
    } else if (uniqueXPositions > 1) {
      return 'flexbox-row';
    } else if (uniqueYPositions > 1) {
      return 'flexbox-column';
    }
  }
  
  // Por defecto
  return 'position';
}

/**
 * Infiere si un nodo es probable que sea clickeable
 */
function inferIsClickable(node: any): boolean {
  // Inferir por nombre
  if (/button|btn|click|tap|link|enlace/i.test(node.name)) {
    return true;
  }
  
  // Inferir por presencia de texto en nodo con fondo y bordes
  if (
    node.fills && 
    node.fills.length > 0 && 
    node.children && 
    node.children.some((child: any) => child.type === 'TEXT')
  ) {
    return true;
  }
  
  return false;
}

/**
 * Identifica y clasifica los tipos de componentes en el árbol
 */
function identifyComponentTypes(hierarchyTree: any): any {
  const components = {
    atomic: [],
    composite: []
  };
  
  // Función recursiva para recorrer el árbol
  const processNode = (node: any, path: string[] = []) => {
    const currentPath = [...path, node.name];
    
    // Identificar componente atómico vs compuesto
    const isAtomic = isAtomicComponent(node);
    const componentInfo = {
      id: node.id,
      name: node.name,
      path: currentPath.join('/'),
      type: node.type,
      properties: node.properties
    };
    
    if (isAtomic) {
      components.atomic.push(componentInfo);
    } else {
      components.composite.push(componentInfo);
    }
    
    // Procesar hijos
    if (node.children && node.children.length > 0) {
      node.children.forEach((child: any) => processNode(child, currentPath));
    }
  };
  
  processNode(hierarchyTree);
  
  return components;
}

/**
 * Determina si un componente es atómico (no se puede descomponer más)
 */
function isAtomicComponent(node: any): boolean {
  // Si es un tipo básico o no tiene hijos, es atómico
  if (
    node.type === 'TEXT' || 
    node.type === 'VECTOR' || 
    node.type === 'ELLIPSE' || 
    node.type === 'LINE' || 
    !node.children || 
    node.children.length === 0
  ) {
    return true;
  }
  
  // Si tiene un solo hijo de tipo TEXT, es atómico (ej: botón simple)
  if (
    node.children.length === 1 && 
    node.children[0].type === 'TEXT'
  ) {
    return true;
  }
  
  // Si tiene menos de 3 hijos y es pequeño, probablemente es atómico
  if (
    node.children.length <= 2 && 
    node.properties && 
    node.properties.layout && 
    node.properties.layout.width && 
    node.properties.layout.width < 200
  ) {
    return true;
  }
  
  // Por defecto, considerarlo compuesto
  return false;
}

/**
 * Infiere elementos HTML semánticos para toda la estructura
 */
function inferSemanticElements(hierarchyTree: any, framework: string): any {
  // Función recursiva para inferir elementos semánticos
  const processNode = (node: any) => {
    // Ya tiene un elemento semántico inferido
    const element = node.semanticElement;
    
    // Procesar hijos
    const processedChildren = node.children && node.children.length > 0
      ? node.children.map(processNode)
      : [];
    
    return {
      id: node.id,
      name: node.name,
      element: element,
      children: processedChildren
    };
  };
  
  return processNode(hierarchyTree);
}

/**
 * Genera sugerencias de implementación basadas en el framework objetivo
 */
function generateImplementationSuggestions(
  hierarchyTree: any, 
  componentTypes: any, 
  semanticStructure: any, 
  framework: string
): any {
  // Determinar estructura de componentes
  const componentStructure = suggestComponentStructure(hierarchyTree, framework);
  
  // Generar propTypes/interfaces
  const propTypes = generatePropTypes(hierarchyTree, framework);
  
  // Generar snippets de código según el framework
  const codeSnippets = generateCodeSnippets(semanticStructure, framework);
  
  return {
    componentStructure,
    propTypes,
    codeSnippets: {
      framework,
      snippets: codeSnippets
    }
  };
}

/**
 * Detecta patrones de UI en un nodo de Figma
 */
function detectUIPatterns(nodeInfo: any, patternTypes: string[]): any[] {
  const detectedPatterns = [];
  
  // Analizar el nodo para cada tipo de patrón solicitado
  for (const patternType of patternTypes) {
    switch (patternType) {
      case 'forms':
        const formPatterns = detectFormPatterns(nodeInfo);
        detectedPatterns.push(...formPatterns);
        break;
      case 'lists':
        const listPatterns = detectListPatterns(nodeInfo);
        detectedPatterns.push(...listPatterns);
        break;
      case 'cards':
        const cardPatterns = detectCardPatterns(nodeInfo);
        detectedPatterns.push(...cardPatterns);
        break;
      case 'navigation':
        const navigationPatterns = detectNavigationPatterns(nodeInfo);
        detectedPatterns.push(...navigationPatterns);
        break;
      case 'tables':
        const tablePatterns = detectTablePatterns(nodeInfo);
        detectedPatterns.push(...tablePatterns);
        break;
      case 'modals':
        const modalPatterns = detectModalPatterns(nodeInfo);
        detectedPatterns.push(...modalPatterns);
        break;
      case 'tabs':
        const tabPatterns = detectTabPatterns(nodeInfo);
        detectedPatterns.push(...tabPatterns);
        break;
      case 'accordions':
        const accordionPatterns = detectAccordionPatterns(nodeInfo);
        detectedPatterns.push(...accordionPatterns);
        break;
      case 'buttons':
        const buttonPatterns = detectButtonPatterns(nodeInfo);
        detectedPatterns.push(...buttonPatterns);
        break;
    }
  }
  
  return detectedPatterns;
}

/**
 * Verifica si un componente es una variante de otro
 */
function isComponentVariant(componentName: string, baseName: string): boolean {
  // Verificar si tienen el mismo nombre base (antes de cualquier variante)
  // Por ejemplo: "Button/Primary" y "Button/Secondary" tienen el mismo nombre base "Button"
  
  // Extraer nombre base antes de '/' si existe
  const baseComponent = baseName.split('/')[0].trim();
  
  // Si el componente contiene el nombre base al inicio, es una potencial variante
  return componentName.startsWith(baseComponent);
}

/**
 * Analiza los estados de un componente y sus variantes
 */
function analyzeComponentStates(componentInfo: any, variantsInfo: any[]): any {
  // Extraer estados del componente principal
  const states = extractComponentStates(componentInfo);
  
  // Analizar variantes para identificar estados adicionales
  const variantStates = variantsInfo.map((variant) => {
    // Comparar con el componente principal para identificar diferencias
    const visualChanges = compareVisualProperties(componentInfo, variant);
    const nameInfo = extractStateInfoFromName(variant.name, componentInfo.name);
    
    return {
      name: nameInfo.stateName || 'variant',
      variants: [variant.id],
      visualChanges,
      conditions: {
        props: inferPropsFromName(nameInfo),
        interactions: inferInteractionsFromName(nameInfo)
      }
    };
  });
  
  // Combinar estados similares
  const combinedStates = combineStates([...states, ...variantStates]);
  
  // Determinar posibles transiciones entre estados
  const transitions = inferStateTransitions(combinedStates);
  
  // Generar sugerencias de implementación
  const implementationSuggestions = generateStateImplementationSuggestions(
    combinedStates,
    transitions,
    componentInfo
  );
  
  return {
    states: combinedStates,
    transitions,
    implementationSuggestions
  };
}

/**
 * Extrae información de estados del nombre de una variante
 */
function extractStateInfoFromName(variantName: string, baseName: string): any {
  // Eliminar el nombre base para obtener solo la parte de variante
  let statePart = variantName;
  if (baseName && variantName.startsWith(baseName.split('/')[0])) {
    statePart = variantName.substring(baseName.split('/')[0].length).trim();
  }
  
  // Eliminar caracteres separadores
  statePart = statePart.replace(/^[\/\-_\s]+/, '');
  
  // Buscar palabras clave de estados comunes
  const stateKeywords = {
    default: ['default', 'normal', 'base', 'inicial'],
    hover: ['hover', 'over'],
    active: ['active', 'pressed', 'activo', 'presionado'],
    focus: ['focus', 'focused', 'enfocado'],
    disabled: ['disabled', 'inactive', 'deshabilitado', 'inactivo'],
    error: ['error', 'invalid', 'inválido'],
    success: ['success', 'valid', 'válido', 'éxito'],
    loading: ['loading', 'cargando', 'wait', 'espera'],
    selected: ['selected', 'seleccionado', 'chosen'],
    expanded: ['expanded', 'expandido', 'open', 'abierto'],
    collapsed: ['collapsed', 'colapsado', 'closed', 'cerrado']
  };
  
  // Determinar el estado basado en palabras clave
  let stateName = 'unknown';
  let stateType = 'visual';
  
  for (const [state, keywords] of Object.entries(stateKeywords)) {
    if (keywords.some(keyword => 
      new RegExp(`\\b${keyword}\\b`, 'i').test(statePart)
    )) {
      stateName = state;
      break;
    }
  }
  
  // Determinar tipo de estado (interactivo, datos, etc.)
  if (/hover|focus|active|pressed/i.test(statePart)) {
    stateType = 'interaction';
  } else if (/disabled|enabled|readonly/i.test(statePart)) {
    stateType = 'capability';
  } else if (/error|success|warning|info/i.test(statePart)) {
    stateType = 'feedback';
  } else if (/loading|wait/i.test(statePart)) {
    stateType = 'loading';
  } else if (/selected|checked|expanded|collapsed/i.test(statePart)) {
    stateType = 'selection';
  }
  
  return {
    stateName,
    stateType,
    fullStatePart: statePart
  };
}

/**
 * Infiere propiedades que activarían este estado basado en su nombre
 */
function inferPropsFromName(nameInfo: any): any[] {
  const props = [];
  
  if (!nameInfo) return props;
  
  // Mapeo de estados a propiedades comunes
  const stateToProps = {
    disabled: [{ name: 'disabled', value: true }],
    error: [{ name: 'error', value: true }, { name: 'isValid', value: false }],
    success: [{ name: 'success', value: true }, { name: 'isValid', value: true }],
    selected: [{ name: 'selected', value: true }, { name: 'isSelected', value: true }],
    expanded: [{ name: 'expanded', value: true }, { name: 'isOpen', value: true }],
    collapsed: [{ name: 'collapsed', value: true }, { name: 'isOpen', value: false }],
    loading: [{ name: 'loading', value: true }, { name: 'isLoading', value: true }]
  };
  
  // Añadir propiedades correspondientes al estado
  if (nameInfo.stateName && stateToProps[nameInfo.stateName]) {
    props.push(...stateToProps[nameInfo.stateName]);
  }
  
  // Verificar si hay información de tamaño en el nombre
  if (/\b(small|sm|pequeño)\b/i.test(nameInfo.fullStatePart)) {
    props.push({ name: 'size', value: 'small' });
  } else if (/\b(large|lg|grande)\b/i.test(nameInfo.fullStatePart)) {
    props.push({ name: 'size', value: 'large' });
  }
  
  // Verificar si hay información de variante en el nombre
  if (/\b(outline|outlined|borde)\b/i.test(nameInfo.fullStatePart)) {
    props.push({ name: 'variant', value: 'outlined' });
  } else if (/\b(text|texto|plain|plano)\b/i.test(nameInfo.fullStatePart)) {
    props.push({ name: 'variant', value: 'text' });
  } else if (/\b(contained|fill|filled|relleno)\b/i.test(nameInfo.fullStatePart)) {
    props.push({ name: 'variant', value: 'contained' });
  }
  
  return props;
}

/**
 * Infiere interacciones que activarían este estado basado en su nombre
 */
function inferInteractionsFromName(nameInfo: any): any[] {
  const interactions = [];
  
  if (!nameInfo) return interactions;
  
  // Mapeo de estados a interacciones comunes
  const stateToInteractions = {
    hover: [{ type: 'hover', description: 'Mouse over the component' }],
    active: [{ type: 'press', description: 'Mouse or touch press on the component' }],
    focus: [{ type: 'focus', description: 'Component receives focus' }],
    selected: [{ type: 'click', description: 'Click or tap on the component' }],
    expanded: [{ type: 'click', description: 'Click to expand' }],
    collapsed: [{ type: 'click', description: 'Click to collapse' }]
  };
  
  // Añadir interacciones correspondientes al estado
  if (nameInfo.stateName && stateToInteractions[nameInfo.stateName]) {
    interactions.push(...stateToInteractions[nameInfo.stateName]);
  }
  
  return interactions;
}

/**
 * Extrae estados del componente principal (si tiene subnodos que indican estados)
 */
function extractComponentStates(componentInfo: any): any[] {
  const states = [];
  
  // Si el nombre contiene estado, añadir como estado default
  const nameInfo = extractStateInfoFromName(componentInfo.name, '');
  if (nameInfo.stateName !== 'unknown') {
    states.push({
      name: nameInfo.stateName,
      variants: [componentInfo.id],
      visualChanges: [],
      conditions: {
        props: inferPropsFromName(nameInfo),
        interactions: inferInteractionsFromName(nameInfo)
      }
    });
  } else {
    // Si no tiene un estado específico, asumimos que es el estado default
    states.push({
      name: 'default',
      variants: [componentInfo.id],
      visualChanges: [],
      conditions: {
        props: [],
        interactions: []
      }
    });
  }
  
  return states;
}

/**
 * Compara propiedades visuales entre dos componentes para identificar cambios
 */
function compareVisualProperties(baseComponent: any, variantComponent: any): any[] {
  const changes = [];
  
  // Comparar propiedades básicas
  if (baseComponent.fills !== variantComponent.fills) {
    changes.push({
      property: 'fill',
      from: summarizeFills(baseComponent.fills),
      to: summarizeFills(variantComponent.fills)
    });
  }
  
  if (baseComponent.strokes !== variantComponent.strokes) {
    changes.push({
      property: 'stroke',
      from: summarizeStrokes(baseComponent.strokes),
      to: summarizeStrokes(variantComponent.strokes)
    });
  }
  
  if (baseComponent.cornerRadius !== variantComponent.cornerRadius) {
    changes.push({
      property: 'cornerRadius',
      from: baseComponent.cornerRadius,
      to: variantComponent.cornerRadius
    });
  }
  
  // Comparar dimensiones si son diferentes
  if (
    baseComponent.absoluteBoundingBox && 
    variantComponent.absoluteBoundingBox
  ) {
    const baseBounds = baseComponent.absoluteBoundingBox;
    const variantBounds = variantComponent.absoluteBoundingBox;
    
    if (baseBounds.width !== variantBounds.width) {
      changes.push({
        property: 'width',
        from: baseBounds.width,
        to: variantBounds.width
      });
    }
    
    if (baseBounds.height !== variantBounds.height) {
      changes.push({
        property: 'height',
        from: baseBounds.height,
        to: variantBounds.height
      });
    }
  }
  
  // Comparar opacidad
  if (baseComponent.opacity !== variantComponent.opacity) {
    changes.push({
      property: 'opacity',
      from: baseComponent.opacity,
      to: variantComponent.opacity
    });
  }
  
  return changes;
}

/**
 * Simplifica la descripción de un fill para comparación
 */
function summarizeFills(fills: any): string {
  if (!fills || fills.length === 0) {
    return 'none';
  }
  
  // Para simplificar, solo consideramos el primer fill
  const primaryFill = fills[0];
  
  if (primaryFill.type === 'SOLID') {
    return primaryFill.color || 'solid color';
  }
  
  return primaryFill.type || 'fill';
}

/**
 * Simplifica la descripción de un stroke para comparación
 */
function summarizeStrokes(strokes: any): string {
  if (!strokes || strokes.length === 0) {
    return 'none';
  }
  
  // Para simplificar, solo consideramos el primer stroke
  const primaryStroke = strokes[0];
  
  return `${primaryStroke.color || 'color'} (${primaryStroke.weight || 1}px)`;
}

/**
 * Combina estados similares para reducir duplicados
 */
function combineStates(states: any[]): any[] {
  // Agrupar estados por nombre
  const statesByName: {[key: string]: any[]} = {};
  
  states.forEach(state => {
    if (!statesByName[state.name]) {
      statesByName[state.name] = [];
    }
    statesByName[state.name].push(state);
  });
  
  // Combinar estados con el mismo nombre
  return Object.entries(statesByName).map(([name, similarStates]) => {
    // Si solo hay un estado con este nombre, devolverlo como está
    if (similarStates.length === 1) {
      return similarStates[0];
    }
    
    // Combinar múltiples estados
    const combinedState = {
      name,
      variants: [] as string[],
      visualChanges: [] as any[],
      conditions: {
        props: [] as any[],
        interactions: [] as any[]
      }
    };
    
    // Unir todas las variantes
    similarStates.forEach(state => {
      combinedState.variants.push(...state.variants);
      
      // Unir cambios visuales (eliminar duplicados)
      state.visualChanges.forEach((change: any) => {
        if (!combinedState.visualChanges.some(c => c.property === change.property)) {
          combinedState.visualChanges.push(change);
        }
      });
      
      // Unir propiedades (eliminar duplicados)
      state.conditions.props.forEach((prop: any) => {
        if (!combinedState.conditions.props.some(p => p.name === prop.name)) {
          combinedState.conditions.props.push(prop);
        }
      });
      
      // Unir interacciones (eliminar duplicados)
      state.conditions.interactions.forEach((interaction: any) => {
        if (!combinedState.conditions.interactions.some(i => i.type === interaction.type)) {
          combinedState.conditions.interactions.push(interaction);
        }
      });
    });
    
    return combinedState;
  });
}

/**
 * Infiere posibles transiciones entre estados
 */
function inferStateTransitions(states: any[]): any[] {
  const transitions = [];
  
  // Definir estados que pueden transicionar entre sí
  const transitionMap: {[key: string]: string[]} = {
    'default': ['hover', 'focus', 'active', 'disabled', 'loading', 'error', 'success'],
    'hover': ['default', 'active', 'focus'],
    'active': ['default', 'hover', 'focus'],
    'focus': ['default', 'hover', 'active'],
    'disabled': ['default'],
    'loading': ['default', 'success', 'error'],
    'error': ['default', 'focus'],
    'success': ['default', 'focus'],
    'selected': ['default', 'hover', 'focus'],
    'expanded': ['collapsed', 'default'],
    'collapsed': ['expanded', 'default']
  };
  
  // Crear transiciones para cada estado que tenga destinos definidos
  states.forEach(fromState => {
    const possibleDestinations = transitionMap[fromState.name] || [];
    
    possibleDestinations.forEach(toStateName => {
      const toState = states.find(s => s.name === toStateName);
      if (!toState) return;
      
      let trigger = '';
      let condition = '';
      
      // Determinar el trigger y condición apropiados para esta transición
      if (fromState.name === 'default' && toState.name === 'hover') {
        trigger = 'mouseenter';
        condition = 'User hovers over component';
      } else if (fromState.name === 'hover' && toState.name === 'default') {
        trigger = 'mouseleave';
        condition = 'User moves mouse away from component';
      } else if (fromState.name === 'default' && toState.name === 'active') {
        trigger = 'mousedown';
        condition = 'User presses mouse button on component';
      } else if (fromState.name === 'active' && toState.name === 'default') {
        trigger = 'mouseup';
        condition = 'User releases mouse button';
      } else if (toState.name === 'focus') {
        trigger = 'focus';
        condition = 'Component receives focus';
      } else if (fromState.name === 'focus' && toState.name === 'default') {
        trigger = 'blur';
        condition = 'Component loses focus';
      } else if (toState.name === 'disabled') {
        trigger = 'prop change';
        condition = 'disabled prop set to true';
      } else if (fromState.name === 'disabled' && toState.name === 'default') {
        trigger = 'prop change';
        condition = 'disabled prop set to false';
      } else if (fromState.name === 'collapsed' && toState.name === 'expanded') {
        trigger = 'click';
        condition = 'User clicks to expand';
      } else if (fromState.name === 'expanded' && toState.name === 'collapsed') {
        trigger = 'click';
        condition = 'User clicks to collapse';
      } else if (fromState.name === 'default' && toState.name === 'loading') {
        trigger = 'async operation';
        condition = 'Component starts loading data';
      } else if (fromState.name === 'loading' && toState.name === 'success') {
        trigger = 'async complete';
        condition = 'Operation completes successfully';
      } else if (fromState.name === 'loading' && toState.name === 'error') {
        trigger = 'async error';
        condition = 'Operation fails';
      }
      
      if (trigger) {
        transitions.push({
          from: fromState.name,
          to: toState.name,
          trigger,
          condition
        });
      }
    });
  });
  
  return transitions;
}

/**
 * Genera sugerencias de implementación para estados de componente
 */
function generateStateImplementationSuggestions(
  states: any[],
  transitions: any[],
  componentInfo: any
): any {
  // Analizar características del componente para determinar mejores prácticas
  const hasInteractiveStates = states.some(s => 
    ['hover', 'active', 'focus'].includes(s.name)
  );
  
  const hasDataStates = states.some(s => 
    ['loading', 'error', 'success'].includes(s.name)
  );
  
  const hasSelectionStates = states.some(s => 
    ['selected', 'checked', 'expanded', 'collapsed'].includes(s.name)
  );
  
  // Determinar enfoque de gestión de estado
  let stateManagement = 'CSS-only states';
  if (hasInteractiveStates && !hasDataStates && !hasSelectionStates) {
    stateManagement = 'CSS pseudo-classes (:hover, :active, :focus)';
  } else if (hasSelectionStates || hasDataStates) {
    stateManagement = 'React useState with conditional rendering';
  }
  
  // Generar sugerencias CSS
  const cssImplementation = [];
  
  if (hasInteractiveStates) {
    cssImplementation.push(
      `Use CSS pseudo-classes for interactive states (:hover, :active, :focus)`
    );
    
    // Si hay cambios específicos de color, sugerir CSS específico
    const hoverState = states.find(s => s.name === 'hover');
    if (hoverState && hoverState.visualChanges.some(c => c.property === 'fill')) {
      cssImplementation.push(
        `For hover state, apply background color transitions`
      );
    }
  }
  
  if (hasDataStates || hasSelectionStates) {
    cssImplementation.push(
      `Use CSS classes for complex states (.is-selected, .is-loading, .is-error)`
    );
  }
  
  // Generar sugerencias JS
  const jsImplementation = [];
  
  if (hasSelectionStates) {
    jsImplementation.push(
      `Implement toggle functionality with useState hook`,
      `const [isExpanded, setIsExpanded] = useState(false);`
    );
  }
  
  if (hasDataStates) {
    jsImplementation.push(
      `Handle loading/error/success states with state management`,
      `const [status, setStatus] = useState('idle'); // idle, loading, success, error`
    );
  }
  
  // Determinar complejidad del componente
  let machineComplexity = 'simple';
  if (transitions.length > 5) {
    machineComplexity = 'complex';
    
    // Si es complejo, recomendar máquina de estados
    jsImplementation.push(
      `Consider using a state machine library like XState for complex state management`,
      `const [state, send] = useMachine(componentMachine);`
    );
  }
  
  return {
    stateManagement,
    css: cssImplementation,
    js: jsImplementation,
    recommendations: [
      `Implement ${states.length} unique state${states.length !== 1 ? 's' : ''} for this component`,
      `Handle ${transitions.length} state transitions with ${machineComplexity} logic`,
      `Ensure transitions provide appropriate visual feedback to users`,
      `Remember to implement accessibility features for all states`
    ]
  };
}
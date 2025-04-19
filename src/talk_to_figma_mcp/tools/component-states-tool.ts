/**
 * Herramienta para analizar estados y variantes de componentes de Figma
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendCommandToFigma } from "../core/figma-connection";

/**
 * Registra la herramienta de análisis de estados de componentes
 */
export function registerComponentStatesTool(server: McpServer): void {
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

        console.log(`Analizando estados del componente ${componentId}, includeVariants=${includeVariants}`);

        // Obtener información del componente
        const componentInfo = await sendCommandToFigma("get_node_info", { nodeId: componentId });
        
        // Variantes conocidas inicialmente vacías
        let variantsInfo = [];
        
        // Solo intentar obtener variantes si explícitamente se solicita
        if (includeVariants === false) {
          console.log("Análisis sin variantes solicitado, omitiendo búsqueda de variantes");
        } else {
          try {
            console.log("Intentando encontrar variantes usando jerarquía del documento");
            
            // Enfoque basado en jerarquía:
            // 1. Si el componente es parte de un conjunto, obtener sus hermanos
            // 2. Si el componente es un conjunto, obtener sus hijos
            
            if (componentInfo.type === 'COMPONENT_SET') {
              console.log("El nodo es un COMPONENT_SET, obteniendo sus hijos como variantes");
              
              // Si tiene hijos, son las variantes
              if (componentInfo.children && Array.isArray(componentInfo.children) && componentInfo.children.length > 0) {
                variantsInfo = componentInfo.children.filter(child => child.type === 'COMPONENT');
                console.log(`Encontradas ${variantsInfo.length} variantes como hijos del COMPONENT_SET`);
              }
            } 
            else if (componentInfo.parent && typeof componentInfo.parent === 'object') {
              console.log("El nodo tiene un padre, verificando si es parte de un conjunto de componentes");
              
              // Comprobar si el padre es un conjunto de componentes
              if (componentInfo.parent.type === 'COMPONENT_SET' && componentInfo.parent.id) {
                console.log(`El nodo es parte de un COMPONENT_SET con ID: ${componentInfo.parent.id}`);
                
                // Obtener el conjunto de componentes (el padre)
                const parentSetInfo = await sendCommandToFigma("get_node_info", { nodeId: componentInfo.parent.id });
                
                // Si el padre tiene hijos, filtrar para excluir el componente actual
                if (parentSetInfo && parentSetInfo.children && Array.isArray(parentSetInfo.children)) {
                  variantsInfo = parentSetInfo.children.filter(child => 
                    child.id !== componentId && child.type === 'COMPONENT'
                  );
                  console.log(`Encontradas ${variantsInfo.length} variantes como hermanos en el COMPONENT_SET`);
                }
              }
            }
            
            // Si no se han encontrado variantes y el componente tiene un nombre que parece ser parte de un sistema
            if (variantsInfo.length === 0 && componentInfo.name.includes('/')) {
              console.log("No se encontraron variantes en la jerarquía. El componente usa nomenclatura de variante, analizando usando solo el componente principal");
            }
            
          } catch (error) {
            console.error("Error al buscar variantes:", error);
            // Si hay un error, continuamos con un análisis básico
            variantsInfo = [];
          }
        }
        
        console.log(`Análisis final con ${variantsInfo.length} variantes`);
        
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
        console.error("Error completo en analyze_component_states:", error);
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
 * Analiza los estados de un componente y sus variantes
 */
export function analyzeComponentStates(componentInfo: any, variantsInfo: any[] = []): any {
  // Información básica del componente
  const componentBase = {
    id: componentInfo.id,
    name: componentInfo.name,
    type: componentInfo.type
  };
  
  // Extraer propiedades de estado del componente principal
  const mainState = extractStateProperties(componentInfo);
  
  // Analizar variantes si están disponibles
  const variants = [];
  if (Array.isArray(variantsInfo) && variantsInfo.length > 0) {
    for (const variant of variantsInfo) {
      const variantState = extractStateProperties(variant);
      variants.push({
        id: variant.id,
        name: variant.name,
        properties: variantState,
        stateName: extractStateName(variant.name, componentInfo.name)
      });
    }
  }
  
  // Intentar detectar propiedades de estado dinámicas
  const stateProperties = detectStateProperties(componentInfo, variants);
  
  // Identificar posibles estados y transiciones
  const possibleStates = identifyPossibleStates(componentInfo, variants);
  
  // Generar sugerencias para implementación
  const suggestedImplementation = suggestStateImplementation(possibleStates, mainState, variants.length);
  
  return {
    component: componentBase,
    mainState,
    variants: variants,
    stateProperties,
    possibleStates,
    implementation: suggestedImplementation
  };
}

/**
 * Extrae propiedades relacionadas con el estado de un componente
 */
function extractStateProperties(component: any): any {
  const stateProperties = {
    visual: {
      fills: component.fills || [],
      strokes: component.strokes || [],
      effects: component.effects || [],
      opacity: component.opacity !== undefined ? component.opacity : 1
    },
    layout: {
      width: component.width,
      height: component.height,
      constraints: component.constraints || {}
    },
    interactive: {
      isClickable: component.isClickable || false,
      actions: component.actions || []
    },
    text: null as any
  };
  
  // Si es un componente de texto, extraer propiedades específicas
  if (component.type === 'TEXT') {
    stateProperties.text = {
      characters: component.characters,
      fontSize: component.fontSize,
      fontName: component.fontName,
      textCase: component.textCase,
      textDecoration: component.textDecoration,
      textAlignHorizontal: component.textAlignHorizontal,
      textAlignVertical: component.textAlignVertical
    };
  }
  
  return stateProperties;
}

/**
 * Extrae el nombre del estado de una variante basado en la convención de nomenclatura
 */
function extractStateName(variantName: string, baseName: string): string {
  // Remover el nombre base de la variante
  let stateName = variantName;
  
  if (variantName.startsWith(baseName)) {
    stateName = variantName.slice(baseName.length).trim();
    // Limpiar separadores iniciales como /, -, _, etc.
    stateName = stateName.replace(/^[\/\-_\s]+/, '');
  }
  
  // Si la variante usa formato "Base/Estado/Subestado"
  const parts = variantName.split('/');
  if (parts.length > 1) {
    return parts.slice(1).join('/'); // Todo después del primer separador
  }
  
  // Si usa un formato como "Base-Estado" o "Base_Estado"
  const dashParts = variantName.split(/[-_\s]/);
  if (dashParts.length > 1) {
    return dashParts.slice(1).join(' '); // Todo después del primer separador
  }
  
  // Si usa camelCase o PascalCase, intentar separar palabras
  if (/[a-z][A-Z]/.test(variantName)) {
    const nameWithoutBase = variantName.replace(new RegExp(`^${baseName}`, 'i'), '');
    return nameWithoutBase
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Insertar espacios entre camelCase
      .trim();
  }
  
  return stateName || 'Default';
}

/**
 * Detecta propiedades que cambian entre estados
 */
function detectStateProperties(mainComponent: any, variants: any[]): any {
  const stateProperties = {
    color: false,
    size: false,
    text: false,
    visibility: false,
    layout: false,
    interactive: false
  };
  
  // No hay variantes para comparar
  if (!Array.isArray(variants) || variants.length === 0) {
    return stateProperties;
  }
  
  // Extraer propiedades principales para comparación
  const mainFill = getMainFill(mainComponent);
  const mainSize = { width: mainComponent.width, height: mainComponent.height };
  const mainText = mainComponent.type === 'TEXT' ? mainComponent.characters : null;
  
  // Comparar con cada variante
  for (const variant of variants) {
    const variantData = variant.properties || {};
    
    // Comparar colores (fills)
    const variantFill = getMainFill(variant);
    if (variantFill && mainFill && !areColorsSimilar(variantFill, mainFill)) {
      stateProperties.color = true;
    }
    
    // Comparar tamaños
    if (variant.width !== mainComponent.width || variant.height !== mainComponent.height) {
      stateProperties.size = true;
    }
    
    // Comparar texto
    if (mainComponent.type === 'TEXT' && variant.type === 'TEXT' && 
        variant.characters !== mainComponent.characters) {
      stateProperties.text = true;
    }
    
    // Comparar visibilidad
    if ((variant.opacity !== undefined && mainComponent.opacity !== undefined) &&
        (variant.opacity < 0.1 || mainComponent.opacity < 0.1)) {
      stateProperties.visibility = true;
    }
    
    // Comparar layout
    if (variant.layoutMode !== mainComponent.layoutMode ||
        variant.paddingLeft !== mainComponent.paddingLeft ||
        variant.paddingRight !== mainComponent.paddingRight ||
        variant.paddingTop !== mainComponent.paddingTop ||
        variant.paddingBottom !== mainComponent.paddingBottom) {
      stateProperties.layout = true;
    }
    
    // Comparar interactividad
    if (variant.isClickable !== mainComponent.isClickable) {
      stateProperties.interactive = true;
    }
  }
  
  return stateProperties;
}

/**
 * Obtiene el relleno principal de un componente
 */
function getMainFill(component: any): any {
  const fills = component.fills || [];
  return fills.length > 0 ? fills[0] : null;
}

/**
 * Compara si dos colores son similares
 */
function areColorsSimilar(color1: any, color2: any): boolean {
  if (!color1 || !color2 || !color1.color || !color2.color) {
    return false;
  }
  
  const c1 = color1.color;
  const c2 = color2.color;
  
  // Comparar componentes RGB con un margen de tolerancia
  const tolerance = 0.1;
  return Math.abs(c1.r - c2.r) < tolerance &&
         Math.abs(c1.g - c2.g) < tolerance &&
         Math.abs(c1.b - c2.b) < tolerance;
}

/**
 * Identifica posibles estados basándose en el análisis de variantes
 */
function identifyPossibleStates(component: any, variants: any[]): any[] {
  const possibleStates = [
    { name: 'Default', description: 'Estado normal o predeterminado del componente' }
  ];
  
  // Mapeo común de nombres de estado
  const commonStates = {
    'hover': 'Estado cuando el cursor está sobre el componente',
    'active': 'Estado cuando el componente está siendo activado (ej. clic)',
    'focus': 'Estado cuando el componente tiene el foco',
    'disabled': 'Estado cuando el componente está deshabilitado',
    'selected': 'Estado cuando el componente está seleccionado',
    'error': 'Estado que indica un error',
    'success': 'Estado que indica éxito',
    'warning': 'Estado que indica advertencia',
    'loading': 'Estado de carga',
    'pressed': 'Estado cuando el componente está presionado',
    'expanded': 'Estado cuando el componente está expandido',
    'collapsed': 'Estado cuando el componente está colapsado'
  };
  
  // No hay variantes para analizar
  if (!Array.isArray(variants) || variants.length === 0) {
    // Inferir estados posibles basados en el tipo de componente
    if (component.isClickable || 
        component.name.toLowerCase().includes('button') || 
        component.name.toLowerCase().includes('btn')) {
      possibleStates.push(
        { name: 'Hover', description: commonStates['hover'] },
        { name: 'Active', description: commonStates['active'] },
        { name: 'Disabled', description: commonStates['disabled'] }
      );
    } else if (component.name.toLowerCase().includes('input') || 
               component.name.toLowerCase().includes('field')) {
      possibleStates.push(
        { name: 'Focus', description: commonStates['focus'] },
        { name: 'Error', description: commonStates['error'] },
        { name: 'Disabled', description: commonStates['disabled'] }
      );
    }
    
    return possibleStates;
  }
  
  // Analizar variantes existentes para determinar estados
  const stateNames = new Set<string>();
  
  for (const variant of variants) {
    if (variant.stateName) {
      // Normalizar el nombre del estado
      const normalizedStateName = variant.stateName.toLowerCase();
      
      // Si ya procesamos este estado, continuar
      if (stateNames.has(normalizedStateName)) continue;
      
      // Registrar el estado
      stateNames.add(normalizedStateName);
      
      // Buscar coincidencia en estados comunes
      let description = '';
      for (const [commonState, commonDescription] of Object.entries(commonStates)) {
        if (normalizedStateName.includes(commonState)) {
          description = commonDescription;
          break;
        }
      }
      
      // Si no hay descripción, generar una genérica
      if (!description) {
        description = `Estado "${variant.stateName}" del componente`;
      }
      
      possibleStates.push({
        name: variant.stateName,
        description: description,
        variantId: variant.id
      });
    }
  }
  
  return possibleStates;
}

/**
 * Sugiere una implementación para manejar los estados del componente
 */
function suggestStateImplementation(states: any[], mainState: any, variantCount: number): any {
  // Determinar enfoque general basado en cantidad de estados
  let approach = 'simple';
  if (states.length > 3 || variantCount > 3) {
    approach = 'complex';
  }
  
  // Generar sugerencia básica
  const suggestion = {
    approach,
    react: {
      stateHook: `const [state, setState] = useState('default')`,
      conditionalRendering: approach === 'simple' ? 
        `className={\`component \${state === 'hover' ? 'hover' : ''}\`}` : 
        `className={\`component \${stateClasses[state]}\`}`
    },
    vue: {
      reactivity: `const state = ref('default')`,
      classBinding: `:class="{ 'hover': state === 'hover', ... }"`
    },
    css: {
      stateSelectors: states.map(s => `.component.${s.name.toLowerCase()} { /* Estilos para estado ${s.name} */ }`)
    },
    storybook: {
      suggestion: `Crear historias para cada estado: ${states.map(s => s.name).join(', ')}`
    }
  };
  
  // Sugerencias específicas según propiedades identificadas
  if (mainState.text) {
    suggestion.react.textExample = `{state === 'loading' ? 'Cargando...' : 'Acción'}`;
    suggestion.vue.textExample = `{{ state === 'loading' ? 'Cargando...' : 'Acción' }}`;
  }
  
  return suggestion;
}
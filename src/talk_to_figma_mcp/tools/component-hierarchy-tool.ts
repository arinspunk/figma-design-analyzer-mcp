/**
 * Herramienta para analizar la estructura jerárquica de componentes de Figma
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendCommandToFigma } from "../core/figma-connection";

/**
 * Registra la herramienta de análisis de jerarquía de componentes
 */
export function registerComponentHierarchyTool(server: McpServer): void {
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
}

/**
 * Analiza la estructura jerárquica de un componente
 */
export function analyzeComponentHierarchy(nodeInfo: any, maxDepth: number, framework: string): any {
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
  
  // Sugerir estructura de componentes
  const componentStructure = suggestComponentStructure(hierarchyTree, framework);
  
  // Estructura del resultado
  return {
    hierarchy: {
      root: hierarchyTree
    },
    implementation: implementationSuggestions,
    componentStructure
  };
}

/**
 * Construye un árbol jerárquico de componentes recursivamente
 */
function buildHierarchyTree(node: any, currentDepth: number, maxDepth: number): any {
  // Si alcanzamos la profundidad máxima, no continuamos explorando
  if (currentDepth > maxDepth) {
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      hasChildren: node.children && node.children.length > 0,
      childrenCount: node.children ? node.children.length : 0
    };
  }

  // Crear nodo base con información básica
  const treeNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    properties: node.properties || {},
    styles: node.styles || {},
    children: []
  };

  // Extraer propiedades específicas según el tipo de nodo
  if (node.type === 'TEXT') {
    treeNode.textProperties = {
      characters: node.characters,
      fontSize: node.fontSize,
      fontName: node.fontName,
      fontWeight: node.fontWeight,
      textAlignHorizontal: node.textAlignHorizontal,
      textAlignVertical: node.textAlignVertical,
      textCase: node.textCase,
      textDecoration: node.textDecoration
    };
  } else if (node.layoutMode) {
    treeNode.layoutProperties = {
      layoutMode: node.layoutMode,
      paddingLeft: node.paddingLeft,
      paddingRight: node.paddingRight,
      paddingTop: node.paddingTop,
      paddingBottom: node.paddingBottom,
      itemSpacing: node.itemSpacing,
      counterAxisSizingMode: node.counterAxisSizingMode,
      primaryAxisSizingMode: node.primaryAxisSizingMode
    };
  }

  // Procesar recursivamente los hijos
  if (node.children && node.children.length > 0) {
    treeNode.children = node.children.map((child: any) => 
      buildHierarchyTree(child, currentDepth + 1, maxDepth)
    );
  }

  return treeNode;
}

/**
 * Identifica tipos de componentes basados en su estructura y propiedades
 */
function identifyComponentTypes(hierarchyTree: any): any {
  // Tipos de componentes encontrados
  const componentTypes = {
    atomic: [],
    composite: [],
    container: [],
    layout: []
  };

  // Función recursiva para analizar nodos
  const analyzeNode = (node: any, path: string = ''): void => {
    const nodePath = path ? `${path} > ${node.name}` : node.name;
    
    // Determinar tipo de componente basado en propiedades
    if (node.type === 'COMPONENT' || node.type === 'INSTANCE') {
      if (!node.children || node.children.length === 0) {
        componentTypes.atomic.push({ id: node.id, name: node.name, path: nodePath });
      } else {
        componentTypes.composite.push({ id: node.id, name: node.name, path: nodePath });
      }
    } else if (node.layoutProperties && (
        node.layoutProperties.layoutMode === 'HORIZONTAL' || 
        node.layoutProperties.layoutMode === 'VERTICAL'
      )) {
      componentTypes.layout.push({ id: node.id, name: node.name, path: nodePath });
    } else if (node.children && node.children.length > 0) {
      componentTypes.container.push({ id: node.id, name: node.name, path: nodePath });
    }
    
    // Recursivamente analizar hijos
    if (node.children && node.children.length > 0) {
      node.children.forEach((child: any) => analyzeNode(child, nodePath));
    }
  };
  
  // Iniciar análisis desde la raíz
  analyzeNode(hierarchyTree);
  
  return componentTypes;
}

/**
 * Infiere elementos HTML semánticos basados en la estructura del componente
 */
function inferSemanticElements(hierarchyTree: any, framework: string): any {
  const semanticMapping = [];
  
  // Función recursiva para analizar nodos
  const analyzeNode = (node: any, parentType: string = null): void => {
    let inferredElement = 'div'; // Elemento por defecto
    
    // Inferir elemento basado en propiedades del nodo
    if (node.type === 'TEXT') {
      // Determinar si es un título o texto normal
      const textContent = node.textProperties?.characters || '';
      const fontSize = node.textProperties?.fontSize || 12;
      
      if (fontSize >= 24) {
        inferredElement = 'h1';
      } else if (fontSize >= 20) {
        inferredElement = 'h2';
      } else if (fontSize >= 16) {
        inferredElement = 'h3';
      } else if (fontSize >= 14) {
        inferredElement = 'h4';
      } else {
        inferredElement = 'p';
      }
      
      // Si parece un texto de enlace, sugerir 'a'
      if (node.textProperties?.textDecoration === 'UNDERLINE' || 
          (node.fill && node.fill.color && node.fill.color.b > 0.7)) {
        inferredElement = 'a';
      }
    } else if (node.type === 'RECTANGLE' && 
               node.properties && 
               node.properties.interactive && 
               node.properties.interactive.isClickable) {
      inferredElement = 'button';
    } else if (node.name.toLowerCase().includes('list') || 
               (node.children && 
                node.children.length > 2 && 
                node.children.every(c => c.type === node.children[0].type))) {
      // Si es una lista de elementos similares
      inferredElement = 'ul';
      // Y los hijos probablemente sean 'li'
    } else if (node.name.toLowerCase().includes('nav') || 
               node.name.toLowerCase().includes('menu')) {
      inferredElement = 'nav';
    } else if (node.name.toLowerCase().includes('section') || 
               node.name.toLowerCase().includes('container')) {
      inferredElement = 'section';
    } else if (node.name.toLowerCase().includes('article')) {
      inferredElement = 'article';
    } else if (node.name.toLowerCase().includes('header')) {
      inferredElement = 'header';
    } else if (node.name.toLowerCase().includes('footer')) {
      inferredElement = 'footer';
    } else if (node.name.toLowerCase().includes('aside') || 
               node.name.toLowerCase().includes('sidebar')) {
      inferredElement = 'aside';
    } else if (node.layoutProperties && node.children && node.children.length > 0) {
      inferredElement = 'div'; // Contenedor con layout
    }
    
    // Ajustar basado en el framework
    if (framework === 'react' || framework === 'vue' || framework === 'angular') {
      // Para frameworks modernos, mantener elementos semánticos
    } else if (framework === 'html') {
      // Para HTML básico, mantener elementos semánticos
    }
    
    // Guardar mapeo
    semanticMapping.push({
      nodeId: node.id,
      nodeName: node.name,
      inferredElement: inferredElement,
      reason: getReasonForElement(node, inferredElement)
    });
    
    // Recursivamente analizar hijos
    if (node.children && node.children.length > 0) {
      node.children.forEach((child: any) => analyzeNode(child, inferredElement));
    }
  };
  
  // Función para generar explicación para el elemento inferido
  function getReasonForElement(node: any, element: string): string {
    switch (element) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
        return `Texto de tamaño grande (${node.textProperties?.fontSize || 'desconocido'}px), probable título`;
      case 'a':
        return 'Texto con subrayado o color azul, probable enlace';
      case 'button':
        return 'Elemento interactivo clickeable';
      case 'ul':
        return 'Contiene múltiples elementos del mismo tipo, probable lista';
      case 'nav':
        return 'Basado en el nombre del componente que sugiere navegación';
      default:
        return `Elemento inferido basado en nombre y estructura`;
    }
  }
  
  // Iniciar análisis desde la raíz
  analyzeNode(hierarchyTree);
  
  return {
    elements: semanticMapping,
    summary: `Se infirieron ${semanticMapping.length} elementos semánticos`
  };
}

/**
 * Genera sugerencias de implementación basadas en el análisis de componentes
 */
function generateImplementationSuggestions(
  hierarchyTree: any, 
  componentTypes: any, 
  semanticStructure: any, 
  framework: string
): any {
  // Determinar el enfoque de implementación basado en el framework
  let implementationApproach = '';
  let componentPattern = '';
  let stateManagement = '';
  
  // Seleccionar patrón según framework
  switch (framework) {
    case 'react':
      implementationApproach = 'Componente funcional con hooks';
      componentPattern = 'Composición de componentes con props para configuración';
      stateManagement = 'React useState para estado local';
      break;
    case 'vue':
      implementationApproach = 'Componente Vue de archivo único (SFC)';
      componentPattern = 'Composición con propiedades y slots';
      stateManagement = 'Composition API con ref/reactive';
      break;
    case 'angular':
      implementationApproach = 'Componente Angular con decorador';
      componentPattern = 'Sistema de módulos con inyección de dependencias';
      stateManagement = 'Servicios compartidos o variables de clase';
      break;
    default: // HTML
      implementationApproach = 'Marcado HTML con CSS y JavaScript';
      componentPattern = 'Módulos JavaScript o Web Components';
      stateManagement = 'Variables de estado y manipulación del DOM';
  }
  
  // Determinar complejidad del componente
  const isComplex = (hierarchyTree.children && hierarchyTree.children.length > 5) ||
                    componentTypes.composite.length > 2;
                    
  // Identificar requisitos de accesibilidad
  const a11yRequirements = [];
  if (semanticStructure.elements.some(e => e.inferredElement === 'button')) {
    a11yRequirements.push('Asegurar que los botones tienen atributos aria-label o contenido de texto');
  }
  if (semanticStructure.elements.some(e => e.inferredElement === 'a')) {
    a11yRequirements.push('Verificar que los enlaces tienen href y contenido descriptivo');
  }
  if (semanticStructure.elements.some(e => 
      ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(e.inferredElement))) {
    a11yRequirements.push('Mantener una estructura jerárquica correcta de encabezados');
  }
  
  // Generar sugerencias específicas del framework
  let frameworkSpecificSuggestions = [];
  switch (framework) {
    case 'react':
      frameworkSpecificSuggestions = [
        'Utilizar React.memo() para componentes puros',
        'Considerar useCallback para funciones de evento',
        'Extraer lógica compleja a custom hooks'
      ];
      break;
    case 'vue':
      frameworkSpecificSuggestions = [
        'Usar props validadas con PropType',
        'Considerar componentes async para optimización',
        'Implementar directivas v-if/v-for de manera óptima'
      ];
      break;
    case 'angular':
      frameworkSpecificSuggestions = [
        'Implementar OnPush ChangeDetectionStrategy',
        'Usar ViewEncapsulation para estilos',
        'Considerar lazy loading si el componente es complejo'
      ];
      break;
    default: // HTML
      frameworkSpecificSuggestions = [
        'Utilizar clases CSS para modularidad',
        'Implementar patrón de módulo para JavaScript',
        'Considerar Web Components para reutilización'
      ];
  }
  
  return {
    approach: implementationApproach,
    componentPattern,
    stateManagement,
    complexity: isComplex ? 'Alta' : 'Media',
    responsiveness: 'Recomendado implementar diseño responsive',
    accessibility: {
      requirements: a11yRequirements,
      importance: 'Alta'
    },
    frameworkSpecific: frameworkSpecificSuggestions
  };
}

/**
 * Sugiere una estructura de componentes para implementación en un framework
 */
function suggestComponentStructure(hierarchyTree: any, framework: string): any {
  // Determinar si usar un enfoque de componentes anidados o planos
  const shouldUseNestedComponents = hierarchyTree.children && hierarchyTree.children.length > 3;
  
  // Identificar componentes potenciales basados en la complejidad
  const potentialComponents = [];
  const processNode = (node: any, depth: number) => {
    // Si es un nodo complejo, considerarlo un componente potencial
    if (
      node.children && 
      node.children.length > 2 && 
      depth > 0 && // No procesar el nodo raíz que ya es un componente
      !isSimpleLayout(node)
    ) {
      potentialComponents.push({
        id: node.id,
        name: formatComponentName(node.name),
        depth,
        complexity: calculateNodeComplexity(node)
      });
    }
    
    // Procesar hijos
    if (node.children) {
      node.children.forEach((child: any) => processNode(child, depth + 1));
    }
  };
  
  // Iniciar procesamiento desde el nodo raíz
  processNode(hierarchyTree, 0);
  
  // Organizar componentes por complejidad
  potentialComponents.sort((a, b) => b.complexity - a.complexity);
  
  // Generar estructura de archivos basada en el framework
  const fileStructure = generateFileStructure(
    formatComponentName(hierarchyTree.name), 
    potentialComponents,
    framework
  );
  
  return {
    componentName: formatComponentName(hierarchyTree.name),
    nestedComponents: shouldUseNestedComponents,
    potentialComponents: potentialComponents.map(c => ({
      name: c.name,
      complexity: c.complexity
    })),
    fileStructure
  };
}

/**
 * Formatea un nombre de nodo para usarlo como nombre de componente
 */
function formatComponentName(nodeName: string): string {
  // Eliminar caracteres no deseados y aplicar PascalCase
  const name = nodeName
    .replace(/[^\w\s-]/g, '') // Eliminar caracteres especiales
    .replace(/[\s-]+(\w)/g, (_match, letter) => letter.toUpperCase()) // Convertir espacios/guiones a camelCase
    .replace(/^\w/, c => c.toUpperCase()); // Asegurar que comienza con mayúscula (PascalCase)
  
  // Si el nombre es muy genérico, añadir sufijo "Component"
  if (['Frame', 'Group', 'Element', 'Component'].includes(name)) {
    return `${name}Component`;
  }
  
  return name;
}

/**
 * Determina si un nodo es un layout simple sin lógica compleja
 */
function isSimpleLayout(node: any): boolean {
  // Si el nodo tiene layout, pero todos sus hijos son simples
  // (texto, imágenes, bordes), probablemente es solo un contenedor
  if (node.children) {
    const allChildrenSimple = node.children.every((child: any) => 
      child.type === 'TEXT' || 
      child.type === 'RECTANGLE' || 
      child.type === 'ELLIPSE' ||
      child.type === 'VECTOR' ||
      !child.children || 
      child.children.length === 0
    );
    
    if (allChildrenSimple && node.layoutMode) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calcula la complejidad de un nodo basado en cantidad de hijos, propiedades y más
 */
function calculateNodeComplexity(node: any): number {
  let complexity = 0;
  
  // Factores de complejidad:
  // 1. Cantidad de hijos
  if (node.children) {
    complexity += node.children.length * 2;
    
    // Recursivamente sumar complejidad de hijos
    node.children.forEach((child: any) => {
      if (child.children && child.children.length > 0) {
        complexity += 1;
      }
    });
  }
  
  // 2. Presencia de elementos interactivos
  if (node.properties && node.properties.interactive && node.properties.interactive.isClickable) {
    complexity += 5;
  }
  
  // 3. Complejidad de estilos
  if (node.properties && node.properties.visual) {
    if (node.properties.visual.fills && Array.isArray(node.properties.visual.fills)) {
      complexity += node.properties.visual.fills.length;
    }
    if (node.properties.visual.strokes && Array.isArray(node.properties.visual.strokes)) {
      complexity += node.properties.visual.strokes.length;
    }
    if (node.properties.visual.effects && Array.isArray(node.properties.visual.effects)) {
      complexity += node.properties.visual.effects.length;
    }
  }
  
  // 4. Complejidad de layout
  if (node.properties && node.properties.layout) {
    if (node.properties.layout.type === 'grid') {
      complexity += 5;
    } else if (node.properties.layout.type.startsWith('flexbox')) {
      complexity += 3;
    }
  }
  
  return complexity;
}

/**
 * Genera una estructura de archivos sugerida basada en el framework
 */
function generateFileStructure(mainComponentName: string, subComponents: any[], framework: string): any {
  let files = [];
  
  switch (framework) {
    case 'react':
      // Archivo principal
      files.push({
        path: `${mainComponentName}/${mainComponentName}.tsx`,
        description: `Main component file`,
        language: 'tsx'
      });
      
      // Estilos
      files.push({
        path: `${mainComponentName}/${mainComponentName}.module.css`,
        description: `Component styles`,
        language: 'css'
      });
      
      // Tipos
      files.push({
        path: `${mainComponentName}/${mainComponentName}.types.ts`,
        description: `TypeScript interfaces and types`,
        language: 'typescript'
      });
      
      // Índice de exportación
      files.push({
        path: `${mainComponentName}/index.ts`,
        description: `Export file`,
        language: 'typescript'
      });
      
      // Subcomponentes (para componentes complejos)
      subComponents.slice(0, 3).forEach(comp => { // Limitar a los 3 más complejos
        if (comp.complexity > 10) { // Solo para componentes realmente complejos
          files.push({
            path: `${mainComponentName}/components/${comp.name}.tsx`,
            description: `Subcomponent for ${comp.name}`,
            language: 'tsx'
          });
        }
      });
      
      // Pruebas
      files.push({
        path: `${mainComponentName}/${mainComponentName}.test.tsx`,
        description: `Component tests`,
        language: 'tsx'
      });
      
      break;
      
    case 'vue':
      files.push({
        path: `${mainComponentName}/${mainComponentName}.vue`,
        description: `Vue single-file component`,
        language: 'vue'
      });
      
      // Tipos (si hay componentes complejos)
      if (subComponents.some(c => c.complexity > 10)) {
        files.push({
          path: `${mainComponentName}/types.ts`,
          description: `TypeScript interfaces and types`,
          language: 'typescript'
        });
      }
      
      break;
      
    case 'angular':
      files.push({
        path: `${kebabCase(mainComponentName)}/${kebabCase(mainComponentName)}.component.ts`,
        description: `Component class`,
        language: 'typescript'
      });
      
      files.push({
        path: `${kebabCase(mainComponentName)}/${kebabCase(mainComponentName)}.component.html`,
        description: `Component template`,
        language: 'html'
      });
      
      files.push({
        path: `${kebabCase(mainComponentName)}/${kebabCase(mainComponentName)}.component.scss`,
        description: `Component styles`,
        language: 'scss'
      });
      
      files.push({
        path: `${kebabCase(mainComponentName)}/${kebabCase(mainComponentName)}.module.ts`,
        description: `Component module`,
        language: 'typescript'
      });
      
      break;
      
    default: // HTML básico
      files.push({
        path: `${mainComponentName}.html`,
        description: `HTML structure`,
        language: 'html'
      });
      
      files.push({
        path: `${mainComponentName}.css`,
        description: `CSS styles`,
        language: 'css'
      });
      
      if (subComponents.some(c => c.complexity > 5)) {
        files.push({
          path: `${mainComponentName}.js`,
          description: `JavaScript functionality`,
          language: 'javascript'
        });
      }
  }
  
  return { files };
}

/**
 * Convierte un string a kebab-case (para nombres de archivos de Angular)
 */
function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}
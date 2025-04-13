/**
 * Herramientas avanzadas para análisis de diseño en Figma
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendCommandToFigma } from "../core/figma-connection";
import { hexToRgb } from "../utils/figma-utils";

/**
 * Registra las herramientas de análisis en el servidor MCP
 */
export function registerAnalysisTools(server: McpServer): void {
  // Analyze Design System Tool
  server.tool(
    "analyze_design_system",
    "Examinar un documento de Figma para identificar y estructurar su sistema de diseño subyacente",
    {
      documentId: z.string().optional().describe("Identificador del documento Figma (si se omite, se usa el documento actual)"),
      detailLevel: z.enum(["basic", "detailed", "comprehensive"]).default("detailed").describe("Nivel de detalle del análisis"),
      includeComponents: z.boolean().default(true).describe("Booleano para incluir análisis de componentes"),
    },
    async ({ documentId, detailLevel, includeComponents }) => {
      try {
        // Mensaje inicial para indicar que el proceso ha comenzado
        const initialStatus = {
          type: "text" as const,
          text: `Iniciando análisis del sistema de diseño con nivel de detalle '${detailLevel}'. Esto puede tomar unos momentos para documentos grandes...`,
        };

        // Obtener información del documento
        const documentInfo = documentId 
          ? await sendCommandToFigma("get_node_info", { nodeId: documentId })
          : await sendCommandToFigma("get_document_info");

        // Obtener todos los estilos del documento
        const stylesResult = await sendCommandToFigma("get_styles");
        
        // Obtener componentes locales si se solicita
        let componentsResult = null;
        if (includeComponents) {
          componentsResult = await sendCommandToFigma("get_local_components");
        }

        // Analizar los datos recopilados para identificar el sistema de diseño
        const designSystem = analyzeDesignSystem(documentInfo, stylesResult, componentsResult, detailLevel);

        return {
          content: [
            initialStatus,
            {
              type: "text" as const,
              text: JSON.stringify(designSystem, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error al analizar el sistema de diseño: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );

  // Extract Design Tokens Tool
  server.tool(
    "extract_design_tokens",
    "Extraer tokens de diseño específicos de un documento o componente de Figma",
    {
      nodeId: z.string().describe("ID del nodo a analizar (documento, página o componente)"),
      tokenTypes: z.array(
        z.enum(["colors", "typography", "spacing", "shadows", "radii"])
      ).default(["colors", "typography", "spacing", "shadows", "radii"])
      .describe("Array de tipos de tokens a extraer"),
      format: z.enum(["css", "scss", "json", "js", "ts"]).default("json")
      .describe("Formato de salida")
    },
    async ({ nodeId, tokenTypes, format }) => {
      try {
        // Mensaje inicial para indicar que el proceso ha comenzado
        const initialStatus = {
          type: "text" as const,
          text: `Iniciando extracción de tokens de diseño (${tokenTypes.join(", ")}) con formato de salida '${format}'. Esto puede tomar unos momentos...`,
        };

        // Obtener información del nodo especificado
        const nodeInfo = await sendCommandToFigma("get_node_info", { nodeId });
        
        // Obtener estilos del documento para análisis
        const stylesResult = await sendCommandToFigma("get_styles");
        
        // Extraer los tokens solicitados
        const tokens = extractTokens(nodeInfo, stylesResult, tokenTypes);
        
        // Generar el código en el formato solicitado
        const codeOutput = generateTokenCode(tokens, format);
        
        // Calcular estadísticas
        const statistics = calculateTokenStatistics(tokens);

        // Construir la respuesta completa
        const response = {
          tokens,
          code: codeOutput,
          statistics
        };

        return {
          content: [
            initialStatus,
            {
              type: "text" as const,
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error al extraer tokens de diseño: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );
}

/**
 * Analiza el sistema de diseño a partir de los datos recopilados
 */
function analyzeDesignSystem(documentInfo: any, stylesData: any, componentsData: any, detailLevel: string): any {
  // Extraer el nombre del documento
  const docName = documentInfo.name || "Documento sin nombre";
  
  // Analizar colores
  const colorTokens = extractColorTokens(stylesData);
  
  // Analizar tipografía
  const typographyTokens = extractTypographyTokens(stylesData);
  
  // Analizar espaciado
  const spacingTokens = extractSpacingTokens(documentInfo, detailLevel);
  
  // Analizar sombras
  const shadowTokens = extractShadowTokens(stylesData);
  
  // Analizar radios de borde
  const radiiTokens = extractRadiiTokens(stylesData, documentInfo);
  
  // Analizar componentes si están disponibles
  let components = {
    atomic: [],
    composite: [],
    patterns: []
  };
  
  if (componentsData) {
    components = analyzeComponents(componentsData, detailLevel);
  }
  
  // Evaluar la consistencia
  const consistency = evaluateConsistency(colorTokens, typographyTokens, spacingTokens, shadowTokens, radiiTokens, components);
  
  // Generar sugerencias de implementación
  const implementationSuggestions = generateImplementationSuggestions(colorTokens, typographyTokens, components);
  
  // Construir y devolver el objeto del sistema de diseño
  return {
    designSystem: {
      name: `${docName} Design System`,
      version: "1.0",
      description: `Sistema de diseño extraído de ${docName}`,
      consistency,
      tokens: {
        colors: colorTokens,
        typography: typographyTokens,
        spacing: spacingTokens,
        shadows: shadowTokens,
        radii: radiiTokens
      },
      components,
      implementationSuggestions
    }
  };
}

/**
 * Extrae tokens de color de los estilos
 */
function extractColorTokens(stylesData: any): any[] {
  // Filtrar estilos de color
  const colorStyles = Array.isArray(stylesData) 
    ? stylesData.filter((style: any) => style.type === 'FILL')
    : [];
  
  // Transformar estilos en tokens
  return colorStyles.map((style: any) => {
    // Obtener el color del estilo
    let colorValue = '#000000';
    let opacity = 1;
    
    if (style.paints && style.paints.length > 0) {
      const paint = style.paints[0];
      if (paint.type === 'SOLID' && paint.color) {
        // Convertir color RGB (0-1) a HEX
        const r = Math.round(paint.color.r * 255);
        const g = Math.round(paint.color.g * 255);
        const b = Math.round(paint.color.b * 255);
        colorValue = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        opacity = paint.opacity !== undefined ? paint.opacity : 1;
      }
    }
    
    // Generar nombre semántico para el token
    const nameParts = style.name.split('/');
    const name = nameParts[nameParts.length - 1].toLowerCase().replace(/\s+/g, '-');
    const category = nameParts.length > 1 ? nameParts[0].toLowerCase() : 'base';
    
    return {
      name,
      category,
      value: colorValue,
      opacity: opacity !== 1 ? opacity : undefined,
      type: 'color',
      description: `Color: ${style.name}`,
      figmaStyleId: style.id
    };
  });
}

/**
 * Extrae tokens de tipografía de los estilos
 */
function extractTypographyTokens(stylesData: any): any[] {
  // Filtrar estilos de texto
  const textStyles = Array.isArray(stylesData) 
    ? stylesData.filter((style: any) => style.type === 'TEXT')
    : [];
  
  // Transformar estilos en tokens
  return textStyles.map((style: any) => {
    const styleData = style.style || {};
    
    // Generar nombre semántico para el token
    const nameParts = style.name.split('/');
    const name = nameParts[nameParts.length - 1].toLowerCase().replace(/\s+/g, '-');
    const category = nameParts.length > 1 ? nameParts[0].toLowerCase() : 'base';
    
    return {
      name,
      category,
      type: 'typography',
      description: `Estilo de texto: ${style.name}`,
      value: {
        fontFamily: styleData.fontFamily || 'default',
        fontSize: styleData.fontSize ? `${styleData.fontSize}px` : undefined,
        fontWeight: styleData.fontWeight,
        lineHeight: styleData.lineHeight ? `${styleData.lineHeight}px` : undefined,
        letterSpacing: styleData.letterSpacing ? `${styleData.letterSpacing}px` : undefined,
        textCase: styleData.textCase,
        textDecoration: styleData.textDecoration
      },
      figmaStyleId: style.id
    };
  });
}

/**
 * Extrae tokens de espaciado analizando el documento
 */
function extractSpacingTokens(documentInfo: any, detailLevel: string): any[] {
  const spacingTokens = [];
  const spacings = new Set<number>();
  
  // Función recursiva para encontrar espaciados entre elementos
  const findSpacings = (node: any) => {
    if (!node) return;
    
    // Si estamos en modo básico, limitamos la profundidad
    if (detailLevel === 'basic' && spacings.size >= 5) return;
    
    // Analizar autolayout para identificar gaps
    if (node.layoutMode && node.itemSpacing !== undefined) {
      spacings.add(Math.round(node.itemSpacing));
    }
    
    // Analizar paddingos si existe autolayout
    if (node.layoutMode) {
      if (node.paddingLeft !== undefined) spacings.add(Math.round(node.paddingLeft));
      if (node.paddingRight !== undefined) spacings.add(Math.round(node.paddingRight));
      if (node.paddingTop !== undefined) spacings.add(Math.round(node.paddingTop));
      if (node.paddingBottom !== undefined) spacings.add(Math.round(node.paddingBottom));
    }
    
    // Explorar hijos recursivamente
    if (node.children && node.children.length > 0) {
      node.children.forEach(findSpacings);
    }
  };
  
  // Iniciar búsqueda recursiva
  findSpacings(documentInfo);
  
  // Convertir a array y ordenar
  const spacingValues = Array.from(spacings).sort((a, b) => a - b);
  
  // Crear tokens basados en los valores únicos encontrados
  spacingValues.forEach((value, index) => {
    // Determinar categoría por tamaño
    let category = 'base';
    if (value <= 4) category = 'xs';
    else if (value <= 8) category = 'sm';
    else if (value <= 16) category = 'md';
    else if (value <= 32) category = 'lg';
    else category = 'xl';
    
    spacingTokens.push({
      name: `spacing-${index + 1}`,
      category,
      value: `${value}px`,
      type: 'spacing',
      description: `Espaciado de ${value}px`
    });
  });
  
  return spacingTokens;
}

/**
 * Extrae tokens de sombra de los estilos
 */
function extractShadowTokens(stylesData: any): any[] {
  // Filtrar estilos de efecto (sombras)
  const effectStyles = Array.isArray(stylesData) 
    ? stylesData.filter((style: any) => style.type === 'EFFECT')
    : [];
  
  // Transformar estilos en tokens
  return effectStyles.map((style: any) => {
    let shadowValue = {};
    
    if (style.effects && style.effects.length > 0) {
      // Tomamos el primer efecto
      const effect = style.effects[0];
      if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
        // Convertir color RGB a HEX
        const r = Math.round(effect.color.r * 255);
        const g = Math.round(effect.color.g * 255);
        const b = Math.round(effect.color.b * 255);
        const a = effect.color.a || 1;
        const colorHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        
        shadowValue = {
          type: effect.type === 'DROP_SHADOW' ? 'dropShadow' : 'innerShadow',
          color: colorHex,
          alpha: a,
          x: `${effect.offset.x}px`,
          y: `${effect.offset.y}px`,
          blur: `${effect.radius}px`,
          spread: effect.spread ? `${effect.spread}px` : '0px'
        };
      }
    }
    
    // Generar nombre semántico para el token
    const nameParts = style.name.split('/');
    const name = nameParts[nameParts.length - 1].toLowerCase().replace(/\s+/g, '-');
    const category = nameParts.length > 1 ? nameParts[0].toLowerCase() : 'base';
    
    return {
      name,
      category,
      value: shadowValue,
      type: 'shadow',
      description: `Sombra: ${style.name}`,
      figmaStyleId: style.id
    };
  });
}

/**
 * Extrae tokens de radio de borde
 */
function extractRadiiTokens(stylesData: any, documentInfo: any): any[] {
  const radiiTokens = [];
  const borderRadii = new Set<number>();
  
  // Función recursiva para encontrar radios en el documento
  const findRadii = (node: any) => {
    if (!node) return;
    
    // Comprobar si el nodo tiene cornerRadius
    if (node.cornerRadius !== undefined && node.cornerRadius > 0) {
      borderRadii.add(Math.round(node.cornerRadius));
    }
    
    // Explorar hijos recursivamente
    if (node.children && node.children.length > 0) {
      node.children.forEach(findRadii);
    }
  };
  
  // Iniciar búsqueda recursiva
  findRadii(documentInfo);
  
  // Convertir a array y ordenar
  const radiiValues = Array.from(borderRadii).sort((a, b) => a - b);
  
  // Crear tokens basados en los valores únicos encontrados
  radiiValues.forEach((value, index) => {
    // Determinar categoría por tamaño
    let category = 'base';
    if (value <= 2) category = 'xs';
    else if (value <= 4) category = 'sm';
    else if (value <= 8) category = 'md';
    else if (value <= 16) category = 'lg';
    else category = 'xl';
    
    radiiTokens.push({
      name: `radius-${index + 1}`,
      category,
      value: `${value}px`,
      type: 'radius',
      description: `Radio de borde de ${value}px`
    });
  });
  
  return radiiTokens;
}

/**
 * Analiza y categoriza componentes
 */
function analyzeComponents(componentsData: any, detailLevel: string): any {
  if (!Array.isArray(componentsData) || componentsData.length === 0) {
    return {
      atomic: [],
      composite: [],
      patterns: []
    };
  }
  
  const atomic = [];
  const composite = [];
  const patterns = [];
  
  // Categorizar componentes
  for (const component of componentsData) {
    // Determinar si es atómico, compuesto o patrón
    let category = 'atomic';
    let description = '';
    
    // Si tiene muchos hijos, probablemente es compuesto o un patrón
    if (component.children && component.children.length > 3) {
      category = 'composite';
      
      // Identificar si es un patrón conocido (card, form, navigation, etc.)
      if (/card|tarjeta/i.test(component.name)) {
        category = 'pattern';
        description = 'Patrón de tarjeta para mostrar contenido agrupado';
      } else if (/form|formulario/i.test(component.name)) {
        category = 'pattern';
        description = 'Patrón de formulario para entrada de datos';
      } else if (/nav|menu|navegación/i.test(component.name)) {
        category = 'pattern';
        description = 'Patrón de navegación';
      } else if (/list|lista/i.test(component.name)) {
        category = 'pattern';
        description = 'Patrón de lista para mostrar colecciones de elementos';
      } else if (/table|tabla/i.test(component.name)) {
        category = 'pattern';
        description = 'Patrón de tabla para mostrar datos estructurados';
      } else if (/modal|dialog|diálogo/i.test(component.name)) {
        category = 'pattern';
        description = 'Patrón de modal o diálogo';
      } else if (/button|botón|btn/i.test(component.name)) {
        category = 'atomic';
        description = 'Componente atómico de botón';
      }
    } else {
      // Identificar componentes atómicos por nombre
      if (/button|botón|btn/i.test(component.name)) {
        description = 'Componente atómico de botón';
      } else if (/input|entrada/i.test(component.name)) {
        description = 'Componente atómico de entrada de texto';
      } else if (/icon|ícono/i.test(component.name)) {
        description = 'Componente atómico de ícono';
      } else if (/badge|insignia/i.test(component.name)) {
        description = 'Componente atómico de insignia o badge';
      } else if (/checkbox|check/i.test(component.name)) {
        description = 'Componente atómico de checkbox';
      } else if (/radio/i.test(component.name)) {
        description = 'Componente atómico de radio button';
      }
    }
    
    const componentInfo = {
      id: component.id,
      name: component.name,
      description: description || `Componente ${category}`,
      type: component.type,
      width: component.absoluteBoundingBox ? component.absoluteBoundingBox.width : null,
      height: component.absoluteBoundingBox ? component.absoluteBoundingBox.height : null,
      childrenCount: component.children ? component.children.length : 0
    };
    
    // Añadir a la categoría correspondiente
    if (category === 'atomic') {
      atomic.push(componentInfo);
    } else if (category === 'composite') {
      composite.push(componentInfo);
    } else if (category === 'pattern') {
      patterns.push(componentInfo);
    }
  }
  
  return {
    atomic,
    composite,
    patterns
  };
}

/**
 * Evalúa la consistencia del sistema de diseño
 */
function evaluateConsistency(
  colorTokens: any[], 
  typographyTokens: any[], 
  spacingTokens: any[], 
  shadowTokens: any[], 
  radiiTokens: any[],
  components: any
): any {
  const issues = [];
  let score = 100; // Comenzamos con puntuación perfecta
  
  // Validar colores
  if (colorTokens.length === 0) {
    issues.push('No se encontraron estilos de color definidos');
    score -= 20;
  } else if (colorTokens.length < 5) {
    issues.push('Pocos estilos de color definidos, el sistema podría no ser completo');
    score -= 10;
  }
  
  // Validar tipografía
  if (typographyTokens.length === 0) {
    issues.push('No se encontraron estilos tipográficos definidos');
    score -= 20;
  } else if (typographyTokens.length < 3) {
    issues.push('Pocos estilos tipográficos definidos, el sistema podría carecer de jerarquía');
    score -= 10;
  }
  
  // Validar espaciado
  if (spacingTokens.length === 0) {
    issues.push('No se pudieron identificar tokens de espaciado consistentes');
    score -= 15;
  }
  
  // Validar sombras
  if (shadowTokens.length === 0) {
    issues.push('No se encontraron estilos de sombras definidos');
    score -= 10;
  }
  
  // Validar radios
  if (radiiTokens.length === 0) {
    issues.push('No se pudieron identificar tokens de radio de borde consistentes');
    score -= 10;
  }
  
  // Validar componentes
  if (components.atomic.length === 0 && components.composite.length === 0) {
    issues.push('No se encontraron componentes definidos');
    score -= 15;
  }
  
  // Limitar puntuación mínima a 0
  score = Math.max(0, score);
  
  return {
    score,
    issues
  };
}

/**
 * Genera sugerencias de implementación basadas en el análisis
 */
function generateImplementationSuggestions(
  colorTokens: any[], 
  typographyTokens: any[], 
  components: any
): any {
  // Determinar framework CSS más adecuado
  let cssFramework = 'tailwind';
  let componentLibrary = 'none';
  let tokenFormat = 'css';
  
  // Si hay muchos componentes complejos, sugerir un framework de componentes
  if (components.composite.length > 5 || components.patterns.length > 3) {
    componentLibrary = 'custom-components';
    
    // Sugerir biblioteca de componentes basada en patrones
    if (components.patterns.some((p: any) => /form|formulario/i.test(p.name))) {
      componentLibrary = 'react-hook-form';
    }
  }
  
  // Si hay muchos estilos de color y tipografía, sugerir tokens de diseño
  if (colorTokens.length > 8 || typographyTokens.length > 6) {
    tokenFormat = 'designTokens';
  }
  
  return {
    cssFramework,
    componentLibrary,
    tokenFormat,
    recommendations: [
      "Implementar los tokens de diseño como variables CSS o en un sistema de tokens",
      "Utilizar un sistema tipo Scale para mantener consistencia en espaciados y tipografía",
      "Desarrollar componentes atómicos reutilizables antes de construir patrones complejos"
    ]
  };
}

/**
 * Extrae tokens de diseño según los tipos especificados
 */
function extractTokens(nodeInfo: any, stylesData: any, tokenTypes: string[]): any {
  const tokens: Record<string, any[]> = {};
  
  // Extraer cada tipo de token solicitado
  for (const tokenType of tokenTypes) {
    switch (tokenType) {
      case 'colors':
        tokens.colors = extractColorTokens(stylesData);
        break;
      case 'typography':
        tokens.typography = extractTypographyTokens(stylesData);
        break;
      case 'spacing':
        tokens.spacing = extractSpacingTokens(nodeInfo, 'detailed');
        break;
      case 'shadows':
        tokens.shadows = extractShadowTokens(stylesData);
        break;
      case 'radii':
        tokens.radii = extractRadiiTokens(stylesData, nodeInfo);
        break;
    }
  }
  
  return tokens;
}

/**
 * Genera código de tokens en diferentes formatos
 */
function generateTokenCode(tokens: Record<string, any[]>, format: string): Record<string, string> {
  const codeOutput: Record<string, string> = {};
  
  switch (format) {
    case 'css':
      codeOutput.css = generateCssTokens(tokens);
      break;
    case 'scss':
      codeOutput.scss = generateScssTokens(tokens);
      break;
    case 'json':
      codeOutput.json = generateJsonTokens(tokens);
      break;
    case 'js':
      codeOutput.js = generateJsTokens(tokens);
      break;
    case 'ts':
      codeOutput.ts = generateTsTokens(tokens);
      break;
  }
  
  return codeOutput;
}

/**
 * Genera tokens en formato CSS Variables
 */
function generateCssTokens(tokens: Record<string, any[]>): string {
  let cssCode = `:root {\n`;
  
  // Procesar cada tipo de token
  for (const tokenType in tokens) {
    cssCode += `  /* ${tokenType.toUpperCase()} */\n`;
    
    tokens[tokenType].forEach(token => {
      const tokenName = `--${token.category ? `${token.category}-` : ''}${token.name}`;
      let tokenValue = '';
      
      switch (token.type) {
        case 'color':
          tokenValue = token.opacity !== undefined ? 
            `rgba(${hexToRgb(token.value)}, ${token.opacity})` : 
            token.value;
          break;
        case 'typography':
          // Para tipografía en CSS creamos variables separadas
          if (token.value.fontFamily) {
            cssCode += `  ${tokenName}-font-family: ${token.value.fontFamily};\n`;
          }
          if (token.value.fontSize) {
            cssCode += `  ${tokenName}-font-size: ${token.value.fontSize};\n`;
          }
          if (token.value.fontWeight) {
            cssCode += `  ${tokenName}-font-weight: ${token.value.fontWeight};\n`;
          }
          if (token.value.lineHeight) {
            cssCode += `  ${tokenName}-line-height: ${token.value.lineHeight};\n`;
          }
          if (token.value.letterSpacing) {
            cssCode += `  ${tokenName}-letter-spacing: ${token.value.letterSpacing};\n`;
          }
          continue; // Saltar la asignación general para tipografía
        case 'shadow':
          if (token.value.type === 'dropShadow') {
            tokenValue = `${token.value.x} ${token.value.y} ${token.value.blur} ${token.value.spread} ${token.value.color}`;
          } else {
            tokenValue = `inset ${token.value.x} ${token.value.y} ${token.value.blur} ${token.value.spread} ${token.value.color}`;
          }
          break;
        default:
          tokenValue = token.value;
      }
      
      // Si no es un token de tipografía, añadir la variable
      if (token.type !== 'typography') {
        cssCode += `  ${tokenName}: ${tokenValue};\n`;
      }
    });
    
    cssCode += `\n`;
  }
  
  cssCode += `}\n`;
  return cssCode;
}

/**
 * Genera tokens en formato SCSS Variables y Maps
 */
function generateScssTokens(tokens: Record<string, any[]>): string {
  let scssCode = `// Design Tokens generados desde Figma\n\n`;
  
  // Procesar cada tipo de token
  for (const tokenType in tokens) {
    scssCode += `// ${tokenType.toUpperCase()}\n`;
    
    // Crear un mapa para este tipo de token
    scssCode += `$${tokenType}: (\n`;
    
    const tokensByCategory: Record<string, any[]> = {};
    
    // Agrupar tokens por categoría
    tokens[tokenType].forEach(token => {
      const category = token.category || 'base';
      if (!tokensByCategory[category]) {
        tokensByCategory[category] = [];
      }
      tokensByCategory[category].push(token);
    });
    
    // Generar código SCSS para cada categoría
    const categories = Object.keys(tokensByCategory);
    categories.forEach((category, categoryIndex) => {
      scssCode += `  '${category}': (\n`;
      
      tokensByCategory[category].forEach((token, tokenIndex) => {
        const isLast = tokenIndex === tokensByCategory[category].length - 1;
        const tokenName = token.name;
        let tokenValue = '';
        
        switch (token.type) {
          case 'color':
            tokenValue = token.opacity !== undefined ? 
              `rgba(${hexToRgb(token.value)}, ${token.opacity})` : 
              token.value;
            break;
          case 'typography':
            // Para tipografía crear un mapa anidado
            tokenValue = `(\n`;
            tokenValue += `      'font-family': ${JSON.stringify(token.value.fontFamily || 'inherit')},\n`;
            tokenValue += `      'font-size': ${JSON.stringify(token.value.fontSize || 'inherit')},\n`;
            tokenValue += `      'font-weight': ${token.value.fontWeight || 'normal'},\n`;
            tokenValue += `      'line-height': ${JSON.stringify(token.value.lineHeight || 'normal')},\n`;
            tokenValue += `      'letter-spacing': ${JSON.stringify(token.value.letterSpacing || 'normal')}\n`;
            tokenValue += `    )`;
            break;
          case 'shadow':
            if (token.value.type === 'dropShadow') {
              tokenValue = `'${token.value.x} ${token.value.y} ${token.value.blur} ${token.value.spread} ${token.value.color}'`;
            } else {
              tokenValue = `'inset ${token.value.x} ${token.value.y} ${token.value.blur} ${token.value.spread} ${token.value.color}'`;
            }
            break;
          default:
            tokenValue = JSON.stringify(token.value);
        }
        
        scssCode += `    '${tokenName}': ${tokenValue}${isLast ? '' : ','}\n`;
      });
      
      const isLastCategory = categoryIndex === categories.length - 1;
      scssCode += `  )${isLastCategory ? '' : ','}\n`;
    });
    
    scssCode += `);\n\n`;
    
    // Crear funciones helper para acceder a los tokens
    if (tokenType === 'colors') {
      scssCode += `// Función helper para colores\n`;
      scssCode += `@function color($category, $name) {\n`;
      scssCode += `  @return map-get(map-get($colors, $category), $name);\n`;
      scssCode += `}\n\n`;
    } else if (tokenType === 'spacing') {
      scssCode += `// Función helper para espaciado\n`;
      scssCode += `@function spacing($category, $name) {\n`;
      scssCode += `  @return map-get(map-get($spacing, $category), $name);\n`;
      scssCode += `}\n\n`;
    }
  }
  
  return scssCode;
}

/**
 * Genera tokens en formato JSON
 */
function generateJsonTokens(tokens: Record<string, any[]>): string {
  const jsonStructure: Record<string, any> = {};
  
  // Construir estructura para JSON
  for (const tokenType in tokens) {
    jsonStructure[tokenType] = {};
    
    // Agrupar por categoría
    tokens[tokenType].forEach(token => {
      const category = token.category || 'base';
      
      // Crear categoría si no existe
      if (!jsonStructure[tokenType][category]) {
        jsonStructure[tokenType][category] = {};
      }
      
      // Añadir token a su categoría
      jsonStructure[tokenType][category][token.name] = {
        value: token.value,
        type: token.type,
        description: token.description,
        ...(token.figmaStyleId && { figmaStyleId: token.figmaStyleId })
      };
    });
  }
  
  // Convertir a string con formato
  return JSON.stringify(jsonStructure, null, 2);
}

/**
 * Genera tokens en formato JavaScript
 */
function generateJsTokens(tokens: Record<string, any[]>): string {
  const jsonStructure = JSON.parse(generateJsonTokens(tokens));
  let jsCode = `// Design Tokens generados desde Figma\n\n`;
  
  // Convertir la estructura a código JS
  jsCode += `const designTokens = ${JSON.stringify(jsonStructure, null, 2)};\n\n`;
  
  // Crear exportaciones para cada tipo de token
  for (const tokenType in tokens) {
    jsCode += `export const ${tokenType} = designTokens.${tokenType};\n`;
  }
  
  // Exportación por defecto
  jsCode += `\nexport default designTokens;\n`;
  
  return jsCode;
}

/**
 * Genera tokens en formato TypeScript
 */
function generateTsTokens(tokens: Record<string, any[]>): string {
  // Generar la base de JS
  let tsCode = generateJsTokens(tokens);
  
  // Añadir interfaces de TypeScript
  tsCode = `// Design Tokens generados desde Figma\n\n`;
  
  // Crear interfaces para cada tipo de token
  for (const tokenType in tokens) {
    const pascalType = tokenType.charAt(0).toUpperCase() + tokenType.slice(1);
    
    tsCode += `interface ${pascalType}Token {\n`;
    tsCode += `  value: ${tokenType === 'typography' ? '{\n' +
      '    fontFamily?: string;\n' +
      '    fontSize?: string;\n' +
      '    fontWeight?: number;\n' +
      '    lineHeight?: string;\n' +
      '    letterSpacing?: string;\n' +
      '  }' : tokenType === 'colors' ? 'string' : tokenType === 'shadows' ? 'string' : 'string'};\n`;
    tsCode += `  type: string;\n`;
    tsCode += `  description?: string;\n`;
    tsCode += `  figmaStyleId?: string;\n`;
    tsCode += `}\n\n`;
    
    // Crear tipo para categorías
    tsCode += `interface ${pascalType}Category {\n`;
    tsCode += `  [tokenName: string]: ${pascalType}Token;\n`;
    tsCode += `}\n\n`;
    
    // Crear tipo para el grupo completo
    tsCode += `interface ${pascalType}Group {\n`;
    tsCode += `  [category: string]: ${pascalType}Category;\n`;
    tsCode += `}\n\n`;
  }
  
  // Interfaz para todos los tokens
  tsCode += `interface DesignTokens {\n`;
  for (const tokenType in tokens) {
    const pascalType = tokenType.charAt(0).toUpperCase() + tokenType.slice(1);
    tsCode += `  ${tokenType}: ${pascalType}Group;\n`;
  }
  tsCode += `}\n\n`;
  
  // Generar los datos
  const jsonStructure = JSON.parse(generateJsonTokens(tokens));
  tsCode += `const designTokens: DesignTokens = ${JSON.stringify(jsonStructure, null, 2)};\n\n`;
  
  // Exportaciones
  for (const tokenType in tokens) {
    const pascalType = tokenType.charAt(0).toUpperCase() + tokenType.slice(1);
    tsCode += `export const ${tokenType}: ${pascalType}Group = designTokens.${tokenType};\n`;
  }
  
  tsCode += `\nexport default designTokens;\n`;
  
  return tsCode;
}

/**
 * Calcula estadísticas sobre los tokens extraídos
 */
function calculateTokenStatistics(tokens: Record<string, any[]>): any {
  let tokenCount = 0;
  const tokenTypeStats: Record<string, number> = {};
  const categoryStats: Record<string, number> = {};
  
  // Contar tokens por tipo y categoría
  for (const tokenType in tokens) {
    const typeTokens = tokens[tokenType];
    tokenCount += typeTokens.length;
    tokenTypeStats[tokenType] = typeTokens.length;
    
    // Contar por categoría
    typeTokens.forEach(token => {
      const category = token.category || 'base';
      if (!categoryStats[category]) {
        categoryStats[category] = 0;
      }
      categoryStats[category]++;
    });
  }
  
  // Calcular consistencia basada en distribución y categorías
  let consistencyScore = 100;
  
  // Si no hay tokens, consistencia es 0
  if (tokenCount === 0) {
    consistencyScore = 0;
  } else {
    // Verificar distribución entre tipos de tokens
    const expectedDistribution = {
      colors: 0.25,
      typography: 0.20,
      spacing: 0.20,
      shadows: 0.15,
      radii: 0.20
    };
    
    // Reducir puntuación si faltan tipos de tokens importantes
    const missingTypes = ['colors', 'typography'].filter(type => !tokens[type] || tokens[type].length === 0);
    consistencyScore -= missingTypes.length * 20;
    
    // Reducir puntuación si hay pocos tokens
    if (tokenCount < 10) {
      consistencyScore -= Math.max(0, (10 - tokenCount) * 5);
    }
    
    // Verificar categorización
    const hasCategorization = Object.keys(categoryStats).length > 1;
    if (!hasCategorization) {
      consistencyScore -= 15;
    }
  }
  
  // Limitar consistencia entre 0 y 100
  consistencyScore = Math.max(0, Math.min(100, consistencyScore));
  
  // Calcular cobertura estimada
  const coverage = tokenCount > 0 ? Math.min(95, 40 + Math.sqrt(tokenCount) * 5) : 0;
  
  return {
    tokenCount,
    tokensByType: tokenTypeStats,
    tokensByCategory: categoryStats,
    consistencyScore,
    coverage: Math.round(coverage),
    timestamp: new Date().toISOString()
  };
}
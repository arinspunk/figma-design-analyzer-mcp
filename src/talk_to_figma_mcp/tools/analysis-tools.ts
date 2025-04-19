/**
 * Herramientas avanzadas para análisis de diseño en Figma
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendCommandToFigma } from "../core/figma-connection.js";
import { hexToRgb } from "../utils/figma-utils.js";

/**
 * Registra las herramientas de análisis en el servidor MCP
 */
export function registerAnalysisTools(server: McpServer): void {
  // Analyze Design System Tool (mejorado para ser más flexible)
  server.tool(
    "analyze_design_system",
    "Examinar un documento de Figma para identificar y estructurar su sistema de diseño subyacente",
    {
      documentId: z.string().optional().describe("Identificador del documento Figma (si se omite, se usa el documento actual)"),
      detailLevel: z.enum(["basic", "detailed", "comprehensive"]).default("detailed").describe("Nivel de detalle del análisis"),
      includeComponents: z.boolean().default(true).describe("Booleano para incluir análisis de componentes"),
      inferStyles: z.boolean().default(true).describe("Intentar inferir estilos no formalmente definidos"),
    },
    async ({ documentId, detailLevel, includeComponents, inferStyles }) => {
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
        let stylesResult = await sendCommandToFigma("get_styles");
        
        // Si no hay estilos formales y se ha solicitado inferencia, inferirlos
        if (inferStyles && 
           (!stylesResult.colors || stylesResult.colors.length === 0) && 
           (!stylesResult.texts || stylesResult.texts.length === 0)) {
          
          const inferredStyles = await inferStylesFromDocument(documentInfo);
          
          // Combinar estilos formales con inferidos
          stylesResult = {
            colors: [...(stylesResult.colors || []), ...(inferredStyles.colors || [])],
            texts: [...(stylesResult.texts || [])],
            effects: [...(stylesResult.effects || []), ...(inferredStyles.effects || [])],
            grids: [...(stylesResult.grids || []), ...(inferredStyles.grids || [])]
          };
        }
        
        // Obtener componentes locales si se solicita
        let componentsResult = null;
        if (includeComponents) {
          componentsResult = await sendCommandToFigma("get_local_components");
        }

        // Analizar los datos recopilados para identificar el sistema de diseño
        const designSystem = analyzeDesignSystem(documentInfo, stylesResult, componentsResult, detailLevel);
        
        // Añadir recomendaciones específicas si el sistema de diseño es limitado
        const isLimitedDesignSystem = designSystem.designSystem.consistency.score < 50;
        
        if (isLimitedDesignSystem) {
          designSystem.designSystem.recommendations = generateRecommendationsForLimitedSystem(designSystem.designSystem);
        }

        return {
          content: [
            initialStatus,
            {
              type: "text" as const,
              text: isLimitedDesignSystem ? 
                "Se ha detectado que el documento no tiene un sistema de diseño formalmente definido. Se ha realizado un análisis basado en los elementos detectados y se han generado recomendaciones para mejorar la consistencia." :
                "Análisis del sistema de diseño completado."
            },
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

  // Extract Design Tokens Tool (mejorada para inferir tokens)
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
      .describe("Formato de salida"),
      inferTokens: z.boolean().default(true).describe("Inferir tokens aunque no estén explícitamente definidos")
    },
    async ({ nodeId, tokenTypes, format, inferTokens }) => {
      try {
        // Mensaje inicial para indicar que el proceso ha comenzado
        const initialStatus = {
          type: "text" as const,
          text: `Iniciando extracción de tokens de diseño (${tokenTypes.join(", ")}) con formato de salida '${format}'. Esto puede tomar unos momentos...`,
        };

        // Obtener información del nodo especificado
        const nodeInfo = await sendCommandToFigma("get_node_info", { nodeId });
        
        // Obtener estilos del documento para análisis
        let stylesResult = await sendCommandToFigma("get_styles");
        
        // Si no hay suficientes estilos definidos y se solicita inferencia, inferir tokens
        const hasLimitedStyles = (!stylesResult.colors || stylesResult.colors.length === 0 || 
                                !stylesResult.texts || stylesResult.texts.length === 0);
        
        let inferredTokensInfo = null;
        
        if (inferTokens && hasLimitedStyles) {
          // Inferir tokens analizando el nodo
          inferredTokensInfo = await inferTokensFromNode(nodeInfo);
          
          // Combinar estilos formales con inferidos
          stylesResult = {
            colors: [...(stylesResult.colors || []), ...(inferredTokensInfo.colors || [])],
            texts: [...(stylesResult.texts || [])],
            effects: [...(stylesResult.effects || []), ...(inferredTokensInfo.effects || [])],
            grids: [...(stylesResult.grids || []), ...(inferredTokensInfo.grids || [])]
          };
        }
        
        // Extraer los tokens solicitados
        const tokens = extractTokens(nodeInfo, stylesResult, tokenTypes);
        
        // Añadir información de análisis de color para tokens inferidos
        if (inferTokens && hasLimitedStyles && tokens.colors && tokens.colors.length > 0) {
          tokens.colorAnalysis = analyzeColors(tokens.colors);
        }
        
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
              text: inferTokens && hasLimitedStyles ? 
                "Se han inferido tokens adicionales ya que no se encontraron suficientes estilos definidos formalmente." :
                "Tokens extraídos correctamente."
            },
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
 * Genera recomendaciones para mejorar un sistema de diseño limitado
 */
function generateRecommendationsForLimitedSystem(designSystem: any): any {
  const recommendations = {
    priority: [],
    consistency: [],
    implementation: []
  };

  // Verificar tokens disponibles
  const tokens = designSystem.tokens;
  const consistency = designSystem.consistency;

  // Recomendaciones prioritarias basadas en las deficiencias
  if (!tokens.colors || tokens.colors.length === 0) {
    recommendations.priority.push(
      "Definir una paleta de colores principal con al menos 5 tonos base y sus variaciones"
    );
  }
  
  if (!tokens.typography || tokens.typography.length === 0) {
    recommendations.priority.push(
      "Establecer estilos tipográficos para al menos títulos (h1-h3) y texto de cuerpo"
    );
  }
  
  if (!tokens.spacing || tokens.spacing.length < 3) {
    recommendations.priority.push(
      "Crear un sistema de espaciado consistente con al menos 4-5 valores incrementales"
    );
  }
  
  if (!tokens.shadows || tokens.shadows.length === 0) {
    recommendations.priority.push(
      "Añadir estilos de sombra para establecer jerarquía visual (al menos 2-3 niveles de elevación)"
    );
  }
  
  // Recomendaciones de consistencia
  recommendations.consistency = [
    "Utilizar colores, espaciados y tipografía consistentes en todos los elementos del diseño",
    "Agrupar estilos por categorías semánticas (ej: colores primarios, secundarios, etc.)",
    "Evitar valores arbitrarios y preferir un sistema escalable (4px, 8px, 16px...)"
  ];
  
  // Recomendaciones de implementación
  recommendations.implementation = [
    "Crear un archivo de estilos compartido en Figma para reutilización",
    "Implementar componentes reusables para elementos comunes (botones, inputs, tarjetas)",
    "Documentar las reglas del sistema para asegurar consistencia entre diseñadores"
  ];
  
  return recommendations;
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
 * Extrae tokens de color de los estilos
 */
function extractColorTokens(stylesData: any): any[] {
  // Inicializar array de tokens
  const colorTokens = [];
  
  // Verificar si hay estilos definidos
  if (stylesData && 'colors' in stylesData && Array.isArray(stylesData.colors)) {
    // Filtrar estilos de color
    const colorStyles = stylesData.colors;
    
    // Transformar estilos en tokens
    colorStyles.forEach((style: any) => {
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
      const nameParts = style.name ? style.name.split('/') : ["color"];
      const name = nameParts[nameParts.length - 1].toLowerCase().replace(/\s+/g, '-');
      const category = nameParts.length > 1 ? nameParts[0].toLowerCase() : 'base';
      
      colorTokens.push({
        name,
        category,
        value: colorValue,
        opacity: opacity !== 1 ? opacity : undefined,
        type: 'color',
        description: `Color: ${style.name || colorValue}`,
        figmaStyleId: style.id
      });
    });
  }
  
  return colorTokens;
}

/**
 * Extrae tokens de tipografía de los estilos
 */
function extractTypographyTokens(stylesData: any): any[] {
  // Inicializar array de tokens
  const typographyTokens = [];
  
  // Verificar si hay estilos definidos
  if (stylesData && 'texts' in stylesData && Array.isArray(stylesData.texts)) {
    // Filtrar estilos de texto
    const textStyles = stylesData.texts;
    
    // Transformar estilos en tokens
    textStyles.forEach((style: any) => {
      const styleData = style.style || {};
      
      // Generar nombre semántico para el token
      const nameParts = style.name ? style.name.split('/') : ["typography"];
      const name = nameParts[nameParts.length - 1].toLowerCase().replace(/\s+/g, '-');
      const category = nameParts.length > 1 ? nameParts[0].toLowerCase() : 'base';
      
      typographyTokens.push({
        name,
        category,
        type: 'typography',
        description: `Estilo de texto: ${style.name || "Estilo tipográfico"}`,
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
      });
    });
  }
  
  return typographyTokens;
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
  // Inicializar array de tokens
  const shadowTokens = [];
  
  // Verificar si hay estilos definidos
  if (stylesData && 'effects' in stylesData && Array.isArray(stylesData.effects)) {
    // Filtrar estilos de efecto (sombras)
    const effectStyles = stylesData.effects;
    
    // Transformar estilos en tokens
    effectStyles.forEach((style: any) => {
      let shadowValue = {};
      
      if (style.effects && style.effects.length > 0) {
        // Tomamos el primer efecto
        const effect = style.effects[0];
        if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
          // Convertir color RGB a HEX si existe
          let colorHex = '#000000';
          let alpha = 1;
          if (effect.color) {
            const r = Math.round(effect.color.r * 255);
            const g = Math.round(effect.color.g * 255);
            const b = Math.round(effect.color.b * 255);
            alpha = effect.color.a || 1;
            colorHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          }
          
          shadowValue = {
            type: effect.type === 'DROP_SHADOW' ? 'dropShadow' : 'innerShadow',
            color: colorHex,
            alpha: alpha,
            x: effect.offset ? `${effect.offset.x}px` : '0px',
            y: effect.offset ? `${effect.offset.y}px` : '0px',
            blur: `${effect.radius || 0}px`,
            spread: effect.spread ? `${effect.spread}px` : '0px'
          };
        }
      }
      
      // Generar nombre semántico para el token
      const nameParts = style.name ? style.name.split('/') : ["shadow"];
      const name = nameParts[nameParts.length - 1].toLowerCase().replace(/\s+/g, '-');
      const category = nameParts.length > 1 ? nameParts[0].toLowerCase() : 'base';
      
      shadowTokens.push({
        name,
        category,
        value: shadowValue,
        type: 'shadow',
        description: `Sombra: ${style.name || "Efecto de sombra"}`,
        figmaStyleId: style.id
      });
    });
  }
  
  return shadowTokens;
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
      let skipMainAssignment = false;  // Flag para controlar si saltamos la asignación general
      
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
          skipMainAssignment = true;  // Marcamos para saltar la asignación general
          break;
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
      
      // Si no debemos saltar la asignación general, añadir la variable
      if (!skipMainAssignment) {
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

/**
 * Analiza la información del documento, estilos y componentes para identificar el sistema de diseño
 * Esta es la función auxiliar que faltaba y causaba el error
 */
function analyzeDesignSystem(documentInfo: any, stylesData: any, componentsData: any, detailLevel: string): any {
  try {
    // Inicializar estructura de respuesta
    const designSystemAnalysis = {
      document: {
        id: documentInfo.id,
        name: documentInfo.name,
        type: documentInfo.type,
        pageCount: documentInfo.pages ? documentInfo.pages.length : 1
      },
      designSystem: {
        tokens: {},
        components: [],
        patterns: [],
        consistency: {
          score: 0,
          analysis: []
        },
        recommendations: []
      },
      statistics: {
        tokenCount: 0,
        componentCount: 0,
        patternCount: 0,
        consistencyScore: 0,
        completenessScore: 0,
        timestamp: new Date().toISOString()
      },
      meta: {
        detailLevel,
        includesComponents: componentsData !== null,
      }
    };

    // Analizar y extraer tokens de diseño de los estilos
    const tokenTypes = ["colors", "typography", "spacing", "shadows", "radii"];
    designSystemAnalysis.designSystem.tokens = extractTokens(documentInfo, stylesData, tokenTypes);
    
    // Contar tokens
    let tokenCount = 0;
    for (const tokenType in designSystemAnalysis.designSystem.tokens) {
      if (Array.isArray(designSystemAnalysis.designSystem.tokens[tokenType])) {
        tokenCount += designSystemAnalysis.designSystem.tokens[tokenType].length;
      }
    }
    designSystemAnalysis.statistics.tokenCount = tokenCount;
    
    // Analizar componentes si están disponibles
    if (componentsData && componentsData.components) {
      designSystemAnalysis.statistics.componentCount = componentsData.components.length;
      
      // Analizar solo en detalle si se solicita un análisis completo
      if (detailLevel === "comprehensive") {
        // Agrupar componentes por categorías semánticas
        const componentCategories = analyzeComponentCategories(componentsData.components);
        
        // Identificar patrones de diseño a partir de los componentes
        designSystemAnalysis.designSystem.patterns = identifyDesignPatterns(componentsData.components, documentInfo);
        designSystemAnalysis.statistics.patternCount = designSystemAnalysis.designSystem.patterns.length;
        
        // Estructurar información de componentes
        designSystemAnalysis.designSystem.components = componentCategories.map((category) => {
          return {
            category: category.name,
            components: category.components.map((comp) => ({
              id: comp.id,
              name: comp.name,
              type: comp.type,
              variantCount: comp.type === "COMPONENT_SET" ? (comp.children?.length || 0) : 0,
            }))
          };
        });
      } else {
        // Para análisis básico o detallado, solo incluir conteo y lista
        designSystemAnalysis.designSystem.components = componentsData.components.map((comp) => ({
          id: comp.id,
          name: comp.name,
          key: comp.key
        }));
      }
    }
    
    // Evaluar la consistencia del sistema de diseño
    const consistencyAnalysis = evaluateDesignSystemConsistency(
      designSystemAnalysis.designSystem.tokens,
      designSystemAnalysis.statistics.componentCount,
      tokenCount
    );
    
    designSystemAnalysis.designSystem.consistency = consistencyAnalysis;
    designSystemAnalysis.statistics.consistencyScore = consistencyAnalysis.score;
    
    // Calcular completitud del sistema de diseño
    const completenessScore = calculateCompleteness(
      designSystemAnalysis.designSystem.tokens,
      designSystemAnalysis.statistics.componentCount,
      detailLevel
    );
    designSystemAnalysis.statistics.completenessScore = completenessScore;
    
    return designSystemAnalysis;
  } catch (error) {
    console.error("Error en analyzeDesignSystem:", error);
    return {
      error: `Error al analizar sistema de diseño: ${error instanceof Error ? error.message : String(error)}`,
      document: {
        id: documentInfo.id,
        name: documentInfo.name
      }
    };
  }
}

/**
 * Analiza componentes y los agrupa en categorías semánticas
 */
function analyzeComponentCategories(components: any[]): any[] {
  // Mapa para agrupar componentes por categorías
  const categoriesMap: Record<string, any[]> = {};
  
  components.forEach((component) => {
    // Intentar determinar categoría a partir del nombre
    let categoryName = "General";
    
    // Dividir por separadores comunes
    const nameParts = component.name.split(/[\/\-_\s]/);
    
    // Buscar categorías comunes en el nombre
    const commonCategories = [
      "button", "input", "form", "card", "nav", "header", "footer", "modal", "dialog",
      "icon", "typography", "menu", "list", "table", "chart", "image", "avatar"
    ];
    
    for (const part of nameParts) {
      const lowercasePart = part.toLowerCase();
      if (commonCategories.includes(lowercasePart) || 
          commonCategories.some(cat => lowercasePart.includes(cat))) {
        categoryName = lowercasePart.charAt(0).toUpperCase() + lowercasePart.slice(1);
        break;
      }
    }
    
    // Si el nombre incluye "property" o "variant", es probablemente parte de un set de componentes
    if (component.name.toLowerCase().includes("property") || 
        component.name.toLowerCase().includes("variant")) {
      categoryName = "Variants";
    }
    
    // Crear categoría si no existe
    if (!categoriesMap[categoryName]) {
      categoriesMap[categoryName] = [];
    }
    
    // Añadir componente a su categoría
    categoriesMap[categoryName].push(component);
  });
  
  // Convertir mapa a array
  return Object.keys(categoriesMap).map(name => ({
    name,
    components: categoriesMap[name]
  }));
}

/**
 * Identifica patrones de diseño a partir de los componentes
 */
function identifyDesignPatterns(components: any[], documentInfo: any): any[] {
  const patterns = [];
  
  // Analizar para identificar patrones comunes
  
  // Patrón: Sistema de botones
  const buttonComponents = components.filter(comp => 
    comp.name.toLowerCase().includes("button") ||
    (comp.type === "COMPONENT_SET" && comp.children?.some(c => c.name.toLowerCase().includes("button")))
  );
  
  if (buttonComponents.length > 0) {
    patterns.push({
      name: "Button System",
      type: "UI Component",
      elements: buttonComponents.length,
      description: `Sistema de botones con ${buttonComponents.length} variantes o estados`,
      components: buttonComponents.map(c => c.id)
    });
  }
  
  // Patrón: Sistema tipográfico
  const typographyComponents = components.filter(comp => 
    comp.name.toLowerCase().includes("text") ||
    comp.name.toLowerCase().includes("heading") ||
    comp.name.toLowerCase().includes("title") ||
    comp.name.toLowerCase().includes("paragraph") ||
    comp.type === "TEXT"
  );
  
  if (typographyComponents.length > 0) {
    patterns.push({
      name: "Typography System",
      type: "Text Styles",
      elements: typographyComponents.length,
      description: `Sistema tipográfico con ${typographyComponents.length} elementos`,
      components: typographyComponents.map(c => c.id)
    });
  }
  
  // Otros patrones que podrían detectarse: formularios, navegación, tarjetas, etc.
  
  return patterns;
}

/**
 * Evalúa la consistencia del sistema de diseño
 */
function evaluateDesignSystemConsistency(tokens: any, componentCount: number, tokenCount: number): any {
  // Inicializar análisis de consistencia
  const consistencyAnalysis = {
    score: 0,
    analysis: []
  };
  
  // Verificar tokens disponibles
  const hasColors = tokens.colors && tokens.colors.length > 0;
  const hasTypography = tokens.typography && tokens.typography.length > 0;
  const hasSpacing = tokens.spacing && tokens.spacing.length > 0;
  const hasShadows = tokens.shadows && tokens.shadows.length > 0;
  const hasRadii = tokens.radii && tokens.radii.length > 0;
  
  // Puntos base por tener tokens fundamentales
  let consistencyScore = 0;
  consistencyScore += hasColors ? 25 : 0;
  consistencyScore += hasTypography ? 25 : 0;
  consistencyScore += hasSpacing ? 15 : 0;
  consistencyScore += hasShadows ? 10 : 0;
  consistencyScore += hasRadii ? 10 : 0;
  
  // Añadir análisis de los tokens detectados
  if (hasColors) {
    consistencyAnalysis.analysis.push({
      aspect: "Color System",
      status: "Detected",
      details: `${tokens.colors.length} colores definidos`
    });
  } else {
    consistencyAnalysis.analysis.push({
      aspect: "Color System",
      status: "Missing",
      details: "No se detectaron colores definidos formalmente"
    });
  }
  
  if (hasTypography) {
    consistencyAnalysis.analysis.push({
      aspect: "Typography System",
      status: "Detected",
      details: `${tokens.typography.length} estilos tipográficos definidos`
    });
  } else {
    consistencyAnalysis.analysis.push({
      aspect: "Typography System",
      status: "Missing",
      details: "No se detectaron estilos tipográficos definidos formalmente"
    });
  }
  
  if (hasSpacing) {
    consistencyAnalysis.analysis.push({
      aspect: "Spacing System",
      status: "Detected",
      details: `${tokens.spacing.length} valores de espaciado detectados`
    });
  } else {
    consistencyAnalysis.analysis.push({
      aspect: "Spacing System",
      status: "Missing",
      details: "No se detectaron valores de espaciado consistentes"
    });
  }
  
  // Puntos adicionales por número de componentes
  if (componentCount > 0) {
    consistencyScore += Math.min(15, componentCount);
    consistencyAnalysis.analysis.push({
      aspect: "Component Library",
      status: "Detected",
      details: `${componentCount} componentes definidos`
    });
  } else {
    consistencyAnalysis.analysis.push({
      aspect: "Component Library",
      status: "Missing",
      details: "No se detectaron componentes reutilizables"
    });
  }
  
  // Limitar la puntuación a 100
  consistencyScore = Math.min(100, consistencyScore);
  
  // Asignar clasificación general
  let consistencyLevel = "Undefined";
  if (consistencyScore >= 85) consistencyLevel = "High";
  else if (consistencyScore >= 60) consistencyLevel = "Medium";
  else if (consistencyScore >= 30) consistencyLevel = "Low";
  else consistencyLevel = "Very Low";
  
  consistencyAnalysis.score = consistencyScore;
  consistencyAnalysis.level = consistencyLevel;
  
  return consistencyAnalysis;
}

/**
 * Calcula la completitud del sistema de diseño
 */
function calculateCompleteness(tokens: any, componentCount: number, detailLevel: string): number {
  // Definir puntos máximos según nivel de detalle
  const maxPoints = detailLevel === "comprehensive" ? 100 : 
                    detailLevel === "detailed" ? 80 : 60;
  
  // Contar elementos disponibles
  let availablePoints = 0;
  
  // Puntos por tokens de color
  if (tokens.colors && tokens.colors.length > 0) {
    availablePoints += Math.min(20, 5 + tokens.colors.length);
  }
  
  // Puntos por tokens tipográficos
  if (tokens.typography && tokens.typography.length > 0) {
    availablePoints += Math.min(20, 5 + tokens.typography.length);
  }
  
  // Puntos por tokens de espaciado
  if (tokens.spacing && tokens.spacing.length > 0) {
    availablePoints += Math.min(15, 5 + tokens.spacing.length);
  }
  
  // Puntos por tokens de sombras
  if (tokens.shadows && tokens.shadows.length > 0) {
    availablePoints += Math.min(10, tokens.shadows.length * 2);
  }
  
  // Puntos por tokens de radios
  if (tokens.radii && tokens.radii.length > 0) {
    availablePoints += Math.min(10, tokens.radii.length * 2);
  }
  
  // Puntos por componentes
  availablePoints += Math.min(25, componentCount);
  
  // Calcular porcentaje de completitud
  return Math.round((availablePoints / maxPoints) * 100);
}

/**
 * Infiere estilos analizando el documento
 */
function inferStylesFromDocument(documentInfo: any): any {
  // Inicializar resultados
  const inferredStyles = {
    colors: [],
    effects: [],
    grids: []
  };
  
  // Conjunto para almacenar colores únicos
  const uniqueColors = new Set<string>();
  
  // Función recursiva para extraer colores y efectos
  const extractVisualProperties = (node: any) => {
    if (!node) return;
    
    // Extraer colores de rellenos
    if (node.fills && Array.isArray(node.fills)) {
      node.fills.forEach((fill: any) => {
        if (fill.type === 'SOLID' && fill.color) {
          // Convertir a HEX para identificación única
          const r = Math.round(fill.color.r * 255);
          const g = Math.round(fill.color.g * 255);
          const b = Math.round(fill.color.b * 255);
          const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          
          // Añadir si es único
          if (!uniqueColors.has(hexColor)) {
            uniqueColors.add(hexColor);
            
            // Inferir nombre semántico basado en el color
            let inferredName = '';
            
            // Detectar blancos y negros
            if (r > 240 && g > 240 && b > 240) inferredName = 'white';
            else if (r < 15 && g < 15 && b < 15) inferredName = 'black';
            // Detectar grises
            else if (Math.abs(r - g) < 20 && Math.abs(r - b) < 20 && Math.abs(g - b) < 20) {
              inferredName = r < 128 ? 'darkGrey' : 'lightGrey';
            }
            // Detectar colores primarios
            else if (r > 200 && g < 100 && b < 100) inferredName = 'red';
            else if (r < 100 && g > 200 && b < 100) inferredName = 'green';
            else if (r < 100 && g < 100 && b > 200) inferredName = 'blue';
            // Otros colores comunes
            else if (r > 200 && g > 150 && b < 100) inferredName = 'yellow';
            else if (r > 150 && g < 100 && b > 150) inferredName = 'purple';
            else if (r < 100 && g > 150 && b > 150) inferredName = 'cyan';
            else inferredName = `color${inferredStyles.colors.length + 1}`;
            
            inferredStyles.colors.push({
              id: `inferred-${hexColor.replace('#', '')}`,
              name: inferredName,
              paints: [{
                type: 'SOLID',
                color: {
                  r: fill.color.r,
                  g: fill.color.g,
                  b: fill.color.b
                },
                opacity: fill.opacity || 1
              }]
            });
          }
        }
      });
    }
    
    // Extraer efectos (sombras)
    if (node.effects && Array.isArray(node.effects) && node.effects.length > 0) {
      node.effects.forEach((effect: any, index: number) => {
        if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
          inferredStyles.effects.push({
            id: `inferred-effect-${inferredStyles.effects.length}`,
            name: effect.type === 'DROP_SHADOW' ? `dropShadow${index + 1}` : `innerShadow${index + 1}`,
            effects: [effect]
          });
        }
      });
    }
    
    // Explorar hijos recursivamente
    if (node.children && node.children.length > 0) {
      node.children.forEach(extractVisualProperties);
    }
  };
  
  // Iniciar extracción recursiva
  extractVisualProperties(documentInfo);
  
  return inferredStyles;
}
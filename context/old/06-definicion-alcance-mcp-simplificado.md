Prompt:

continua con el punto 2.1 del plan maestro

Respuesta:

# Definición del Alcance para el MCP Simplificado

## 1. Evaluación de Herramientas Existentes

Basándonos en el análisis detallado del MCP actual y el estudio de necesidades de desarrolladores front-end, hemos clasificado todas las herramientas existentes según su relevancia para el nuevo enfoque:

### 1.1 Herramientas a Mantener (Sin Modificaciones)

Estas herramientas ya proporcionan funcionalidad de lectura esencial y pueden conservarse tal como están:

1. `get_document_info`: Proporciona información general sobre el documento de Figma.
2. `get_selection`: Obtiene datos sobre los elementos actualmente seleccionados.
3. `get_styles`: Recupera información sobre los estilos definidos en el documento.
4. `get_local_components`: Obtiene componentes locales del documento.
5. `get_remote_components`: Obtiene componentes de las bibliotecas de equipo.
6. `get_styled_text_segments`: Analiza segmentos de texto con diferentes estilos.
7. `join_channel`: Herramienta de configuración necesaria para la comunicación.

### 1.2 Herramientas a Modificar/Mejorar

Estas herramientas son útiles pero requieren optimizaciones para proporcionar información más relevante para desarrolladores:

1. `get_node_info`: Mejorar para incluir:
   - Información CSS detallada
   - Tokens de diseño aplicados
   - Relaciones jerárquicas más claras
   - Datos de restricciones responsivas

2. `get_nodes_info`: Mejorar para:
   - Optimizar el rendimiento con múltiples nodos
   - Proporcionar información sobre relaciones entre nodos
   - Incluir datos agregados (patrones comunes, inconsistencias)

3. `scan_text_nodes`: Mejorar para:
   - Extraer jerarquía tipográfica
   - Identificar patrones de contenido
   - Proporcionar información de accesibilidad

4. `export_node_as_image`: Mantener pero optimizar para:
   - Ofrecer formatos más ligeros
   - Incluir metadatos relevantes en la exportación

### 1.3 Herramientas a Eliminar

Todas las herramientas de manipulación serán eliminadas para simplificar el MCP, incluyendo:

1. Herramientas de creación: `create_rectangle`, `create_frame`, `create_text`, `create_ellipse`, `create_polygon`, `create_star`, `create_vector`, `create_line`, `create_component_instance`

2. Herramientas de modificación: `set_fill_color`, `set_stroke_color`, `move_node`, `resize_node`, `set_corner_radius`, `set_text_content`, `set_multiple_text_contents`, `set_auto_layout`, `set_effects`, `set_effect_style_id`

3. Herramientas de propiedades de texto: `set_font_name`, `set_font_size`, `set_font_weight`, `set_letter_spacing`, `set_line_height`, `set_paragraph_spacing`, `set_text_case`, `set_text_decoration`

4. Herramientas de organización: `delete_node`, `clone_node`, `group_nodes`, `ungroup_nodes`, `flatten_node`, `insert_child`

## 2. Nuevas Herramientas de Análisis

Para satisfacer las necesidades específicas de los desarrolladores front-end, proponemos añadir las siguientes nuevas herramientas:

### 2.1 Herramientas de Análisis Estructural

1. `analyze_component_hierarchy`: Analiza la estructura jerárquica completa de un componente o diseño, identificando:
   - Estructura DOM recomendada
   - Relaciones contenedor-contenido
   - Patrones de componentes reutilizables

2. `detect_layout_system`: Identifica el sistema de layout utilizado (grid, flexbox, etc.) y proporciona:
   - Configuración de grid/flexbox recomendada
   - Parámetros de alineación y distribución
   - Sugerencias de implementación responsiva

### 2.2 Herramientas de Extracción de Diseño

1. `extract_design_tokens`: Analiza el documento para extraer:
   - Palette de colores completa
   - Sistema tipográfico
   - Espaciados consistentes
   - Sombras y efectos recurrentes
   - Variables de diseño

2. `get_component_variants`: Identifica todas las variantes de un componente y:
   - Enumera los estados (default, hover, active, etc.)
   - Documenta las props/propiedades variables
   - Sugiere estructura para implementación en frameworks comunes

### 2.3 Herramientas de Generación de Código

1. `suggest_component_implementation`: Genera sugerencias de implementación en:
   - HTML/CSS estándar
   - React/JSX
   - Vue/Templates
   - Otros frameworks según se requiera

2. `analyze_accessibility`: Evalúa aspectos de accesibilidad como:
   - Contraste de colores (WCAG)
   - Jerarquía semántica sugerida
   - Texto alternativo para imágenes
   - Tamaños interactivos adecuados

## 3. Formato de Respuesta Óptimo

Para maximizar la utilidad para LLMs que generan código, optimizaremos el formato de respuesta:

### 3.1 Estructura General

Todas las respuestas seguirán una estructura consistente:

```json
{
  \"metadata\": {
    \"figmaObjectType\": \"string\",
    \"figmaObjectId\": \"string\",
    \"figmaObjectName\": \"string\",
    \"analysisTimestamp\": \"ISO-datetime\"
  },
  \"summary\": {
    \"brief\": \"string\",
    \"complexity\": \"string\",
    \"suggestedImplementation\": \"string\"
  },
  \"visualData\": {
    \"imageUrl\": \"string\",
    \"dimensions\": { \"width\": number, \"height\": number }
  },
  \"cssProperties\": {
    // Propiedades CSS relevantes
  },
  \"structureData\": {
    // Información jerárquica y estructural
  },
  \"designTokens\": {
    // Tokens de diseño identificados
  },
  \"accessibility\": {
    // Información de accesibilidad
  },
  \"implementationSuggestions\": {
    // Sugerencias de código por framework
  }
}
```

### 3.2 Optimización para LLMs

Las respuestas estarán optimizadas para que los LLMs puedan:

1. **Comprender rápidamente el contexto visual** sin necesidad de "ver" el diseño directamente (aunque se proporcionará una imagen cuando sea posible)

2. **Identificar patrones** en la estructura y estilos del diseño

3. **Generar código eficiente** basado en la información estructurada

4. **Explicar decisiones de implementación** basadas en los datos proporcionados

### 3.3 Adaptabilidad por Tipo de Objeto

El formato se adaptará según el tipo de objeto Figma analizado:

1. **Componentes individuales**: Enfoque en propiedades, estados y variantes
2. **Grupos de componentes**: Enfoque en relaciones y estructura
3. **Pantallas completas**: Enfoque en layout y jerarquía visual
4. **Sistemas de diseño**: Enfoque en tokens y patrones consistentes

## 4. Limitaciones y Exclusiones

Para mantener el enfoque y la simplicidad, especificamos claramente las siguientes limitaciones:

1. **Sin manipulación de diseños**: El MCP no permitirá modificar diseños de Figma en ninguna forma.

2. **Sin generación directa de código**: Aunque proporcionará toda la información necesaria para generar código, la generación final se delegará al LLM o herramienta específica.

3. **Enfoque en componentes estáticos**: La primera versión se centrará en componentes de UI estáticos. Las animaciones y transiciones complejas se considerarán para versiones futuras.

4. **Compatibilidad limitada con prototipos**: Se analizarán los aspectos visuales de los prototipos, pero no todas las interacciones complejas.

5. **Compatibilidad con frameworks selectos**: Inicialmente se optimizará para React, Vue y HTML/CSS estándar, con otros frameworks como objetivos futuros.

## 5. Criterios de Éxito

El alcance se considerará exitoso si la herramienta permite:

1. **Extracción completa** de toda la información visual y estructural necesaria para implementar fielmente un diseño.

2. **Análisis eficiente** de componentes y sistemas de diseño complejos.

3. **Generación asistida de código** a través de LLMs con un alto grado de precisión y calidad.

4. **Mejora significativa en productividad** para desarrolladores front-end trabajando con diseños de Figma.

5. **Flexibilidad para diferentes frameworks** y metodologías de desarrollo front-end.

Este documento de alcance servirá como guía para las siguientes fases de diseño e implementación del MCP simplificado.

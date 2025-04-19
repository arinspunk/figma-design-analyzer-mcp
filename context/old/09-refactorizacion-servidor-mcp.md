# Refactorización del Servidor MCP

## 1. Visión General

Siguiendo el Plan Maestro y basándonos en la Definición del Alcance y el Diseño de la Arquitectura Simplificada, procederemos a refactorizar el servidor MCP con un enfoque específico en las capacidades de lectura y análisis para desarrolladores front-end.

Esta refactorización tiene como objetivo:

1. **Eliminar todas las herramientas de manipulación**
2. **Optimizar las herramientas de lectura existentes**
3. **Implementar nuevas herramientas analíticas**
4. **Mejorar el formato de respuesta**

## 2. Herramientas a Conservar y Optimizar

De acuerdo con el documento "06-definicion-alcance-mcp-simplificado.md", conservaremos las siguientes herramientas sin modificaciones:

- `get_document_info`
- `get_selection`
- `get_styles`
- `get_local_components`
- `get_remote_components`
- `get_styled_text_segments`
- `join_channel`

Y optimizaremos estas herramientas existentes:

- `get_node_info`
- `get_nodes_info`
- `scan_text_nodes`
- `export_node_as_image`

## 3. Herramientas a Eliminar

Todas las herramientas de manipulación serán eliminadas:

- Herramientas de creación: `create_rectangle`, `create_frame`, `create_text`, etc.
- Herramientas de modificación: `set_fill_color`, `move_node`, `resize_node`, etc.
- Herramientas de propiedades de texto: `set_font_name`, `set_font_size`, etc.
- Herramientas de organización: `delete_node`, `clone_node`, etc.

## 4. Nuevas Herramientas a Implementar

Según el documento "08-diseno-nuevas-capacidades.md", implementaremos estas nuevas herramientas analíticas:

- `analyze_design_system`
- `extract_design_tokens`
- `analyze_component_hierarchy`
- `detect_ui_patterns`
- `analyze_component_states`

## 5. Implementación de Cambios

### 5.1 Refactorización del Código Base

El archivo principal a modificar es:
- `src/talk_to_figma_mcp/server.ts`

Los cambios incluirán:
1. Actualización de la versión del servidor
2. Eliminación de las herramientas de manipulación
3. Optimización de las herramientas de lectura existentes
4. Implementación de las nuevas herramientas de análisis
5. Mejora del formato de respuesta para mayor utilidad para desarrolladores front-end

### 5.2 Estructura del Código Refactorizado

Para mejorar la mantenibilidad, reorganizaremos el código de la siguiente manera:

```
server.ts (archivo principal)
  ├── configuración y setup
  ├── herramientas básicas de lectura
  ├── herramientas optimizadas de análisis
  ├── nuevas herramientas analíticas
  ├── utilidades y helpers
  └── funciones de comunicación
```

### 5.3 Mejoras en el Formato de Respuesta

Para todas las herramientas, actualizaremos el formato de respuesta para incluir:

- Metadatos más completos
- Información relevante para desarrolladores (CSS, jerarquía, tokens)
- Sugerencias de implementación cuando sea apropiado
- Referencias a mejores prácticas

## 6. Implementación Detallada

A continuación, presentamos el código refactorizado para el servidor MCP, destacando los cambios realizados.
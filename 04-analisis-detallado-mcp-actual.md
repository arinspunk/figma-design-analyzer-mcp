Prompt:

Ejecuta el punto 1.1 del plan maestro

Respuesta: 

# Análisis Detallado del MCP Actual

## 1. Estructura del Sistema

El sistema Claude Talk to Figma MCP está compuesto por tres componentes principales:

1. **Plugin de Figma (`code.js`)**: 
   - Ejecuta comandos dentro del contexto de Figma
   - Implementa funciones para cada operación (crear, modificar, consultar elementos)
   - Se comunica con el servidor MCP a través de un WebSocket

2. **Servidor WebSocket (`socket.ts`)**: 
   - Establece un canal de comunicación bidireccional
   - Gestiona canales de comunicación para diferentes clientes
   - Maneja la transmisión de mensajes entre el plugin y el servidor MCP

3. **Servidor MCP (`server.ts`)**:
   - Define herramientas (tools) que Claude puede utilizar
   - Valida parámetros con Zod
   - Envía comandos al plugin a través del WebSocket
   - Formatea respuestas para Claude

## 2. Clasificación de Herramientas

He clasificado todas las herramientas en tres categorías:

### A. Herramientas de Lectura/Análisis

1. `get_document_info` - Obtiene información general del documento Figma
2. `get_selection` - Obtiene información sobre los elementos seleccionados
3. `get_node_info` - Obtiene detalles de un nodo específico
4. `get_nodes_info` - Obtiene detalles de múltiples nodos
5. `get_styles` - Obtiene estilos del documento
6. `get_local_components` - Obtiene componentes locales
7. `get_remote_components` - Obtiene componentes de las bibliotecas de equipo
8. `scan_text_nodes` - Escanea todos los nodos de texto en un diseño
9. `get_styled_text_segments` - Obtiene segmentos de texto con estilos específicos

### B. Herramientas de Manipulación

1. Creación de elementos:
   - `create_rectangle` - Crea un rectángulo
   - `create_frame` - Crea un marco/contenedor
   - `create_text` - Crea un elemento de texto
   - `create_ellipse` - Crea una elipse
   - `create_polygon` - Crea un polígono
   - `create_star` - Crea una estrella
   - `create_vector` - Crea un vector
   - `create_line` - Crea una línea
   - `create_component_instance` - Crea una instancia de un componente

2. Modificación de elementos:
   - `set_fill_color` - Establece el color de relleno
   - `set_stroke_color` - Establece el color de borde
   - `move_node` - Mueve un nodo
   - `resize_node` - Redimensiona un nodo
   - `set_corner_radius` - Establece el radio de esquinas
   - `set_text_content` - Modifica el contenido de texto
   - `set_multiple_text_contents` - Modifica múltiples textos en paralelo
   - `set_auto_layout` - Configura propiedades de diseño automático
   - `set_effects` - Establece efectos visuales
   - `set_effect_style_id` - Aplica un estilo de efecto

3. Propiedades de texto:
   - `set_font_name` - Establece la fuente
   - `set_font_size` - Establece el tamaño de fuente
   - `set_font_weight` - Establece el peso de la fuente
   - `set_letter_spacing` - Establece el espaciado entre letras
   - `set_line_height` - Establece la altura de línea
   - `set_paragraph_spacing` - Establece el espaciado de párrafos
   - `set_text_case` - Establece el formato de mayúsculas/minúsculas
   - `set_text_decoration` - Establece decoraciones de texto

4. Organización de elementos:
   - `delete_node` - Elimina un nodo
   - `clone_node` - Clona un nodo existente
   - `group_nodes` - Agrupa nodos
   - `ungroup_nodes` - Desagrupa nodos
   - `flatten_node` - Aplana un nodo
   - `insert_child` - Inserta un nodo hijo en un padre

### C. Herramientas Mixtas

1. `export_node_as_image` - Exporta un nodo como imagen (lectura y exportación)
2. `load_font_async` - Carga una fuente de manera asíncrona (preparación para manipulación)
3. `join_channel` - Une a un canal específico para comunicarse con Figma (configuración de conexión)

## 3. Análisis de Funcionalidad

### Flujo de comunicación

1. Claude envía una solicitud al servidor MCP
2. El servidor MCP valida los parámetros con Zod
3. El servidor MCP envía el comando al plugin de Figma vía WebSocket
4. El plugin ejecuta el comando en Figma y devuelve el resultado
5. El servidor MCP formatea la respuesta para Claude
6. Claude recibe la respuesta y la procesa

### Patrones observados

1. **Patrón de validación de parámetros**: Todas las herramientas utilizan Zod para validar parámetros
2. **Patrón de gestión de errores**: Manejo consistente de errores y excepciones
3. **Patrón de procesamiento por lotes**: Algunas operaciones complejas como `scan_text_nodes` y `set_multiple_text_contents` implementan procesamiento por lotes
4. **Patrón de retroalimentación progresiva**: Las operaciones largas envían actualizaciones de progreso periódicas

## Conclusiones para la Simplificación del MCP

Para convertir el MCP actual en una herramienta enfocada en la lectura y análisis de diseños para desarrolladores front-end, podríamos:

1. **Mantener todas las herramientas de lectura/análisis**: Las 9 herramientas identificadas en esta categoría son esenciales.

2. **Eliminar la mayoría de herramientas de manipulación**: Las 30+ herramientas de manipulación podrían ser eliminadas para simplificar el MCP.

3. **Considerar mantener algunas herramientas mixtas**: Especialmente `export_node_as_image` que es crucial para que los LLMs puedan "ver" visualmente un componente.

4. **Mejorar la estructura de datos devuelta**: Enriquecer las respuestas con información más relevante para desarrolladores (valores CSS, jerarquía de componentes, tokens de diseño).

Este análisis detallado nos proporciona una base sólida para avanzar con el plan de simplificación y transformación del MCP actual en una herramienta especializada para desarrolladores front-end.

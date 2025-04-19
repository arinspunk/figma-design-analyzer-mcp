> Sigue con el punto 2.2 del plan maestro

# Diseño de la Arquitectura Simplificada

## 1. Diagrama de la Nueva Arquitectura

La arquitectura propuesta mantiene la estructura base del sistema actual pero simplificada, eliminando componentes innecesarios y optimizando el flujo de datos para el caso de uso específico de desarrolladores front-end.

+-----------------+     +------------------+     +------------------+
|                 |     |                  |     |                  |
|  LLM (Claude,   |<--->|   MCP Server     |<--->|   Figma Plugin   |
|  GitHub Copilot,|     |   (Simplificado) |     |   (Solo Lectura) |
|  Cursor)        |     |                  |     |                  |
|                 |     |                  |     |                  |
+-----------------+     +------------------+     +------------------+
        ^                       ^                       ^
        |                       |                       |
        v                       v                       v
+-----------------+     +------------------+     +------------------+
|                 |     |                  |     |                  |
|  Editor de      |     |   Servidor       |     |   Archivo de     |
|  Código del     |     |   WebSocket      |     |   Diseño Figma   |
|  Desarrollador  |     |                  |     |                  |
+-----------------+     +------------------+     +------------------+

### 1.1 Componentes Principales

1. **Figma Plugin (Simplificado)**:
   - Versión reducida que elimina todas las capacidades de manipulación
   - Optimizado para lectura, análisis y exportación de información visual
   - Capacidad mejorada para extraer metadatos y propiedades CSS

2. **WebSocket Server**:
   - Mantiene la misma funcionalidad base para comunicación en tiempo real
   - Protocolo simplificado con menos tipos de mensajes
   - Mayor eficiencia en la transferencia de datos estructurados

3. **MCP Server (Simplificado)**:
   - Centrado exclusivamente en herramientas de análisis y lectura
   - Nuevos procesadores para extracción de tokens y análisis estructural
   - Formato de respuesta optimizado para generación de código

4. **LLM (Cliente externo)**:
   - Se conecta al MCP para solicitar información sobre diseños
   - Recibe datos estructurados que puede interpretar fácilmente
   - Genera código basado en la información recibida

5. **Developer Code Editor**:
   - Ambiente donde el desarrollador trabaja con el código generado
   - Potencialmente conectado directamente al LLM (como en Cursor)
   - Permite iteración rápida entre diseño y código

## 2. Flujo de Datos

El flujo de datos principal en esta arquitectura simplificada sigue estos pasos:

### 2.1 Flujo de Análisis de Diseño

1. **Solicitud Inicial**:
   - El desarrollador, a través del LLM, solicita información sobre un diseño de Figma
   - El LLM formula una consulta estructurada al MCP Server

2. **Procesamiento de la Solicitud**:
   - MCP Server recibe la solicitud y la valida con Zod
   - Se establece conexión WebSocket con el Figma Plugin
   - Se transmite el comando de lectura/análisis al plugin

3. **Extracción de Datos**:
   - Figma Plugin ejecuta operaciones de lectura en el diseño
   - Se obtienen propiedades visuales, estructurales y metadatos
   - Los datos son preprocesados para optimizar su transmisión

4. **Análisis y Transformación**:
   - Los datos regresan al MCP Server vía WebSocket
   - MCP Server aplica análisis adicional (extracción de tokens, patrones, etc.)
   - Se estructura la información en el formato optimizado para LLMs

5. **Respuesta al LLM**:
   - Los datos estructurados y analizados se envían al LLM
   - El LLM interpreta la información para entender el diseño
   - Se genera código basado en los datos recibidos

### 2.2 Flujo de Retroalimentación

En caso de necesitar información adicional o aclaraciones:

1. El LLM identifica qué información adicional se requiere
2. Formula una nueva consulta específica al MCP Server
3. Se repite el proceso de extracción enfocado en los detalles solicitados
4. La nueva información se integra con los datos previos
5. El LLM refina el código generado basado en la información completa

## 3. Interfaces y Protocolos de Comunicación

### 3.1 Interfaz LLM → MCP Server

**Protocolo**: Model Context Protocol (MCP)

**Esquema de Solicitud**:

```typescript
interface MCPRequest {
  toolName: string;   // Nombre de la herramienta (ej: 'get_node_info')
  parameters: {       // Parámetros específicos de cada herramienta
    [key: string]: any;
  };
  context?: {         // Contexto opcional para el análisis
    framework?: string;  // Framework objetivo (react, vue, etc.)
    outputFormat?: string; // Formato de salida preferido
    detailLevel?: 'basic' | 'detailed' | 'comprehensive';
  };
}
```

**Esquema de Respuesta**:

```typescript
interface MCPResponse {
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  data?: {
    metadata: {
      figmaObjectType: string;
      figmaObjectId: string;
      figmaObjectName: string;
      analysisTimestamp: string;
    };
    summary: {
      brief: string;
      complexity: string;
      suggestedImplementation: string;
    };
    visualData?: {
      imageUrl?: string;
      dimensions?: { width: number; height: number };
    };
    cssProperties?: Record<string, any>;
    structureData?: Record<string, any>;
    designTokens?: Record<string, any>;
    accessibility?: Record<string, any>;
    implementationSuggestions?: Record<string, any>;
  };
}
```

### 3.2 Interfaz MCP Server → WebSocket Server

**Protocolo**: WebSocket con mensajes JSON

**Tipos de Mensajes**:
1. **Comando**: Solicitud de lectura o análisis
2. **Respuesta**: Datos obtenidos del plugin
3. **Error**: Información sobre errores
4. **Progreso**: Actualizaciones para operaciones largas

**Esquema de Mensaje Base**:

```typescript
interface WebSocketMessage {
  id: string;           // Identificador único del mensaje
  type: 'command' | 'response' | 'error' | 'progress';
  channel: string;      // Canal de comunicación
  timestamp: number;    // Timestamp en milisegundos
}

interface CommandMessage extends WebSocketMessage {
  type: 'command';
  command: string;      // Comando a ejecutar
  params: any;          // Parámetros del comando
}

interface ResponseMessage extends WebSocketMessage {
  type: 'response';
  result: any;          // Resultado del comando
}

interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  error: string;        // Descripción del error
  code?: number;        // Código de error opcional
}

interface ProgressMessage extends WebSocketMessage {
  type: 'progress';
  progress: number;     // Porcentaje de progreso (0-100)
  message: string;      // Descripción del progreso
}
```


### 3.3 Interfaz WebSocket Server → Figma Plugin

**Protocolo**: Mensajes de Figma UI con JSON

**Comandos Principales**:
1. **get_document_info**: Obtener información general del documento
2. **get_selection**: Obtener datos de la selección actual
3. **get_node_info**: Obtener información detallada de un nodo
4. **get_nodes_info**: Obtener información de múltiples nodos
5. **scan_text_nodes**: Analizar nodos de texto
6. **export_node_as_image**: Exportar un nodo como imagen
7. **get_styles**: Obtener estilos del documento
8. **get_local_components**: Obtener componentes locales
9. **get_remote_components**: Obtener componentes remotos

**Nuevos Comandos Analíticos**:
1. **analyze_component_hierarchy**: Analizar jerarquía de componentes
2. **detect_layout_system**: Detectar sistema de layout
3. **extract_design_tokens**: Extraer tokens de diseño
4. **get_component_variants**: Obtener variantes de componentes
5. **analyze_accessibility**: Analizar accesibilidad

## 4. Consideraciones Técnicas Adicionales

### 4.1 Gestión de Datos y Caché

Para mejorar el rendimiento y reducir la carga en Figma:

1. **Sistema de Caché Local**:
   - Almacenamiento de resultados frecuentes
   - Invalidación inteligente cuando cambian los diseños
   - Opciones para refrescar datos explícitamente

2. **Procesamiento por Lotes**:
   - Agrupación de solicitudes similares
   - Análisis en segundo plano para elementos complejos
   - Cola de prioridad para solicitudes

### 4.2 Seguridad y Privacidad

1. **Manejo de Datos**:
   - No se almacenan diseños completos
   - Las imágenes exportadas tienen tiempo de vida limitado
   - Opción para limitar la información extraída

2. **Autenticación**:
   - Conexión segura entre componentes
   - Verificación de origen para solicitudes
   - Control de acceso basado en canales

### 4.3 Manejo de Errores y Robustez

1. **Estrategia de Reintentos**:
   - Reconexión automática en caso de fallos
   - Reintentos con backoff exponencial
   - Preservación del estado de la sesión

2. **Degradación Elegante**:
   - Respuestas parciales cuando es posible
   - Alternativas cuando ciertos datos no están disponibles
   - Mensajes de error informativos y accionables

## 5. Extensibilidad y Compatibilidad Futura

La arquitectura está diseñada para permitir:

1. **Adición de Nuevas Herramientas Analíticas**:
   - Estructura modular para agregar nuevos analizadores
   - Interfaz consistente para todos los análisis
   - Documentación clara para desarrolladores de extensiones

2. **Soporte para Nuevos Frameworks**:
   - Sistema de plantillas para diferentes frameworks
   - Detectores de patrones extensibles
   - Configuración por usuario para preferencias específicas

3. **Integración con Otros Sistemas**:
   - APIs públicas para integración con otras herramientas
   - Webhooks para notificaciones de cambios
   - Posible soporte para sistemas de diseño basados en código

Esta arquitectura simplificada permitirá un MCP enfocado exclusivamente en la lectura y análisis de diseños, optimizado para facilitar el trabajo de desarrolladores front-end a través de LLMs que pueden interpretar estos diseños y generar código apropiado.

# Procedimiento para pruebas de cambios en herramientas

Este documento describe el procedimiento paso a paso que debe seguirse al realizar y probar cambios en las herramientas del sistema Claude Talk to Figma MCP. Seguir este protocolo evitará problemas comunes como múltiples instancias de servidor, cambios no aplicados o errores de caché.

## 1. Preparación del entorno

### 1.1. Verificar procesos activos

Antes de realizar cualquier cambio, verificar que no haya procesos del servidor MCP ejecutándose:

```bash
ps aux | grep "talk_to_figma"
```

### 1.2. Detener todos los procesos activos

Si hay procesos del servidor en ejecución, detenerlos:

```bash
# Opción 1: Más selectiva
pkill -f "node.*talk_to_figma_mcp/dist/talk_to_figma_mcp/server.js"

# Opción 2: Si la anterior no funciona
killall -9 node
```

### 1.3. Confirmar que no hay procesos activos

Verificar nuevamente que todos los procesos se han detenido:

```bash
ps aux | grep "talk_to_figma"
```

Solo debería aparecer el proceso `grep`.

## 2. Implementación de cambios

### 2.1. Editar el código fuente

Realizar los cambios necesarios en los archivos fuente:
- Ubicados en `src/talk_to_figma_mcp/tools/`
- Modificar solo lo necesario para solucionar el problema
- Añadir logs de diagnóstico si es necesario (`console.log`)

### 2.2. Reconstruir el proyecto

Después de realizar cambios, reconstruir el proyecto:

```bash
# En el directorio raíz del proyecto
npm run build
# O si se usa bun
bun run build
```

### 2.3. Verificar que no hay errores de compilación

Asegurarse de que la compilación termina sin errores.

## 3. Ejecución y pruebas

### 3.1. Iniciar una única instancia del servidor

Iniciar el servidor con una sola instancia:

```bash
node dist/talk_to_figma_mcp/server.js
```

### 3.2. Probar la conectividad básica

Antes de probar la herramienta modificada, verificar la conectividad básica:

1. Conectarse a un canal de Figma
2. Ejecutar una herramienta sencilla como `get_document_info`

### 3.3. Pruebas de la herramienta modificada

Probar la herramienta de forma progresiva:

1. Comenzar con el caso más sencillo (parámetros mínimos)
2. Probar variantes más complejas de forma incremental
3. Verificar tanto casos de éxito como de error controlado

### 3.4. Registro de resultados

Documentar los resultados de las pruebas:
- Capturar respuesta de herramientas exitosas
- Registrar errores específicos
- Anotar tiempos de respuesta para operaciones largas

## 4. Depuración de problemas

### 4.1. Análisis de logs del servidor

Si hay problemas, revisar los logs generados por el servidor en la consola.

### 4.2. Estrategia de depuración incremental

Si una herramienta falla:
1. Verificar que la conexión WebSocket sigue activa
2. Probar con datos de entrada más simples
3. Añadir logs adicionales para identificar dónde ocurre el error
4. Realizar cambios incrementales, no modificaciones masivas

### 4.3. Reinicio del proceso completo

Si los problemas persisten después de cambios:
1. Detener el servidor
2. Limpiar cualquier caché (si aplica)
3. Reconstruir el proyecto
4. Reiniciar el servidor

## 5. Buenas prácticas de implementación

### 5.1. Manejo robusto de errores

Implementar manejo de errores en todas las herramientas:
- Verificar tipos de parámetros antes de usarlos
- No asumir estructura de datos esperada
- Capturar y reportar errores específicos

### 5.2. Uso de valores por defecto seguros

Proporcionar valores por defecto para parámetros opcionales.

### 5.3. Logs informativos

Incluir logs de diagnóstico claros:
```typescript
console.log(`Procesando componente: ${componentId}, variantes: ${includeVariants}`);
```

### 5.4. Control de timeouts

Implementar manejo de timeouts para operaciones largas:
- Dividir operaciones grandes en suboperaciones más pequeñas
- Mostrar progreso para operaciones que toman más de 5 segundos
- Establecer límites de tiempo razonables para cada operación

## 6. Consideraciones específicas para herramientas complejas

### 6.1. extract_design_tokens
- Dividir el procesamiento por tipos de tokens
- Implementar análisis progresivo
- Priorizar la extracción de información esencial

### 6.2. detect_ui_patterns
- Limitar la profundidad de análisis
- Permitir análisis selectivo por tipos de patrones
- Implementar procesamiento asíncrono cuando sea posible

### 6.3. analyze_component_states
- Usar enfoque basado en jerarquía del documento
- No depender de `get_local_components`
- Validar la estructura de datos antes de procesarla

## 7. Lista de verificación final

Antes de considerar una herramienta como "arreglada":

- [ ] Funciona con parámetros mínimos
- [ ] Funciona con parámetros completos
- [ ] Maneja correctamente casos borde y errores
- [ ] No causa timeouts en documentos grandes
- [ ] Proporciona respuestas útiles incluso para entradas no ideales
- [ ] Incluye logs adecuados para diagnóstico

Este procedimiento debe seguirse estrictamente para cada modificación de herramientas, asegurando una implementación robusta y fiable.
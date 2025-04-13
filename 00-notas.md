# Notas

- El agente es capaz de leer páginas web para documentarse
- Si intenta crear archivos vía consola hay que recordarle que puede usar `insert_edit_into_file`
- Para tareas complejas, como crear una herraimenta grande, mejor pedirle que divida en pasos la tarea y cree una lista y que luego ejecute paso a paso la lista pidiendome validación antes de pasar al siguiente punto. No me hace caso en lo esperar a la validación, pero no genera problemas de tiempo de respuesta
- He tenido que refactorizar server.ts porque era muy largo y provocaba problemas a la hora de implementar nuevas funcionalidades…
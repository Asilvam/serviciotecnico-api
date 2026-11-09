# Gestión inicial de órdenes

9 de noviembre de 2026.

Prioridad se presenta con opciones marcables Baja, Media, Alta y Urgente. Media queda seleccionada en órdenes nuevas. Solo puede estar activa una prioridad; se utilizan controles de opción exclusivos con apariencia de casilla marcada y navegación de teclado.

Técnico asignado utiliza el mismo selector compacto con búsqueda integrada que Marca/Modelo. Si hay exactamente un técnico activo disponible, queda preseleccionado y no se ofrece dejarlo sin asignar. Se conserva la asignación existente al editar. Si una orden editable no tiene técnico y solo hay uno disponible, se propone ese técnico; se persiste al guardar. Si hay varios, se puede escoger uno o mantener Sin asignar. Se respetan los permisos de gestión de la orden.

La fecha estimada de una orden nueva se inicializa con el día actual de America/Santiago al abrir el formulario. La API también aplica hoy si se omite en un alta. El calendario impide nuevas fechas anteriores a hoy y muestra la advertencia en español con SweetAlert2. La API valida la misma restricción antes de guardar.

Una orden histórica puede conservar su fecha vencida cuando se editan otros datos. No se puede cambiar a otra fecha pasada. La fecha se trata como día calendario; hoy se calcula en Chile, no en UTC ni con la zona horaria del navegador. Se puede borrar explícitamente una fecha al editar, ya que no se cambió la regla de obligatoriedad.

Validación: pruebas de día de Chile cerca de medianoche UTC, fechas de hoy/futuras, rechazo del pasado y conservación de fechas históricas. TypeScript, ESLint y compilación de ambos proyectos. Verificación visual de la selección Media, técnico único y fecha inicial. No se guardaron órdenes de prueba en la base de negocio.

Sin despliegue de esta mejora.

## Cliente con listado compacto

Cliente utiliza el mismo selector con búsqueda integrada de Marca. Permite buscar por nombre o RUT y conserva el botón Nuevo cliente. La creación rápida mantiene seleccionado el cliente creado. Los clientes se ordenan alfabéticamente con comparación española, también al agregarlos sin recargar.

Se normalizaron los nombres existentes en la base de la API al formato «Alejandro Silva Monsalve». Se revisaron 9 registros, se modificaron 3 y se conservaron 6 ya correctos. Se respaldaron los nombres e identificadores originales en una copia local privada antes de la actualización. No se cambiaron identificadores, RUT, contactos ni vínculos a órdenes. La misma función de formato se aplica en altas y ediciones futuras del servicio.

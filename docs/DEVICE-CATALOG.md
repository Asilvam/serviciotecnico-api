# Marcas y modelos de celulares

Estado actual, 9 de noviembre de 2026: el catálogo ya está guardado en MongoDB, con 33 marcas y 5.503 modelos, incluidos 55 modelos de iPhone desde el original.

## Uso

Al abrir una orden nueva, la categoría predeterminada es **CELULAR**. Se puede cambiar para recibir otro tipo de equipo. Las órdenes existentes conservan su categoría.

Los selectores consultan directamente las colecciones `device_brands` y `device_models`. No existe pantalla de carga, importador de CSV, publicación de candidatos, catálogo incluido en el ejecutable ni trabajo de importación en segundo plano.

Buscar y seleccionar la marca y después el modelo. La búsqueda también reconoce los códigos de hardware guardados en la base. Ambas listas cargan todas las páginas de resultados. Se conservan mayúsculas, orden de marcas y entrada manual para equipos faltantes.

## Datos y compatibilidad

El código eliminado del cargador no elimina los datos guardados. No se borraron colecciones ni documentos de MongoDB. Las antiguas colecciones auxiliares de importación pueden permanecer como historial, pero la aplicación ya no las consulta ni actualiza.

Las órdenes mantienen los textos de marca/modelo y sus referencias opcionales. No se reescriben las órdenes históricas. Las selecciones nuevas se validan contra la marca y el modelo de la base; A04, A04E y A04S permanecen separados. No se infieren especificaciones técnicas.

El catálogo original Android fue depurado y cargado una sola vez. Los registros ambiguos o de otras categorías quedaron fuera del catálogo activo, sin revisión obligatoria para el usuario. APPLE se incorporó desde https://support.apple.com/es-cl/108044; se conservaron los números Axxxx como variantes.

## API actual

- `GET /device-catalog/brands`
- `GET /device-catalog/models?brandId=...`
- `GET /device-catalog/brands/:id`
- `GET /device-catalog/models/:id`

Lectura protegida para los roles autenticados habilitados. Los endpoints de carga, importación, publicación y administración se retiraron. Los equipos ingresados manualmente en una orden de CELULAR amplían el catálogo después de guardar la orden. Las correcciones administrativas se realizan directamente en la base mediante una operación de mantenimiento autorizada.

El orden de marcas se basa en las posiciones publicadas por Omdia para Q3 2026: SAMSUNG, APPLE, XIAOMI, OPPO y VIVO. La métrica es unidades enviadas mundialmente, no ventas finales al consumidor. Las demás marcas siguen alfabéticamente, sin inventar posiciones. Fuente: https://omdia.tech.informa.com/pr/2026/oct/global-smartphone-shipments-fell-20percent-in-3q26-the-lowest-third-quarter-total-since-2013

Se conservaron solo la configuración de orden, las consultas, los selectores y la validación de órdenes. No se realizó commit, push ni despliegue.

## Selectores compactos, caché e ingreso manual

Marca y Modelo utilizan un único selector cada uno, con búsqueda dentro del desplegable y unas ocho opciones visibles con desplazamiento interno. No hay buscadores separados encima. Modelo permanece deshabilitado hasta elegir Marca y su indicación inicial es «Selecciona un modelo». Flechas, Enter y Escape permiten operarlo con teclado. El enlace de ingreso manual conserva los campos escritos.

Las marcas y modelos se consultan completos y se guardan en caché de memoria por una hora, separada por sesión autenticada. La búsqueda al escribir es local, por nombre o código; consultas numéricas como «13» priorizan el nombre del modelo. Las consultas reales a la API usan SweetAlert2; las respuestas de caché no abren una carga. Recargar la página reinicia la caché.

Al guardar correctamente una orden con datos manuales de un celular, se agregan los nombres al catálogo con operaciones upsert e índices únicos. Se normalizan a mayúsculas y no se duplican diferencias de espacios o mayúsculas. No se reactivan marcas o modelos deshabilitados ni se inventan códigos de hardware. La caché del cliente se invalida después del guardado manual para mostrar los nuevos valores en la próxima consulta. No se agregan datos de otras categorías al catálogo de celulares.

Si falla temporalmente la incorporación al catálogo después de guardar la orden, se registra una advertencia en la API; la orden ya guardada se conserva. No hay importador ni pantalla de administración.

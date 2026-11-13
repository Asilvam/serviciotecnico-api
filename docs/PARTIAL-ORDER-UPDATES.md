# Conservar campos omitidos al editar órdenes

13 de noviembre de 2026.

## Causa reproducida

El frontend envía solo los campos modificados. La transformación de UpdateServiceOrderDto crea propiedades opcionales con valor undefined incluso cuando no llegaron en el JSON. El filtrado por permisos las consideraba modificaciones y podían sobrescribir campos existentes. Al seleccionar marca/modelo sin reenviar deviceType, la validación recibía una categoría vacía y rechazaba el catálogo con «El catálogo aplica a la categoría CELULAR».

## Corrección

El servicio de órdenes excluye propiedades undefined antes de procesar permisos y cambios. La combinación de datos del catálogo también ignora undefined y conserva la categoría y marca guardadas. Un null explícito mantiene su significado para borrar campos opcionales. No se relajan los permisos ni la validación de categorías y relaciones marca/modelo.

## Validación

Dos pruebas nuevas fallaron antes de la corrección y pasan después: un DTO transformado que modifica solo modelo conserva categoría, cliente, marca, falla, prioridad y estado, y la resolución de catálogo conserva categoría y marca ante propiedades undefined. La auditoría registra solo el campo modificado. Pasaron las 155 pruebas de la API y la compilación. No se guardaron órdenes reales ni se modificaron datos históricos. Sin commit ni despliegue.

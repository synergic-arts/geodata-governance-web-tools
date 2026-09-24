# Geodata Governance Web Tools

Herramientas estáticas para documentar y revisar capas geoespaciales localmente.

## GeoMetadata Lab

Carga un GeoJSON y genera una ficha técnica con:

- número de entidades, tipos geométricos y extensión BBOX;
- detección de geometrías ausentes, propiedades vacías e IDs duplicados;
- aviso de entidades sin campo `fuente` o `source`;
- esquema de atributos detectado;
- campos de título, responsable, fecha, CRS, licencia, procedencia y contacto;
- exportación de documentación Markdown y metadatos JSON.

El archivo se procesa íntegramente en el navegador. No se realiza ninguna petición de red. Las coordenadas se describen tal como llegan en el GeoJSON y el CRS declarado debe verificarse con la fuente original.

## Uso

Abre `index.html` o sirve esta carpeta con cualquier servidor estático. No requiere Node.js ni dependencias.

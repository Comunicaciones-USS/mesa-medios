// Configuración de los visores de Excel Online (SharePoint) accesibles desde el header.
// Cada Excel se embebe via la URL "src" que entrega el modal Archivo → Compartir → Embed
// en Excel Online. La URL típicamente empieza con https://[tenant]-my.sharepoint.com/...
//
// IMPORTANTE: Leo reemplazará url y label después del merge.
// El array es la única fuente de verdad: si quiere agregar un tercer visor,
// se añade una entrada y aparece automáticamente en ambos headers.

export const VISOR_SHEETS = [
  {
    id: 'sheet-1',
    label: 'PLACEHOLDER_LABEL_1',
    url: 'PLACEHOLDER_URL_1',
  },
  {
    id: 'sheet-2',
    label: 'PLACEHOLDER_LABEL_2',
    url: 'PLACEHOLDER_URL_2',
  },
];

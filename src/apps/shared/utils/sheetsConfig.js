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
    label: 'Grilla RR.SS',
    url: 'https://correouss-my.sharepoint.com/personal/felipe_morales_uss_cl/_layouts/15/Doc.aspx?sourcedoc={f8c812a1-2bff-4987-baa9-2693e19cc14f}&action=embedview&wdHideGridlines=True&wdHideHeaders=True&wdInConfigurator=True&wdInConfigurator=True&edaebf=rslc0',
  },
  {
    id: 'sheet-2',
    label: 'Visual Medios 2026',
    url: 'https://correouss.sharepoint.com/sites/MKT2026/_layouts/15/Doc.aspx?sourcedoc={f58c6413-d33b-4916-9f6c-16d57c2fe7e7}&action=embedview&wdAllowInteractivity=False&wdHideGridlines=True&wdHideHeaders=True&wdDownloadButton=True&wdInConfigurator=True&wdInConfigurator=True&edaebf=rslc0',
  },
];

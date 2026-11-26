/* Constantes del negocio: catálogo, escalera, premios, parques, abonos y cuentas. */

/* CATÁLOGO — precios de xperiencia.com.co. Actualizar cuando cambien. */
export const TOURS = [
 {d:'Nevado del Cocuy', di:'nevado-del-cocuy', pi:'nevado-del-cocuy-y-guican', n:'Nevado del Cocuy y Güicán', p:'670.000 COP', t:'2 días - 1 noche', u:'nevado-del-cocuy-y-guican'},
 {d:'Nevado del Cocuy', di:'nevado-del-cocuy', pi:'nevado-del-cocuy-travesia', n:'Nevado del Cocuy Travesía', p:'920.000 COP', t:'3 días - 2 noches', u:'nevado-del-cocuy-travesia'},
 {d:'Nevado del Cocuy', di:'nevado-del-cocuy', pi:'nevado-del-cocuy-trilogia', n:'Nevado del Cocuy Trilogía', p:'1.220.000 COP', t:'4 días - 3 noches', u:'trilogia-sierra-nevada-del-cocuy-y-guican'},
 {d:'Nevado Santa Isabel', di:'nevado-santa-isabel', pi:'nevado-de-santa-isabel', n:'Nevado de Santa Isabel', p:'1.300.000 COP', t:'2 días - 1 noche', u:'nevado-santa-isabel'},
 {d:'Paramillo del Quindio', di:'paramillo-del-quindio', pi:'paramillo-del-quindio', n:'Paramillo del Quindío', p:'980.000 COP', t:'3 días - 2 noches', u:'paramillo-del-quindio'},
 {d:'Nevado del Tolima', di:'nevado-del-tolima', pi:'nevado-del-tolima-montana-pura', n:'Nevado del Tolima Montaña Pura', p:'1.550.000 COP', t:'4 días - 3 noches', u:'nevado-del-tolima-montana-pura'},
 {d:'Nevado del Tolima', di:'nevado-del-tolima', pi:'nevado-del-tolima-desde-la-finca', n:'Nevado del Tolima desde la Finca', p:'2.000.000 COP', t:'4 días - 3 noches', u:'nevado-del-tolima-expedicion-finca'},
 {d:'Nevado del Tolima', di:'nevado-del-tolima', pi:'nevado-del-tolima', n:'Nevado del Tolima', p:'2.180.000 COP', t:'4 días - 3 noches', u:'nevado-del-tolima'},
 {d:'Nevado del Tolima', di:'nevado-del-tolima', pi:'nevado-del-tolima-desde-anzoategui', n:'Nevado del Tolima desde Anzoátegui', p:'2.200.000 COP', t:'4 días - 3 noches', u:'nevado-del-tolima-desde-anzoategui'},
 {d:'Nevado del Tolima', di:'nevado-del-tolima', pi:'nevado-del-tolima-travesia', n:'Nevado del Tolima Travesía', p:'2.450.000 COP', t:'4 días - 3 noches', u:'nevado-del-tolima-travesia'},
 {d:'Nevado del Huila', di:'nevado-del-huila', pi:'nevado-del-huila-ruta-sur', n:'Nevado del Huila Ruta Sur', p:'3.350.000 COP', t:'4 días - 3 noches', u:'nevado-del-huila-ruta-sur'},
 {d:'Nevado del Huila', di:'nevado-del-huila', pi:'nevado-del-huila-ruta-norte', n:'Nevado del Huila Ruta Norte', p:'3.950.000 COP', t:'5 días - 4 noches', u:'nevado-del-huila-ruta-norte'},
 {d:'Peru - Cordillera Blanca', di:'peru-cordillera-blanca', pi:'peru-churup-ishinca-vallunaraju', n:'Perú Churup, Ishinca y Vallunaraju', p:'850 USD', t:'6 días - 5 noches', u:'cordillera-blanca'},
 {d:'Peru - Cordillera Blanca', di:'peru-cordillera-blanca', pi:'peru-base-camp-alpamayo-yanapacha', n:'Perú Base Camp Alpamayo Yanapacha', p:'1.399 USD', t:'8 días - 7 noches', u:'cordillera-blanca-churup-yanapaccha-alpamayo'},
 {d:'Peru - Cordillera Blanca', di:'peru-cordillera-blanca', pi:'trekking-de-huayhuash', n:'Trekking de Huayhuash', p:'1.400 USD', t:'9 días - 8 noches', u:'tour-trekking-de-huayhuash'},
 {d:'Ecuador - Volcanes', di:'ecuador-volcanes', pi:'volcan-cotopaxi', n:'Volcán Cotopaxi', p:'900 USD', t:'3 días - 2 noches', u:'volcan-cotopaxi'},
 {d:'Ecuador - Volcanes', di:'ecuador-volcanes', pi:'volcan-chimborazo', n:'Volcán Chimborazo', p:'980 USD', t:'4 días - 3 noches', u:'volcan-chimborazo'},
 {d:'Ecuador - Volcanes', di:'ecuador-volcanes', pi:'volcanes-cotopaxi-y-chimborazo', n:'Cotopaxi y Chimborazo', p:'1.700 USD', t:'6 días - 5 noches', u:'volcanes-cotopaxi-y-chimborazo'},
 {d:'Bolivia - Cordillera Real', di:'bolivia-cordillera-real', pi:'bolivia-pequeno-alpamayo', n:'Bolivia Pequeño Alpamayo', p:'800 USD', t:'9 días - 8 noches', u:'bolivia-cordillera-real-pequeno-alpamayo'},
 {d:'Sierra Nevada Sta Marta', di:'sierra-nevada-santa-marta', pi:'sierra-nevada-pico-simonds', n:'Sierra Nevada Pico Simonds', p:'12.000.000 COP', t:'12 días - 11 noches', u:'sierra-nevada-de-santa-marta'},
 {d:'Sierra Nevada Sta Marta', di:'sierra-nevada-santa-marta', pi:'sierra-nevada-pico-colon', n:'Sierra Nevada Pico Colón', p:'15.000.000 COP', t:'15 días - 14 noches', u:'sierra-nevada-de-santa-marta-pico-colon'},
 {d:'Ballenas', di:'ballenas', pi:'avistamiento-de-ballenas', n:'Avistamiento de Ballenas', p:'1.350.000 COP', t:'4 días - 3 noches', u:'avistamiento-de-ballenas'},
 {d:'Bahia Solano', di:'bahia-solano', pi:'bahia-solano-ballenas-y-tortugas', n:'Bahía Solano Ballenas y Tortugas', p:'1.590.000 COP', t:'4 días - 3 noches', u:'tour-bahia-solano-ballenas-y-tortugas'},
 {d:'Cano Cristales', di:'cano-cristales', pi:'cano-cristales', n:'Caño Cristales', p:'2.200.000 COP', t:'3 días', u:'cano-cristales'},
 {d:'Canon del Guejar', di:'canon-del-guejar', pi:'canon-del-rio-guejar-y-guape', n:'Cañón del Río Güejar y Guape', p:'1.050.000 COP', t:'3 días - 2 noches', u:'canon-del-rio-guejar-y-guape'},
 {d:'Canon del Cafre', di:'canon-del-cafre', pi:'canon-guejar-guape-y-cafre', n:'Cañón Güejar, Guape y Cafre', p:'1.350.000 COP', t:'2 días - 1 noche', u:'canon-del-rio-guejar-guape-y-cafre'},
 {d:'Carnaval Negros y Blancos', di:'carnaval-negros-y-blancos', pi:'carnaval-de-negros-y-blancos', n:'Carnaval de Negros y Blancos', p:'2.400.000 COP', t:'7 días - 6 noches', u:'carnaval-de-negros-y-blancos-pasto'},
 {d:'San Jose del Guaviare', di:'san-jose-del-guaviare', pi:'san-jose-del-guaviare', n:'San José del Guaviare', p:'1.324.000 COP', t:'3 días - 2 noches', u:'san-jose-del-guaviare'}
];

/* RECOMPENSAS — por número de nevados de la escalera.
   Alex y Mario: cambien los textos aquí, es lo único que hay que editar. */
export const PREMIOS = [
  {nevados:1, titulo:'Primera Cumbre',    detalle:'Ya sabes lo que se siente llegar arriba.'},
  {nevados:3, titulo:'Cordada',           detalle:'Tres cumbres. Ya no es casualidad.'},
  {nevados:5, titulo:'Alta Montaña',      detalle:'De los pocos que llegan hasta aquí.'},
  {nevados:7, titulo:'Hielo Perpetuo',    detalle:'Montaña de verdad, de las que no perdonan.'},
  {nevados:9, titulo:'Leyenda Xperiencia',detalle:'Completaste el camino. Nada que agregar.'}
];

export const CATALOGO = [
 {"di":"nevado-del-cocuy","d":"Nevado del Cocuy","pi":"nevado-del-cocuy-y-guican","p":"Nevado del Cocuy y Güicán","t":"Nevado","e":1,"pr":"670000","m":"COP","du":"2D/1N","u":"https://xperiencia.com.co/tours/nevado-del-cocuy-y-guican/"},
 {"di":"nevado-del-cocuy","d":"Nevado del Cocuy","pi":"nevado-del-cocuy-travesia","p":"Nevado del Cocuy Travesía","t":"Nevado","e":1,"pr":"920000","m":"COP","du":"3D/2N","u":"https://xperiencia.com.co/tours/nevado-del-cocuy-travesia/"},
 {"di":"nevado-del-cocuy","d":"Nevado del Cocuy","pi":"nevado-del-cocuy-trilogia","p":"Nevado del Cocuy Trilogía","t":"Nevado","e":1,"pr":"1220000","m":"COP","du":"4D/3N","u":"https://xperiencia.com.co/tours/trilogia-sierra-nevada-del-cocuy-y-guican/"},
 {"di":"nevado-santa-isabel","d":"Nevado Santa Isabel","pi":"nevado-de-santa-isabel","p":"Nevado de Santa Isabel","t":"Nevado","e":2,"pr":"1300000","m":"COP","du":"2D/1N","u":"https://xperiencia.com.co/tours/nevado-santa-isabel/"},
 {"di":"paramillo-del-quindio","d":"Paramillo del Quindío","pi":"paramillo-del-quindio","p":"Paramillo del Quindío","t":"Nevado","e":3,"pr":"980000","m":"COP","du":"3D/2N","u":"https://xperiencia.com.co/tours/paramillo-del-quindio/"},
 {"di":"nevado-del-tolima","d":"Nevado del Tolima","pi":"nevado-del-tolima-montana-pura","p":"Nevado del Tolima Montaña Pura","t":"Nevado","e":4,"pr":"1550000","m":"COP","du":"4D/3N","u":"https://xperiencia.com.co/tours/nevado-del-tolima-montana-pura/"},
 {"di":"nevado-del-tolima","d":"Nevado del Tolima","pi":"nevado-del-tolima-desde-la-finca","p":"Nevado del Tolima desde la Finca","t":"Nevado","e":4,"pr":"2000000","m":"COP","du":"4D/3N","u":"https://xperiencia.com.co/tours/nevado-del-tolima-expedicion-finca/"},
 {"di":"nevado-del-tolima","d":"Nevado del Tolima","pi":"nevado-del-tolima","p":"Nevado del Tolima","t":"Nevado","e":4,"pr":"2180000","m":"COP","du":"4D/3N","u":"https://xperiencia.com.co/tours/nevado-del-tolima/"},
 {"di":"nevado-del-tolima","d":"Nevado del Tolima","pi":"nevado-del-tolima-desde-anzoategui","p":"Nevado del Tolima desde Anzoátegui","t":"Nevado","e":4,"pr":"2200000","m":"COP","du":"4D/3N","u":"https://xperiencia.com.co/tours/nevado-del-tolima-desde-anzoategui/"},
 {"di":"nevado-del-tolima","d":"Nevado del Tolima","pi":"nevado-del-tolima-travesia","p":"Nevado del Tolima Travesía","t":"Nevado","e":4,"pr":"2450000","m":"COP","du":"4D/3N","u":"https://xperiencia.com.co/tours/nevado-del-tolima-travesia/"},
 {"di":"nevado-del-huila","d":"Nevado del Huila","pi":"nevado-del-huila-ruta-sur","p":"Nevado del Huila Ruta Sur","t":"Nevado","e":5,"pr":"3350000","m":"COP","du":"4D/3N","u":"https://xperiencia.com.co/tours/nevado-del-huila-ruta-sur/"},
 {"di":"nevado-del-huila","d":"Nevado del Huila","pi":"nevado-del-huila-ruta-norte","p":"Nevado del Huila Ruta Norte","t":"Nevado","e":5,"pr":"3950000","m":"COP","du":"5D/4N","u":"https://xperiencia.com.co/tours/nevado-del-huila-ruta-norte/"},
 {"di":"peru-cordillera-blanca","d":"Perú Cordillera Blanca","pi":"peru-churup-ishinca-vallunaraju","p":"Perú Churup Ishinca Vallunaraju","t":"Nevado","e":6,"pr":"850","m":"USD","du":"6D/5N","u":"https://xperiencia.com.co/tours/cordillera-blanca/"},
 {"di":"peru-cordillera-blanca","d":"Perú Cordillera Blanca","pi":"peru-base-camp-alpamayo-yanapacha","p":"Perú Base Camp Alpamayo Yanapacha","t":"Nevado","e":6,"pr":"1399","m":"USD","du":"8D/7N","u":"https://xperiencia.com.co/tours/cordillera-blanca-churup-yanapaccha-alpamayo/"},
 {"di":"peru-cordillera-blanca","d":"Perú Cordillera Blanca","pi":"trekking-de-huayhuash","p":"Trekking de Huayhuash","t":"Nevado","e":6,"pr":"1400","m":"USD","du":"9D/8N","u":"https://xperiencia.com.co/tours/tour-trekking-de-huayhuash/"},
 {"di":"ecuador-volcanes","d":"Ecuador Volcanes","pi":"volcan-cotopaxi","p":"Volcán Cotopaxi","t":"Nevado","e":7,"pr":"900","m":"USD","du":"3D/2N","u":"https://xperiencia.com.co/tours/volcan-cotopaxi/"},
 {"di":"ecuador-volcanes","d":"Ecuador Volcanes","pi":"volcan-chimborazo","p":"Volcán Chimborazo","t":"Nevado","e":7,"pr":"980","m":"USD","du":"4D/3N","u":"https://xperiencia.com.co/tours/volcan-chimborazo/"},
 {"di":"ecuador-volcanes","d":"Ecuador Volcanes","pi":"volcanes-cotopaxi-y-chimborazo","p":"Volcanes Cotopaxi y Chimborazo","t":"Nevado","e":7,"pr":"1700","m":"USD","du":"6D/5N","u":"https://xperiencia.com.co/tours/volcanes-cotopaxi-y-chimborazo/"},
 {"di":"bolivia-cordillera-real","d":"Bolivia Cordillera Real","pi":"bolivia-pequeno-alpamayo","p":"Bolivia Pequeño Alpamayo","t":"Nevado","e":8,"pr":"800","m":"USD","du":"9D/8N","u":"https://xperiencia.com.co/tours/bolivia-cordillera-real-pequeno-alpamayo/"},
 {"di":"sierra-nevada-santa-marta","d":"Sierra Nevada Santa Marta","pi":"sierra-nevada-pico-simonds","p":"Sierra Nevada Pico Simonds","t":"Nevado","e":9,"pr":"12000000","m":"COP","du":"12D/11N","u":"https://xperiencia.com.co/tours/sierra-nevada-de-santa-marta/"},
 {"di":"sierra-nevada-santa-marta","d":"Sierra Nevada Santa Marta","pi":"sierra-nevada-pico-colon","p":"Sierra Nevada Pico Colón","t":"Nevado","e":9,"pr":"15000000","m":"COP","du":"15D/14N","u":"https://xperiencia.com.co/tours/sierra-nevada-de-santa-marta-pico-colon/"},
 {"di":"sumapaz","d":"Sumapaz","pi":"paramo-de-sumapaz","p":"Páramo de Sumapaz","t":"Páramo","e":0,"pr":"","m":"COP","du":"1D","u":""},
 {"di":"chingaza","d":"Chingaza","pi":"paramo-de-chingaza","p":"Páramo de Chingaza","t":"Páramo","e":0,"pr":"","m":"COP","du":"1D","u":""},
 {"di":"ballenas","d":"Ballenas","pi":"avistamiento-de-ballenas","p":"Avistamiento de Ballenas","t":"Disfrute","e":0,"pr":"1350000","m":"COP","du":"4D/3N","u":"https://xperiencia.com.co/tours/avistamiento-de-ballenas/"},
 {"di":"bahia-solano","d":"Bahía Solano","pi":"bahia-solano-ballenas-y-tortugas","p":"Bahía Solano Ballenas y Tortugas","t":"Disfrute","e":0,"pr":"1590000","m":"COP","du":"4D/3N","u":"https://xperiencia.com.co/tours/tour-bahia-solano-ballenas-y-tortugas/"},
 {"di":"cano-cristales","d":"Caño Cristales","pi":"cano-cristales","p":"Caño Cristales","t":"Disfrute","e":0,"pr":"2200000","m":"COP","du":"3D","u":"https://xperiencia.com.co/tours/cano-cristales/"},
 {"di":"canon-del-guejar","d":"Cañón del Güejar","pi":"canon-del-rio-guejar-y-guape","p":"Cañón del Río Güejar y Guape","t":"Disfrute","e":0,"pr":"1050000","m":"COP","du":"3D/2N","u":"https://xperiencia.com.co/tours/canon-del-rio-guejar-y-guape/"},
 {"di":"canon-del-cafre","d":"Cañón del Cafre","pi":"canon-guejar-guape-y-cafre","p":"Cañón Güejar Guape y Cafre","t":"Disfrute","e":0,"pr":"1350000","m":"COP","du":"2D/1N","u":"https://xperiencia.com.co/tours/canon-del-rio-guejar-guape-y-cafre/"},
 {"di":"carnaval-negros-y-blancos","d":"Carnaval Negros y Blancos","pi":"carnaval-de-negros-y-blancos","p":"Carnaval de Negros y Blancos","t":"Disfrute","e":0,"pr":"2400000","m":"COP","du":"7D/6N","u":"https://xperiencia.com.co/tours/carnaval-de-negros-y-blancos-pasto/"},
 {"di":"san-jose-del-guaviare","d":"San José del Guaviare","pi":"san-jose-del-guaviare","p":"San José del Guaviare","t":"Disfrute","e":0,"pr":"1324000","m":"COP","du":"3D/2N","u":"https://xperiencia.com.co/tours/san-jose-del-guaviare/"},
 {"di":"sutatausa","d":"Sutatausa","pi":"farallones-de-sutatausa","p":"Farallones de Sutatausa","t":"Disfrute","e":0,"pr":"","m":"COP","du":"1D","u":""},
 {"di":"escalada-suesca","d":"Escalada Suesca","pi":"escalada-en-suesca","p":"Escalada en Suesca","t":"Disfrute","e":0,"pr":"","m":"COP","du":"1D","u":""},
 {"di":"tatacoa","d":"Tatacoa","pi":"desierto-de-la-tatacoa","p":"Desierto de la Tatacoa","t":"Disfrute","e":0,"pr":"","m":"COP","du":"2D/1N","u":""},
 {"di":"ciudad-perdida","d":"Ciudad Perdida","pi":"ciudad-perdida-teyuna","p":"Ciudad Perdida Teyuna","t":"Disfrute","e":0,"pr":"","m":"COP","du":"4D/3N","u":""},
 {"di":"parapente","d":"Parapente","pi":"parapente","p":"Parapente","t":"Disfrute","e":0,"pr":"","m":"COP","du":"1D","u":""},
 {"di":"via-ferrata-choachi","d":"Vía Ferrata Choachí","pi":"via-ferrata-choachi","p":"Vía Ferrata Choachí","t":"Disfrute","e":0,"pr":"","m":"COP","du":"1D","u":""},
 {"di":"piedra-colgada","d":"Piedra Colgada","pi":"piedra-colgada","p":"Piedra Colgada","t":"Disfrute","e":0,"pr":"","m":"COP","du":"1D","u":""},
 {"di":"cascada-el-escobo","d":"Cascada El Escobo","pi":"cascada-el-escobo-vergara","p":"Cascada El Escobo Vergara","t":"Disfrute","e":0,"pr":"","m":"COP","du":"1D","u":""},
 {"di":"curso-de-escalada","d":"Curso de Escalada","pi":"curso-de-escalada-nivel-1","p":"Curso de Escalada Nivel 1","t":"Disfrute","e":0,"pr":"","m":"COP","du":"—","u":"https://xperiencia.com.co/tours/curso-de-escalada-nivel-1-iniciacion-indoor-y-outdoor-basico/"}
];

/* ─── TERRITORIO ───────────────────────────────────────────
   Los nevados que están en Colombia. Quien los haga todos
   se gana una insignia aparte, que no es de dificultad.
   ────────────────────────────────────────────────────────── */
export const COLOMBIA = ['nevado-santa-isabel','paramillo-del-quindio','nevado-del-cocuy',
                  'nevado-del-tolima','nevado-del-huila','sierra-nevada-santa-marta'];

/* Visitantes por parque, informe anual de Parques Nacionales.
   ⚠ Es gente que ENTRÓ al parque, no que hizo cumbre. Los textos
   de abajo están redactados con ese cuidado: no decir lo que no sabemos.
   Para actualizar: cambiar las cifras y el año. Nada más. */
export const PARQUES_ANIO = 2023;
export const PARQUES_FUENTE = 'Parques Nacionales Naturales de Colombia';
export const POBLACION_COL = 52000000;   // aproximado, para la comparación
export const PARQUES = {
  'nevado-del-cocuy':         {parque:'El Cocuy',                 visitas:31520},
  'nevado-santa-isabel':      {parque:'Los Nevados',              visitas:25884},
  'paramillo-del-quindio':    {parque:'Los Nevados',              visitas:25884},
  'nevado-del-tolima':        {parque:'Los Nevados',              visitas:25884},
  'sierra-nevada-santa-marta':{parque:'Sierra Nevada de Santa Marta', visitas:25174},
  'ciudad-perdida':           {parque:'Sierra Nevada de Santa Marta', visitas:25174},
  'chingaza':                 {parque:'Chingaza',                 visitas:16937}
};

/* LA ESCALERA — por destino_id, definida por Alex y Mario */
export const ESCALERA = ['nevado-del-cocuy','nevado-santa-isabel','paramillo-del-quindio',
  'nevado-del-tolima','nevado-del-huila','peru-cordillera-blanca',
  'ecuador-volcanes','bolivia-cordillera-real','sierra-nevada-santa-marta'];

/* Índices derivados del catálogo — una sola fuente de verdad */
export const DESTINOS = (function(){
  const m = {};
  CATALOGO.forEach(p => { if(!m[p.di]) m[p.di] = {id:p.di, nombre:p.d, tipo:p.t, escalon:p.e, planes:[]};
                          m[p.di].planes.push(p); });
  return m;
})();
export const PLANES = (function(){ const m={}; CATALOGO.forEach(p => m[p.pi]=p); return m; })();
export const PARAMOS  = Object.keys(DESTINOS).filter(k => DESTINOS[k].tipo === 'Páramo');
export const DISFRUTE = Object.keys(DESTINOS).filter(k => DESTINOS[k].tipo === 'Disfrute');
export const nombreDe = id => (DESTINOS[id] ? DESTINOS[id].nombre : id);

/* Datos de cobro oficiales de Xperiencia (pieza "Medios de pago").
   Si cambia una cuenta, se cambia AQUÍ y en ningún otro lado de la app. */
export const CUENTAS = {
  'Nequi':          '<b>Nequi</b><br>313 305 2017',
  'Daviplata':      '<b>Daviplata</b><br>313 498 6199',
  'Bancolombia':    '<b>Bancolombia</b> · Ahorros<br>299-387415-47',
  'Banco de Bogotá':'<b>Banco de Bogotá</b> · Ahorros<br>075-563056',
  'Tarjeta (datáfono)':'<b>Visa · Mastercard · American Express · Crédito Fácil Codensa</b><br>' +
                       'Te coordinamos el cobro por WhatsApp.',
  'Efectivo':       'Coordina la entrega con nosotros por WhatsApp.',
  'Transferencia internacional':'Te enviamos los datos por WhatsApp.'
};

/* Porcentaje de abono. Por defecto 30%.
   Se puede poner una excepción por destino (destino_id) o por plan (plan_id).
   El plan manda sobre el destino. Para agregar otra, basta una línea más. */
export const ABONO_PCT = 0.30;
export const ABONO_ESPECIAL = {
  'nevado-santa-isabel': 0.40        // Santa Isabel va con 40%
};

/* ══════════════════ ARMAR LINK (solo Xperiencia) ══════════════════ */
export const BASE_APP = 'https://xperiencia.com.co/app/';

/* El WhatsApp de Xperiencia con un mensaje ya escrito. Si cambia el número, se cambia AQUÍ. */
export const waXperiencia = texto =>
  'https://api.whatsapp.com/send/?phone=573133052017&text=' + encodeURIComponent(texto);

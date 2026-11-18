/* Estado mutable de la sesión. Antes eran variables globales del demo (BD, YO, UID, MI,
   onboarding, INTENCION); ahora viven en un objeto que todos los módulos comparten. */

export const bdVacia = () => ({usuarios: {}, salidas: [], misViajes: []});

export const E = {
  BD: bdVacia(),
  YO: null,            // id de mi ficha (viajero.id): es la llave de BD.usuarios
  UID: null,           // id de la cuenta (auth.uid)
  MI: null,            // mi fila de viajero
  PRIVADO: null,       // mi fila de viajero_privado (salud, emergencia)
  INSCRIPCIONES: [],   // mis inscripciones con saldo (v_inscripcion_saldo + plan y fechas)
  ACOMPANANTES: [],    // mis acompañantes: solo nombre y dinero (mis_acompanantes)
  DERIVADOS: [],       // destinos de lo ya viajado según mis inscripciones (no se copian al historial)
  CUENTAS: [],        // cuentas donde se puede pagar
  POLITICAS: {},       // textos de política de cancelación por id
  ULTIMO_ENVIO: null,  // último comprobante enviado {monto, moneda, medio}: lo pinta «Comprobante enviado»
  onboarding: false,
  INTENCION: null,     // lo que trajo el link preparado: {plan, fecha, cupos, salida}
  SALIDA_ELEGIDA: null // salida que se pidió desde el calendario o «Mi viaje»
};

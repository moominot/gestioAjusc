import { json, opcions, origen } from '../../../lib/api/resposta'

/** Índex de l'API v1. La documentació sencera és a docs/api.md del repositori. */
export function GET(peticio: Request) {
  const base = `${origen(peticio)}/api/v1`
  return json({
    nom: 'API del BARRUF',
    versio: 1,
    lectura: {
      barruf: `${base}/barruf`,
      jugadors: `${base}/jugadors`,
      jugador: `${base}/jugadors/{numero}`,
    },
    escriptura: {
      autenticacio: 'Authorization: Bearer <clau de l’aplicació>',
      enviar_campionat: `POST ${base}/campionats`,
      estat_campionat: `GET ${base}/campionats/{id_extern}`,
    },
  })
}

export const OPTIONS = opcions

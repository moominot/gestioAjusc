export interface Clubs {
  id: string
  nom: string
  poblacio: string
}

export interface Jugadors {
  id: string
  nom: string
  cognoms: string
  club_id: string | null
  email: string | null
  es_soci: boolean
  data_alta: string // Date as string in ISO format
}

export interface Temporades {
  id: string
  nom: string
  data_inici: string
  data_fi: string
}

export interface Campionats {
  id: string
  temporada_id: string
  nom: string
  data: string
  tipus_campionat: string
  desempat:Array<string>
}

export interface Partides {
  id: string
  campionat_id: string
  ronda: number
  jugador_1_id: string
  jugador_2_id: string
  punts_1: number
  punts_2: number
  scrabbles_1:number
  scrabbles_2:number
  mot_1: string
  mot_2: string
  punts_mot_1: number
  punts_mot_2: number
  especial_1: string
  especial_2: string
  punts_especial_1: number
  punts_especial_2: number

}

export interface Quotes {
  id: string
  jugador_id: string
  any: number
  import: number
  pagat_status: boolean
  data_pagament: string | null
}
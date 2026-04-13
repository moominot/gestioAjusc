import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import { supabase } from '../../../lib/supabase'
import { Partides } from '../../../types/database'

interface CsvRow {
  campionat_id: string
  ronda: number | undefined
  jugador_1_id: string
  jugador_2_id: string
  punts_1: number | undefined
  punts_2: number | undefined
  scrabbles_1: number | null
  scrabbles_2: number | null
  mot_1: string | null
  mot_2: string | null
  punts_mot_1: number | null
  punts_mot_2: number | null
  especial_1: string | null
  especial_2: string | null
  punts_especial_1: number | null
  punts_especial_2: number | null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const csvText = await file.text()

    // Parse CSV
    const parseResult = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string, field: string) => {
        const trimmed = value.trim()
        if (['ronda', 'punts_1', 'punts_2'].includes(field)) {
          if (!trimmed) return undefined
          const num = parseInt(trimmed, 10)
          return isNaN(num) ? undefined : num
        }
        if (['scrabbles_1', 'scrabbles_2', 'punts_mot_1', 'punts_mot_2', 'punts_especial_1', 'punts_especial_2'].includes(field)) {
          if (!trimmed) return null
          const num = parseInt(trimmed, 10)
          return isNaN(num) ? null : num
        }
        return trimmed || null
      }
    })

    if (parseResult.errors.length > 0) {
      return NextResponse.json({ error: 'CSV parsing errors', details: parseResult.errors }, { status: 400 })
    }

    // Validate required fields and map to Partides format
    const partides: Omit<Partides, 'id'>[] = []
    for (const [index, row] of (parseResult.data as CsvRow[]).entries()) {
      // Check required fields
      if (!row.jugador_1_id || !row.jugador_2_id || row.punts_1 === undefined || row.punts_2 === undefined) {
        return NextResponse.json({
          error: `Fila ${index + 1}: falten camps requerits (jugador_1_id, jugador_2_id, punts_1, punts_2)`
        }, { status: 400 })
      }

      // Ensure campionat_id and ronda are present (should be set by the replacement)
      if (!row.campionat_id) {
        return NextResponse.json({
          error: `Fila ${index + 1}: falta campionat_id`
        }, { status: 400 })
      }

      if (row.ronda === undefined || row.ronda === null) {
        return NextResponse.json({
          error: `Fila ${index + 1}: falta ronda`
        }, { status: 400 })
      }

      partides.push({
        campionat_id: row.campionat_id,
        ronda: row.ronda!,
        jugador_1_id: row.jugador_1_id,
        jugador_2_id: row.jugador_2_id,
        punts_1: row.punts_1!,
        punts_2: row.punts_2!,
        scrabbles_1: row.scrabbles_1 || 0,
        scrabbles_2: row.scrabbles_2 || 0,
        mot_1: row.mot_1,
        mot_2: row.mot_2,
        punts_mot_1: row.punts_mot_1,
        punts_mot_2: row.punts_mot_2,
        especial_1: row.especial_1,
        especial_2: row.especial_2,
        punts_especial_1: row.punts_especial_1,
        punts_especial_2: row.punts_especial_2,
      })
    }

    // Bulk insert
    const { data, error } = await supabase
      .from('partides')
      .insert(partides)
      .select()

    if (error) {
      return NextResponse.json({ error: 'Database insert error', details: error }, { status: 500 })
    }

    return NextResponse.json({ message: 'Partides inserted successfully', count: data.length }, { status: 200 })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
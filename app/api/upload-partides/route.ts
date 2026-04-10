import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import { supabase } from '../../../lib/supabase'
import { Partides } from '../../../types/database'

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
        if (['ronda', 'punts_1', 'punts_2', 'scrabbles_1', 'scrabbles_2', 'punts_mot_1', 'punts_mot_2', 'punts_especial_1', 'punts_especial_2'].includes(field)) {
          return value ? parseInt(value, 10) : 0
        }
        return value.trim()
      }
    })

    if (parseResult.errors.length > 0) {
      return NextResponse.json({ error: 'CSV parsing errors', details: parseResult.errors }, { status: 400 })
    }

    // Map to Partides format
    const partides: Omit<Partides, 'id'>[] = parseResult.data.map((row: any) => ({
      campionat_id: row.campionat_id,
      ronda: row.ronda,
      jugador_1_id: row.jugador_1_id,
      jugador_2_id: row.jugador_2_id,
      punts_1: row.punts_1,
      punts_2: row.punts_2,
      scrabbles_1: row.scrabbles_1 || 0,
      scrabbles_2: row.scrabbles_2 || 0,
      mot_1: row.mot_1 || null,
      mot_2: row.mot_2 || null,
      punts_mot_1: row.punts_mot_1 || null,
      punts_mot_2: row.punts_mot_2 || null,
      especial_1: row.especial_1 || null,
      especial_2: row.especial_2 || null,
      punts_especial_1: row.punts_especial_1 || null,
      punts_especial_2: row.punts_especial_2 || null,
    }))

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
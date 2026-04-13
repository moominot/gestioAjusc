'use client'

import React from 'react'
import Papa from 'papaparse'
import { Modal } from './Modal'
import { Jugadors, Clubs } from '../types/database'
import { findSimilarPlayers } from '../lib/nameMatching'

interface CsvImportRow {
  nom: string
  cognoms: string
  email: string
  telefon: string
  data_naixement: string
  club: string
  es_soci: boolean
  barruf: number | null
  selectedId: string | null
  suggestions: { player: Jugadors; similarity: number }[]
}

interface CsvImportModalProps {
  isOpen: boolean
  onClose: () => void
  jugadors: Jugadors[]
  clubs: Clubs[]
  onImportComplete: () => void
}

const parseBoolean = (value: string | null | undefined) => {
  if (!value) return false
  const normalized = String(value).trim().toLowerCase()
  return ['sí', 'si', 'true', '1', 'yes', 'y'].includes(normalized)
}

const parseBarruf = (value: string | null | undefined) => {
  if (!value) return null
  const parsed = parseInt(String(value).trim(), 10)
  return Number.isNaN(parsed) ? null : parsed
}

const normalizeHeader = (header: string) => header.trim().toLowerCase()

export function CsvImportModal({
  isOpen,
  onClose,
  jugadors,
  clubs,
  onImportComplete,
}: CsvImportModalProps) {
  const [csvRows, setCsvRows] = React.useState<CsvImportRow[]>([])
  const [csvFileName, setCsvFileName] = React.useState('')
  const [csvError, setCsvError] = React.useState('')
  const [csvSuccess, setCsvSuccess] = React.useState('')
  const [csvSubmitting, setCsvSubmitting] = React.useState(false)

  const handleCsvFile = async (file: File | null) => {
    setCsvRows([])
    setCsvFileName('')
    setCsvError('')
    setCsvSuccess('')

    if (!file) return
    setCsvFileName(file.name)

    const csvText = await file.text()
    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
      transform: (value) => value.trim(),
    })

    if (result.errors.length > 0) {
      setCsvError('Error en parsejar el CSV. Revisa el format i les columnes.')
      return
    }

    const rows = (result.data as any[]).map((row) => {
      const nom = row.nom || row.name || ''
      const cognoms = row.cognoms || row.surname || ''
      const email = row.email || ''
      const telefon = row.telefon || row.phone || row.tel || ''
      const data_naixement = row.data_naixement || row.birthdate || row.birth_date || ''
      const club = row.club || row.club_name || ''
      const es_soci = parseBoolean(row.es_soci || row.soci || row.is_member)
      const barruf = parseBarruf(row.barruf || row.elo)
      const fullName = `${nom} ${cognoms}`.trim()

      return {
        nom,
        cognoms,
        email,
        telefon,
        data_naixement,
        club,
        es_soci,
        barruf,
        selectedId: null,
        suggestions: fullName ? findSimilarPlayers(fullName, jugadors) : [],
      }
    })

    setCsvRows(rows)
  }

  const handleSelectMatch = (index: number, selectedId: string | null) => {
    setCsvRows((current) => {
      const next = [...current]
      next[index] = { ...next[index], selectedId }
      return next
    })
  }

  const getClubId = (clubName: string) => {
    const normalized = clubName.trim().toLowerCase()
    const found = clubs.find((club) => club.nom.toLowerCase() === normalized)
    return found?.id ?? null
  }

  const handleCsvSubmit = async () => {
    if (csvRows.length === 0) {
      setCsvError('No hi ha cap fila CSV per processar.')
      return
    }

    setCsvSubmitting(true)
    setCsvError('')
    setCsvSuccess('')

    try {
      const { supabase } = await import('../lib/supabase')

      const updates = csvRows.filter((row) => row.selectedId).map((row) => ({
        id: row.selectedId,
        nom: row.nom,
        cognoms: row.cognoms,
        email: row.email || null,
        telefon: row.telefon || null,
        data_naixement: row.data_naixement || null,
        barruf: row.barruf ?? 1000,
        club_id: row.club ? getClubId(row.club) : null,
        es_soci: row.es_soci,
        data_alta: row.data_naixement || new Date().toISOString().slice(0, 10),
      }))

      const inserts = csvRows.filter((row) => !row.selectedId).map((row) => ({
        nom: row.nom,
        cognoms: row.cognoms,
        email: row.email || null,
        telefon: row.telefon || null,
        data_naixement: row.data_naixement || null,
        barruf: row.barruf ?? 1000,
        club_id: row.club ? getClubId(row.club) : null,
        es_soci: row.es_soci,
        data_alta: row.data_naixement || new Date().toISOString().slice(0, 10),
      }))

      if (updates.length > 0) {
        const { error } = await supabase
          .from('jugadors')
          .upsert(updates, { onConflict: ['id'] })
        if (error) throw error
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from('jugadors').insert(inserts)
        if (error) throw error
      }

      setCsvSuccess(
        `S'han processat ${updates.length} actualitzacions i ${inserts.length} nous jugadors.`
      )
      setCsvRows([])
      setCsvFileName('')
      onImportComplete()
    } catch (error) {
      console.error(error)
      setCsvError('Error al processar el CSV. Revisa la consola per més detalls.')
    } finally {
      setCsvSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} title="Importar CSV de Jugadors" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Fitxer CSV</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => handleCsvFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full border border-gray-300 rounded-md p-2"
          />
        </div>
        {csvFileName && <div className="text-sm text-gray-600">Fitxer: {csvFileName}</div>}
        {csvError && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700">{csvError}</div>
        )}
        {csvSuccess && (
          <div className="rounded-md bg-green-50 border border-green-200 p-3 text-green-700">
            {csvSuccess}
          </div>
        )}
        <div className="text-sm text-gray-600">
          El CSV ha de contenir columnes mínimes: <strong>nom, cognoms</strong>. També pot incloure{' '}
          <strong>email, telefon, data_naixement, club, es_soci, barruf</strong>.
        </div>

        {csvRows.length > 0 && (
          <div className="space-y-4">
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
              <p className="font-semibold">Comparativa amb jugadors existents</p>
              <p className="text-sm text-gray-600">Tria si vols actualitzar un jugador existent o crear-ne un de nou.</p>
            </div>
            <div className="max-h-96 overflow-auto rounded border border-gray-200">
              <table className="min-w-full bg-white">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nom
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Club CSV
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Match
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acció
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {csvRows.map((row, index) => (
                    <tr key={`${row.nom}-${row.cognoms}-${index}`}>
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold">
                          {row.nom} {row.cognoms}
                        </div>
                        <div className="text-sm text-gray-500">{row.email || 'sense email'}</div>
                      </td>
                      <td className="px-4 py-3 align-top">{row.club || 'Sense club'}</td>
                      <td className="px-4 py-3 align-top">
                        {row.suggestions.length > 0 ? (
                          <div className="space-y-2">
                            {row.suggestions.slice(0, 2).map((suggestion) => (
                              <div key={suggestion.player.id} className="rounded border border-gray-200 p-2 bg-gray-50">
                                <div className="text-sm font-medium">
                                  {suggestion.player.nom} {suggestion.player.cognoms}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Similitud: {(suggestion.similarity * 100).toFixed(0)}%
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">No hi ha coincidències fortes</div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <select
                          value={row.selectedId || 'new'}
                          onChange={(e) =>
                            handleSelectMatch(index, e.target.value === 'new' ? null : e.target.value)
                          }
                          className="block w-full border border-gray-300 rounded-md p-2 text-sm"
                        >
                          <option value="new">Crea nou jugador</option>
                          {row.suggestions.map((suggestion) => (
                            <option key={suggestion.player.id} value={suggestion.player.id}>
                              {suggestion.player.nom} {suggestion.player.cognoms} (
                              {(suggestion.similarity * 100).toFixed(0)}%)
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel·lar
              </button>
              <button
                type="button"
                onClick={handleCsvSubmit}
                disabled={csvSubmitting}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {csvSubmitting ? 'Processant...' : 'Puja i actualitza jugadors'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

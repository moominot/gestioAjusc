'use client'

import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { supabase } from '../../lib/supabase'
import { Jugadors, Clubs } from '../../types/database'
import { findSimilarPlayers } from '../../lib/nameMatching'

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

export default function JugadorsPage() {
  const [jugadors, setJugadors] = useState<Jugadors[]>([])
  const [clubs, setClubs] = useState<Clubs[]>([])
  const [loading, setLoading] = useState(true)
  const [savingPlayer, setSavingPlayer] = useState(false)
  const [csvRows, setCsvRows] = useState<CsvImportRow[]>([])
  const [csvFileName, setCsvFileName] = useState('')
  const [csvError, setCsvError] = useState('')
  const [csvSuccess, setCsvSuccess] = useState('')
  const [csvSubmitting, setCsvSubmitting] = useState(false)

  const [newPlayer, setNewPlayer] = useState({
    nom: '',
    cognoms: '',
    email: '',
    telefon: '',
    data_naixement: '',
    barruf: 1000,
    club_id: '',
    es_soci: false
  })

  const [editingPlayer, setEditingPlayer] = useState<Jugadors | null>(null)
  const [editForm, setEditForm] = useState({
    nom: '',
    cognoms: '',
    email: '',
    telefon: '',
    data_naixement: '',
    barruf: 1000,
    club_id: '',
    es_soci: false
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [jugadorsRes, clubsRes] = await Promise.all([
      supabase.from('jugadors').select('*'),
      supabase.from('clubs').select('*')
    ])

    if (jugadorsRes.data) setJugadors(jugadorsRes.data)
    if (clubsRes.data) setClubs(clubsRes.data)
    setLoading(false)
  }

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPlayer(true)

    const { error } = await supabase.from('jugadors').insert([{ 
      nom: newPlayer.nom,
      cognoms: newPlayer.cognoms,
      email: newPlayer.email || null,
      telefon: newPlayer.telefon || null,
      data_naixement: newPlayer.data_naixement || null,
      barruf: newPlayer.barruf,
      club_id: newPlayer.club_id || null,
      es_soci: newPlayer.es_soci,
      data_alta: new Date().toISOString().slice(0, 10)
    }])

    if (error) {
      console.error(error)
      alert('No s’ha pogut afegir el jugador')
    } else {
      setNewPlayer({ nom: '', cognoms: '', email: '', telefon: '', data_naixement: '', barruf: 1000, club_id: '', es_soci: false })
      loadData()
    }

    setSavingPlayer(false)
  }

  const handleEditPlayer = (player: Jugadors) => {
    setEditingPlayer(player)
    setEditForm({
      nom: player.nom,
      cognoms: player.cognoms,
      email: player.email || '',
      telefon: player.telefon || '',
      data_naixement: player.data_naixement || '',
      barruf: player.barruf ?? 1000,
      club_id: player.club_id || '',
      es_soci: player.es_soci
    })
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPlayer) return

    setSavingPlayer(true)

    const { error } = await supabase
      .from('jugadors')
      .update({
        nom: editForm.nom,
        cognoms: editForm.cognoms,
        email: editForm.email || null,
        telefon: editForm.telefon || null,
        data_naixement: editForm.data_naixement || null,
        barruf: editForm.barruf,
        club_id: editForm.club_id || null,
        es_soci: editForm.es_soci
      })
      .eq('id', editingPlayer.id)

    if (error) {
      console.error(error)
      alert('No s’ha pogut actualitzar el jugador')
    } else {
      setEditingPlayer(null)
      loadData()
    }

    setSavingPlayer(false)
  }

  const handleCancelEdit = () => {
    setEditingPlayer(null)
  }

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm('Estàs segur que vols esborrar aquest jugador?')) return

    const { error } = await supabase
      .from('jugadors')
      .delete()
      .eq('id', playerId)

    if (error) {
      console.error(error)
      alert('No s’ha pogut esborrar el jugador')
    } else {
      loadData()
    }
  }

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
      transform: (value) => value.trim()
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
        suggestions: fullName ? findSimilarPlayers(fullName, jugadors) : []
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
        data_alta: row.data_naixement || new Date().toISOString().slice(0, 10)
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
        data_alta: row.data_naixement || new Date().toISOString().slice(0, 10)
      }))

      if (updates.length > 0) {
        const { error } = await supabase.from('jugadors').upsert(updates, { onConflict: ['id'] })
        if (error) throw error
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from('jugadors').insert(inserts)
        if (error) throw error
      }

      setCsvSuccess(`S'han processat ${updates.length} actualitzacions i ${inserts.length} nous jugadors.`)
      setCsvRows([])
      setCsvFileName('')
      loadData()
    } catch (error) {
      console.error(error)
      setCsvError('Error al processar el CSV. Revisa la consola per més detalls.')
    } finally {
      setCsvSubmitting(false)
    }
  }

  if (loading) return <div>Carregant...</div>

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jugadors</h1>
          <p className="text-gray-600">Gestiona jugadors, importa un CSV i compara amb entrades existents.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Afegeix jugador</h2>
          <form onSubmit={handleAddPlayer} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Nom</label>
              <input
                value={newPlayer.nom}
                onChange={(e) => setNewPlayer({ ...newPlayer, nom: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Cognoms</label>
              <input
                value={newPlayer.cognoms}
                onChange={(e) => setNewPlayer({ ...newPlayer, cognoms: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input
                type="email"
                value={newPlayer.email}
                onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Telèfon</label>
              <input
                value={newPlayer.telefon}
                onChange={(e) => setNewPlayer({ ...newPlayer, telefon: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Data de naixement</label>
              <input
                type="date"
                value={newPlayer.data_naixement}
                onChange={(e) => setNewPlayer({ ...newPlayer, data_naixement: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Barruf (ELO)</label>
              <input
                type="number"
                value={newPlayer.barruf}
                onChange={(e) => setNewPlayer({ ...newPlayer, barruf: parseInt(e.target.value, 10) || 0 })}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Club</label>
              <select
                value={newPlayer.club_id}
                onChange={(e) => setNewPlayer({ ...newPlayer, club_id: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              >
                <option value="">Sense club</option>
                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>{club.nom}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newPlayer.es_soci}
                  onChange={(e) => setNewPlayer({ ...newPlayer, es_soci: e.target.checked })}
                  className="h-4 w-4"
                />
                És soci
              </label>
            </div>
            <button
              type="submit"
              disabled={savingPlayer}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {savingPlayer ? 'Guardant...' : 'Crear jugador'}
            </button>
          </form>
        </div>

        {editingPlayer && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Editar jugador: {editingPlayer.nom} {editingPlayer.cognoms}</h2>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Nom</label>
                <input
                  value={editForm.nom}
                  onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Cognoms</label>
                <input
                  value={editForm.cognoms}
                  onChange={(e) => setEditForm({ ...editForm, cognoms: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Telèfon</label>
                <input
                  value={editForm.telefon}
                  onChange={(e) => setEditForm({ ...editForm, telefon: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Data de naixement</label>
                <input
                  type="date"
                  value={editForm.data_naixement}
                  onChange={(e) => setEditForm({ ...editForm, data_naixement: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Barruf (ELO)</label>
                <input
                  type="number"
                  value={editForm.barruf}
                  onChange={(e) => setEditForm({ ...editForm, barruf: parseInt(e.target.value, 10) || 0 })}
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Club</label>
                <select
                  value={editForm.club_id}
                  onChange={(e) => setEditForm({ ...editForm, club_id: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                >
                  <option value="">Sense club</option>
                  {clubs.map((club) => (
                    <option key={club.id} value={club.id}>{club.nom}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.es_soci}
                    onChange={(e) => setEditForm({ ...editForm, es_soci: e.target.checked })}
                    className="h-4 w-4"
                  />
                  És soci
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingPlayer}
                  className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  {savingPlayer ? 'Guardant...' : 'Guardar canvis'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
                >
                  Cancel·lar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Puja CSV de jugadors</h2>
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
            {csvError && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-red-700">{csvError}</div>}
            {csvSuccess && <div className="rounded-md bg-green-50 border border-green-200 p-3 text-green-700">{csvSuccess}</div>}
            <div className="text-sm text-gray-600">
              El CSV ha de contenir columnes mínimes: <strong>nom, cognoms</strong>. També pot incloure <strong>email, telefon, data_naixement, club, es_soci, barruf</strong>.
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
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Club CSV</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Match</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acció</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {csvRows.map((row, index) => (
                        <tr key={`${row.nom}-${row.cognoms}-${index}`}>
                          <td className="px-4 py-3 align-top">
                            <div className="font-semibold">{row.nom} {row.cognoms}</div>
                            <div className="text-sm text-gray-500">{row.email || 'sense email'}</div>
                          </td>
                          <td className="px-4 py-3 align-top">{row.club || 'Sense club'}</td>
                          <td className="px-4 py-3 align-top">
                            {row.suggestions.length > 0 ? (
                              <div className="space-y-2">
                                {row.suggestions.slice(0, 2).map((suggestion) => (
                                  <div key={suggestion.player.id} className="rounded border border-gray-200 p-2 bg-gray-50">
                                    <div className="text-sm font-medium">{suggestion.player.nom} {suggestion.player.cognoms}</div>
                                    <div className="text-xs text-gray-500">Similitud: {(suggestion.similarity * 100).toFixed(0)}%</div>
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
                              onChange={(e) => handleSelectMatch(index, e.target.value === 'new' ? null : e.target.value)}
                              className="block w-full border border-gray-300 rounded-md p-2"
                            >
                              <option value="new">Crea nou jugador</option>
                              {row.suggestions.map((suggestion) => (
                                <option key={suggestion.player.id} value={suggestion.player.id}>
                                  {suggestion.player.nom} {suggestion.player.cognoms} ({(suggestion.similarity * 100).toFixed(0)}%)
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={handleCsvSubmit}
                  disabled={csvSubmitting}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  {csvSubmitting ? 'Processant...' : 'Puja i actualitza jugadors'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cognoms</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Club</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telèfon</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Naixement</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Barruf</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Soci</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Alta</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jugadors.map((jugador) => (
              <tr key={jugador.id}>
                <td className="px-6 py-4 whitespace-nowrap">{jugador.nom}</td>
                <td className="px-6 py-4 whitespace-nowrap">{jugador.cognoms}</td>
                <td className="px-6 py-4 whitespace-nowrap">{jugador.club_id ? clubs.find((c) => c.id === jugador.club_id)?.nom : 'Sense club'}</td>
                <td className="px-6 py-4 whitespace-nowrap">{jugador.telefon || '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap">{jugador.data_naixement ? new Date(jugador.data_naixement).toLocaleDateString('ca') : '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap">{jugador.barruf ?? '—'}</td>
                <td className="px-6 py-4 whitespace-nowrap">{jugador.es_soci ? 'Sí' : 'No'}</td>
                <td className="px-6 py-4 whitespace-nowrap">{new Date(jugador.data_alta).toLocaleDateString('ca')}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditPlayer(jugador)}
                      className="text-blue-600 hover:text-blue-900 text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeletePlayer(jugador.id)}
                      className="text-red-600 hover:text-red-900 text-sm"
                    >
                      Esborrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
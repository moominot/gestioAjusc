'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Temporades, Jugadors } from '../../../types/database'
import { findSimilarPlayers } from '../../../lib/nameMatching'
import Papa from 'papaparse'

interface PlayerResolution {
  name: string
  suggestions: { player: Jugadors; similarity: number }[]
  selectedId: string | null
  isNew: boolean
  newData: { nom: string; cognoms: string; club_id: string | null; email: string }
  status: 'perfect' | 'good' | 'needs-attention' // New field for auto-selection status
}

export default function NouCampionat() {
  const [step, setStep] = useState(1)
  const [temporades, setTemporades] = useState<Temporades[]>([])
  const [clubs, setClubs] = useState<{ id: string; nom: string }[]>([])
  const [allPlayers, setAllPlayers] = useState<Jugadors[]>([])
  const tieBreakerOptions = [
    { value: 'buchholz', label: 'Buchholz' },
    { value: 'median_buchholz', label: 'Median Buchholz' },
    { value: 'berger', label: 'Berger' },
    { value: 'differential', label: 'Diferencial de punts' },
    { value: 'average_points', label: 'Mitjana de punts' }
  ]

  const [formData, setFormData] = useState({
    temporada_id: '',
    nom: '',
    data: '',
    tipus_campionat: 'Classic',
    desempat: [] as string[]
  })
  const availableDesempatOptions = tieBreakerOptions.filter(option => !formData.desempat.includes(option.value))
  const [selectedDesempat, setSelectedDesempat] = useState(availableDesempatOptions[0]?.value || '')
  const [matchesData, setMatchesData] = useState('')
  const [matchesFileName, setMatchesFileName] = useState('')
  const [uniqueNames, setUniqueNames] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (availableDesempatOptions.length > 0) {
      setSelectedDesempat(availableDesempatOptions[0].value)
    }
  }, [availableDesempatOptions.length])
  const [playerResolutions, setPlayerResolutions] = useState<PlayerResolution[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Load seasons, clubs and players
    Promise.all([
      supabase.from('temporades').select('*'),
      supabase.from('clubs').select('id, nom'),
      supabase.from('jugadors').select('*')
    ]).then(([tempRes, clubRes, playerRes]) => {
      if (tempRes.data) setTemporades(tempRes.data)
      if (clubRes.data) setClubs(clubRes.data)
      if (playerRes.data) setAllPlayers(playerRes.data)
    })
  }, [])

  const handleChampionshipSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStep(2)
  }

  const handleMatchesSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!matchesData) {
      alert('Selecciona un fitxer CSV amb les partides abans de continuar.')
      return
    }

    setLoading(true)

    // Parse CSV to get unique player names
    const parseResult = Papa.parse(matchesData, { header: true, skipEmptyLines: true })
    console.log('CSV headers found:', parseResult.meta.fields)
    console.log('First few rows:', parseResult.data.slice(0, 3))

    // Validate CSV has required columns
    const requiredColumns = ['jugador_1', 'jugador_2', 'punts_1', 'punts_2']
    const missingColumns = requiredColumns.filter(col => !parseResult.meta.fields?.includes(col))

    if (missingColumns.length > 0) {
      alert(`El CSV no té les columnes requerides: ${missingColumns.join(', ')}`)
      setLoading(false)
      return
    }

    const namesSet = new Set<string>()
    parseResult.data.forEach((row: any) => {
      if (row.jugador_1) namesSet.add(row.jugador_1.trim())
      if (row.jugador_2) namesSet.add(row.jugador_2.trim())
    })

    setUniqueNames(namesSet)

    console.log('Unique player names found:', Array.from(namesSet))

    // Create resolutions with auto-selection
    const resolutions: PlayerResolution[] = Array.from(namesSet).map(name => {
      const suggestions = findSimilarPlayers(name, allPlayers)
      let selectedId: string | null = null
      let isNew = false
      let status: 'perfect' | 'good' | 'needs-attention' = 'needs-attention'

      if (suggestions.length > 0) {
        const bestMatch = suggestions[0]
        if (bestMatch.similarity >= 1.0) { // 100% match
          selectedId = bestMatch.player.id
          status = 'perfect'
        } else if (bestMatch.similarity >= 0.5) { // 50%+ match
          selectedId = bestMatch.player.id
          status = 'good'
        }
        // If similarity < 0.5, leave as needs-attention
      } else {
        // No suggestions found, will need to create new player
        isNew = true
        const parts = name.split(' ')
        status = 'needs-attention'
      }

      return {
        name,
        suggestions,
        selectedId,
        isNew,
        newData: { nom: '', cognoms: '', club_id: null, email: '' },
        status
      }
    })

    setPlayerResolutions(resolutions)
    setStep(3)
    setLoading(false)
  }

  const handleResolutionChange = (index: number, selectedId: string | null, isNew: boolean) => {
    const updated = [...playerResolutions]
    updated[index].selectedId = selectedId
    updated[index].isNew = isNew
    // Update status based on user action
    updated[index].status = isNew ? 'needs-attention' : 'perfect'
    if (isNew) {
      // Parse name into nom and cognoms
      const parts = updated[index].name.split(' ')
      updated[index].newData.nom = parts[0] || ''
      updated[index].newData.cognoms = parts.slice(1).join(' ') || ''
    }
    setPlayerResolutions(updated)
  }

  const handleNewPlayerDataChange = (index: number, field: string, value: string) => {
    const updated = [...playerResolutions]
    updated[index].newData = { ...updated[index].newData, [field]: value }
    setPlayerResolutions(updated)
  }

  const handleFinalSubmit = async () => {
    setLoading(true)

    try {
      // Create new players if any
      const newPlayers = playerResolutions.filter(r => r.isNew).map(r => ({
        nom: r.newData.nom,
        cognoms: r.newData.cognoms,
        club_id: r.newData.club_id,
        email: r.newData.email || null,
        es_soci: false
      }))

      let createdPlayers: Jugadors[] = []
      if (newPlayers.length > 0) {
        const { data, error } = await supabase.from('jugadors').insert(newPlayers).select()
        if (error) throw error
        createdPlayers = data || []
      }

      // Map names to IDs
      const nameToId = new Map<string, string>()
      playerResolutions.forEach((res) => {
        if (res.isNew) {
          const created = createdPlayers.find(p => p.nom === res.newData.nom && p.cognoms === res.newData.cognoms)
          if (created) nameToId.set(res.name, created.id)
        } else if (res.selectedId) {
          nameToId.set(res.name, res.selectedId)
        }
      })

      console.log('Final nameToId mapping:', Object.fromEntries(nameToId))
      console.log('Player resolutions:', playerResolutions.map(r => ({
        name: r.name,
        selectedId: r.selectedId,
        isNew: r.isNew,
        status: r.status
      })))

      // Validate all names have IDs
      const uniqueNamesFromCSV = Array.from(uniqueNames)
      const missingMappings = uniqueNamesFromCSV.filter(name => !nameToId.has(name))

      if (missingMappings.length > 0) {
        throw new Error(`Els següents jugadors no tenen ID assignat: ${missingMappings.join(', ')}`)
      }

      // Validate championship data
      if (!formData.temporada_id || !formData.nom || !formData.data) {
        throw new Error('Falten camps requerits: temporada, nom o data')
      }

      // Check if selected season exists
      const selectedSeason = temporades.find(t => t.id === formData.temporada_id)
      if (!selectedSeason) {
        throw new Error('La temporada seleccionada no existeix')
      }

      // Validate date format
      const dateObj = new Date(formData.data)
      if (isNaN(dateObj.getTime())) {
        throw new Error('La data no és vàlida')
      }

      // Create championship
      const championshipData = {
        temporada_id: formData.temporada_id,
        nom: formData.nom.trim(),
        data: formData.data,
        tipus_campionat: formData.tipus_campionat,
        desempat: formData.desempat
      }

      console.log('Inserting championship:', championshipData) // Debug log

      const { data: campionat, error: campError } = await supabase
        .from('campionats')
        .insert([championshipData])
        .select()
        .single()

      if (campError) {
        console.error('Championship insert error:', campError) // Debug log
        throw campError
      }

      // Replace in CSV
      let csvWithIds = matchesData
      console.log('Original CSV sample:', matchesData.substring(0, 200))
      console.log('Name to ID mappings:', Object.fromEntries(nameToId))

      nameToId.forEach((id, name) => {
        console.log(`Replacing "${name}" with "${id}"`)
        csvWithIds = csvWithIds.replace(new RegExp(name, 'g'), id)
      })

      console.log('CSV after replacement sample:', csvWithIds.substring(0, 200))
      csvWithIds = csvWithIds.replace(/{campionat_id}/g, campionat.id)

      // Upload matches
      const formDataUpload = new FormData()
      const csvBlob = new Blob([csvWithIds], { type: 'text/csv' })
      formDataUpload.append('file', csvBlob, 'matches.csv')

      const response = await fetch('/api/upload-partides', {
        method: 'POST',
        body: formDataUpload
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error uploading matches')
      }

      alert('Campionat i partides creats correctament!')
      // Reset
      setStep(1)
      setFormData({
        temporada_id: '',
        nom: '',
        data: '',
        tipus_campionat: 'Classic',
        desempat: []
      })
      setMatchesData('')
      setPlayerResolutions([])
    } catch (error) {
      console.error(error)
      alert('Error: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const allResolved = playerResolutions.every(r => r.selectedId || r.isNew)

  if (step === 1) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-6">Crear Nou Campionat</h1>
        <form onSubmit={handleChampionshipSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Temporada</label>
            <select
              value={formData.temporada_id}
              onChange={(e) => setFormData({...formData, temporada_id: e.target.value})}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              required
            >
              <option value="">Selecciona una temporada</option>
              {temporades.map(t => (
                <option key={t.id} value={t.id}>{t.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Nom del Campionat</label>
            <input
              type="text"
              value={formData.nom}
              onChange={(e) => setFormData({...formData, nom: e.target.value})}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Data</label>
            <input
              type="date"
              value={formData.data}
              onChange={(e) => setFormData({...formData, data: e.target.value})}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Tipus de Campionat</label>
            <select
              value={formData.tipus_campionat}
              onChange={(e) => setFormData({...formData, tipus_campionat: e.target.value})}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            >
              <option value="Classic">Classic</option>
              <option value="Duplicada">Duplicada</option>
            </select>
          </div>
              <div>
            <label className="block text-sm font-medium">Afegir criteri de desempat</label>
            <div className="mt-2 flex gap-2">
              <select
                value={selectedDesempat}
                onChange={(e) => setSelectedDesempat(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md p-2"
              >
                {tieBreakerOptions
                  .filter(option => !formData.desempat.includes(option.value))
                  .map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (selectedDesempat && !formData.desempat.includes(selectedDesempat)) {
                    setFormData({
                      ...formData,
                      desempat: [...formData.desempat, selectedDesempat]
                    })
                  }
                }}
                disabled={availableDesempatOptions.length === 0}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Afegeix
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {formData.desempat.length === 0 ? (
                <p className="text-sm text-gray-500">Cap criteri seleccionat. Afegeix-ne un del desplegable.</p>
              ) : (
                <div className="space-y-2">
                  {formData.desempat.map((criteria, index) => {
                    const option = tieBreakerOptions.find(o => o.value === criteria)
                    return (
                      <div key={criteria} className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-gray-50 p-2">
                        <span>{index + 1}. {option?.label || criteria}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              desempat: formData.desempat.filter(item => item !== criteria)
                            })
                          }}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Elimina
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600">
            Següent: Afegir Partides
          </button>
        </form>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <h1 className="text-2xl font-bold mb-6">Afegir Partides al Campionat</h1>
        <form onSubmit={handleMatchesSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Fitxer CSV de partides</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) {
                  setMatchesData('')
                  setMatchesFileName('')
                  return
                }
                setMatchesFileName(file.name)
                const text = await file.text()
                setMatchesData(text)
              }}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              required
            />
            {matchesFileName ? (
              <p className="text-sm text-gray-600 mt-2">Fitxer seleccionat: {matchesFileName}</p>
            ) : (
              <p className="text-sm text-gray-600 mt-2">Selecciona un fitxer CSV amb les partides. El campionat es carregarà amb noms de jugadors.</p>
            )}
            <div className="text-sm text-gray-600 mt-2">
              <p><strong>Camps mínims requerits al CSV:</strong></p>
              <ul className="list-disc list-inside mt-1">
                <li><code>jugador_1</code> - Nom del primer jugador</li>
                <li><code>jugador_2</code> - Nom del segon jugador</li>
                <li><code>punts_1</code> - Punts del primer jugador</li>
                <li><code>punts_2</code> - Punts del segon jugador</li>
              </ul>
              <p className="mt-2"><strong>Camps opcionals:</strong> ronda, scrabbles_1, scrabbles_2, mot_1, mot_2, punts_mot_1, punts_mot_2, especial_1, especial_2, punts_especial_1, punts_especial_2</p>
              <p className="mt-2">El {`{campionat_id}`} es reemplaçarà automàticament abans de pujar.</p>
            </div>
          </div>
          <div className="flex space-x-4">
            <button type="button" onClick={() => setStep(1)} className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600">
              Enrere
            </button>
            <button type="submit" disabled={loading || !matchesData} className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50">
              {loading ? 'Processant...' : 'Següent: Resoldre Jugadors'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // Step 3: Resolve players
  return (
    <div className="max-w-4xl mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-6">Resoldre Jugadors</h1>
      <div className="space-y-6">
        {playerResolutions.map((res, index) => {
          const borderColor = res.status === 'perfect' ? 'border-green-500 bg-green-50' :
                             res.status === 'good' ? 'border-yellow-500 bg-yellow-50' :
                             'border-red-500 bg-red-50'
          return (
            <div key={index} className={`border rounded-md p-4 ${borderColor}`}>
              <h3 className="font-semibold">Nom: {res.name}</h3>
              <div className="text-sm text-gray-600 mb-2">
                {res.status === 'perfect' && '✅ Coincidència perfecta - seleccionat automàticament'}
                {res.status === 'good' && '⚠️ Bona coincidència - revisa i confirma'}
                {res.status === 'needs-attention' && '❌ Cal resoldre manualment'}
              </div>
              <div className="mt-2">
                <label className="block text-sm font-medium">Selecciona opció:</label>
                <select
                  value={res.isNew ? 'new' : res.selectedId || ''}
                  onChange={(e) => {
                    if (e.target.value === 'new') {
                      handleResolutionChange(index, null, true)
                    } else {
                      handleResolutionChange(index, e.target.value, false)
                    }
                  }}
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                >
                  <option value="">Selecciona una opció...</option>
                  {res.suggestions.map(s => (
                    <option key={s.player.id} value={s.player.id}>
                      {s.player.nom} {s.player.cognoms} ({(s.similarity * 100).toFixed(0)}% similitud)
                    </option>
                  ))}
                  <option value="new">➕ Crear jugador nou</option>
                </select>
              </div>
              {res.isNew && (
                <div className="mt-4 space-y-2">
                  <input
                    type="text"
                    placeholder="Nom"
                    value={res.newData.nom}
                    onChange={(e) => handleNewPlayerDataChange(index, 'nom', e.target.value)}
                    className="block w-full border border-gray-300 rounded-md p-2"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Cognoms"
                    value={res.newData.cognoms}
                    onChange={(e) => handleNewPlayerDataChange(index, 'cognoms', e.target.value)}
                    className="block w-full border border-gray-300 rounded-md p-2"
                    required
                  />
                  <select
                    value={res.newData.club_id || ''}
                    onChange={(e) => handleNewPlayerDataChange(index, 'club_id', e.target.value)}
                    className="block w-full border border-gray-300 rounded-md p-2"
                  >
                    <option value="">Sense club</option>
                    {clubs.map(c => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                  <input
                    type="email"
                    placeholder="Email"
                    value={res.newData.email}
                    onChange={(e) => handleNewPlayerDataChange(index, 'email', e.target.value)}
                    className="block w-full border border-gray-300 rounded-md p-2"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mt-6">
        <h3 className="font-semibold mb-2">Resum de resolucions:</h3>
        <div className="flex gap-4 text-sm">
          <span className="text-green-600">
            ✅ Perfectes: {playerResolutions.filter(r => r.status === 'perfect').length}
          </span>
          <span className="text-yellow-600">
            ⚠️ Bones: {playerResolutions.filter(r => r.status === 'good').length}
          </span>
          <span className="text-red-600">
            ❌ Cal revisar: {playerResolutions.filter(r => r.status === 'needs-attention').length}
          </span>
        </div>
      </div>

      <div className="mt-6 flex space-x-4">
        <button type="button" onClick={() => setStep(2)} className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600">
          Enrere
        </button>
        <button
          onClick={handleFinalSubmit}
          disabled={!allResolved || loading}
          className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? 'Creant...' : 'Crear Campionat i Partides'}
        </button>
      </div>
    </div>
  )
}
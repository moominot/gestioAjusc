'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { Jugadors, Clubs } from '../../types/database'
import { AddPlayerModal } from '../../components/AddPlayerModal'
import { EditPlayerModal } from '../../components/EditPlayerModal'
import { CsvImportModal } from '../../components/CsvImportModal'
import { PlayerDetailsModal } from '../../components/PlayerDetailsModal'
import { GlobalStats } from '../../components/GlobalStats'

export default function JugadorsPage() {
  const [jugadors, setJugadors] = useState<Jugadors[]>([])
  const [clubs, setClubs] = useState<Clubs[]>([])
  const [loading, setLoading] = useState(true)
  const [savingPlayer, setSavingPlayer] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Jugadors | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

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
      setShowAddModal(false)
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
    const { error } = await supabase
      .from('jugadors')
      .delete()
      .eq('id', playerId)

    if (error) {
      console.error(error)
      alert('No s’ha pogut esborrar el jugador')
    } else {
      setEditingPlayer(null)
      loadData()
    }
  }

  if (loading) return <div className="p-6">Carregant...</div>

  return (
    <div className="space-y-8">
      {/* Header amb botons */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jugadors</h1>
          <p className="text-gray-600">Gestiona jugadors i visualitza estadístiques</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            + Afegir Jugador
          </button>
          <button
            onClick={() => setShowCsvModal(true)}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            📥 Importar CSV
          </button>
        </div>
      </div>

      {/* Estadístiques Globals */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Estadístiques Globals</h2>
        <GlobalStats jugadors={jugadors} />
      </div>

      {/* Taula de Jugadors */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Club</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telèfon</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Barruf</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Soci</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Alta</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stats</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jugadors.map((jugador) => (
              <tr
                key={jugador.id}
                onClick={() => {
                  setSelectedPlayer(jugador)
                  setShowDetailsModal(true)
                }}
                className="hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap font-medium">
                  {jugador.nom} {jugador.cognoms}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {jugador.club_id ? clubs.find((c) => c.id === jugador.club_id)?.nom : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {jugador.telefon || '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                  {jugador.barruf ?? '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {jugador.es_soci ? '✓' : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {new Date(jugador.data_alta).toLocaleDateString('ca')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <Link
                    href={`/jugadors/${jugador.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    Veure stats
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      <AddPlayerModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddPlayer}
        newPlayer={newPlayer}
        setNewPlayer={setNewPlayer}
        clubs={clubs}
        isLoading={savingPlayer}
      />

      <EditPlayerModal
        isOpen={editingPlayer !== null}
        onClose={() => setEditingPlayer(null)}
        onSubmit={handleSaveEdit}
        onDelete={() => handleDeletePlayer(editingPlayer?.id || '')}
        editingPlayer={editingPlayer}
        editForm={editForm}
        setEditForm={setEditForm}
        clubs={clubs}
        isLoading={savingPlayer}
      />

      <CsvImportModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        jugadors={jugadors}
        clubs={clubs}
        onImportComplete={() => {
          setShowCsvModal(false)
          loadData()
        }}
      />

      <PlayerDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        player={selectedPlayer}
        clubs={clubs}
        onEdit={(player) => {
          handleEditPlayer(player)
          setShowDetailsModal(false)
        }}
      />
    </div>
  )
}
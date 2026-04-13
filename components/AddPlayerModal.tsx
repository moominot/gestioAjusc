'use client'

import React from 'react'
import { Modal } from './Modal'
import { Clubs } from '../types/database'

interface AddPlayerModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => Promise<void>
  newPlayer: {
    nom: string
    cognoms: string
    email: string
    telefon: string
    data_naixement: string
    barruf: number
    club_id: string
    es_soci: boolean
  }
  setNewPlayer: (player: any) => void
  clubs: Clubs[]
  isLoading: boolean
}

export function AddPlayerModal({
  isOpen,
  onClose,
  onSubmit,
  newPlayer,
  setNewPlayer,
  clubs,
  isLoading,
}: AddPlayerModalProps) {
  return (
    <Modal isOpen={isOpen} title="Afegir Jugador" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
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
              <option key={club.id} value={club.id}>
                {club.nom}
              </option>
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
        <div className="flex gap-2 justify-end pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel·lar
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Guardant...' : 'Crear jugador'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

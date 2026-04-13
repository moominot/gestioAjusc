'use client'

import React from 'react'
import { Modal } from './Modal'
import { Jugadors, Clubs } from '../types/database'

interface EditPlayerModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => Promise<void>
  onDelete: () => Promise<void>
  editingPlayer: Jugadors | null
  editForm: {
    nom: string
    cognoms: string
    email: string
    telefon: string
    data_naixement: string
    barruf: number
    club_id: string
    es_soci: boolean
  }
  setEditForm: (form: any) => void
  clubs: Clubs[]
  isLoading: boolean
}

export function EditPlayerModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  editingPlayer,
  editForm,
  setEditForm,
  clubs,
  isLoading,
}: EditPlayerModalProps) {
  if (!editingPlayer) return null

  return (
    <Modal
      isOpen={isOpen}
      title={`Editar jugador: ${editingPlayer.nom} ${editingPlayer.cognoms}`}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-4">
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
              checked={editForm.es_soci}
              onChange={(e) => setEditForm({ ...editForm, es_soci: e.target.checked })}
              className="h-4 w-4"
            />
            És soci
          </label>
        </div>
        <div className="flex gap-2 justify-between pt-4 border-t">
          <button
            type="button"
            onClick={async () => {
              if (confirm('Estàs segur que vols esborrar aquest jugador?')) {
                await onDelete()
              }
            }}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
            disabled={isLoading}
          >
            Esborrar
          </button>
          <div className="flex gap-2">
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
              {isLoading ? 'Guardant...' : 'Guardar canvis'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

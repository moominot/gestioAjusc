'use client'

import React from 'react'
import { Modal } from './Modal'
import { Jugadors, Clubs } from '../types/database'

interface PlayerDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  player: Jugadors | null
  clubs: Clubs[]
  onEdit: (player: Jugadors) => void
}

export function PlayerDetailsModal({
  isOpen,
  onClose,
  player,
  clubs,
  onEdit,
}: PlayerDetailsModalProps) {
  if (!player) return null

  const club = clubs.find((c) => c.id === player.club_id)
  const edad = player.data_naixement
    ? Math.floor(
        (new Date().getTime() - new Date(player.data_naixement).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      )
    : null

  return (
    <Modal isOpen={isOpen} title={`${player.nom} ${player.cognoms}`} onClose={onClose}>
      <div className="space-y-6">
        {/* Informació Personal */}
        <div>
          <h3 className="text-lg font-semibold mb-4 border-b pb-2">Informació Personal</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Nom Complet</div>
              <div className="text-lg font-medium">
                {player.nom} {player.cognoms}
              </div>
            </div>
            {player.data_naixement && (
              <div>
                <div className="text-sm text-gray-600">Edat</div>
                <div className="text-lg font-medium">{edad} anys</div>
              </div>
            )}
            {player.email && (
              <div>
                <div className="text-sm text-gray-600">Email</div>
                <div className="text-lg font-medium break-all">{player.email}</div>
              </div>
            )}
            {player.telefon && (
              <div>
                <div className="text-sm text-gray-600">Telèfon</div>
                <div className="text-lg font-medium">{player.telefon}</div>
              </div>
            )}
            {club && (
              <div>
                <div className="text-sm text-gray-600">Club</div>
                <div className="text-lg font-medium">{club.nom}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-gray-600">Estat</div>
              <div className="text-lg font-medium">{player.es_soci ? 'Soci ✓' : 'No soci'}</div>
            </div>
          </div>
        </div>

        {/* Estadístiques de Joc */}
        <div>
          <h3 className="text-lg font-semibold mb-4 border-b pb-2">Estadístiques de Joc</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="text-sm text-gray-600">Barruf (ELO)</div>
              <div className="text-3xl font-bold text-blue-600">{player.barruf || '—'}</div>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div>
          <h3 className="text-lg font-semibold mb-4 border-b pb-2">Dates</h3>
          <div className="grid grid-cols-2 gap-4">
            {player.data_naixement && (
              <div>
                <div className="text-sm text-gray-600">Data Naixement</div>
                <div className="text-lg font-medium">
                  {new Date(player.data_naixement).toLocaleDateString('ca')}
                </div>
              </div>
            )}
            <div>
              <div className="text-sm text-gray-600">Data Alta</div>
              <div className="text-lg font-medium">
                {new Date(player.data_alta).toLocaleDateString('ca')}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Tancar
          </button>
          <button
            onClick={() => {
              onEdit(player)
              onClose()
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Editar
          </button>
        </div>
      </div>
    </Modal>
  )
}

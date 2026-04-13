'use server'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { Jugadors, Partides, Campionats, Temporades, Clubs } from '../../../types/database'

function getPlayerGameData(partida: Partides, playerId: string) {
  const isFirst = partida.jugador_1_id === playerId
  const score = isFirst ? partida.punts_1 : partida.punts_2
  const opponentScore = isFirst ? partida.punts_2 : partida.punts_1
  const scrabbles = isFirst ? partida.scrabbles_1 : partida.scrabbles_2
  const specialPoints = isFirst ? partida.punts_especial_1 : partida.punts_especial_2
  const opponentId = isFirst ? partida.jugador_2_id : partida.jugador_1_id
  const result = score > opponentScore ? 'win' : score < opponentScore ? 'loss' : 'draw'

  return { score, opponentScore, scrabbles, specialPoints, opponentId, result, campionatId: partida.campionat_id, round: partida.ronda }
}

export default async function PlayerStatsPage({ params }: { params: { id: string } }) {
  const playerId = params.id

  const [playerRes, partides1Res, partides2Res, campionatsRes, temporadesRes, clubsRes] = await Promise.all([
    supabase.from<Jugadors>('jugadors').select('*').eq('id', playerId).single(),
    supabase.from<Partides>('partides').select('*').eq('jugador_1_id', playerId),
    supabase.from<Partides>('partides').select('*').eq('jugador_2_id', playerId),
    supabase.from<Campionats>('campionats').select('*'),
    supabase.from<Temporades>('temporades').select('*'),
    supabase.from<Clubs>('clubs').select('*')
  ])

  if (playerRes.error || !playerRes.data) {
    notFound()
  }

  const player = playerRes.data
  const partides = [...(partides1Res.data ?? []), ...(partides2Res.data ?? [])]
  const opponentIds = Array.from(new Set(partides.map((partida) => {
    return partida.jugador_1_id === playerId ? partida.jugador_2_id : partida.jugador_1_id
  }).filter(Boolean)))

  const opponentRes = opponentIds.length > 0
    ? await supabase.from<Jugadors>('jugadors').select('id, nom, cognoms').in('id', opponentIds)
    : { data: [] }

  const opponents = opponentRes.data ?? []
  const opponentsById = new Map(opponents.map((opp) => [opp.id, `${opp.nom} ${opp.cognoms}`]))
  const campionatsById = new Map((campionatsRes.data ?? []).map((campionat) => [campionat.id, campionat]))
  const temporadesById = new Map((temporadesRes.data ?? []).map((temporada) => [temporada.id, temporada]))
  const club = clubsRes.data?.find((c) => c.id === player.club_id)

  const games = partides.length
  const gameStats = partides.map((partida) => ({
    partida,
    ...getPlayerGameData(partida, playerId)
  }))

  const totalPoints = gameStats.reduce((sum, row) => sum + row.score, 0)
  const totalOpponentPoints = gameStats.reduce((sum, row) => sum + row.opponentScore, 0)
  const totalWins = gameStats.filter((row) => row.result === 'win').length
  const totalDraws = gameStats.filter((row) => row.result === 'draw').length
  const totalLosses = gameStats.filter((row) => row.result === 'loss').length
  const totalScrabbles = gameStats.reduce((sum, row) => sum + row.scrabbles, 0)
  const totalSpecialPoints = gameStats.reduce((sum, row) => sum + row.specialPoints, 0)
  const uniqueChampionships = new Set(gameStats.map((row) => row.campionatId)).size
  const averagePoints = games > 0 ? (totalPoints / games).toFixed(1) : '0.0'

  const championshipStats = Array.from(gameStats.reduce((map, row) => {
    const existing = map.get(row.campionatId)
    if (!existing) {
      map.set(row.campionatId, {
        campionatId: row.campionatId,
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        opponentPoints: 0,
        scrabbles: 0,
        specialPoints: 0
      })
    }
    const stat = map.get(row.campionatId)!
    stat.games += 1
    stat.points += row.score
    stat.opponentPoints += row.opponentScore
    stat.scrabbles += row.scrabbles
    stat.specialPoints += row.specialPoints
    stat.wins += row.result === 'win' ? 1 : 0
    stat.draws += row.result === 'draw' ? 1 : 0
    stat.losses += row.result === 'loss' ? 1 : 0
    return map
  }, new Map<string, {
    campionatId: string
    games: number
    wins: number
    draws: number
    losses: number
    points: number
    opponentPoints: number
    scrabbles: number
    specialPoints: number
  }>())).map(([, stat]) => stat)

  const campaignRows = championshipStats.sort((a, b) => b.games - a.games)

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Estadístiques de {player.nom} {player.cognoms}</h1>
          <p className="text-gray-600">Dades extretes dels campionats i partides jugades.</p>
        </div>
        <div className="space-y-2 text-right">
          <Link href="/jugadors" className="text-blue-600 hover:underline">
            ← Tots els jugadors
          </Link>
          {club && <div className="text-sm text-gray-500">Club: {club.nom}</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Partides jugades</div>
          <div className="mt-2 text-3xl font-semibold">{games}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Victòries</div>
          <div className="mt-2 text-3xl font-semibold text-green-600">{totalWins}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Empats</div>
          <div className="mt-2 text-3xl font-semibold text-orange-600">{totalDraws}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Derrotes</div>
          <div className="mt-2 text-3xl font-semibold text-red-600">{totalLosses}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Punts totals</div>
          <div className="mt-2 text-3xl font-semibold">{totalPoints}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Mitjana punts</div>
          <div className="mt-2 text-3xl font-semibold">{averagePoints}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Championships jugats</div>
          <div className="mt-2 text-3xl font-semibold">{uniqueChampionships}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Scrabbles totals</div>
          <div className="mt-2 text-3xl font-semibold">{totalScrabbles}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Punts especials</div>
          <div className="mt-2 text-3xl font-semibold">{totalSpecialPoints}</div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Estadístiques per campionat</h2>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Campionat</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Temporada</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Partides</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">V</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">E</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">D</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Punts</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Mitjana</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {campaignRows.map((stat) => {
                const campionat = campionatsById.get(stat.campionatId)
                const temporada = campionat ? temporadesById.get(campionat.temporada_id) : undefined
                return (
                  <tr key={stat.campionatId}>
                    <td className="px-4 py-3 text-sm text-gray-700">{campionat?.nom || 'Campionat desconegut'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{temporada?.nom || '—'}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{stat.games}</td>
                    <td className="px-4 py-3 text-center text-sm text-green-600">{stat.wins}</td>
                    <td className="px-4 py-3 text-center text-sm text-orange-600">{stat.draws}</td>
                    <td className="px-4 py-3 text-center text-sm text-red-600">{stat.losses}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{stat.points}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{stat.games > 0 ? (stat.points / stat.games).toFixed(1) : '0.0'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Partides recents</h2>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Campionat</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Ronda</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Oponent</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Resultat</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Punts</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Scrabbles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {gameStats.slice(0, 12).map((row, index) => {
                const campionat = campionatsById.get(row.campionatId)
                return (
                  <tr key={`${row.partida.id}-${index}`}>
                    <td className="px-4 py-3 text-sm text-gray-700">{campionat?.nom || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.round}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{opponentsById.get(row.opponentId) || row.opponentId}</td>
                    <td className={`px-4 py-3 text-center text-sm font-semibold ${row.result === 'win' ? 'text-green-600' : row.result === 'draw' ? 'text-orange-600' : 'text-red-600'}`}>
                      {row.result === 'win' ? 'Victòria' : row.result === 'draw' ? 'Empat' : 'Derrota'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{row.score} - {row.opponentScore}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">{row.scrabbles}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

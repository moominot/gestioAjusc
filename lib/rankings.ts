import { Partides, Jugadors, Campionats } from '../types/database'

export interface PlayerStats {
  jugador: Jugadors
  victories: number
  empats: number
  derrotes: number
  puntsTotals: number
  diferenciaPunts: number
  buchholz: number
  medianBuchholz: number
  berger: number
  averagePoints: number
}

export function calcularRanking(partides: Partides[], campionat: Campionats, jugadors: Jugadors[]): PlayerStats[] {
  const statsMap = new Map<string, PlayerStats>()

  // Initialize stats for all players
  jugadors.forEach(jugador => {
    statsMap.set(jugador.id, {
      jugador,
      victories: 0,
      empats: 0,
      derrotes: 0,
      puntsTotals: 0,
      diferenciaPunts: 0,
      buchholz: 0,
      medianBuchholz: 0,
      berger: 0,
      averagePoints: 0
    })
  })

  // Calculate basic stats from matches
  partides.forEach(partida => {
    const p1 = statsMap.get(partida.jugador_1_id)!
    const p2 = statsMap.get(partida.jugador_2_id)!

    const diff1 = partida.punts_1 - partida.punts_2
    const diff2 = partida.punts_2 - partida.punts_1

    p1.diferenciaPunts += diff1
    p2.diferenciaPunts += diff2

    if (partida.punts_1 > partida.punts_2) {
      p1.victories++
      p1.puntsTotals += 2
      p2.derrotes++
    } else if (partida.punts_2 > partida.punts_1) {
      p2.victories++
      p2.puntsTotals += 2
      p1.derrotes++
    } else {
      p1.empats++
      p2.empats++
      p1.puntsTotals += 1
      p2.puntsTotals += 1
    }
  })

  // Calculate additional metrics
  const statsArray = Array.from(statsMap.values())
  statsArray.forEach(stat => {
    const playerId = stat.jugador.id
    const opponents = partides
      .filter(p => p.jugador_1_id === playerId || p.jugador_2_id === playerId)
      .map(p => {
        const opponentId = p.jugador_1_id === playerId ? p.jugador_2_id : p.jugador_1_id
        const opponentStat = statsMap.get(opponentId)!
        const isPlayer1 = p.jugador_1_id === playerId
        const pointsScored = isPlayer1 ? p.punts_1 : p.punts_2
        return { opponentStat, pointsScored }
      })

    // Buchholz: sum of opponents' total points
    stat.buchholz = opponents.reduce((sum, opp) => sum + opp.opponentStat.puntsTotals, 0)

    // Median Buchholz: median of opponents' total points
    const oppPoints = opponents.map(opp => opp.opponentStat.puntsTotals).sort((a, b) => a - b)
    const mid = Math.floor(oppPoints.length / 2)
    stat.medianBuchholz = oppPoints.length % 2 === 0 ? (oppPoints[mid - 1] + oppPoints[mid]) / 2 : oppPoints[mid]

    // Berger: sum of points from games against players with same or higher score
    stat.berger = opponents
      .filter(opp => opp.opponentStat.puntsTotals >= stat.puntsTotals)
      .reduce((sum, opp) => sum + opp.pointsScored, 0)

    // Average points: total points scored / games played
    const gamesPlayed = stat.victories + stat.empats + stat.derrotes
    stat.averagePoints = gamesPlayed > 0 ? stat.diferenciaPunts / gamesPlayed : 0 // Wait, average points in favor is total scored / games, but diferencia is scored - conceded, wait no.
    // Average points in favor: total points scored / games
    // But diferenciaPunts is scored - conceded, so total scored = (diferencia + conceded) but don't have conceded directly.
    // Actually, total scored = sum of pointsScored
    const totalScored = opponents.reduce((sum, opp) => sum + opp.pointsScored, 0)
    stat.averagePoints = gamesPlayed > 0 ? totalScored / gamesPlayed : 0
  })

  // Sort using tiebreakers
  const tiebreakers = campionat.desempat || []
  statsArray.sort((a, b) => {
    // First, by puntsTotals descending
    if (a.puntsTotals !== b.puntsTotals) {
      return b.puntsTotals - a.puntsTotals
    }
    // Then by each tiebreaker in order
    for (const tb of tiebreakers) {
      let valA: number, valB: number
      switch (tb) {
        case 'buchholz':
          valA = a.buchholz
          valB = b.buchholz
          break
        case 'median_buchholz':
          valA = a.medianBuchholz
          valB = b.medianBuchholz
          break
        case 'berger':
          valA = a.berger
          valB = b.berger
          break
        case 'differential':
          valA = a.diferenciaPunts
          valB = b.diferenciaPunts
          break
        case 'average_points':
          valA = a.averagePoints
          valB = b.averagePoints
          break
        default:
          continue
      }
      if (valA !== valB) {
        return valB - valA // descending
      }
    }
    return 0
  })

  return statsArray
}
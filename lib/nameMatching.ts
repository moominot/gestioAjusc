import levenshtein from 'fast-levenshtein'

export function calculateSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length)
  if (maxLen === 0) return 1
  const distance = levenshtein.get(str1.toLowerCase(), str2.toLowerCase())
  return 1 - distance / maxLen
}

export function findSimilarPlayers(name: string, allPlayers: { id: string; nom: string; cognoms: string }[]): { player: any; similarity: number }[] {
  const fullName = name.toLowerCase()
  return allPlayers
    .map(player => ({
      player,
      similarity: Math.max(
        calculateSimilarity(fullName, `${player.nom} ${player.cognoms}`.toLowerCase()),
        calculateSimilarity(fullName, `${player.cognoms}, ${player.nom}`.toLowerCase()),
        calculateSimilarity(fullName, player.nom.toLowerCase()),
        calculateSimilarity(fullName, player.cognoms.toLowerCase())
      )
    }))
    .filter(item => item.similarity > 0.6) // Threshold
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5) // Top 5
}
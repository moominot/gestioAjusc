import levenshtein from 'fast-levenshtein'

export function calculateSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length)
  if (maxLen === 0) return 1
  const distance = levenshtein.get(str1.toLowerCase(), str2.toLowerCase())
  return 1 - distance / maxLen
}

export function findSimilarPlayers(name: string, allPlayers: { id: string; nom: string; cognoms: string }[]): { player: any; similarity: number }[] {
  const fullName = name.toLowerCase().trim()
  return allPlayers
    .map(player => {
      const playerFullName = `${player.nom} ${player.cognoms}`.toLowerCase()
      const playerFullNameReversed = `${player.cognoms}, ${player.nom}`.toLowerCase()
      const playerNom = player.nom.toLowerCase()
      const playerCognoms = player.cognoms.toLowerCase()

      // Calculate similarities
      const similarities = [
        calculateSimilarity(fullName, playerFullName),
        calculateSimilarity(fullName, playerFullNameReversed),
        calculateSimilarity(fullName, playerNom),
        calculateSimilarity(fullName, playerCognoms)
      ]

      // Special handling for full names: if CSV has "Nom Cognoms" and DB has "Nom Cognoms", give higher score
      const maxSimilarity = Math.max(...similarities)
      let adjustedSimilarity = maxSimilarity

      // If the full name matches exactly (ignoring case and extra spaces), give perfect score
      if (fullName === playerFullName || fullName === playerFullNameReversed.replace(', ', ' ')) {
        adjustedSimilarity = 1.0
      }

      return {
        player,
        similarity: adjustedSimilarity
      }
    })
    .filter(item => item.similarity > 0.4) // Lower threshold for better matching
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5) // Top 5
}
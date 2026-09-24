// Romanized Nepali has no single spelling standard. Keep short words explicit;
// allow only a small, unambiguous spelling distance for longer cue words.
const forms = {
  aaja: ['aja', 'aj', 'aaj', 'aajaa', 'ajaa'],
  bholi: ['voli', 'boli', 'bholii', 'bhol', 'bholie'],
  hijo: ['hijo', 'hijjo', 'hijoo'],
  bihana: ['bihan', 'bihna', 'bihanaa', 'bihanai', 'bihanae', 'bihani', 'bihane'],
  beluka: ['belka', 'belukaa', 'beluk', 'belukha', 'belukae'],
  sanjha: ['sanjh', 'saanjh', 'sanjha', 'sajha', 'sajh', 'saanjha'],
  rati: ['raat', 'raati', 'rat', 'rati'],
  diuso: ['diunso', 'diuso', 'diusoo', 'deuso'],
  dekhi: ['dekhee', 'dekhi', 'dekhi'],
  samma: ['sama', 'smma', 'samma', 'sammaa'],
  baje: ['bajey', 'bajee', 'baje', 'bje', 'bajya'],
  bajda: ['bajda', 'bajdaa', 'bajdhaa', 'bajdha', 'bjda'],
  bajcha: ['bajcha', 'bajchha', 'bajxa', 'bajx', 'bajch', 'bazx', 'bazcha', 'bajchaa', 'bajchh', 'bajchxa'],
  bajyo: ['bajyo', 'bajyoo', 'bajio', 'bajiyo'],
  huncha: ['hunchha', 'hunxa', 'hunx', 'hunch', 'hunca', 'huncha'],
  kati: ['kati', 'katii', 'ktti', 'kti', 'katiii', 'katti', 'katy', 'kate'],
  ma: ['ma', 'maa'],
  ko: ['ko', 'koo'],
  bata: ['bata', 'bataa', 'batta', 'baata'],
}

const exact = new Map()
for (const [canonical, spellings] of Object.entries(forms)) {
  exact.set(canonical, canonical)
  for (const spelling of spellings) exact.set(spelling, canonical)
}

function distanceAtMostOne(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false
  if (a === b) return true
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a[i + 1] === b[j] && a[i] === b[j + 1]) { i += 2; j += 2 }
    else if (a.length > b.length) i++
    else if (a.length < b.length) j++
    else { i++; j++ }
  }
  return edits + Number(i < a.length || j < b.length) <= 1
}

const fuzzyRoots = ['aaja', 'bholi', 'bihana', 'beluka', 'sanjha', 'dekhi', 'samma', 'baje', 'bajda', 'bajcha', 'bajyo', 'huncha', 'kati', 'bata']

export function canonicalNepaliWord(word) {
  const direct = exact.get(word)
  if (direct) return direct
  if (word.length < 5) return word
  const matches = new Set(fuzzyRoots.filter(root => distanceAtMostOne(word, root)))
  return matches.size === 1 ? [...matches][0] : word
}

export function normalizeNepaliWords(text) {
  return text.toLowerCase().replace(/\b[a-z]+\b/g, word => canonicalNepaliWord(word))
}

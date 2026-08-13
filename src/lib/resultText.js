export function cleanResultText(text) {
  return text
    .replace(/\*{1,3}/g, '')
    .replace(/_{1,2}/g, '')
    .replace(/`+/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '· ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function parseResultSections(text) {
  const cleaned = cleanResultText(text)
  if (!cleaned) return []

  const chunks = cleaned.split(/(?=^\d+\.\s+)/m).filter((part) => part.trim())

  return chunks.map((chunk, index) => {
    const lines = chunk.trim().split('\n')
    const first = lines[0].trim()
    const headingMatch = first.match(/^(\d+)\.\s*(.+)$/)

    if (headingMatch) {
      return {
        id: `${headingMatch[1]}-${index}`,
        number: headingMatch[1],
        title: headingMatch[2].trim(),
        body: lines.slice(1).join('\n').trim(),
      }
    }

    return {
      id: `intro-${index}`,
      number: '',
      title: '',
      body: chunk.trim(),
    }
  })
}

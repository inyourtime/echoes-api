export const normalizeText = (text: string) => {
  return text
    .toLowerCase()
    .replace(/=/g, ' equal ')
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/@/g, ' at ')
    .replace(/\s+/g, ' ')
    .trim()
}

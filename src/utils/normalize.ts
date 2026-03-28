export const normalizeText = (text: string) => {
  return text
    .toLowerCase()
    .replace(/=/g, ' equal ')
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/@/g, ' at ')
    .replace(/([a-z])([0-9])/g, '$1 $2')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

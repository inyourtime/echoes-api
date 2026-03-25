async function searchSongs(query) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`

  const response = await fetch(url)
  const data = await response.json()

  console.log(data.results)
}

searchSongs('=love')

// async function getEmbedData(url) {
//   const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
//   const data = await res.json()
//   console.log(data)
// }

// getEmbedData('https://open.spotify.com/track/5uICw7DZWUJfnSkRbT7SvF?si=e613d6955a214b11')

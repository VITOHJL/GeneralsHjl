const GOLDEN_ANGLE = 137.508

function hslToHex(h, s, l) {
  const sNorm = s / 100
  const lNorm = l / 100

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lNorm - c / 2

  let r = 0
  let g = 0
  let b = 0

  if (h >= 0 && h < 60) {
    r = c
    g = x
  } else if (h >= 60 && h < 120) {
    r = x
    g = c
  } else if (h >= 120 && h < 180) {
    g = c
    b = x
  } else if (h >= 180 && h < 240) {
    g = x
    b = c
  } else if (h >= 240 && h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  const toHex = (value) => {
    const hex = Math.round((value + m) * 255).toString(16)
    return hex.length === 1 ? `0${hex}` : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function getPlayerColor(playerId) {
  if (!playerId || playerId <= 0) return '#6b7280'

  const hue = (playerId * GOLDEN_ANGLE) % 360
  const saturation = 65
  const lightnessBase = 50
  const lightness = lightnessBase + ((playerId * 13) % 11) - 5

  return hslToHex(hue, saturation, Math.max(35, Math.min(65, lightness)))
}


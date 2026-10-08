// First-run guide flag, remembered in localStorage.

const KEY = 'laureate.guide.v1'

export function guideSeen() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}

export function markGuideSeen() {
  try {
    localStorage.setItem(KEY, '1')
  } catch { /* private mode */ }
}

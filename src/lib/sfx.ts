// Synthesized ceremony audio. No samples, no network. Muted by default;
// a single toggle arms an AudioContext on first use.

let ctx: AudioContext | null = null

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function thunk(on: boolean) {
  if (!on) return
  try {
    const a = ac()
    const t = a.currentTime
    // body: sine drop 90 → 45 Hz
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(95, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.16)
    g.gain.setValueAtTime(0.5, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24)
    o.connect(g).connect(a.destination)
    o.start(t)
    o.stop(t + 0.26)
    // strike noise: short filtered burst
    const len = a.sampleRate * 0.09
    const buf = a.createBuffer(1, len, a.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const n = a.createBufferSource()
    n.buffer = buf
    const f = a.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 900
    f.Q.value = 0.8
    const ng = a.createGain()
    ng.gain.setValueAtTime(0.28, t)
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
    n.connect(f).connect(ng).connect(a.destination)
    n.start(t)
  } catch { /* audio is garnish */ }
}

export function shimmer(on: boolean) {
  if (!on) return
  try {
    const a = ac()
    const t = a.currentTime + 0.05
    for (const [f, g0, dur] of [[2093, 0.06, 0.9], [3136, 0.04, 0.7], [4186, 0.025, 0.5]] as const) {
      const o = a.createOscillator()
      const g = a.createGain()
      o.type = 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(g0, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      o.connect(g).connect(a.destination)
      o.start(t)
      o.stop(t + dur)
    }
  } catch { /* audio is garnish */ }
}

export function tick(on: boolean) {
  if (!on) return
  try {
    const a = ac()
    const t = a.currentTime
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = 'triangle'
    o.frequency.value = 2400
    g.gain.setValueAtTime(0.04, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
    o.connect(g).connect(a.destination)
    o.start(t)
    o.stop(t + 0.05)
  } catch { /* garnish */ }
}

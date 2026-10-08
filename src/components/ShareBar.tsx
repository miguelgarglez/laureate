import { useRef, useState } from 'react'
import type { Award } from '../lib/award'
import { downloadCard } from '../lib/sharecard'
import { medalShareText } from '../lib/medal'

// Selectable-text fallback when the clipboard API is denied.
function legacyCopy(text: string): boolean {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch { /* denied */ }
  ta.remove()
  return ok
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return legacyCopy(text)
  }
}

export function ShareBar({ award, onReset }: { award: Award; onReset: () => void }) {
  const [copied, setCopied] = useState('')
  const [notice, setNotice] = useState('')
  const timer = useRef(0)
  const announce = (k: string, msg: string) => {
    setCopied(k)
    setNotice(msg)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(''), 1800)
  }

  const copyCitation = async () => {
    const ok = await writeClipboard(medalShareText(award))
    announce(ok ? 'citation' : 'fail', ok ? 'Citation copied' : 'Copy failed — the citation is on the diploma')
  }
  const copyLink = async () => {
    const ok = await writeClipboard(location.href)
    announce(ok ? 'link' : 'fail', ok ? 'Link copied' : 'Copy failed — the link is in your address bar')
  }
  const share = async () => {
    if (!navigator.share) return copyLink()
    try {
      await navigator.share({ title: 'Laureate', text: medalShareText(award), url: location.href })
      announce('', 'Shared')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // user dismissed
      announce('fail', 'Share failed — try copy the link')
    }
  }

  const label = (k: string, base: string, done: string) =>
    copied === 'fail' ? 'Couldn’t copy' : copied === k ? done : base

  return (
    <div className="dispatch">
      <div className="dispatch-row" role="toolbar" aria-label="Share the award">
        <button className="dispatch-tab" onClick={() => void downloadCard(award)}>
          Save the card
        </button>
        <span className="dispatch-sep" aria-hidden="true">·</span>
        <button className="dlink" onClick={share}>
          {label('link', 'copy the link', 'link copied')}
        </button>
        <span className="dispatch-sep" aria-hidden="true">·</span>
        <button className="dlink" onClick={copyCitation}>
          {label('citation', 'copy the citation', 'citation copied')}
        </button>
      </div>
      <button className="dlink dlink-quiet" onClick={onReset}>
        mint another
      </button>
      <span className="vh" role="status">
        {notice}
      </span>
    </div>
  )
}

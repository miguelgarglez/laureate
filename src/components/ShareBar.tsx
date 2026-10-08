import { useState } from 'react'
import type { Award } from '../lib/award'
import { downloadCard } from '../lib/sharecard'
import { medalShareText } from '../lib/medal'

export function ShareBar({ award, onReset }: { award: Award; onReset: () => void }) {
  const [copied, setCopied] = useState('')
  const stamp = (k: string) => {
    setCopied(k)
    setTimeout(() => setCopied(''), 1800)
  }

  const copyCitation = async () => {
    try {
      await navigator.clipboard.writeText(medalShareText(award))
      stamp('citation')
    } catch { /* clipboard denied — rare */ }
  }
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      stamp('link')
    } catch { /* rare */ }
  }
  const share = async () => {
    if (!navigator.share) return copyLink()
    try {
      await navigator.share({ title: 'Laureate', text: medalShareText(award), url: location.href })
    } catch { /* user dismissed */ }
  }

  return (
    <div className="sharebar" role="toolbar" aria-label="Share the award">
      <button className="slink" onClick={() => void downloadCard(award)}>
        Download the card
      </button>
      <button className="slink" onClick={copyCitation}>
        {copied === 'citation' ? 'Citation copied' : 'Copy the citation'}
      </button>
      <button className="slink" onClick={share}>
        {copied === 'link' ? 'Link copied' : 'Share'}
      </button>
      <button className="slink slink-dim" onClick={onReset}>
        Mint another
      </button>
    </div>
  )
}

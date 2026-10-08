import type { Award } from '../lib/award'
import { CATEGORIES, citation, ceremonyDate, awardYear } from '../lib/award'

// The parchment diploma. Unfurl is a clip-path wipe with a moving
// curl-shadow; the citation letterpresses in line by line.

export function Diploma({ award, animate }: { award: Award; animate: boolean }) {
  const who = award.recipient || 'the bearer'
  return (
    <section
      className={`diploma ${animate ? 'unfurl' : ''}`}
      aria-label="Diploma"
    >
      <div className="diploma-inner">
        <header className="dip-head">
          <div className="dip-board">The Committee for Extremely Specific Achievement</div>
          <h2 className="dip-doc" data-focus="diploma" tabIndex={-1}>
            Diploma
          </h2>
        </header>
        <p className="dip-line dip-l1">having deliberated at length, and finding the claim sound,</p>
        <p className="dip-line dip-l2">
          hereby confers upon <span className="dip-who">{who}</span>
        </p>
        <p className="dip-line dip-l3">
          the {awardYear(award.dateISO)} Prize in {CATEGORIES[award.category].label},
        </p>
        <p className="dip-line dip-cite">{citation(award)},</p>
        <p className="dip-line dip-l4">with all the rights and honours thereunto appertaining.</p>
        <footer className="dip-foot">
          <span>Medal No. {award.serial}</span>
          <span className="dip-date">Given under seal, {ceremonyDate(award.dateISO)}</span>
        </footer>
        <p className="dip-colophon">Struck locally — no committee was contacted.</p>
        <div className="wax-seal" aria-hidden="true">
          <span>LC</span>
        </div>
      </div>
    </section>
  )
}

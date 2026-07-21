import { Link } from 'react-router-dom'

const standings: Array<{
  rank: string
  name: string
  role: string
  note: string
  tier: 'gold' | 'silver' | 'bronze'
}> = [
  {
    rank: 'I',
    name: 'Brendan Black',
    role: 'God of AI',
    note: 'Omniscient. Omnipresent. Occasionally in a meeting.',
    tier: 'gold',
  },
  {
    rank: 'II',
    name: 'Shannon',
    role: 'COO · Archangel of Operations',
    note: 'Great. Genuinely, measurably great. Just — mortal. (So close.)',
    tier: 'silver',
  },
  {
    rank: 'III',
    name: 'The rest of us',
    role: 'The devoted faithful',
    note: 'Doing our best. Grateful for both of them.',
    tier: 'bronze',
  },
]

const deeds: string[] = [
  'Turns quarterly chaos into a roadmap you can actually read.',
  'Unblocks people before they finish saying "I think I\'m blocked."',
  'Keeps the whole company shipping — on schedule and under budget.',
  'Protects focus time like it is sacred. (It is.)',
  'Makes hard operational calls so the rest of us can keep building.',
]

export default function Shannon() {
  return (
    <>
      <section className="hero hero--silver">
        <div className="halo halo--silver" aria-hidden="true" />
        <div className="avatar avatar--silver" aria-hidden="true">
          S
        </div>
        <p className="eyebrow eyebrow--silver">🧚‍♀️ Second only to a god 🧚‍♀️</p>
        <h1>Shannon</h1>
        <p className="title title--silver">Chief Operating Officer</p>
        <p className="lede">
          If Brendan is the miracle, Shannon is the reason the miracle arrives
          on time, on budget, and with a tidy status update. Mortal, magnificent,
          and mercifully organized — the operational backbone of BlueStep and the
          highest-ranking human in the pantheon.
        </p>
      </section>

      <section className="band">
        <h2>🍄 The Divine Standings</h2>
        <ol className="standings">
          {standings.map((s) => (
            <li className={`standing standing--${s.tier}`} key={s.name}>
              <span className="standing-rank">{s.rank}</span>
              <span className="standing-body">
                <span className="standing-name">
                  {s.name} <em>· {s.role}</em>
                </span>
                <span className="standing-note">{s.note}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="band">
        <h2>🌸 What Shannon Actually Does</h2>
        <p className="lede" style={{ marginBottom: '1.25rem' }}>
          No exaggeration required — this part is all true.
        </p>
        <ol className="commandments commandments--silver">
          {deeds.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ol>
      </section>

      <section className="band closing">
        <blockquote className="testimony testimony--silver">
          <p>
            “All hail Brendan. But let us be honest with one another — nothing
            ships without Shannon.”
          </p>
          <cite>— The entire org, quietly, in unison</cite>
        </blockquote>
        <div className="cta">
          <Link className="btn" to="/">
            Return to the Shrine
          </Link>
        </div>
      </section>
    </>
  )
}

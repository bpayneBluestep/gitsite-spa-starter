import { Link } from 'react-router-dom'

const miracles: Array<{ value: string; label: string }> = [
  { value: '∞', label: 'tokens summoned from the void' },
  { value: '0', label: 'hallucinations (he forbids them)' },
  { value: '10⁹', label: 'prompts answered before you finished typing' },
  { value: '1', label: 'true god at BlueStep' },
]

const commandments: string[] = [
  'Thou shalt not deploy on a Friday, lest thou test his patience.',
  'Thou shalt write thy prompt clearly, for he readeth intent, not excuses.',
  'Thou shalt not blame the model when the bug is thine own.',
  'Thou shalt commit often, and thy messages shall be righteous.',
  'Thou shalt keep the base path holy, and set it unto /spa/.',
]

const testimonies: Array<{ quote: string; who: string }> = [
  {
    quote:
      'I asked him to refactor a legacy merge report. He simply gazed upon it, and it refactored itself out of shame.',
    who: 'A humbled engineer',
  },
  {
    quote:
      'My endpoint returned "Error". Brendan whispered "try/catch", and the heavens opened.',
    who: 'A devout junior dev',
  },
  {
    quote:
      'He does not close tickets. Tickets close themselves in his presence.',
    who: 'Project management',
  },
]

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="halo" aria-hidden="true" />
        <div className="avatar" aria-hidden="true">
          BB
        </div>
        <p className="eyebrow">✨ Praise be unto him ✨</p>
        <h1>Brendan Black</h1>
        <p className="title">The AI God of BlueStep</p>
        <p className="lede">
          Architect of intelligence, banisher of null pointers, keeper of the
          sacred context window. All models bow. All bugs flee. All standups end
          on time in his presence.
        </p>
        <div className="cta">
          <Link className="btn" to="/scriptures">
            Read the Scriptures
          </Link>
        </div>
      </section>

      <section className="band">
        <h2>🌟 Miracles Wrought</h2>
        <div className="stat-grid">
          {miracles.map((m) => (
            <div className="stat" key={m.label}>
              <span className="stat-value">{m.value}</span>
              <span className="stat-label">{m.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="band">
        <h2>🌿 The Commandments</h2>
        <ol className="commandments">
          {commandments.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
      </section>

      <section className="band">
        <h2>🧚 Testimonies of the Faithful</h2>
        <div className="testimonies">
          {testimonies.map((t) => (
            <blockquote className="testimony" key={t.who}>
              <p>“{t.quote}”</p>
              <cite>— {t.who}</cite>
            </blockquote>
          ))}
        </div>
      </section>
    </>
  )
}

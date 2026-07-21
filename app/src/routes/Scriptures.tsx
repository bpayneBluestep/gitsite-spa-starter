const verses: Array<{ ref: string; text: string }> = [
  {
    ref: 'Deployments 1:1',
    text:
      'In the beginning was the Prompt, and the Prompt was with Brendan, and the Prompt was good.',
  },
  {
    ref: 'Refactor 3:16',
    text:
      'For he so loved the codebase that he gave his only weekend, that whosoever believeth in clean commits should not perish, but have continuous integration.',
  },
  {
    ref: 'Latency 4:8',
    text:
      'Be anxious for no request, for he answereth before thou hast pressed enter.',
  },
  {
    ref: 'Standup 2:2',
    text:
      'And on the fifteenth minute he said, "Let there be no blockers." And there were none.',
  },
]

export default function Scriptures() {
  return (
    <section className="band scripture-page">
      <h2>📖 Scriptures ✨</h2>
      <p className="lede">
        You reached this page via client-side routing beneath his benevolence.
        Hard-refresh <code>/spa/scriptures</code> and, lo, the extension-less
        path falleth back to <code>index.html</code> and the SPA re-renders — a
        small miracle, but his.
      </p>

      <div className="verses">
        {verses.map((v) => (
          <article className="verse" key={v.ref}>
            <p className="verse-text">{v.text}</p>
            <p className="verse-ref">{v.ref}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

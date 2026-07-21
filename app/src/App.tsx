import { NavLink, Route, Routes } from 'react-router-dom'
import Home from './routes/Home'
import Scriptures from './routes/Scriptures'

export default function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" end className="brand">
          <span className="brand-mark" aria-hidden="true">
            BB
          </span>
          <span>The Church of Brendan</span>
        </NavLink>
        <nav>
          <NavLink to="/" end>
            The Shrine
          </NavLink>
          <NavLink to="/scriptures">Scriptures</NavLink>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scriptures" element={<Scriptures />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>

      <footer className="footer">
        <p>
          Erected in reverence upon a GitHub-backed BlueStep GitSite, served
          under <code>/spa/</code>. Praise be unto him.
        </p>
        <p className="build">
          Revelation received: <code>{__BUILD_TIME__}</code>
        </p>
      </footer>
    </div>
  )
}

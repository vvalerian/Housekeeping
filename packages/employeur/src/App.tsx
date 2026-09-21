import { useDeconnexion, useEtatAuth, useSignalements } from './api.js'
import { ContexteLectureSeule, useLectureSeule } from './lecture.js'
import { naviguer, useRoute } from './routeur.js'
import { Connexion } from './pages/Connexion.js'
import { Calendrier } from './pages/Calendrier.js'
import { Intervention } from './pages/Intervention.js'
import { Rotations } from './pages/Rotations.js'
import { Pieces } from './pages/Pieces.js'
import { Taches } from './pages/Taches.js'
import { Demandes } from './pages/Demandes.js'
import { Messages } from './pages/Messages.js'
import { Signalements } from './pages/Signalements.js'
import { Produits } from './pages/Produits.js'
import { Securite } from './pages/Securite.js'

const LIENS: { chemin: string; libelle: string }[] = [
  { chemin: '/', libelle: 'Calendrier' },
  { chemin: '/rotations', libelle: 'Rotations' },
  { chemin: '/pieces', libelle: 'Pièces' },
  { chemin: '/taches', libelle: 'Tâches' },
  { chemin: '/demandes', libelle: 'Demandes' },
  { chemin: '/signalements', libelle: 'Signalements' },
  { chemin: '/messages', libelle: 'Messages' },
  { chemin: '/produits', libelle: 'Produits' },
  { chemin: '/securite', libelle: 'Sécurité' },
]

function Navigation() {
  const route = useRoute()
  const deconnexion = useDeconnexion()
  const signalements = useSignalements()
  const lectureSeule = useLectureSeule()
  const ouverts = (signalements.data ?? []).filter((s) => s.statut === 'ouvert').length
  const liens = lectureSeule ? LIENS.filter((l) => l.chemin !== '/securite') : LIENS

  return (
    <nav className="flex w-52 shrink-0 flex-col border-r border-slate-200 bg-white">
      <p className="px-5 pt-5 pb-1 text-lg font-bold text-slate-900">Housekeeping</p>
      {lectureSeule && (
        <p className="mx-5 mb-2 w-fit rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          Lecture seule
        </p>
      )}
      <ul className="flex-1">
        {liens.map((lien) => {
          const actif = lien.chemin === '/' ? route === '/' : route.startsWith(lien.chemin)
          return (
            <li key={lien.chemin}>
              <a
                href={`#${lien.chemin}`}
                className={`flex items-center justify-between px-5 py-2 text-sm font-medium ${
                  actif ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {lien.libelle}
                {lien.chemin === '/signalements' && ouverts > 0 && (
                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                    {ouverts}
                  </span>
                )}
              </a>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        onClick={() => deconnexion.mutate()}
        className="m-4 h-9 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        Se déconnecter
      </button>
    </nav>
  )
}

function Page() {
  const route = useRoute()
  if (route.startsWith('/interventions/')) {
    return <Intervention id={route.slice('/interventions/'.length)} />
  }
  switch (route) {
    case '/rotations':
      return <Rotations />
    case '/pieces':
      return <Pieces />
    case '/taches':
      return <Taches />
    case '/demandes':
      return <Demandes />
    case '/signalements':
      return <Signalements />
    case '/messages':
      return <Messages />
    case '/produits':
      return <Produits />
    case '/securite':
      return <Securite />
    default:
      return <Calendrier />
  }
}

export default function App() {
  const etat = useEtatAuth()

  if (etat.data === undefined) {
    return <main className="grid min-h-dvh place-items-center text-slate-500">Chargement…</main>
  }
  if (etat.data.acteur !== 'employeur' && etat.data.acteur !== 'observateur') {
    // Une session tablette sur /admin n'a pas les droits : on repasse par la connexion.
    return <Connexion initialisation={etat.data.initialisation_requise} />
  }
  return (
    <ContexteLectureSeule.Provider value={etat.data.acteur === 'observateur'}>
      <div className="flex min-h-dvh">
        <Navigation />
        <main className="min-w-0 flex-1 p-6">
          <div className="mx-auto flex max-w-4xl flex-col gap-5">
            <Page />
          </div>
        </main>
      </div>
    </ContexteLectureSeule.Provider>
  )
}

export { naviguer }

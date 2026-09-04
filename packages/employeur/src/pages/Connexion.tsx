import { useState } from 'react'
import { ErreurApi, useConnexion, useInitialisation } from '../api.js'
import { Bouton, Carte, Champ } from '../composants/ui.js'

/**
 * Connexion des employeurs — ou création du tout premier compte quand la base
 * n'en contient aucun (protégée par le Basic Auth nginx au déploiement).
 */
export function Connexion({ initialisation }: { initialisation: boolean }) {
  const connexion = useConnexion()
  const creation = useInitialisation()
  const mutation = initialisation ? creation : connexion
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')

  const erreur = mutation.error instanceof ErreurApi ? mutation.error.detail : null

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 text-center text-2xl font-bold text-slate-900">Housekeeping</p>
        <Carte titre={initialisation ? 'Créer le compte employeur' : 'Connexion'}>
          {initialisation && (
            <p className="mb-4 text-sm text-slate-500">
              Aucun compte n'existe encore : celui-ci sera le compte administrateur du foyer.
            </p>
          )}
          <form
            className="flex flex-col gap-3"
            onSubmit={(evenement) => {
              evenement.preventDefault()
              mutation.mutate({ identifiant, mot_de_passe: motDePasse })
            }}
          >
            <Champ
              label="Identifiant"
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              autoComplete="username"
              required
            />
            <Champ
              label={initialisation ? 'Mot de passe (8 caractères minimum)' : 'Mot de passe'}
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoComplete={initialisation ? 'new-password' : 'current-password'}
              required
              minLength={initialisation ? 8 : 1}
            />
            {erreur !== null && (
              <p role="alert" className="text-sm font-medium text-red-600">
                {erreur}
              </p>
            )}
            <Bouton type="submit" disabled={mutation.isPending} className="mt-1">
              {initialisation ? 'Créer et entrer' : 'Se connecter'}
            </Bouton>
          </form>
        </Carte>
      </div>
    </main>
  )
}

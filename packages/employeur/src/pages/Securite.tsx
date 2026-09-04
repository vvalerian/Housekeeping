import { useState } from 'react'
import { ErreurApi, useComptes, useConfigurerPin, useCreerCompte, useEtatAuth } from '../api.js'
import { Badge, Bouton, Carte, Champ, dateCourte } from '../composants/ui.js'

/** PIN de la tablette et comptes employeurs (SPEC §2 et §9). */
export function Securite() {
  const etat = useEtatAuth()
  const configurerPin = useConfigurerPin()
  const comptes = useComptes()
  const creerCompte = useCreerCompte()
  const [pin, setPin] = useState('')
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')

  const etatPin = etat.data?.pin ?? 'non_configure'
  const erreurCompte = creerCompte.error instanceof ErreurApi ? creerCompte.error.detail : null

  return (
    <>
      <h1 className="text-xl font-bold text-slate-900">Sécurité</h1>

      <Carte titre="Code de la tablette">
        <p className="mb-3 flex items-center gap-2 text-sm text-slate-600">
          État :
          {etatPin === 'requis' ? (
            <Badge couleur="vert">code actif</Badge>
          ) : etatPin === 'desactive' ? (
            <Badge couleur="ambre">désactivé — la tablette entre sans code</Badge>
          ) : (
            <Badge couleur="rouge">non configuré — la tablette est bloquée</Badge>
          )}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Champ
            label="Nouveau code (4 chiffres)"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
          />
          <Bouton
            disabled={pin.length !== 4 || configurerPin.isPending}
            onClick={() => configurerPin.mutate(pin, { onSuccess: () => setPin('') })}
          >
            Définir le code
          </Bouton>
          <Bouton
            variante="danger"
            disabled={configurerPin.isPending}
            onClick={() => {
              if (
                window.confirm(
                  'Désactiver le code ? Toute personne pouvant joindre l’application ouvrira une session tablette sans authentification.',
                )
              ) {
                configurerPin.mutate(null)
              }
            }}
          >
            Désactiver le code
          </Bouton>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          La session de la tablette dure un an : le code n'est redemandé qu'après une longue
          absence ou un changement d'appareil.
        </p>
      </Carte>

      <Carte titre="Comptes employeurs">
        <ul className="mb-4">
          {(comptes.data ?? []).map((compte) => (
            <li
              key={compte.id}
              className="flex items-center gap-3 border-t border-slate-100 py-2 first:border-t-0"
            >
              <span className="font-medium text-slate-800">{compte.identifiant}</span>
              <span className="ml-auto text-xs text-slate-400">
                créé le {dateCourte(compte.cree_le.slice(0, 10))}
              </span>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(evenement) => {
            evenement.preventDefault()
            creerCompte.mutate(
              { identifiant: identifiant.trim(), mot_de_passe: motDePasse },
              {
                onSuccess: () => {
                  setIdentifiant('')
                  setMotDePasse('')
                },
              },
            )
          }}
        >
          <Champ
            label="Identifiant"
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
            autoComplete="off"
          />
          <Champ
            label="Mot de passe (8 min.)"
            type="password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            autoComplete="new-password"
            minLength={8}
          />
          <Bouton type="submit" disabled={identifiant.trim().length < 3 || motDePasse.length < 8}>
            Créer le compte
          </Bouton>
        </form>
        {erreurCompte !== null && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-600">
            {erreurCompte}
          </p>
        )}
      </Carte>
    </>
  )
}

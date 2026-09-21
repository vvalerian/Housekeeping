import { useState } from 'react'
import {
  ErreurApi,
  useComptes,
  useConfigurerPin,
  useCreerCompte,
  useEtatAuth,
  useSupprimerCompte,
} from '../api.js'
import { Badge, Bouton, Carte, Champ, dateCourte, Selecteur } from '../composants/ui.js'
import { useLectureSeule } from '../lecture.js'

/** PIN de la tablette et comptes (SPEC §2 et §9). */
export function Securite() {
  const lectureSeule = useLectureSeule()
  const etat = useEtatAuth()
  const configurerPin = useConfigurerPin()
  const comptes = useComptes()
  const creerCompte = useCreerCompte()
  const supprimerCompte = useSupprimerCompte()
  const [pin, setPin] = useState('')
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [role, setRole] = useState<'employeur' | 'observateur'>('employeur')

  // Défense en profondeur : le lien de navigation est déjà masqué pour un
  // observateur, et le serveur répond 403 sur toutes ces routes.
  if (lectureSeule) {
    return (
      <>
        <h1 className="text-xl font-bold text-slate-900">Sécurité</h1>
        <p className="text-slate-500">Cette page est réservée aux comptes employeurs.</p>
      </>
    )
  }

  const etatPin = etat.data?.pin ?? 'non_configure'
  const erreurCompte = creerCompte.error instanceof ErreurApi ? creerCompte.error.detail : null
  const erreurSuppression =
    supprimerCompte.error instanceof ErreurApi ? supprimerCompte.error.detail : null

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

      <Carte titre="Comptes">
        <ul className="mb-4">
          {(comptes.data ?? []).map((compte) => (
            <li
              key={compte.id}
              className="flex flex-wrap items-center gap-3 border-t border-slate-100 py-2 first:border-t-0"
            >
              <span className="font-medium text-slate-800">{compte.identifiant}</span>
              {compte.role === 'observateur' ? (
                <Badge couleur="bleu">lecture seule</Badge>
              ) : (
                <Badge couleur="gris">employeur</Badge>
              )}
              <span className="ml-auto flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  créé le {dateCourte(compte.cree_le.slice(0, 10))}
                </span>
                <Bouton
                  variante="danger"
                  disabled={supprimerCompte.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Supprimer le compte « ${compte.identifiant} » ? Ses sessions ouvertes seront immédiatement déconnectées.`,
                      )
                    ) {
                      supprimerCompte.mutate(compte.id)
                    }
                  }}
                >
                  Supprimer
                </Bouton>
              </span>
            </li>
          ))}
        </ul>
        {erreurSuppression !== null && (
          <p role="alert" className="mb-3 text-sm font-medium text-red-600">
            {erreurSuppression}
          </p>
        )}
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(evenement) => {
            evenement.preventDefault()
            creerCompte.mutate(
              { identifiant: identifiant.trim(), mot_de_passe: motDePasse, role },
              {
                onSuccess: () => {
                  setIdentifiant('')
                  setMotDePasse('')
                  setRole('employeur')
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
          <Selecteur
            label="Rôle"
            value={role}
            onChange={(e) => setRole(e.target.value as 'employeur' | 'observateur')}
            options={[
              { valeur: 'employeur', libelle: 'Employeur' },
              { valeur: 'observateur', libelle: 'Lecture seule (société de prestation)' },
            ]}
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
        <p className="mt-3 text-xs text-slate-400">
          Un compte « lecture seule » voit tout (calendrier, comptes rendus, signalements…) mais ne
          peut rien modifier — prévu pour la société de prestation. Supprimer un compte révoque
          immédiatement son accès.
        </p>
      </Carte>
    </>
  )
}

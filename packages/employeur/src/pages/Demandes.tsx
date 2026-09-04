import { useState } from 'react'
import { useCreerDemande, useInterventions, useModifierDemande, useDemandes } from '../api.js'
import { Badge, Bouton, Carte, dateCourte, dateLongue, Selecteur, ZoneTexte } from '../composants/ui.js'

const aujourdHui = () => new Date().toLocaleDateString('en-CA')

/** Demandes ponctuelles : injectées automatiquement dans le plan visé (SPEC §5 étape 4). */
export function Demandes() {
  const demandes = useDemandes()
  const interventions = useInterventions()
  const creer = useCreerDemande()
  const modifier = useModifierDemande()
  const [texte, setTexte] = useState('')
  const [cible, setCible] = useState('')

  const aVenir = (interventions.data ?? []).filter(
    (i) => i.statut === 'planifiee' && i.date >= aujourdHui(),
  )
  const parStatut = (statut: string) => (demandes.data ?? []).filter((d) => d.statut === statut)

  return (
    <>
      <h1 className="text-xl font-bold text-slate-900">Demandes ponctuelles</h1>

      <Carte titre="Nouvelle demande">
        <form
          className="flex flex-col gap-3"
          onSubmit={(evenement) => {
            evenement.preventDefault()
            creer.mutate(
              { texte: texte.trim(), intervention_id: cible === '' ? null : cible },
              { onSuccess: () => setTexte('') },
            )
          }}
        >
          <ZoneTexte
            label="Quoi faire ?"
            rows={2}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Ex. : nettoyer le four après le gratin de dimanche"
          />
          <div className="flex items-end gap-3">
            <Selecteur
              label="Pour quelle intervention ?"
              value={cible}
              onChange={(e) => setCible(e.target.value)}
              options={[
                { valeur: '', libelle: 'La prochaine' },
                ...aVenir.map((i) => ({ valeur: i.id, libelle: dateLongue(i.date) })),
              ]}
            />
            <Bouton type="submit" disabled={texte.trim() === '' || creer.isPending}>
              Ajouter
            </Bouton>
          </div>
        </form>
      </Carte>

      <Carte titre="En attente">
        {parStatut('en_attente').length === 0 ? (
          <p className="text-sm text-slate-500">Aucune demande en attente.</p>
        ) : (
          <ul>
            {parStatut('en_attente').map((demande) => (
              <li
                key={demande.id}
                className="flex items-center gap-3 border-t border-slate-100 py-2 first:border-t-0"
              >
                <span className="text-slate-800">{demande.texte}</span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-slate-400">{dateCourte(demande.cree_le.slice(0, 10))}</span>
                  <Bouton
                    variante="danger"
                    onClick={() => modifier.mutate({ id: demande.id, corps: { statut: 'annulee' } })}
                  >
                    Annuler
                  </Bouton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <Carte titre="Déjà dans un plan">
        {parStatut('injectee').length === 0 ? (
          <p className="text-sm text-slate-500">Rien pour l'instant.</p>
        ) : (
          <ul>
            {parStatut('injectee').map((demande) => (
              <li key={demande.id} className="flex items-center gap-3 border-t border-slate-100 py-2 first:border-t-0">
                <span className="text-slate-600">{demande.texte}</span>
                <span className="ml-auto">
                  <Badge couleur="vert">au planning</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </>
  )
}

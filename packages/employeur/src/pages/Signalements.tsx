import { useState } from 'react'
import { useModifierSignalement, useSignalements } from '../api.js'
import { Badge, Bouton, Carte, dateCourte, ZoneTexte } from '../composants/ui.js'
import type { SignalementDto } from '../types.js'

const LIBELLES: Record<string, string> = {
  casse: 'Casse',
  produit_a_racheter: 'Produit à racheter',
  probleme_technique: 'Problème technique',
  autre: 'Autre',
}

function Ouvert({ signalement }: { signalement: SignalementDto }) {
  const modifier = useModifierSignalement()
  const [reponse, setReponse] = useState('')
  return (
    <li className="border-t border-slate-100 py-3 first:border-t-0">
      <div className="flex items-center gap-2">
        <Badge couleur="ambre">{LIBELLES[signalement.type]}</Badge>
        <span className="text-xs text-slate-400">{dateCourte(signalement.cree_le.slice(0, 10))}</span>
      </div>
      <p className="mt-1.5 text-slate-800">{signalement.texte}</p>
      <div className="mt-2 flex items-end gap-2">
        <div className="flex-1">
          <ZoneTexte
            label="Réponse (visible de l'intervenante)"
            rows={1}
            value={reponse}
            onChange={(e) => setReponse(e.target.value)}
          />
        </div>
        <Bouton
          disabled={modifier.isPending}
          onClick={() =>
            modifier.mutate({
              id: signalement.id,
              corps: { statut: 'traite', reponse_employeur: reponse.trim() === '' ? null : reponse.trim() },
            })
          }
        >
          Clore
        </Bouton>
      </div>
    </li>
  )
}

export function Signalements() {
  const signalements = useSignalements()
  const ouverts = (signalements.data ?? []).filter((s) => s.statut === 'ouvert')
  const traites = (signalements.data ?? []).filter((s) => s.statut === 'traite').reverse()

  return (
    <>
      <h1 className="text-xl font-bold text-slate-900">Signalements</h1>
      <Carte titre={`Ouverts (${ouverts.length})`}>
        {ouverts.length === 0 ? (
          <p className="text-sm text-slate-500">Rien à traiter. 🎉</p>
        ) : (
          <ul>
            {ouverts.map((s) => (
              <Ouvert key={s.id} signalement={s} />
            ))}
          </ul>
        )}
      </Carte>
      <Carte titre="Traités">
        {traites.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun historique.</p>
        ) : (
          <ul>
            {traites.map((s) => (
              <li key={s.id} className="border-t border-slate-100 py-2.5 first:border-t-0">
                <div className="flex items-center gap-2">
                  <Badge couleur="gris">{LIBELLES[s.type]}</Badge>
                  <span className="text-xs text-slate-400">{dateCourte(s.cree_le.slice(0, 10))}</span>
                </div>
                <p className="mt-1 text-slate-600">{s.texte}</p>
                {s.reponse_employeur !== null && (
                  <p className="mt-0.5 text-sm text-slate-500">↳ {s.reponse_employeur}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </>
  )
}

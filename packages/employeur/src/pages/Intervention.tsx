import { useState } from 'react'
import { useIntervention, useModifierIntervention, usePieces } from '../api.js'
import {
  Badge,
  Bouton,
  Carte,
  dateLongue,
  LIBELLES_MOTIF,
  LIBELLES_STATUT,
  LIBELLES_TYPE,
  ZoneTexte,
} from '../composants/ui.js'
import type { InstanceDto } from '../types.js'

function BadgeInstance({ instance }: { instance: InstanceDto }) {
  switch (instance.statut) {
    case 'faite':
      return <Badge couleur="vert">Fait</Badge>
    case 'partielle':
      return <Badge couleur="ambre">Partiel</Badge>
    case 'non_faite':
      return <Badge couleur="rouge">Pas fait</Badge>
    default:
      return <Badge couleur="gris">À faire</Badge>
  }
}

/** Détail d'une intervention : consulter le plan et son exécution (SPEC §7). */
export function Intervention({ id }: { id: string }) {
  const detail = useIntervention(id)
  const pieces = usePieces()
  const modifier = useModifierIntervention()
  const [note, setNote] = useState<string | null>(null)

  if (detail.data === undefined) {
    return <p className="text-slate-500">Chargement…</p>
  }
  const { intervention, instances } = detail.data
  const statut = LIBELLES_STATUT[intervention.statut]!
  const nomPiece = (idPiece: string | null) =>
    idPiece === null ? '—' : (pieces.data?.find((p) => p.id === idPiece)?.nom ?? idPiece)
  const heure = (iso: string | null) =>
    iso === null ? null : new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <a href="#/" className="text-sm text-slate-500 hover:underline">
          ← Calendrier
        </a>
        <h1 className="text-xl font-bold text-slate-900 first-letter:uppercase">
          {dateLongue(intervention.date)}
        </h1>
        <span className="text-slate-500">{LIBELLES_TYPE[intervention.type]}</span>
        <Badge couleur={statut.couleur}>{statut.texte}</Badge>
        {intervention.heure_debut !== null && (
          <span className="text-sm text-slate-500">
            {heure(intervention.heure_debut)}
            {intervention.heure_fin !== null ? ` → ${heure(intervention.heure_fin)}` : ''}
          </span>
        )}
      </div>

      {intervention.note_intervenante !== null && (
        <Carte titre="Note de l'intervenante">
          <p className="text-slate-700">{intervention.note_intervenante}</p>
        </Carte>
      )}

      <Carte titre="Consigne pour ce jour (visible sur la tablette)">
        <ZoneTexte
          label=""
          rows={2}
          value={note ?? intervention.note_employeur ?? ''}
          onChange={(e) => setNote(e.target.value)}
        />
        <Bouton
          className="mt-2"
          disabled={note === null || modifier.isPending}
          onClick={() =>
            modifier.mutate(
              { id, corps: { note_employeur: note === '' ? null : note } },
              { onSuccess: () => void detail.refetch() },
            )
          }
        >
          Enregistrer
        </Bouton>
      </Carte>

      <Carte titre={`Plan (${instances.length} tâches)`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2">Tâche</th>
              <th className="pb-2">Pièce</th>
              <th className="pb-2">Statut</th>
              <th className="pb-2">Motif / commentaire</th>
            </tr>
          </thead>
          <tbody>
            {instances.map((instance) => (
              <tr key={instance.id} className="border-t border-slate-100">
                <td className="py-2 pr-3 text-slate-800">
                  {instance.libelle}
                  {instance.reportee_depuis !== null && (
                    <span className="ml-2">
                      <Badge couleur="ambre">reportée</Badge>
                    </span>
                  )}
                  {instance.origine === 'ponctuelle' && (
                    <span className="ml-2">
                      <Badge couleur="bleu">demande</Badge>
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 text-slate-500">{nomPiece(instance.room_id_effectif)}</td>
                <td className="py-2 pr-3">
                  <BadgeInstance instance={instance} />
                </td>
                <td className="py-2 text-slate-500">
                  {[
                    instance.motif_non_faite !== null ? LIBELLES_MOTIF[instance.motif_non_faite] : null,
                    instance.commentaire,
                  ]
                    .filter((x) => x !== null)
                    .join(' — ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Carte>
    </>
  )
}

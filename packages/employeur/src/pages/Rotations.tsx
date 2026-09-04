import { usePieces, useRotations } from '../api.js'
import { Badge, Carte, dateCourte } from '../composants/ui.js'

/**
 * La vue « dernière exécution » (SPEC §7) : « ça fait combien de temps qu'on
 * n'a pas fait le frigo ? ».
 */
export function Rotations() {
  const rotations = useRotations()
  const pieces = usePieces()
  const nomCible = (cible: string | null) => {
    if (cible === null) return null
    return pieces.data?.find((p) => p.id === cible)?.nom ?? cible
  }

  return (
    <>
      <h1 className="text-xl font-bold text-slate-900">Tâches tournantes</h1>
      <Carte>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2">Tâche</th>
              <th className="pb-2">Cadence</th>
              <th className="pb-2">Dernière exécution</th>
              <th className="pb-2">Retard</th>
            </tr>
          </thead>
          <tbody>
            {(rotations.data ?? []).map((rotation) => (
              <tr key={rotation.task_definition_id} className="border-t border-slate-100">
                <td className="py-2.5 pr-3 font-medium text-slate-800">{rotation.libelle}</td>
                <td className="py-2.5 pr-3 text-slate-500">
                  {rotation.cadence === 'mensuelle' ? 'Mensuelle' : 'Trimestrielle'}
                </td>
                <td className="py-2.5 pr-3 text-slate-600">
                  {rotation.derniere_execution === null ? (
                    'Jamais'
                  ) : (
                    <>
                      {dateCourte(rotation.derniere_execution)}
                      <span className="text-slate-400"> · il y a {rotation.jours_depuis} j</span>
                      {rotation.derniere_cible !== null && (
                        <span className="text-slate-400"> · {nomCible(rotation.derniere_cible)}</span>
                      )}
                    </>
                  )}
                </td>
                <td className="py-2.5">
                  {rotation.ratio_retard === null ? (
                    <Badge couleur="gris">à programmer</Badge>
                  ) : rotation.ratio_retard >= 1 ? (
                    <Badge couleur="rouge">en retard ({Math.round(rotation.ratio_retard * 100)} %)</Badge>
                  ) : rotation.ratio_retard >= 0.8 ? (
                    <Badge couleur="ambre">bientôt ({Math.round(rotation.ratio_retard * 100)} %)</Badge>
                  ) : (
                    <Badge couleur="vert">à jour ({Math.round(rotation.ratio_retard * 100)} %)</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-slate-400">
          Le pourcentage rapporte le temps écoulé à la période de la tâche (30 ou 90 jours) ; la
          sélection automatique repart toujours de la dernière exécution réelle.
        </p>
      </Carte>
    </>
  )
}

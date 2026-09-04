import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GroupePlan } from '../lib.js'
import type { DefinitionTacheDto, InstanceDto } from '../types.js'
import { LigneTache } from './LigneTache.js'

/** Une carte par pièce, dépliable (SPEC §6). Dépliée par défaut. */
export function CartePiece({
  groupe,
  definitions,
  onBasculer,
  onOuvrirMotifs,
}: {
  groupe: GroupePlan
  definitions: Map<string, DefinitionTacheDto>
  onBasculer: (instance: InstanceDto) => void
  onOuvrirMotifs: (instance: InstanceDto) => void
}) {
  const { t } = useTranslation()
  const [ouverte, setOuverte] = useState(true)
  const traitees = groupe.instances.filter((i) => i.statut !== 'a_faire').length
  const complete = traitees === groupe.instances.length

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOuverte((etat) => !etat)}
        aria-expanded={ouverte}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left active:bg-slate-50"
      >
        <h2 className="text-lg font-semibold text-slate-900">
          {groupe.titre ?? t('plan.transverses')}
        </h2>
        <span className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              complete ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {traitees}/{groupe.instances.length}
          </span>
          <span className="text-xl text-slate-400">{ouverte ? '▾' : '▸'}</span>
        </span>
      </button>
      {ouverte && (
        <ul>
          {groupe.instances.map((instance) => (
            <LigneTache
              key={instance.id}
              instance={instance}
              definition={
                instance.task_definition_id === null
                  ? undefined
                  : definitions.get(instance.task_definition_id)
              }
              onBasculer={() => onBasculer(instance)}
              onOuvrirMotifs={() => onOuvrirMotifs(instance)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

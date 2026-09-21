import { useState } from 'react'
import {
  useAnnulerIntervention,
  useCreerIntervention,
  useGenererCalendrier,
  useInterventions,
  useModifierIntervention,
} from '../api.js'
import {
  Badge,
  Bouton,
  Carte,
  Champ,
  dateLongue,
  LIBELLES_STATUT,
  LIBELLES_TYPE,
  Modale,
  Selecteur,
} from '../composants/ui.js'
import { useLectureSeule } from '../lecture.js'
import type { InterventionDto } from '../types.js'

const aujourdHui = () => new Date().toLocaleDateString('en-CA')
const plusJours = (jours: number) =>
  new Date(Date.now() + jours * 86_400_000).toLocaleDateString('en-CA')

function Ligne({ intervention }: { intervention: InterventionDto }) {
  const annuler = useAnnulerIntervention()
  const deplacer = useModifierIntervention()
  const [deplacement, setDeplacement] = useState<string | null>(null)
  const statut = LIBELLES_STATUT[intervention.statut]!
  const modifiable = intervention.statut === 'planifiee' && !useLectureSeule()

  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-slate-100 py-2.5 first:border-t-0">
      <a
        href={`#/interventions/${intervention.id}`}
        className="min-w-44 font-medium text-slate-800 first-letter:uppercase hover:underline"
      >
        {dateLongue(intervention.date)}
      </a>
      <span className="text-sm text-slate-500">{LIBELLES_TYPE[intervention.type]}</span>
      <Badge couleur={statut.couleur}>{statut.texte}</Badge>
      {modifiable && (
        <span className="ml-auto flex gap-2">
          <Bouton variante="secondaire" onClick={() => setDeplacement(intervention.date)}>
            Déplacer
          </Bouton>
          <Bouton
            variante="danger"
            onClick={() => {
              if (window.confirm(`Annuler l'intervention du ${dateLongue(intervention.date)} ?`)) {
                annuler.mutate(intervention.id)
              }
            }}
          >
            Annuler
          </Bouton>
        </span>
      )}
      {deplacement !== null && (
        <Modale titre="Déplacer l'intervention" onFermer={() => setDeplacement(null)}>
          <Champ
            label="Nouvelle date"
            type="date"
            value={deplacement}
            onChange={(e) => setDeplacement(e.target.value)}
          />
          <Bouton
            className="mt-4 w-full"
            onClick={() =>
              deplacer.mutate(
                { id: intervention.id, corps: { date: deplacement } },
                { onSuccess: () => setDeplacement(null) },
              )
            }
          >
            Déplacer
          </Bouton>
        </Modale>
      )}
    </li>
  )
}

export function Calendrier() {
  const lectureSeule = useLectureSeule()
  const interventions = useInterventions()
  const generer = useGenererCalendrier()
  const creer = useCreerIntervention()
  const [date, setDate] = useState(aujourdHui())
  const [type, setType] = useState<InterventionDto['type']>('exceptionnelle')

  const toutes = interventions.data ?? []
  const aVenir = toutes.filter((i) => i.date >= aujourdHui())
  const passees = toutes.filter((i) => i.date < aujourdHui()).reverse().slice(0, 20)

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Calendrier</h1>
        {!lectureSeule && (
          <Bouton
            onClick={() => generer.mutate({ depuis: aujourdHui(), jusqua: plusJours(56) })}
            disabled={generer.isPending}
          >
            Générer les 8 prochaines semaines
          </Bouton>
        )}
      </div>

      <Carte titre="À venir">
        {aVenir.length === 0 ? (
          <p className="text-sm text-slate-500">
            Rien de planifié — générer le calendrier ci-dessus.
          </p>
        ) : (
          <ul>
            {aVenir.map((i) => (
              <Ligne key={i.id} intervention={i} />
            ))}
          </ul>
        )}
      </Carte>

      {!lectureSeule && (
      <Carte titre="Ajouter une intervention">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(evenement) => {
            evenement.preventDefault()
            creer.mutate({ date, type })
          }}
        >
          <Champ label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Selecteur
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value as InterventionDto['type'])}
            options={[
              { valeur: 'exceptionnelle', libelle: 'Exceptionnelle' },
              { valeur: 'A', libelle: LIBELLES_TYPE.A! },
              { valeur: 'B', libelle: LIBELLES_TYPE.B! },
            ]}
          />
          <Bouton type="submit" disabled={creer.isPending}>
            Ajouter
          </Bouton>
        </form>
      </Carte>
      )}

      <Carte titre="Historique récent">
        {passees.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune intervention passée.</p>
        ) : (
          <ul>
            {passees.map((i) => (
              <Ligne key={i.id} intervention={i} />
            ))}
          </ul>
        )}
      </Carte>
    </>
  )
}

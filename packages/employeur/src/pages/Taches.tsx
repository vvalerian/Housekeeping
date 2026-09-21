import { useState } from 'react'
import { useCreerTache, useModifierTache, usePieces, useTaches } from '../api.js'
import { Badge, Bouton, Carte, Champ, Modale, Selecteur, ZoneTexte } from '../composants/ui.js'
import { useLectureSeule } from '../lecture.js'
import type { TacheDto } from '../types.js'

const CADENCES: { valeur: TacheDto['cadence']; libelle: string }[] = [
  { valeur: 'chaque_passage', libelle: 'À chaque passage' },
  { valeur: 'passage_A', libelle: 'Passage 1 (A)' },
  { valeur: 'passage_B', libelle: 'Passage 2 (B)' },
  { valeur: 'mensuelle', libelle: 'Mensuelle' },
  { valeur: 'trimestrielle', libelle: 'Trimestrielle' },
]

function ModaleEdition({ tache, onFermer }: { tache: TacheDto | null; onFermer: () => void }) {
  const pieces = usePieces()
  const modifier = useModifierTache()
  const creer = useCreerTache()
  const [libelle, setLibelle] = useState(tache?.libelle ?? '')
  const [libellePt, setLibellePt] = useState(tache?.libelle_pt ?? '')
  const [cadence, setCadence] = useState<TacheDto['cadence']>(tache?.cadence ?? 'chaque_passage')
  const [roomId, setRoomId] = useState(tache?.room_id ?? '')
  const [checklist, setChecklist] = useState((tache?.checklist ?? []).join('\n'))
  const [checklistPt, setChecklistPt] = useState((tache?.checklist_pt ?? []).join('\n'))
  const [instructions, setInstructions] = useState(tache?.instructions ?? '')
  const [instructionsPt, setInstructionsPt] = useState(tache?.instructions_pt ?? '')
  const [duree, setDuree] = useState(tache?.duree_estimee_min?.toString() ?? '')

  const enregistrer = () => {
    const lignes = (texte: string) =>
      texte
        .split('\n')
        .map((ligne) => ligne.trim())
        .filter((ligne) => ligne !== '')
    const checklistPtLignes = lignes(checklistPt)
    const corps = {
      libelle,
      libelle_pt: libellePt.trim() === '' ? null : libellePt.trim(),
      cadence,
      room_id: roomId === '' ? null : roomId,
      checklist: lignes(checklist),
      checklist_pt: checklistPtLignes.length === 0 ? null : checklistPtLignes,
      instructions: instructions.trim() === '' ? null : instructions.trim(),
      instructions_pt: instructionsPt.trim() === '' ? null : instructionsPt.trim(),
      duree_estimee_min: duree.trim() === '' ? null : Number(duree),
    }
    if (tache === null) creer.mutate(corps, { onSuccess: onFermer })
    else modifier.mutate({ id: tache.id, corps }, { onSuccess: onFermer })
  }

  return (
    <Modale titre={tache === null ? 'Nouvelle tâche' : `Modifier « ${tache.libelle} »`} onFermer={onFermer}>
      <div className="flex flex-col gap-3">
        <Champ label="Libellé" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
        <Champ
          label="Libellé en portugais (affiché à l'intervenante — vide = français)"
          value={libellePt}
          onChange={(e) => setLibellePt(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Selecteur
            label="Cadence"
            value={cadence}
            onChange={(e) => setCadence(e.target.value as TacheDto['cadence'])}
            options={CADENCES.map((c) => ({ valeur: c.valeur, libelle: c.libelle }))}
          />
          <Selecteur
            label="Pièce"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            options={[
              { valeur: '', libelle: 'Transverse (aucune)' },
              ...(pieces.data ?? []).map((p) => ({ valeur: p.id, libelle: p.nom })),
            ]}
          />
        </div>
        <ZoneTexte
          label="Checklist (un point par ligne)"
          rows={4}
          value={checklist}
          onChange={(e) => setChecklist(e.target.value)}
        />
        <ZoneTexte
          label="Checklist en portugais (un point par ligne — vide = français)"
          rows={3}
          value={checklistPt}
          onChange={(e) => setChecklistPt(e.target.value)}
        />
        <ZoneTexte
          label="Instructions (produit, précaution…)"
          rows={2}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
        <ZoneTexte
          label="Instructions en portugais (vide = français)"
          rows={2}
          value={instructionsPt}
          onChange={(e) => setInstructionsPt(e.target.value)}
        />
        <Champ
          label="Durée indicative (minutes — jamais montrée à l'intervenante)"
          type="number"
          value={duree}
          onChange={(e) => setDuree(e.target.value)}
        />
        {tache?.cible_rotative != null && (
          <p className="text-xs text-slate-400">
            Cette tâche porte une sous-rotation ({tache.cible_rotative.type}) — modifiable via
            l'API uniquement.
          </p>
        )}
        <Bouton onClick={enregistrer} disabled={libelle.trim() === ''}>
          Enregistrer
        </Bouton>
      </div>
    </Modale>
  )
}

export function Taches() {
  const lectureSeule = useLectureSeule()
  const taches = useTaches()
  const pieces = usePieces()
  const modifier = useModifierTache()
  const [edition, setEdition] = useState<TacheDto | null | 'nouvelle'>(null)

  const nomPiece = (id: string | null) =>
    id === null ? 'Transverse' : (pieces.data?.find((p) => p.id === id)?.nom ?? id)

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Tâches</h1>
        {!lectureSeule && <Bouton onClick={() => setEdition('nouvelle')}>Nouvelle tâche</Bouton>}
      </div>

      {CADENCES.map((cadence) => {
        const liste = (taches.data ?? []).filter((t) => t.cadence === cadence.valeur)
        if (liste.length === 0) return null
        return (
          <Carte key={cadence.valeur} titre={cadence.libelle}>
            <ul>
              {liste.map((tache) => (
                <li
                  key={tache.id}
                  className="flex flex-wrap items-center gap-3 border-t border-slate-100 py-2 first:border-t-0"
                >
                  <span className={`font-medium ${tache.actif ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                    {tache.libelle}
                  </span>
                  <span className="text-sm text-slate-500">{nomPiece(tache.room_id)}</span>
                  {tache.cible_rotative !== null && <Badge couleur="bleu">sous-rotation</Badge>}
                  {tache.passage_contraint !== null && (
                    <Badge couleur="gris">passage {tache.passage_contraint}</Badge>
                  )}
                  <span className="ml-auto flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-sm text-slate-500">
                      <input
                        type="checkbox"
                        checked={tache.actif}
                        disabled={lectureSeule}
                        onChange={(e) =>
                          modifier.mutate({ id: tache.id, corps: { actif: e.target.checked } })
                        }
                      />
                      active
                    </label>
                    {!lectureSeule && (
                      <Bouton variante="secondaire" onClick={() => setEdition(tache)}>
                        Modifier
                      </Bouton>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Carte>
        )
      })}

      {edition !== null && (
        <ModaleEdition tache={edition === 'nouvelle' ? null : edition} onFermer={() => setEdition(null)} />
      )}
    </>
  )
}

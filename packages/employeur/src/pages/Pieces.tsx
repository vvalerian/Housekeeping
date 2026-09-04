import { useState } from 'react'
import { useCreerPiece, useModeTravaux, useModifierPiece, usePieces, useReactiverPiece } from '../api.js'
import { Badge, Bouton, Carte, Champ, dateCourte, Modale, Selecteur } from '../composants/ui.js'
import type { PieceDto } from '../types.js'

const aujourdHui = () => new Date().toLocaleDateString('en-CA')

const TYPES_PIECE = [
  { valeur: 'cuisine', libelle: 'Cuisine' },
  { valeur: 'salon', libelle: 'Salon / séjour' },
  { valeur: 'chambre', libelle: 'Chambre' },
  { valeur: 'bureau', libelle: 'Bureau' },
  { valeur: 'sanitaire', libelle: 'Sanitaire' },
  { valeur: 'circulation', libelle: 'Circulation' },
]

function estInactive(piece: PieceDto): { inactive: boolean; jusqua: string | null; motif: string | null } {
  const date = aujourdHui()
  if (!piece.actif) return { inactive: true, jusqua: null, motif: 'Désactivée' }
  const periode = piece.periodes_inactivite.find(
    (p) => p.debut <= date && (p.fin === null || date <= p.fin),
  )
  return periode !== undefined
    ? { inactive: true, jusqua: periode.fin, motif: periode.motif }
    : { inactive: false, jusqua: null, motif: null }
}

function ModaleEdition({ piece, onFermer }: { piece: PieceDto | null; onFermer: () => void }) {
  const modifier = useModifierPiece()
  const creer = useCreerPiece()
  const [nom, setNom] = useState(piece?.nom ?? '')
  const [type, setType] = useState<PieceDto['type']>(piece?.type ?? 'chambre')
  const [surface, setSurface] = useState(piece?.surface_m2?.toString() ?? '')
  const [ordre, setOrdre] = useState(piece?.ordre_affichage.toString() ?? '')

  const enregistrer = () => {
    const surface_m2 = surface.trim() === '' ? null : Number(surface)
    if (piece === null) {
      creer.mutate({ nom, type, surface_m2 }, { onSuccess: onFermer })
    } else {
      modifier.mutate(
        {
          id: piece.id,
          corps: { nom, type, surface_m2, ordre_affichage: Number(ordre) || piece.ordre_affichage },
        },
        { onSuccess: onFermer },
      )
    }
  }

  return (
    <Modale titre={piece === null ? 'Nouvelle pièce' : `Modifier « ${piece.nom} »`} onFermer={onFermer}>
      <div className="flex flex-col gap-3">
        <Champ label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} />
        <Selecteur
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value as PieceDto['type'])}
          options={TYPES_PIECE}
        />
        <Champ
          label="Surface (m², facultatif)"
          type="number"
          value={surface}
          onChange={(e) => setSurface(e.target.value)}
        />
        {piece !== null && (
          <Champ
            label="Ordre d'affichage"
            type="number"
            value={ordre}
            onChange={(e) => setOrdre(e.target.value)}
          />
        )}
        <Bouton onClick={enregistrer} disabled={nom.trim() === ''}>
          Enregistrer
        </Bouton>
      </div>
    </Modale>
  )
}

export function Pieces() {
  const pieces = usePieces()
  const modifier = useModifierPiece()
  const reactiver = useReactiverPiece()
  const modeTravaux = useModeTravaux()
  const [edition, setEdition] = useState<PieceDto | null | 'nouvelle'>(null)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [debut, setDebut] = useState(aujourdHui())
  const [fin, setFin] = useState('')
  const [motif, setMotif] = useState('Travaux')

  const basculerSelection = (id: string) => {
    setSelection((s) => {
      const suivant = new Set(s)
      if (suivant.has(id)) suivant.delete(id)
      else suivant.add(id)
      return suivant
    })
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Pièces</h1>
        <Bouton onClick={() => setEdition('nouvelle')}>Nouvelle pièce</Bouton>
      </div>

      <Carte>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2">Travaux</th>
              <th className="pb-2">Pièce</th>
              <th className="pb-2">Surface</th>
              <th className="pb-2">Vitres</th>
              <th className="pb-2">État</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {(pieces.data ?? []).map((piece) => {
              const etat = estInactive(piece)
              return (
                <tr key={piece.id} className="border-t border-slate-100">
                  <td className="py-2 pr-2">
                    <input
                      type="checkbox"
                      aria-label={`Sélectionner ${piece.nom} pour le mode travaux`}
                      checked={selection.has(piece.id)}
                      onChange={() => basculerSelection(piece.id)}
                    />
                  </td>
                  <td className="py-2 pr-3 font-medium text-slate-800">{piece.nom}</td>
                  <td className="py-2 pr-3 text-slate-500">
                    {piece.surface_m2 !== null ? `${piece.surface_m2} m²` : '—'}
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      aria-label={`${piece.nom} dans la rotation des vitres`}
                      checked={piece.inclus_rotation_vitres}
                      onChange={(e) =>
                        modifier.mutate({
                          id: piece.id,
                          corps: { inclus_rotation_vitres: e.target.checked },
                        })
                      }
                    />
                  </td>
                  <td className="py-2 pr-3">
                    {etat.inactive ? (
                      <span className="flex items-center gap-2">
                        <Badge couleur="rouge">
                          {etat.motif ?? 'Inactive'}
                          {etat.jusqua !== null ? ` → ${dateCourte(etat.jusqua)}` : ''}
                        </Badge>
                        <Bouton variante="secondaire" onClick={() => reactiver.mutate({ id: piece.id })}>
                          Réactiver
                        </Bouton>
                      </span>
                    ) : (
                      <Badge couleur="vert">Active</Badge>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <Bouton variante="secondaire" onClick={() => setEdition(piece)}>
                      Modifier
                    </Bouton>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Carte>

      <Carte titre="Mode travaux d'un clic">
        <p className="mb-3 text-sm text-slate-500">
          Cocher les pièces concernées ci-dessus, choisir la période : elles disparaissent du
          planning et reviennent automatiquement à l'échéance.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Champ label="Début" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
          <Champ
            label="Fin (vide = jusqu'à nouvel ordre)"
            type="date"
            value={fin}
            onChange={(e) => setFin(e.target.value)}
          />
          <Champ label="Motif" value={motif} onChange={(e) => setMotif(e.target.value)} />
          <Bouton
            disabled={selection.size === 0 || modeTravaux.isPending}
            onClick={() =>
              modeTravaux.mutate(
                {
                  piece_ids: [...selection],
                  debut,
                  fin: fin === '' ? null : fin,
                  motif,
                },
                { onSuccess: () => setSelection(new Set()) },
              )
            }
          >
            Condamner {selection.size > 0 ? `${selection.size} pièce(s)` : ''}
          </Bouton>
        </div>
      </Carte>

      {edition !== null && (
        <ModaleEdition piece={edition === 'nouvelle' ? null : edition} onFermer={() => setEdition(null)} />
      )}
    </>
  )
}

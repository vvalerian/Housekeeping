import { useState } from 'react'
import { useCreerProduit, useModifierProduit, useProduits } from '../api.js'
import { Bouton, Carte, Champ } from '../composants/ui.js'
import { useLectureSeule } from '../lecture.js'
import type { ProduitDto } from '../types.js'

const NIVEAUX: { valeur: ProduitDto['niveau']; libelle: string; style: string }[] = [
  { valeur: 'ok', libelle: 'OK', style: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { valeur: 'bas', libelle: 'Bas', style: 'bg-amber-100 text-amber-800 border-amber-200' },
  { valeur: 'epuise', libelle: 'Épuisé', style: 'bg-red-100 text-red-800 border-red-200' },
]

/** Suivi des consommables (SPEC §3.5 et §7). */
export function Produits() {
  const lectureSeule = useLectureSeule()
  const produits = useProduits()
  const creer = useCreerProduit()
  const modifier = useModifierProduit()
  const [nom, setNom] = useState('')

  return (
    <>
      <h1 className="text-xl font-bold text-slate-900">Consommables</h1>
      <Carte>
        <ul>
          {(produits.data ?? []).map((produit) => (
            <li
              key={produit.id}
              className="flex items-center gap-3 border-t border-slate-100 py-2 first:border-t-0"
            >
              <span className="font-medium text-slate-800">{produit.nom}</span>
              <span className="ml-auto flex gap-1.5">
                {NIVEAUX.map((niveau) => (
                  <button
                    key={niveau.valeur}
                    type="button"
                    disabled={lectureSeule}
                    onClick={() => modifier.mutate({ id: produit.id, niveau: niveau.valeur })}
                    className={`h-8 rounded-lg border px-3 text-xs font-semibold ${
                      produit.niveau === niveau.valeur
                        ? niveau.style
                        : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {niveau.libelle}
                  </button>
                ))}
              </span>
            </li>
          ))}
          {(produits.data ?? []).length === 0 && (
            <p className="text-sm text-slate-500">
              Aucun produit suivi — en ajouter un ci-dessous (l'intervenante met le niveau à jour
              d'une touche depuis la tablette).
            </p>
          )}
        </ul>
        {!lectureSeule && (
        <form
          className="mt-4 flex items-end gap-2"
          onSubmit={(evenement) => {
            evenement.preventDefault()
            creer.mutate({ nom: nom.trim() }, { onSuccess: () => setNom('') })
          }}
        >
          <Champ label="Nouveau produit" value={nom} onChange={(e) => setNom(e.target.value)} />
          <Bouton type="submit" disabled={nom.trim() === '' || creer.isPending}>
            Ajouter
          </Bouton>
        </form>
        )}
      </Carte>
    </>
  )
}

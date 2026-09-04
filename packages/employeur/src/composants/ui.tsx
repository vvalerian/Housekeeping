/** Petites briques d'interface communes de l'espace employeur. */
import type { ReactNode } from 'react'

export function Bouton({
  variante = 'primaire',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primaire' | 'secondaire' | 'danger'
}) {
  const styles = {
    primaire: 'bg-slate-900 text-white hover:bg-slate-700 disabled:bg-slate-300',
    secondaire: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
  }
  return (
    <button
      type="button"
      {...props}
      className={`h-9 rounded-lg px-3.5 text-sm font-medium ${styles[variante]} ${props.className ?? ''}`}
    />
  )
}

export function Champ({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
      <input
        {...props}
        className={`h-9 w-full rounded-lg border border-slate-300 px-2.5 text-slate-800 ${props.className ?? ''}`}
      />
    </label>
  )
}

export function ZoneTexte({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
      <textarea
        {...props}
        className={`w-full rounded-lg border border-slate-300 p-2.5 text-slate-800 ${props.className ?? ''}`}
      />
    </label>
  )
}

export function Selecteur({
  label,
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  options: { valeur: string; libelle: string }[]
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
      <select
        {...props}
        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-slate-800"
      >
        {options.map((option) => (
          <option key={option.valeur} value={option.valeur}>
            {option.libelle}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Badge({
  couleur,
  children,
}: {
  couleur: 'vert' | 'ambre' | 'rouge' | 'gris' | 'bleu'
  children: ReactNode
}) {
  const styles = {
    vert: 'bg-emerald-100 text-emerald-800',
    ambre: 'bg-amber-100 text-amber-800',
    rouge: 'bg-red-100 text-red-800',
    gris: 'bg-slate-200 text-slate-700',
    bleu: 'bg-sky-100 text-sky-800',
  }
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[couleur]}`}>
      {children}
    </span>
  )
}

export function Carte({ titre, children }: { titre?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      {titre !== undefined && (
        <h2 className="mb-4 text-base font-semibold text-slate-900">{titre}</h2>
      )}
      {children}
    </section>
  )
}

export function Modale({
  titre,
  onFermer,
  children,
}: {
  titre: string
  onFermer: () => void
  children: ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onFermer}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onClick={(evenement) => evenement.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{titre}</h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Date « jeudi 4 septembre 2026 ». */
export function dateLongue(dateIso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${dateIso}T00:00:00`))
}

export function dateCourte(dateIso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${dateIso}T00:00:00`),
  )
}

export const LIBELLES_TYPE: Record<string, string> = {
  A: 'Passage 1 — zone jour',
  B: 'Passage 2 — chambres',
  exceptionnelle: 'Exceptionnelle',
}

export const LIBELLES_STATUT: Record<string, { texte: string; couleur: 'vert' | 'ambre' | 'rouge' | 'gris' | 'bleu' }> = {
  planifiee: { texte: 'Planifiée', couleur: 'bleu' },
  en_cours: { texte: 'En cours', couleur: 'ambre' },
  cloturee: { texte: 'Clôturée', couleur: 'vert' },
  annulee: { texte: 'Annulée', couleur: 'gris' },
}

export const LIBELLES_MOTIF: Record<string, string> = {
  manque_de_temps: 'Manque de temps',
  piece_inaccessible: 'Pièce inaccessible',
  produit_manquant: 'Produit manquant',
  non_necessaire: 'Pas nécessaire',
  autre: 'Autre',
}

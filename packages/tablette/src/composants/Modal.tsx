import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export function Modal({
  titre,
  onFermer,
  children,
}: {
  titre: string
  onFermer: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onFermer}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(evenement) => evenement.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">{titre}</h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label={t('commun.fermer')}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl text-slate-500 active:bg-slate-100"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

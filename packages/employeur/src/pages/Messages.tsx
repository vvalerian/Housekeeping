import { useState } from 'react'
import { useEnvoyerMessage, useMessages } from '../api.js'
import { Bouton, Carte } from '../composants/ui.js'
import { useLectureSeule } from '../lecture.js'

/** Fil de discussion simple et horodaté (SPEC §3.5). */
export function Messages() {
  const lectureSeule = useLectureSeule()
  const messages = useMessages()
  const envoyer = useEnvoyerMessage()
  const [texte, setTexte] = useState('')

  return (
    <>
      <h1 className="text-xl font-bold text-slate-900">Messages</h1>
      <Carte>
        <ul className="flex flex-col gap-2">
          {(messages.data ?? []).map((message) => (
            <li
              key={message.id}
              className={`max-w-[80%] rounded-xl px-3.5 py-2 text-sm ${
                message.auteur === 'employeur'
                  ? 'self-end bg-slate-900 text-white'
                  : 'self-start bg-slate-100 text-slate-800'
              }`}
            >
              <p>{message.texte}</p>
              <p className={`mt-0.5 text-xs ${message.auteur === 'employeur' ? 'text-slate-400' : 'text-slate-400'}`}>
                {new Date(message.cree_le).toLocaleString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </li>
          ))}
          {(messages.data ?? []).length === 0 && (
            <p className="text-sm text-slate-500">Aucun message pour l'instant.</p>
          )}
        </ul>
        {!lectureSeule && (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(evenement) => {
            evenement.preventDefault()
            envoyer.mutate(texte.trim(), { onSuccess: () => setTexte('') })
          }}
        >
          <input
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Écrire un mot à l'intervenante…"
            className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-sm text-slate-800"
          />
          <Bouton type="submit" disabled={texte.trim() === '' || envoyer.isPending}>
            Envoyer
          </Bouton>
        </form>
        )}
      </Carte>
    </>
  )
}

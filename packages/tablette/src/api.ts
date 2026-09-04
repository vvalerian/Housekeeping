/**
 * Client de l'API du lot 1 + hooks TanStack Query. Toute la conversation
 * réseau passe par ici — le hors ligne (lot 4) viendra s'insérer dans cette
 * couche sans toucher aux écrans.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dateDuJour } from './lib.js'
import type {
  DefinitionTacheDto,
  InstanceDto,
  InterventionDto,
  MessageDto,
  MotifNonFaite,
  PieceDto,
  PlanDuJourDto,
  StatutInstance,
  TypeSignalement,
} from './types.js'

export class ErreurApi extends Error {
  constructor(
    public statut: number,
    chemin: string,
  ) {
    super(`API ${statut} sur ${chemin}`)
  }
}

async function requete<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  const reponse = await fetch(`/api${chemin}`, {
    ...options,
    headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
  })
  if (!reponse.ok) throw new ErreurApi(reponse.status, chemin)
  return reponse.json() as Promise<T>
}

/** Comme `requete`, mais un 404 devient `null` (« pas d'intervention aujourd'hui »). */
async function requeteOptionnelle<T>(chemin: string): Promise<T | null> {
  const reponse = await fetch(`/api${chemin}`)
  if (reponse.status === 404) return null
  if (!reponse.ok) throw new ErreurApi(reponse.status, chemin)
  return reponse.json() as Promise<T>
}

// --- Authentification (lot 3) ----------------------------------------------

export interface EtatAuthDto {
  initialisation_requise: boolean
  acteur: 'employeur' | 'tablette' | null
  pin: 'non_configure' | 'requis' | 'desactive'
}

export function useEtatAuth() {
  return useQuery({
    queryKey: ['auth'],
    queryFn: () => requete<EtatAuthDto>('/auth/etat'),
    refetchInterval: 60_000,
  })
}

export function useConnexionPin() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (pin: string | null) =>
      requete<{ ok: true }>('/auth/pin', {
        method: 'POST',
        body: JSON.stringify(pin === null ? {} : { pin }),
      }),
    onSuccess: () => client.invalidateQueries(),
  })
}

const CLE_DU_JOUR = ['du-jour'] as const

export function useDuJour(actif = true) {
  return useQuery({
    queryKey: CLE_DU_JOUR,
    queryFn: () => requeteOptionnelle<PlanDuJourDto>(`/interventions/du-jour?date=${dateDuJour()}`),
    refetchInterval: 60_000,
    enabled: actif,
  })
}

export function usePieces() {
  return useQuery({
    queryKey: ['pieces'],
    queryFn: () => requete<PieceDto[]>('/pieces'),
    staleTime: 5 * 60_000,
  })
}

export function useTaches() {
  return useQuery({
    queryKey: ['taches'],
    queryFn: () => requete<DefinitionTacheDto[]>('/taches'),
    staleTime: 5 * 60_000,
  })
}

export function useMessages() {
  return useQuery({
    queryKey: ['messages'],
    queryFn: () => requete<MessageDto[]>('/messages'),
    refetchInterval: 60_000,
  })
}

export function useProchaineIntervention(active: boolean) {
  return useQuery({
    queryKey: ['prochaine', dateDuJour()],
    queryFn: () => requete<InterventionDto[]>(`/interventions?du=${dateDuJour()}`),
    select: (interventions) =>
      interventions.find((i) => i.statut === 'planifiee' && i.date > dateDuJour()) ?? null,
    enabled: active,
  })
}

export function useDemarrer() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (interventionId: string) =>
      requete<PlanDuJourDto>(`/interventions/${interventionId}/demarrer`, { method: 'POST' }),
    onSuccess: (plan) => client.setQueryData(CLE_DU_JOUR, plan),
  })
}

export interface ValidationInstance {
  instanceId: string
  statut: StatutInstance
  motif_non_faite?: MotifNonFaite | null
  commentaire?: string | null
}

/**
 * Validation d'une tâche, avec mise à jour optimiste : la coche répond au
 * doigt, le serveur confirme derrière.
 */
export function useValiderInstance() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ instanceId, ...corps }: ValidationInstance) =>
      requete<InstanceDto>(`/instances/${instanceId}`, {
        method: 'PATCH',
        body: JSON.stringify(corps),
      }),
    onMutate: async (validation) => {
      await client.cancelQueries({ queryKey: CLE_DU_JOUR })
      const precedent = client.getQueryData<PlanDuJourDto | null>(CLE_DU_JOUR)
      if (precedent) {
        client.setQueryData<PlanDuJourDto>(CLE_DU_JOUR, {
          ...precedent,
          instances: precedent.instances.map((instance) =>
            instance.id === validation.instanceId
              ? {
                  ...instance,
                  statut: validation.statut,
                  motif_non_faite: validation.motif_non_faite ?? null,
                  commentaire: validation.commentaire ?? instance.commentaire,
                }
              : instance,
          ),
        })
      }
      return { precedent }
    },
    onError: (_erreur, _validation, contexte) => {
      if (contexte?.precedent !== undefined) client.setQueryData(CLE_DU_JOUR, contexte.precedent)
    },
    onSettled: () => client.invalidateQueries({ queryKey: CLE_DU_JOUR }),
  })
}

export function useAjoutSpontane() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ interventionId, libelle }: { interventionId: string; libelle: string }) =>
      requete<InstanceDto>(`/interventions/${interventionId}/instances`, {
        method: 'POST',
        body: JSON.stringify({ libelle }),
      }),
    onSettled: () => client.invalidateQueries({ queryKey: CLE_DU_JOUR }),
  })
}

export function useCloturer() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      interventionId,
      note,
    }: {
      interventionId: string
      note: string | null
    }) =>
      requete<PlanDuJourDto>(`/interventions/${interventionId}/cloturer`, {
        method: 'POST',
        body: JSON.stringify({ note_intervenante: note }),
      }),
    onSuccess: (plan) => client.setQueryData(CLE_DU_JOUR, plan),
  })
}

export function useSignaler() {
  return useMutation({
    mutationFn: (signalement: {
      type: TypeSignalement
      texte: string
      intervention_id?: string | null
    }) => requete('/signalements', { method: 'POST', body: JSON.stringify(signalement) }),
  })
}

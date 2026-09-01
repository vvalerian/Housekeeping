CREATE TABLE `demandes_ponctuelles` (
	`id` text PRIMARY KEY NOT NULL,
	`texte` text NOT NULL,
	`intervention_id` text,
	`statut` text NOT NULL,
	`cree_le` text NOT NULL,
	FOREIGN KEY (`intervention_id`) REFERENCES `interventions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `interventions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`statut` text NOT NULL,
	`heure_debut` text,
	`heure_fin` text,
	`note_intervenante` text,
	`note_employeur` text
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`auteur` text NOT NULL,
	`texte` text NOT NULL,
	`cree_le` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pieces` (
	`id` text PRIMARY KEY NOT NULL,
	`nom` text NOT NULL,
	`type` text NOT NULL,
	`surface_m2` real,
	`actif` integer NOT NULL,
	`periodes_inactivite` text NOT NULL,
	`ordre_affichage` integer NOT NULL,
	`inclus_rotation_vitres` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `produits` (
	`id` text PRIMARY KEY NOT NULL,
	`nom` text NOT NULL,
	`niveau` text NOT NULL,
	`mis_a_jour_le` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signalements` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`texte` text NOT NULL,
	`statut` text NOT NULL,
	`reponse_employeur` text,
	`intervention_id` text,
	`cree_le` text NOT NULL,
	FOREIGN KEY (`intervention_id`) REFERENCES `interventions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `taches` (
	`id` text PRIMARY KEY NOT NULL,
	`libelle` text NOT NULL,
	`room_id` text,
	`checklist` text NOT NULL,
	`cadence` text NOT NULL,
	`duree_estimee_min` real,
	`cible_rotative` text,
	`passage_contraint` text,
	`instructions` text,
	`actif` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `pieces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `task_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`intervention_id` text NOT NULL,
	`task_definition_id` text,
	`demande_ponctuelle_id` text,
	`libelle` text NOT NULL,
	`room_id_effectif` text,
	`cible_resolue` text,
	`statut` text NOT NULL,
	`motif_non_faite` text,
	`commentaire` text,
	`horodatage_validation` text,
	`origine` text NOT NULL,
	`reportee_depuis` text,
	FOREIGN KEY (`intervention_id`) REFERENCES `interventions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_definition_id`) REFERENCES `taches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`demande_ponctuelle_id`) REFERENCES `demandes_ponctuelles`(`id`) ON UPDATE no action ON DELETE no action
);

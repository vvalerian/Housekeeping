CREATE TABLE `comptes_employeurs` (
	`id` text PRIMARY KEY NOT NULL,
	`identifiant` text NOT NULL,
	`mot_de_passe_hash` text NOT NULL,
	`cree_le` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comptes_employeurs_identifiant_unique` ON `comptes_employeurs` (`identifiant`);--> statement-breakpoint
CREATE TABLE `parametres` (
	`cle` text PRIMARY KEY NOT NULL,
	`valeur` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions_auth` (
	`jeton` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`compte_id` text,
	`cree_le` text NOT NULL,
	`expire_le` text NOT NULL,
	FOREIGN KEY (`compte_id`) REFERENCES `comptes_employeurs`(`id`) ON UPDATE no action ON DELETE cascade
);

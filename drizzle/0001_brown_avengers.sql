CREATE TABLE `document_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`document_name` text NOT NULL,
	`page` integer NOT NULL,
	`chunk_index` integer NOT NULL,
	`text` text NOT NULL,
	`embedding` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `chunk_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `indexed_at` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `index_error` text;
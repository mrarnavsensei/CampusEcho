-- Fresh staging/production database only. No development users, colleges, or secrets.
-- Derived from the reviewed schema through local migration 0008. Do not apply to an existing schema.

CREATE TABLE `admin_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'moderator' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `admin_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`campus_id` text,
	`actor_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `blocks` (
	`blocker_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`blocker_id`, `blocked_id`),
	FOREIGN KEY (`blocker_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `bookmarks` (
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`post_id`, `user_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `campuses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL, `status` text DEFAULT 'active' NOT NULL, `created_at` integer NOT NULL, `updated_at` integer NOT NULL);

CREATE TABLE chess_games (
  id TEXT PRIMARY KEY NOT NULL,
  campus_id TEXT NOT NULL REFERENCES campuses(id),
  white_user_id TEXT NOT NULL REFERENCES users(id),
  black_user_id TEXT REFERENCES users(id),
  mode TEXT NOT NULL CHECK (mode IN ('ai','multiplayer')),
  difficulty TEXT NOT NULL DEFAULT 'practice' CHECK (difficulty IN ('beginner','practice')),
  status TEXT NOT NULL CHECK (status IN ('waiting','active','completed','cancelled')),
  fen TEXT NOT NULL,
  pgn TEXT NOT NULL DEFAULT '',
  ply INTEGER NOT NULL DEFAULT 0 CHECK (ply >= 0),
  version INTEGER NOT NULL DEFAULT 0,
  result TEXT CHECK (result IN ('1-0','0-1','1/2-1/2')),
  result_reason TEXT,
  draw_offered_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  CHECK (black_user_id IS NULL OR black_user_id <> white_user_id),
  CHECK (mode = 'multiplayer' OR black_user_id IS NULL),
  CHECK (mode = 'ai' OR status IN ('waiting','cancelled') OR black_user_id IS NOT NULL)
);

CREATE TABLE `chess_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text,
	`campus_id` text NOT NULL,
	`white_user_id` text NOT NULL,
	`black_user_id` text NOT NULL,
	`result` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`suspicious` integer DEFAULT false NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`white_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`black_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `college_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`campus_id` text NOT NULL,
	`domain` text NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`author_id` text NOT NULL,
	`parent_id` text,
	`body` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL, alias text,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE "competition_scores" (
	`id` text PRIMARY KEY NOT NULL,
	`campus_id` text NOT NULL,
	`user_id` text NOT NULL,
	`game` text NOT NULL,
	`rating` integer DEFAULT 1200 NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`draws` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `conversation_members` (
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`muted_until` integer,
	`joined_at` integer NOT NULL, last_read_at integer,
	PRIMARY KEY(`conversation_id`, `user_id`),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`campus_id` text NOT NULL,
	`last_message_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify', 'reset')),
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`campus_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`game` text,
	`capacity` integer,
	`starts_at` integer NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `follows` (
	`follower_id` text NOT NULL,
	`followed_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`follower_id`, `followed_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`followed_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `message_receipts` (
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`delivered_at` integer,
	`read_at` integer,
	PRIMARY KEY(`message_id`, `user_id`),
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE "messages" (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `moderation_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`campus_id` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`provider` text NOT NULL,
	`outcome` text NOT NULL,
	`categories` text DEFAULT '[]' NOT NULL,
	`reason` text NOT NULL,
	`reviewer_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`actor_id` text,
	`type` text NOT NULL,
	`entity_id` text,
	`body` text NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `platform_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`updated_by` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `admin_accounts`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `poll_options` (
	`id` text PRIMARY KEY NOT NULL,
	`poll_id` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `poll_votes` (
	`poll_id` text NOT NULL,
	`option_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`poll_id`, `user_id`),
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`option_id`) REFERENCES `poll_options`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `polls` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`closes_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `post_likes` (
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`post_id`, `user_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE "posts" (
	`id` text PRIMARY KEY NOT NULL,
	`campus_id` text NOT NULL,
	`author_id` text NOT NULL,
	`alias` text,
	`visibility` text DEFAULT 'anonymous' NOT NULL,
	`body` text NOT NULL,
	`kind` text DEFAULT 'text' NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`moderation_status` text DEFAULT 'approved' NOT NULL,
	`edited_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE "profiles" (
	`user_id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`avatar_key` text,
	`interests` text DEFAULT '[]' NOT NULL,
	`is_private` integer DEFAULT false NOT NULL,
	`anonymous_by_default` integer DEFAULT true NOT NULL,
	`joined_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `registrations` (
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'registered' NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`event_id`, `user_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE report_reviews (
  report_id TEXT PRIMARY KEY NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  assigned_admin_id TEXT REFERENCES admin_accounts(id),
  updated_at INTEGER NOT NULL
);

CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`campus_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`assignee_id` text,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE security_rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 1,
  resets_at INTEGER NOT NULL
);

CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE student_verifications (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'domain_verified' CHECK(status IN ('domain_verified','pending','approved','rejected')),
  reviewed_by TEXT,
  review_note TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

CREATE TABLE `uploaded_media` (
	`id` text PRIMARY KEY NOT NULL,
	`campus_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE user_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`campus_id` text NOT NULL,
	`email` text NOT NULL,
	`email_verified_at` integer,
	`role` text DEFAULT 'student' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`terms_accepted_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `voice_participants` (
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'listener' NOT NULL,
	`muted` integer DEFAULT true NOT NULL,
	`raised_hand_at` integer,
	`joined_at` integer NOT NULL,
	`left_at` integer,
	PRIMARY KEY(`room_id`, `user_id`),
	FOREIGN KEY (`room_id`) REFERENCES `voice_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `voice_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`campus_id` text NOT NULL,
	`host_id` text NOT NULL,
	`title` text NOT NULL,
	`topic` text NOT NULL,
	`provider_room_id` text,
	`status` text DEFAULT 'live' NOT NULL,
	`ended_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`host_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX `admin_accounts_email_uq` ON `admin_accounts` (`email`);

CREATE INDEX `admin_sessions_admin_idx` ON `admin_sessions` (`admin_id`);

CREATE UNIQUE INDEX `admin_sessions_token_uq` ON `admin_sessions` (`token_hash`);

CREATE INDEX `audit_campus_idx` ON `audit_logs` (`campus_id`,`created_at`);

CREATE INDEX audit_created_idx ON audit_logs(created_at, id);

CREATE INDEX audit_target_idx ON audit_logs(target_type, target_id, created_at);

CREATE INDEX blocks_reverse_idx ON blocks(blocked_id, blocker_id);

CREATE INDEX bookmarks_user_idx ON bookmarks(user_id, post_id);

CREATE UNIQUE INDEX `campuses_slug_uq` ON `campuses` (`slug`);

CREATE INDEX chess_games_black_idx ON chess_games(black_user_id,updated_at);

CREATE INDEX chess_games_campus_status_idx ON chess_games(campus_id,status,created_at);

CREATE INDEX chess_games_completed_idx ON chess_games(mode,status,completed_at);

CREATE UNIQUE INDEX chess_games_waiting_owner_uq ON chess_games(white_user_id) WHERE status = 'waiting';

CREATE INDEX chess_games_white_idx ON chess_games(white_user_id,updated_at);

CREATE INDEX `chess_matches_campus_idx` ON `chess_matches` (`campus_id`,`created_at`);

CREATE UNIQUE INDEX `college_domains_domain_uq` ON `college_domains` (`domain`);

CREATE INDEX `comments_parent_idx` ON `comments` (`parent_id`);

CREATE INDEX `comments_post_idx` ON `comments` (`post_id`,`created_at`);

CREATE INDEX `competition_scores_rank_idx` ON `competition_scores` (`campus_id`,`game`,`rating`);

CREATE UNIQUE INDEX `competition_scores_user_game_uq` ON `competition_scores` (`user_id`,`game`);

CREATE INDEX `conversation_members_user_idx` ON `conversation_members` (`user_id`);

CREATE INDEX `conversations_campus_idx` ON `conversations` (`campus_id`);

CREATE INDEX email_tokens_user_idx ON email_tokens(user_id, purpose);

CREATE INDEX `events_campus_idx` ON `events` (`campus_id`,`starts_at`);

CREATE INDEX `follows_followed_idx` ON `follows` (`followed_id`);

CREATE INDEX `messages_conversation_idx` ON `messages` (`conversation_id`,`created_at`);

CREATE INDEX messages_cursor_idx ON messages(conversation_id, created_at, id);

CREATE INDEX `moderation_subject_idx` ON `moderation_decisions` (`subject_type`,`subject_id`);

CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`,`read_at`,`created_at`);

CREATE UNIQUE INDEX `poll_options_position_uq` ON `poll_options` (`poll_id`,`position`);

CREATE INDEX `poll_votes_option_idx` ON `poll_votes` (`option_id`);

CREATE UNIQUE INDEX `polls_post_uq` ON `polls` (`post_id`);

CREATE INDEX `posts_author_idx` ON `posts` (`author_id`);

CREATE INDEX `posts_campus_created_idx` ON `posts` (`campus_id`,`created_at`);

CREATE INDEX posts_feed_cursor_idx ON posts(campus_id, status, moderation_status, created_at, id);

CREATE UNIQUE INDEX `profiles_handle_uq` ON `profiles` (`handle`);

CREATE INDEX registrations_capacity_idx ON registrations(event_id, status);

CREATE INDEX reports_duplicate_idx ON reports(reporter_id, target_type, target_id, status);

CREATE INDEX `reports_queue_idx` ON `reports` (`campus_id`,`status`,`created_at`);

CREATE INDEX reports_status_created_idx ON reports(status, created_at, id);

CREATE INDEX security_rate_expiry_idx ON security_rate_limits(resets_at);

CREATE UNIQUE INDEX `sessions_token_uq` ON `sessions` (`token_hash`);

CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);

CREATE UNIQUE INDEX `uploaded_media_key_uq` ON `uploaded_media` (`object_key`);

CREATE INDEX `users_campus_idx` ON `users` (`campus_id`,`status`);

CREATE INDEX users_created_idx ON users(created_at, id);

CREATE UNIQUE INDEX `users_email_uq` ON `users` (`email`);

CREATE INDEX `voice_rooms_campus_idx` ON `voice_rooms` (`campus_id`,`status`);

CREATE TRIGGER chess_games_join_admin AFTER UPDATE OF black_user_id ON chess_games
WHEN NEW.mode = 'multiplayer' AND NEW.black_user_id IS NOT NULL AND OLD.black_user_id IS NULL
BEGIN
  INSERT INTO chess_matches (id,campus_id,white_user_id,black_user_id,status,result,suspicious,created_at,updated_at,completed_at)
  VALUES (NEW.id,NEW.campus_id,NEW.white_user_id,NEW.black_user_id,NEW.status,NEW.result,0,NEW.created_at,NEW.updated_at,NEW.completed_at);
END;

CREATE TRIGGER chess_games_update_admin AFTER UPDATE OF status,result ON chess_games
WHEN NEW.mode = 'multiplayer' AND NEW.black_user_id IS NOT NULL
BEGIN
  UPDATE chess_matches SET status = NEW.status,result = NEW.result,updated_at = NEW.updated_at,completed_at = NEW.completed_at WHERE id = NEW.id;
END;

CREATE TRIGGER protect_last_super_admin_update
BEFORE UPDATE OF status, role ON admin_accounts
WHEN OLD.role = 'super_admin' AND OLD.status = 'active'
  AND (NEW.role <> 'super_admin' OR NEW.status <> 'active')
  AND (SELECT count(*) FROM admin_accounts WHERE role = 'super_admin' AND status = 'active') <= 1
BEGIN SELECT RAISE(ABORT, 'The last active Super Admin cannot be removed.'); END;

INSERT INTO platform_settings(key,value,updated_at) VALUES
('user_registration_enabled','false',0),
('manual_verification_required','true',0),
('voice_spaces_enabled','false',0);

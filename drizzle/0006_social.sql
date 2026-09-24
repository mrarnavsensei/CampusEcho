ALTER TABLE conversation_members ADD COLUMN last_read_at integer;
ALTER TABLE comments ADD COLUMN alias text;
CREATE INDEX IF NOT EXISTS posts_feed_cursor_idx ON posts(campus_id, status, moderation_status, created_at, id);
CREATE INDEX IF NOT EXISTS blocks_reverse_idx ON blocks(blocked_id, blocker_id);
CREATE INDEX IF NOT EXISTS bookmarks_user_idx ON bookmarks(user_id, post_id);
CREATE INDEX IF NOT EXISTS reports_duplicate_idx ON reports(reporter_id, target_type, target_id, status);
CREATE INDEX IF NOT EXISTS registrations_capacity_idx ON registrations(event_id, status);
CREATE INDEX IF NOT EXISTS messages_cursor_idx ON messages(conversation_id, created_at, id);

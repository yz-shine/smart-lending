-- Выполнить один раз в SQL Editor подключённого PostgreSQL.
CREATE TABLE IF NOT EXISTS zico_users (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 username varchar(32) NOT NULL,
 display_name varchar(32),
 password_hash text NOT NULL,
 is_admin boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS zico_username_unique ON zico_users(lower(username));
CREATE TABLE IF NOT EXISTS zico_sessions (
 token_hash text PRIMARY KEY,
 user_id bigint NOT NULL REFERENCES zico_users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS zico_results (
 id text NOT NULL,
 user_id bigint NOT NULL REFERENCES zico_users(id) ON DELETE CASCADE,
 module text NOT NULL,
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,id)
);
CREATE TABLE IF NOT EXISTS zico_chat_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id bigint NOT NULL REFERENCES zico_users(id) ON DELETE CASCADE,
 module text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS zico_limits (
 key text NOT NULL,
 bucket bigint NOT NULL,
 count integer NOT NULL,
 PRIMARY KEY(key,bucket)
);
-- После создания своего аккаунта вручную назначить администратора.
-- UPDATE zico_users SET is_admin=true WHERE username='ваш_логин';
-- Периодически удалять старые сессии и счётчики.
-- DELETE FROM zico_sessions WHERE expires_at < now();
-- Для счётчиков заданий и сообщений сроки периодов различаются.
-- Очистку их истории настраивать отдельно с учётом длины периода.

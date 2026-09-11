CREATE TABLE IF NOT EXISTS challenges (
 id uuid PRIMARY KEY, controller text NOT NULL, message text NOT NULL,
 expires_at timestamptz NOT NULL, used boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, identity text NOT NULL, controller text NOT NULL,
 identity_version bigint NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS files (
 id uuid PRIMARY KEY, name text NOT NULL, code text NOT NULL, description text NOT NULL,
 mime text NOT NULL, digest text NOT NULL, encrypted bytea NOT NULL,
 nonce bytea NOT NULL, tag bytea NOT NULL, created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS asset_cache (
 token_id bigint PRIMARY KEY, owner text NOT NULL, block_number bigint NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS security_logs (
 id bigserial PRIMARY KEY, at text NOT NULL, actor text NOT NULL, action text NOT NULL,
 outcome text NOT NULL, details text NOT NULL, previous_hash text NOT NULL, digest text NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
 bucket text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS experiment_reports (
 id uuid PRIMARY KEY, report jsonb NOT NULL, digest text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS challenges_expiry ON challenges(expires_at);

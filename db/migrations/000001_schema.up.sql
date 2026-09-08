-- saas-admin initial database schema.
--
-- This is a fresh-install baseline, not an in-place upgrade. Refuse to run
-- against an existing application schema so a partially provisioned database
-- cannot be mistaken for a successfully migrated one.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
          AND tablename <> 'schema_migrations'
    ) THEN
        RAISE EXCEPTION 'saas-admin baseline requires an empty database';
    END IF;
END $$;

-- Identity

CREATE TABLE users (
    id         TEXT PRIMARY KEY,
    email      TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    role       TEXT NOT NULL DEFAULT 'user'
               CHECK (role IN ('owner', 'admin', 'user')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE oauth_accounts (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider    TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    email       TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider, provider_id)
);
CREATE INDEX idx_oauth_user ON oauth_accounts(user_id);

CREATE TABLE otp_codes (
    id         TEXT PRIMARY KEY,
    email      TEXT NOT NULL,
    code_hash  TEXT NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_codes_email_expires ON otp_codes(email, expires_at);

CREATE TABLE refresh_tokens (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_revoked ON refresh_tokens(revoked_at)
    WHERE revoked_at IS NOT NULL;

-- Products and programmatic access

CREATE TABLE products (
    id                        TEXT PRIMARY KEY,
    name                      TEXT NOT NULL,
    slug                      TEXT NOT NULL UNIQUE,
    type                      TEXT NOT NULL
                              CHECK (type IN ('desktop', 'saas', 'hybrid')),
    minimum_supported_version TEXT NOT NULL DEFAULT ''
                              CHECK (
                                  minimum_supported_version = ''
                                  OR minimum_supported_version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$'
                              ),
    minimum_supported_message TEXT NOT NULL DEFAULT ''
                              CHECK (length(minimum_supported_message) <= 1024),
    require_signing           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE api_keys (
    id           TEXT PRIMARY KEY,
    product_id   TEXT REFERENCES products(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    key_hash     TEXT NOT NULL UNIQUE,
    prefix       TEXT NOT NULL,
    scopes       TEXT[] NOT NULL DEFAULT '{}',
    last_used    TIMESTAMPTZ,
    last_used_ip TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_apikeys_product ON api_keys(product_id);

-- Plans and entitlements

CREATE TABLE plans (
    id               TEXT PRIMARY KEY,
    product_id       TEXT NOT NULL REFERENCES products(id),
    name             TEXT NOT NULL,
    slug             TEXT NOT NULL,
    checkout_id      TEXT NOT NULL,
    license_type     TEXT NOT NULL
                     CHECK (license_type IN ('subscription', 'perpetual', 'trial')),
    billing_interval TEXT NOT NULL DEFAULT ''
                     CHECK (billing_interval IN ('', 'month', 'year')),
    max_activations  INTEGER NOT NULL DEFAULT 3,
    trial_days       INTEGER NOT NULL DEFAULT 0,
    grace_days       INTEGER NOT NULL DEFAULT 7,
    stripe_price_id  TEXT NOT NULL DEFAULT '',
    paypal_plan_id   TEXT NOT NULL DEFAULT '',
    license_model    TEXT NOT NULL DEFAULT 'standard'
                     CHECK (license_model IN ('standard', 'floating')),
    floating_timeout INTEGER NOT NULL DEFAULT 30,
    token_ttl_days   INTEGER NOT NULL DEFAULT 0,
    max_seats        INTEGER NOT NULL DEFAULT 0,
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(product_id, slug)
);
CREATE UNIQUE INDEX idx_plans_checkout_id ON plans(checkout_id);
CREATE UNIQUE INDEX idx_plans_stripe_price_unique ON plans(stripe_price_id)
    WHERE stripe_price_id != '';

CREATE TABLE entitlements (
    id                      TEXT PRIMARY KEY,
    plan_id                 TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    feature                 TEXT NOT NULL,
    value_type              TEXT NOT NULL
                            CHECK (value_type IN ('bool', 'int', 'string', 'quota', 'flag')),
    value                   TEXT NOT NULL DEFAULT '',
    quota_period            TEXT NOT NULL DEFAULT ''
                            CHECK (quota_period IN ('', 'hourly', 'daily', 'monthly', 'yearly')),
    quota_unit              TEXT NOT NULL DEFAULT '',
    stripe_meter_event_name TEXT NOT NULL DEFAULT '',
    UNIQUE(plan_id, feature)
);

-- Licenses and access state

CREATE TABLE licenses (
    id                         TEXT PRIMARY KEY,
    product_id                 TEXT NOT NULL REFERENCES products(id),
    plan_id                    TEXT NOT NULL REFERENCES plans(id),
    user_id                    TEXT REFERENCES users(id) ON DELETE SET NULL,
    email                      TEXT NOT NULL,
    license_key                TEXT NOT NULL UNIQUE,
    key_hash                   TEXT NOT NULL DEFAULT '',
    license_key_encrypted      BYTEA
                               CHECK (
                                   license_key_encrypted IS NULL
                                   OR octet_length(license_key_encrypted) BETWEEN 28 AND 4096
                               ),
    payment_provider           TEXT NOT NULL DEFAULT '',
    stripe_customer_id         TEXT NOT NULL DEFAULT '',
    stripe_subscription_id     TEXT UNIQUE,
    paypal_subscription_id     TEXT UNIQUE,
    stripe_payment_intent_id   TEXT NOT NULL DEFAULT '',
    stripe_checkout_session_id TEXT NOT NULL DEFAULT '',
    status                     TEXT NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active','trialing','past_due','canceled','expired','suspended','revoked')),
    valid_from                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until                TIMESTAMPTZ,
    canceled_at                TIMESTAMPTZ,
    suspended_at               TIMESTAMPTZ,
    past_due_at                TIMESTAMPTZ,
    notes                      TEXT NOT NULL DEFAULT '',
    org_name                   TEXT NOT NULL DEFAULT '',
    external_customer_id       TEXT NOT NULL DEFAULT '',
    external_workspace_id      TEXT NOT NULL DEFAULT '',
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_licenses_email ON licenses(email);
CREATE INDEX idx_licenses_key ON licenses(license_key);
CREATE INDEX idx_licenses_product_status ON licenses(product_id, status);
CREATE INDEX idx_licenses_user ON licenses(user_id);
CREATE INDEX idx_licenses_stripe_sub ON licenses(stripe_subscription_id);
CREATE INDEX idx_licenses_paypal_sub ON licenses(paypal_subscription_id);
CREATE UNIQUE INDEX idx_licenses_key_hash ON licenses(key_hash) WHERE key_hash != '';
CREATE INDEX idx_licenses_external_customer ON licenses(product_id, external_customer_id)
    WHERE external_customer_id <> '';
CREATE INDEX idx_licenses_external_workspace ON licenses(product_id, external_workspace_id)
    WHERE external_workspace_id <> '';
CREATE INDEX idx_licenses_past_due_at ON licenses(past_due_at) WHERE status = 'past_due';
CREATE INDEX idx_licenses_stripe_payment_intent ON licenses(stripe_payment_intent_id)
    WHERE stripe_payment_intent_id != '';
CREATE UNIQUE INDEX idx_licenses_stripe_checkout_session ON licenses(stripe_checkout_session_id)
    WHERE stripe_checkout_session_id != '';

CREATE TABLE activations (
    id              TEXT PRIMARY KEY,
    license_id      TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    identifier      TEXT NOT NULL,
    identifier_type TEXT NOT NULL CHECK (identifier_type IN ('device', 'user')),
    label           TEXT NOT NULL DEFAULT '',
    ip_address      TEXT NOT NULL DEFAULT '',
    last_verified   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(license_id, identifier)
);
CREATE INDEX idx_activations_license ON activations(license_id);

CREATE TABLE seats (
    id                TEXT PRIMARY KEY,
    license_id        TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    user_id           TEXT REFERENCES users(id) ON DELETE SET NULL,
    email             TEXT NOT NULL,
    role              TEXT NOT NULL DEFAULT 'member'
                      CHECK (role IN ('admin', 'member')),
    invited_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at       TIMESTAMPTZ,
    removed_at        TIMESTAMPTZ,
    invite_token_hash TEXT,
    invite_expires_at TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_seats_license ON seats(license_id);
CREATE INDEX idx_seats_email ON seats(email);
CREATE INDEX idx_seats_user ON seats(user_id);
CREATE UNIQUE INDEX idx_seats_unique_active ON seats(license_id, email)
    WHERE removed_at IS NULL;
CREATE UNIQUE INDEX idx_seats_invite_token_hash ON seats(invite_token_hash)
    WHERE invite_token_hash IS NOT NULL;

CREATE TABLE floating_sessions (
    id          TEXT PRIMARY KEY,
    license_id  TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    identifier  TEXT NOT NULL,
    label       TEXT NOT NULL DEFAULT '',
    ip_address  TEXT NOT NULL DEFAULT '',
    checked_out TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    heartbeat   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(license_id, identifier)
);
CREATE INDEX idx_floating_license ON floating_sessions(license_id);
CREATE INDEX idx_floating_expires ON floating_sessions(expires_at);

CREATE TABLE subscriptions (
    id                   TEXT PRIMARY KEY,
    license_id           TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    user_id              TEXT REFERENCES users(id) ON DELETE SET NULL,
    plan_id              TEXT NOT NULL REFERENCES plans(id),
    status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','trialing','past_due','canceled','expired','paused','suspended','revoked')),
    payment_provider     TEXT NOT NULL DEFAULT '',
    external_id          TEXT NOT NULL DEFAULT '',
    current_period_start TIMESTAMPTZ,
    current_period_end   TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    canceled_at          TIMESTAMPTZ,
    trial_start          TIMESTAMPTZ,
    trial_end            TIMESTAMPTZ,
    metadata             JSONB NOT NULL DEFAULT '{}',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_license ON subscriptions(license_id);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_external ON subscriptions(payment_provider, external_id);

-- Usage and add-ons

CREATE TABLE usage_events (
    id          TEXT PRIMARY KEY,
    license_id  TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    feature     TEXT NOT NULL,
    quantity    BIGINT NOT NULL DEFAULT 1,
    metadata    JSONB NOT NULL DEFAULT '{}',
    ip_address  TEXT NOT NULL DEFAULT '',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_usage_license_feature ON usage_events(license_id, feature, recorded_at);
CREATE INDEX idx_usage_recorded ON usage_events(recorded_at);

CREATE TABLE usage_counters (
    id         TEXT PRIMARY KEY,
    license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    feature    TEXT NOT NULL,
    period     TEXT NOT NULL,
    period_key TEXT NOT NULL,
    used       BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(license_id, feature, period, period_key)
);
CREATE INDEX idx_counters_lookup ON usage_counters(license_id, feature, period, period_key);

CREATE TABLE addons (
    id           TEXT PRIMARY KEY,
    product_id   TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    slug         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    feature      TEXT NOT NULL,
    value_type   TEXT NOT NULL CHECK (value_type IN ('bool', 'int', 'string', 'quota')),
    value        TEXT NOT NULL,
    quota_period TEXT NOT NULL DEFAULT '',
    quota_unit   TEXT NOT NULL DEFAULT '',
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(product_id, slug)
);
CREATE INDEX idx_addons_product ON addons(product_id);

CREATE TABLE license_addons (
    id         TEXT PRIMARY KEY,
    license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    addon_id   TEXT NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(license_id, addon_id)
);
CREATE INDEX idx_license_addons_license ON license_addons(license_id);

CREATE TABLE metered_billing (
    id          TEXT PRIMARY KEY,
    license_id  TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    feature     TEXT NOT NULL,
    quantity    BIGINT NOT NULL,
    period_key  TEXT NOT NULL,
    synced      BOOLEAN NOT NULL DEFAULT FALSE,
    synced_at   TIMESTAMPTZ,
    external_id TEXT NOT NULL DEFAULT '',
    identifier  TEXT NOT NULL DEFAULT '',
    attempts    INTEGER NOT NULL DEFAULT 0,
    last_error  TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_metered_license ON metered_billing(license_id);
CREATE INDEX idx_metered_unsynced ON metered_billing(synced) WHERE synced = FALSE;
CREATE UNIQUE INDEX idx_metered_billing_identifier ON metered_billing(identifier)
    WHERE identifier <> '';

-- Webhooks and operational state

CREATE TABLE webhooks (
    id         TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url        TEXT NOT NULL,
    secret     TEXT NOT NULL,
    events     TEXT[] NOT NULL DEFAULT '{}',
    active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhooks_product ON webhooks(product_id);

CREATE TABLE webhook_deliveries (
    id            TEXT PRIMARY KEY,
    webhook_id    TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event         TEXT NOT NULL,
    payload       JSONB NOT NULL DEFAULT '{}',
    response_code INTEGER,
    response_body TEXT NOT NULL DEFAULT '',
    attempts      INTEGER NOT NULL DEFAULT 0,
    next_retry    TIMESTAMPTZ,
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'delivered', 'failed')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at  TIMESTAMPTZ
);
CREATE INDEX idx_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX idx_deliveries_retry ON webhook_deliveries(status, next_retry)
    WHERE status = 'pending';

CREATE TABLE processed_events (
    id         TEXT PRIMARY KEY,
    provider   TEXT NOT NULL,
    event_id   TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider, event_id)
);
CREATE INDEX idx_processed_events_lookup ON processed_events(provider, event_id);

CREATE TABLE idempotency_keys (
    key               TEXT NOT NULL CHECK (length(key) BETWEEN 1 AND 256),
    endpoint          TEXT NOT NULL CHECK (length(endpoint) BETWEEN 1 AND 256),
    body_hash         TEXT NOT NULL CHECK (body_hash ~ '^[a-f0-9]{64}$'),
    response_status   INTEGER NOT NULL DEFAULT 0,
    response_body     TEXT NOT NULL DEFAULT '',
    response_complete BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
    PRIMARY KEY (key, endpoint)
);
CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);

CREATE TABLE notifications (
    id         TEXT PRIMARY KEY,
    license_id TEXT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    tag        TEXT NOT NULL,
    sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(license_id, tag)
);
CREATE INDEX idx_notifications_license ON notifications(license_id);

CREATE TABLE email_queue (
    id           TEXT PRIMARY KEY,
    to_addr      TEXT NOT NULL,
    subject      TEXT NOT NULL,
    body         TEXT NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'sent', 'failed')),
    next_retry   TIMESTAMPTZ,
    error        TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at      TIMESTAMPTZ
);
CREATE INDEX idx_email_queue_status ON email_queue(status, next_retry)
    WHERE status = 'pending';

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE audit_logs (
    id         TEXT PRIMARY KEY,
    entity     TEXT NOT NULL,
    entity_id  TEXT NOT NULL,
    action     TEXT NOT NULL,
    actor_id   TEXT NOT NULL DEFAULT '',
    actor_type TEXT NOT NULL DEFAULT '',
    changes    JSONB NOT NULL DEFAULT '{}',
    ip_address TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

CREATE TABLE analytics_snapshots (
    id                TEXT PRIMARY KEY,
    date              DATE NOT NULL,
    product_id        TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    total_licenses    INTEGER NOT NULL DEFAULT 0,
    active_licenses   INTEGER NOT NULL DEFAULT 0,
    new_licenses      INTEGER NOT NULL DEFAULT 0,
    churned           INTEGER NOT NULL DEFAULT 0,
    total_activations INTEGER NOT NULL DEFAULT 0,
    total_seats       INTEGER NOT NULL DEFAULT 0,
    total_usage       BIGINT NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(date, product_id)
);
CREATE INDEX idx_analytics_product_date ON analytics_snapshots(product_id, date);

-- Software releases

CREATE TABLE release_signing_keys (
    id                    TEXT PRIMARY KEY,
    product_id            TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    public_key            TEXT NOT NULL CHECK (length(public_key) BETWEEN 32 AND 128),
    private_key_encrypted BYTEA NOT NULL
                          CHECK (octet_length(private_key_encrypted) BETWEEN 60 AND 256),
    active                BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    rotated_at            TIMESTAMPTZ,
    note                  TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 256)
);
CREATE UNIQUE INDEX idx_release_signing_keys_one_active
    ON release_signing_keys(product_id) WHERE active = TRUE;
CREATE INDEX idx_release_signing_keys_product
    ON release_signing_keys(product_id, active, created_at DESC);

CREATE TABLE releases (
    id            TEXT PRIMARY KEY,
    product_id    TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    version       TEXT NOT NULL
                  CHECK (
                      length(version) BETWEEN 1 AND 64
                      AND version ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$'
                  ),
    channel       TEXT NOT NULL DEFAULT 'stable'
                  CHECK (channel IN ('stable', 'beta', 'alpha', 'dev')),
    name          TEXT NOT NULL DEFAULT '' CHECK (length(name) <= 256),
    release_notes TEXT NOT NULL DEFAULT '' CHECK (length(release_notes) <= 65536),
    status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'yanked')),
    yanked_reason TEXT NOT NULL DEFAULT '' CHECK (length(yanked_reason) <= 1024),
    published_at  TIMESTAMPTZ,
    yanked_at     TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(product_id, version)
);
CREATE INDEX idx_releases_published ON releases(product_id, channel, published_at DESC)
    WHERE status = 'published';
CREATE INDEX idx_releases_drafts ON releases(product_id, created_at DESC)
    WHERE status = 'draft';

CREATE TABLE release_artifacts (
    id             TEXT PRIMARY KEY,
    release_id     TEXT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
    platform       TEXT NOT NULL CHECK (length(platform) BETWEEN 1 AND 64),
    file_key       TEXT NOT NULL DEFAULT '' CHECK (length(file_key) <= 1024),
    file_size      BIGINT NOT NULL DEFAULT 0 CHECK (file_size >= 0),
    sha256         TEXT NOT NULL DEFAULT ''
                   CHECK (sha256 = '' OR sha256 ~ '^[a-f0-9]{64}$'),
    ed25519_sig    TEXT NOT NULL DEFAULT '' CHECK (length(ed25519_sig) <= 256),
    content_type   TEXT NOT NULL DEFAULT 'application/octet-stream'
                   CHECK (length(content_type) <= 128),
    signing_key_id TEXT REFERENCES release_signing_keys(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(release_id, platform)
);
CREATE INDEX idx_release_artifacts_release ON release_artifacts(release_id);
CREATE INDEX idx_release_artifacts_platform ON release_artifacts(platform);

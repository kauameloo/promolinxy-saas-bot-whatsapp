-- =====================================================
-- TYPEBOT BRIDGE - Database Schema
-- Tables for TypeBot integration
-- =====================================================

-- =====================================================
-- TABLE: typebot_flows (TypeBot flow configurations)
-- =====================================================
CREATE TABLE IF NOT EXISTS typebot_flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    flow_url TEXT NOT NULL,
    token TEXT,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE: typebot_logs (Message and event logs)
-- =====================================================
CREATE TABLE IF NOT EXISTS typebot_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    session_id VARCHAR(255),
    direction VARCHAR(20) NOT NULL,
    content TEXT,
    message_type VARCHAR(50),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABLE: typebot_sessions (Session metadata - optional, Redis is primary)
-- =====================================================
CREATE TABLE IF NOT EXISTS typebot_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    flow_url TEXT,
    last_activity TIMESTAMP WITH TIME ZONE,
    state JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(phone, session_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_typebot_flows_tenant ON typebot_flows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_typebot_flows_active ON typebot_flows(is_active);

CREATE INDEX IF NOT EXISTS idx_typebot_logs_tenant ON typebot_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_typebot_logs_phone ON typebot_logs(phone);
CREATE INDEX IF NOT EXISTS idx_typebot_logs_session ON typebot_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_typebot_logs_created ON typebot_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_typebot_logs_direction ON typebot_logs(direction);

CREATE INDEX IF NOT EXISTS idx_typebot_sessions_tenant ON typebot_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_typebot_sessions_phone ON typebot_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_typebot_sessions_activity ON typebot_sessions(last_activity);

-- =====================================================
-- TRIGGER FOR UPDATED_AT
-- =====================================================
DROP TRIGGER IF EXISTS update_typebot_flows_updated_at ON typebot_flows;
CREATE TRIGGER update_typebot_flows_updated_at 
BEFORE UPDATE ON typebot_flows 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_typebot_sessions_updated_at ON typebot_sessions;
CREATE TRIGGER update_typebot_sessions_updated_at 
BEFORE UPDATE ON typebot_sessions 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INITIAL DATA (Example flow configuration)
-- =====================================================
-- Uncomment to create a default flow
-- INSERT INTO typebot_flows (tenant_id, name, flow_url, token, settings)
-- VALUES (
--     '00000000-0000-0000-0000-000000000001',
--     'Default TypeBot Flow',
--     'https://bot.promolinxy.online/chatbot',
--     'dFFZwBGJE2gQuXLcnVyXYpfj',
--     '{
--         "preferReupload": true,
--         "enableUrlRewrite": false,
--         "delays": {
--             "fixed": 1000,
--             "perMessage": 500
--         }
--     }'::jsonb
-- )
-- ON CONFLICT DO NOTHING;

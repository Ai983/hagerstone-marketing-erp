-- Chatbot flows table
CREATE TABLE IF NOT EXISTS chatbot_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive')),
  trigger_type TEXT NOT NULL DEFAULT 'keyword' CHECK (trigger_type IN ('keyword', 'first_message', 'any_message', 'button_reply')),
  trigger_keywords TEXT[] DEFAULT '{}',
  trigger_match TEXT NOT NULL DEFAULT 'contains' CHECK (trigger_match IN ('contains', 'exact', 'starts_with')),
  priority INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chatbot nodes table
CREATE TABLE IF NOT EXISTS chatbot_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID NOT NULL REFERENCES chatbot_flows(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'send_text', 'send_media', 'send_buttons',
    'ask_question', 'move_stage', 'create_task',
    'enroll_campaign', 'condition', 'end'
  )),
  position INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}',
  next_node_id UUID REFERENCES chatbot_nodes(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chatbot sessions - tracks where each lead is in a flow
CREATE TABLE IF NOT EXISTS chatbot_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID NOT NULL REFERENCES chatbot_flows(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  current_node_id UUID REFERENCES chatbot_nodes(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'waiting_answer')),
  waiting_for_field TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chatbot answers - saves lead answers to questions
CREATE TABLE IF NOT EXISTS chatbot_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES chatbot_sessions(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES chatbot_flows(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES chatbot_nodes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  field_saved TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE chatbot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chatbot_flows_all" ON chatbot_flows FOR ALL USING (true);
CREATE POLICY "chatbot_nodes_all" ON chatbot_nodes FOR ALL USING (true);
CREATE POLICY "chatbot_sessions_all" ON chatbot_sessions FOR ALL USING (true);
CREATE POLICY "chatbot_answers_all" ON chatbot_answers FOR ALL USING (true);

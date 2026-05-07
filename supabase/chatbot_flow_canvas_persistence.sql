ALTER TABLE chatbot_nodes ADD COLUMN IF NOT EXISTS position_x float DEFAULT 0;
ALTER TABLE chatbot_nodes ADD COLUMN IF NOT EXISTS position_y float DEFAULT 0;
ALTER TABLE chatbot_flows ADD COLUMN IF NOT EXISTS edges_data JSONB DEFAULT '[]';

ALTER TABLE chatbot_sessions DROP CONSTRAINT IF EXISTS chatbot_sessions_current_node_id_fkey;
ALTER TABLE chatbot_answers DROP CONSTRAINT IF EXISTS chatbot_answers_node_id_fkey;

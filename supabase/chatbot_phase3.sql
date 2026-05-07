-- Add condition support to chatbot_nodes
ALTER TABLE chatbot_nodes ADD COLUMN IF NOT EXISTS branches JSONB DEFAULT '[]';

-- branches structure:
-- [
--   { id: "branch_uuid", label: "Yes", color: "#10B981", conditions: [...], next_node_id: "uuid" },
--   { id: "branch_uuid", label: "No", color: "#EF4444", conditions: [...], next_node_id: "uuid" },
--   { id: "branch_uuid", label: "Default", color: "#5A5A72", conditions: [], next_node_id: "uuid" }
-- ]
--
-- condition structure:
-- { field: "message_text"|"lead_stage"|"lead_category"|"lead_city"|"lead_budget"|"last_answer",
--   operator: "contains"|"equals"|"starts_with"|"greater_than"|"less_than"|"not_equals",
--   value: "string or number" }

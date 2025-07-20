import type {
  SupabaseClient,
  PostgrestResponse,
} from "npm:@supabase/supabase-js@2";

const WEBHOOKS_TABLE = "webhooks";
const WEBHOOK_SECRETS_TABLE = "webhook_secrets";

export interface Webhook {
  id: string;
  created_at: Date;
  updated_at: Date;
  name: string;
  url: string;
  event_contract: string;
  event_topic: string;
  alias: string;
}

export interface WebhookSecret {
  id: string;
  created_at: Date;
  alias: string;
  secret: string;
}

export const getWebhook = async (
  client: SupabaseClient,
  event_contract: string,
  event_topic: string
): Promise<PostgrestResponse<Webhook>> => {
  return await client
    .from(WEBHOOKS_TABLE)
    .select("*")
    .eq("event_contract", event_contract)
    .eq("event_topic", event_topic);
};

export const getWebhookSecret = async (
  client: SupabaseClient,
  alias: string
): Promise<PostgrestResponse<WebhookSecret>> => {
  return await client
    .from(WEBHOOK_SECRETS_TABLE)
    .select("*")
    .eq("alias", alias);
};

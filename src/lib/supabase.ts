import { createClient } from "@supabase/supabase-js";
import { getEnvVar, validateDataLayerEnv } from "@/lib/env";

let supabaseClient: any = null;

function getSupabaseClient() {
	if (supabaseClient) return supabaseClient;

	validateDataLayerEnv();

	const supabaseUrl = getEnvVar("NEXT_PUBLIC_SUPABASE_URL", "supabase-service");
	const supabaseKey = getEnvVar("SUPABASE_SERVICE_ROLE_KEY", "supabase-service");

	  supabaseClient = createClient<any>(supabaseUrl, supabaseKey);
	return supabaseClient;
}

	export const supabase: any = new Proxy({}, {
	get(_target, prop) {
			return getSupabaseClient()[prop as string];
	},
});

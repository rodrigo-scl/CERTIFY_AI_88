// ============================================================
// CERTIFY AI - Edge Function: Recálculo de Estados
// Versión: 1.0
// Autor: Rodrigo Osorio
// Fecha: Enero 2026
// ============================================================
// Deploy: supabase functions deploy recalculate-status --no-verify-jwt
// Cron: 0 6 * * * (todos los días a las 6:00 AM)
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: any) => {
    // Manejar preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Missing Supabase credentials');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Ejecutar la función de recálculo
        const { error } = await supabase.rpc('recalculate_credential_statuses');

        if (error) {
            throw error;
        }

        console.log(`[${new Date().toISOString()}] Credential statuses recalculated successfully`);

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Credential statuses recalculated',
                timestamp: new Date().toISOString()
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );

    } catch (error: any) {
        console.error('Recalculation error:', error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
});

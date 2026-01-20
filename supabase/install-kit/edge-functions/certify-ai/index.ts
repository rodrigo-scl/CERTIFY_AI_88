// ============================================================
// CERTIFY AI - Edge Function: Asistente IA
// Versión: 1.0
// Autor: Rodrigo Osorio
// Fecha: Enero 2026
// ============================================================
// Deploy: supabase functions deploy certify-ai
// NOTA: Esta función VERIFICA JWT automáticamente
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

// Obtener origen permitido desde variables de entorno o usar default
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || ['http://localhost:5173', 'http://localhost:3000'];

const getCorsHeaders = (origin: string | null) => {
    const allowedOrigin = origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o.trim()))
        ? origin
        : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Credentials': 'true',
    };
};

// Función para verificar y gestionar cuota de uso
async function checkAndIncrementQuota(
    supabase: any,
    userId: string
): Promise<{ allowed: boolean, remaining: number, limit: number }> {
    const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'ai_quotas')
        .single();

    const quotaSettings = settings?.value || { daily_limit: 50, enabled: true };

    if (!quotaSettings.enabled) {
        return { allowed: true, remaining: 999, limit: 999 };
    }

    const dailyLimit = quotaSettings.daily_limit || 50;
    const { data: usage } = await supabase
        .from('ai_usage')
        .select('*')
        .eq('user_id', userId)
        .single();

    const now = new Date();

    if (!usage) {
        await supabase.from('ai_usage').insert({
            user_id: userId,
            query_count: 1,
            last_query_at: now.toISOString(),
            reset_at: new Date(now.getTime() + 86400000).toISOString()
        });
        return { allowed: true, remaining: dailyLimit - 1, limit: dailyLimit };
    }

    if (now > new Date(usage.reset_at)) {
        await supabase.from('ai_usage').update({
            query_count: 1,
            last_query_at: now.toISOString(),
            reset_at: new Date(now.getTime() + 86400000).toISOString()
        }).eq('user_id', userId);
        return { allowed: true, remaining: dailyLimit - 1, limit: dailyLimit };
    }

    if (usage.query_count >= dailyLimit) {
        return { allowed: false, remaining: 0, limit: dailyLimit };
    }

    await supabase.from('ai_usage').update({
        query_count: usage.query_count + 1,
        last_query_at: now.toISOString()
    }).eq('user_id', userId);

    return {
        allowed: true,
        remaining: dailyLimit - usage.query_count - 1,
        limit: dailyLimit
    };
}

// Generar sugerencias de seguimiento
function generateFollowUpSuggestions(message: string): string[] {
    const suggestions: string[] = [];
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes('vencido') || lowerMsg.includes('expired')) {
        suggestions.push('¿Cuáles son los técnicos con documentos por vencer pronto?');
        suggestions.push('¿Cómo está el cumplimiento general?');
    } else if (lowerMsg.includes('cumplimiento') || lowerMsg.includes('compliance')) {
        suggestions.push('¿Cuáles sucursales tienen mejor cumplimiento?');
        suggestions.push('¿Hay técnicos con documentos vencidos?');
    } else {
        suggestions.push('¿Cuál es el estado general de cumplimiento?');
        suggestions.push('¿Cuántos técnicos tienen documentos vencidos?');
    }

    return suggestions.slice(0, 3);
}

Deno.serve(async (req: any) => {
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);

    // Manejar preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const geminiKey = Deno.env.get('GEMINI_API_KEY');

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Missing Supabase credentials');
        }
        if (!geminiKey) {
            throw new Error('Missing Gemini API key');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Verificar token JWT del header Authorization
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(
                JSON.stringify({ answer: 'No autorizado. Inicia sesión nuevamente.' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return new Response(
                JSON.stringify({ answer: 'Sesión inválida. Inicia sesión nuevamente.' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { message, userId } = await req.json();

        // Validar que el userId del body coincida con el del token (previene suplantación)
        if (userId !== user.id) {
            return new Response(
                JSON.stringify({ answer: 'Usuario no coincide con la sesión.' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (!message) {
            return new Response(
                JSON.stringify({ answer: 'El mensaje es requerido.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Verificar cuota
        const quota = await checkAndIncrementQuota(supabase, userId);
        if (!quota.allowed) {
            return new Response(
                JSON.stringify({
                    answer: 'Has alcanzado el límite diario de consultas IA. Intenta mañana.',
                    quota
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Obtener datos para contexto
        const { data: technicians } = await supabase
            .rpc('get_technicians_decrypted');

        const { data: branches } = await supabase
            .from('branches')
            .select('*');

        // Preparar resumen para el modelo
        const totalTechs = technicians?.length || 0;
        const validTechs = technicians?.filter((t: any) => t.overall_status === 'VALID').length || 0;
        const expiredTechs = technicians?.filter((t: any) => t.overall_status === 'EXPIRED').length || 0;
        const expiringTechs = technicians?.filter((t: any) => t.overall_status === 'EXPIRING_SOON').length || 0;
        const missingTechs = technicians?.filter((t: any) => t.overall_status === 'MISSING').length || 0;

        const complianceRate = totalTechs > 0
            ? Math.round((validTechs / totalTechs) * 100)
            : 0;

        const dataContext = `
DATOS ACTUALES:
- Total técnicos: ${totalTechs}
- Habilitados (VALID): ${validTechs}
- Por vencer (EXPIRING_SOON): ${expiringTechs}
- Vencidos (EXPIRED): ${expiredTechs}
- Sin documentos (MISSING): ${missingTechs}
- Tasa de cumplimiento: ${complianceRate}%
- Total sucursales: ${branches?.length || 0}`;

        const sysPrompt = `Eres CertifyAI, asistente de gestión de credenciales laborales.
${dataContext}

REGLAS:
1. Responde SOLO con datos proporcionados
2. Siempre menciona vencidos, pendientes y sin documentos
3. Links disponibles:
   - [Ver Incumplimientos](/technicians?status=EXPIRED) - ver técnicos vencidos
   - [Ver Técnicos](/technicians) - lista completa con botón Descargar Reporte
   - [Sucursales](/branches) - estado por sucursal
4. Cuando el usuario quiera detalles, indica ir a [Técnicos](/technicians)
5. Español chileno, máx 350 palabras
6. Cumplimiento = % de técnicos HABILITADOS`;

        // Llamar a Gemini
        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: message }] }],
                    systemInstruction: { parts: [{ text: sysPrompt }] },
                    generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
                })
            }
        );

        if (!geminiRes.ok) {
            if (geminiRes.status === 429) {
                return new Response(
                    JSON.stringify({ answer: 'Servicio sobrecargado. Intenta en un momento.' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
            throw new Error(`Gemini error: ${geminiRes.status}`);
        }

        const data = await geminiRes.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta.';
        const suggestions = generateFollowUpSuggestions(message);

        return new Response(
            JSON.stringify({ answer: text, suggestions, quota }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (e: any) {
        // Log interno para debugging (solo visible en Supabase Logs)
        console.error('[certify-ai] Error interno:', e.message, e.stack);

        // Respuesta sanitizada al cliente (no exponer detalles internos)
        return new Response(
            JSON.stringify({ answer: 'Ha ocurrido un error. Por favor intenta nuevamente.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

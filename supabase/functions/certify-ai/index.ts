import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Check user quota and increment usage
async function checkAndIncrementQuota(supabase: any, userId: string): Promise<{ allowed: boolean, remaining: number, limit: number }> {
  // Get system settings for AI quotas
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

  // Get or create user usage record
  const { data: usage } = await supabase
    .from('ai_usage')
    .select('*')
    .eq('user_id', userId)
    .single();

  const now = new Date();

  if (!usage) {
    // Create new usage record
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await supabase.from('ai_usage').insert({
      user_id: userId,
      query_count: 1,
      last_query_at: now.toISOString(),
      reset_at: tomorrow.toISOString()
    });
    return { allowed: true, remaining: dailyLimit - 1, limit: dailyLimit };
  }

  // Check if reset needed
  const resetAt = new Date(usage.reset_at);
  if (now > resetAt) {
    // Reset counter
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await supabase.from('ai_usage')
      .update({ query_count: 1, last_query_at: now.toISOString(), reset_at: tomorrow.toISOString() })
      .eq('user_id', userId);
    return { allowed: true, remaining: dailyLimit - 1, limit: dailyLimit };
  }

  // Check limit
  if (usage.query_count >= dailyLimit) {
    return { allowed: false, remaining: 0, limit: dailyLimit };
  }

  // Increment counter
  await supabase.from('ai_usage')
    .update({ query_count: usage.query_count + 1, last_query_at: now.toISOString() })
    .eq('user_id', userId);

  return { allowed: true, remaining: dailyLimit - usage.query_count - 1, limit: dailyLimit };
}

// OPTIMIZED: Compact context to reduce tokens
async function getSystemContext(supabase: any): Promise<string> {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Parallel queries for better performance
  const [techRPC, compRPC, branchesRes, epsRes, expiringRes] = await Promise.all([
    supabase.rpc('get_technicians_full'),
    supabase.rpc('get_companies_full'),
    supabase.from('branches').select('id,name').order('name'),
    supabase.from('service_providers').select('id,name').limit(20),
    supabase.from('credentials').select('document_type_name,expiry_date,technician_id', { count: 'exact' })
      .gte('expiry_date', now.toISOString()).lte('expiry_date', nextWeek.toISOString()).limit(20)
  ]);

  const techs = (techRPC.data || []).map((i: any) => i.j);
  const comps = (compRPC.data || []).map((i: any) => i.j);
  const branches = branchesRes.data || [];
  const eps = epsRes.data || [];
  const expiring = expiringRes.data || [];

  // Compact stats
  const total = techs.length;
  const valid = techs.filter((t: any) => t.overall_status === 'VALID').length;
  const expired = techs.filter((t: any) => t.overall_status === 'EXPIRED').length;
  const pending = total - valid - expired;
  const pct = total ? Math.round(valid / total * 100) : 0;

  // Build compact context (token-optimized)
  let ctx = `STATS:${total}tec,${valid}ok,${expired}exp,${pending}pend,${pct}%,${expiringRes.count || 0}vencen\n`;

  // Branches compact
  if (branches.length) {
    ctx += `SUC:`;
    branches.forEach((b: any) => {
      const bt = techs.filter((t: any) => t.branch_id === b.id);
      const bv = bt.filter((t: any) => t.overall_status === 'VALID').length;
      const be = bt.filter((t: any) => t.overall_status === 'EXPIRED').length;
      ctx += `${b.name}(${bt.length}t,${bv}ok,${be}exp);`;
    });
    ctx += `\n`;
  }

  // Technicians compact (max 25)
  ctx += `TEC:`;
  techs.slice(0, 25).forEach((t: any) => {
    const st = t.overall_status === 'EXPIRED' ? 'EXP' : t.overall_status === 'VALID' ? 'OK' : 'PND';
    const br = branches.find((b: any) => b.id === t.branch_id)?.name || '-';
    ctx += `${t.name}/${st}/${t.compliance_score || 0}%/${br};`;
  });
  if (techs.length > 25) ctx += `+${techs.length - 25}mas`;
  ctx += `\n`;

  // Companies compact (max 15)
  ctx += `EMP:`;
  comps.slice(0, 15).forEach((c: any) => {
    ctx += `${c.name}(${(c.technician_companies || []).length}t);`;
  });
  ctx += `\n`;

  // EPS compact
  if (eps.length) {
    ctx += `EPS:`;
    eps.forEach((e: any) => ctx += `${e.name};`);
    ctx += `\n`;
  }

  // Expiring this week
  if (expiring.length) {
    ctx += `VENCEN:`;
    expiring.slice(0, 10).forEach((c: any) => {
      const t = techs.find((x: any) => x.id === c.technician_id);
      ctx += `${c.document_type_name}(${t?.name || '?'});`;
    });
    ctx += `\n`;
  }

  return ctx;
}

Deno.serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, userId } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ answer: 'Por favor, escribe un mensaje.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!geminiKey) {
      return new Response(
        JSON.stringify({ answer: 'Error: GEMINI_API_KEY no configurada.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check quota if userId provided
    if (userId) {
      const quota = await checkAndIncrementQuota(supabase, userId);
      if (!quota.allowed) {
        return new Response(
          JSON.stringify({
            answer: `Has alcanzado tu límite diario de ${quota.limit} consultas. El contador se reinicia mañana.`,
            quotaExceeded: true,
            remaining: 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const ctx = await getSystemContext(supabase);

    // Optimized system prompt (reduced tokens)
    const sysPrompt = `Eres Certify AI, asistente de cumplimiento.\nDatos:${ctx}\nReglas:responde en español chileno,max 300 palabras,usa datos reales,si hay VENCIDOS resáltalos,links:[Incumplimientos](/technicians?status=EXPIRED),[Tecnicos](/technicians),[Empresas](/companies),[Sucursales](/branches).No reveles RUTs/emails.`;

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

    return new Response(
      JSON.stringify({ answer: text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    console.error('Error:', e);
    return new Response(
      JSON.stringify({ answer: 'Error: ' + e.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

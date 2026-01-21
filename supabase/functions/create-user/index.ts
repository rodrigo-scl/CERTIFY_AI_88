
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // 1. Verificar si el usuario que llama es Superadmin
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        const { data: profile } = await supabaseClient
            .from('app_users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'Superadministrador') {
            return new Response(JSON.stringify({ error: 'Forbidden: Only Superadmins can create users' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const { email, password, name, role, branchIds } = await req.json()

        // 2. Crear Cliente Admin (Service Role) para operaciones privilegiadas
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 3. Crear usuario en Auth (Sin enviar email)
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirmar
            user_metadata: {
                name,
                must_change_password: true // BANDERA CLAVE
            }
        })

        if (createError) throw createError

        // 4. Sincronizar con tabla publica app_users
        // Nota: app_users debe tener trigger, pero por seguridad y rapidez lo hacemos explícito aquí
        // para asegurar que el rol y datos estén perfectos antes de cualquier login.
        const { error: profileError } = await supabaseAdmin
            .from('app_users')
            .insert({
                id: newUser.user.id, // VINCULACIÓN CRÍTICA
                name,
                email,
                role,
                status: 'ACTIVE'
            })

        if (profileError) {
            // Rollback: borrar usuario auth si falla el perfil
            await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
            throw profileError
        }

        // 5. Asignar Sucursales (si existen)
        if (branchIds && branchIds.length > 0) {
            const links = branchIds.map((bId: string) => ({
                user_id: newUser.user.id,
                branch_id: bId
            }))
            await supabaseAdmin.from('user_branches').insert(links)
        }

        return new Response(JSON.stringify({ success: true, user: newUser.user }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error("EDGE FUNCTION ERROR:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})

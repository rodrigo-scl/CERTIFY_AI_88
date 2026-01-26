
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

        // 1. Verificar SOLICITANTE
        const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !caller) throw new Error('Unauthorized')

        const { data: callerProfile } = await supabaseClient
            .from('app_users')
            .select('role')
            .eq('id', caller.id)
            .single()

        // Solo Admins y Superadmins pueden ejecutar acciones
        const allowedRoles = ['Superadministrador', 'Administrador'];
        if (!allowedRoles.includes(callerProfile?.role)) {
            return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const { action, targetUserId } = await req.json()

        if (!targetUserId) throw new Error('Target User ID is required')

        // 2. Verificar OBJETIVO (Target)
        // Instancia Admin para consultar usuarios y ejecutar acciones
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Obtener perfil del objetivo
        const { data: targetProfile } = await supabaseAdmin
            .from('app_users')
            .select('role')
            .eq('id', targetUserId)
            .single()

        // REGLA DE ORO: Nadie toca al Superadministrador (excepto DB directa)
        if (targetProfile?.role === 'Superadministrador') {
            return new Response(JSON.stringify({ error: 'PROTECTED: Cannot modify Superadministrator accounts.' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Un simple Administrador no puede borrar a otro Administrador (opcional, pero buena práctica)
        if (callerProfile.role === 'Administrador' && targetProfile?.role === 'Administrador') {
            return new Response(JSON.stringify({ error: 'Forbidden: Administrators cannot modify other Administrators.' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        let result;

        // 3. Ejecutar Acción
        switch (action) {
            case 'block':
                // Ban hasta el año 3000
                const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
                    ban_duration: '876000h' // 100 años
                });
                if (banError) throw banError;

                // Actualizar estado visual en app_users
                await supabaseAdmin.from('app_users').update({ status: 'BLOCKED' }).eq('id', targetUserId);
                result = { message: 'User blocked' };
                break;

            case 'unblock':
                const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
                    ban_duration: '0s' // Desbanear
                });
                if (unbanError) throw unbanError;

                await supabaseAdmin.from('app_users').update({ status: 'ACTIVE' }).eq('id', targetUserId);
                result = { message: 'User unblocked' };
                break;

            case 'delete':
                // Soft delete preferible, pero hard delete solicitado
                const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
                if (delError) throw delError;

                // Trigger en DB debería limpiar app_users, pero lo hacemos explícito por consistencia
                await supabaseAdmin.from('app_users').delete().eq('id', targetUserId);
                result = { message: 'User deleted' };
                break;

            case 'reset_password':
                // Generar pase temporal
                const tempPass = 'Certify' + Math.floor(Math.random() * 9000 + 1000) + '!';
                const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
                    password: tempPass,
                    user_metadata: { must_change_password: true }
                });
                if (resetError) throw resetError;

                result = { message: 'Password reset', newPassword: tempPass };
                break;

            default:
                throw new Error('Invalid action');
        }

        return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error("ADMIN ACTION ERROR:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})

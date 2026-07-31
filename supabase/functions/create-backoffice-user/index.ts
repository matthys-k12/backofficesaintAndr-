import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Vérifier que l'appelant est un super admin
  const token = authHeader.replace('Bearer ', '')
  const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token)
  if (authError || !caller) {
    return new Response(JSON.stringify({ error: 'Token invalide' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Super admin = profiles.role='admin' OU pas de row dans backoffice_user_roles
  const { data: callerProfile } = await adminClient
    .from('profiles').select('role').eq('id', caller.id).maybeSingle()
  const { data: callerRoleRow } = await adminClient
    .from('backoffice_user_roles').select('user_id').eq('user_id', caller.id).maybeSingle()

  const callerIsAdmin = callerProfile?.role === 'admin' || !callerRoleRow
  if (!callerIsAdmin) {
    return new Response(JSON.stringify({ error: 'Seul un super administrateur peut créer des accès' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { email, password, nom, role_id } = await req.json()
  if (!email || !password || !role_id) {
    return new Response(JSON.stringify({ error: 'email, password et role_id sont requis' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Créer l'utilisateur dans Supabase Auth
  const { data: { user }, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nom: nom || '' },
  })

  if (createError) {
    return new Response(JSON.stringify({ error: createError.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Assigner le rôle
  const { error: roleError } = await adminClient.from('backoffice_user_roles').insert({
    user_id: user!.id,
    role_id,
    email,
    nom: nom || null,
    is_active: true,
  })

  if (roleError) {
    // Rollback: supprimer l'utilisateur créé
    await adminClient.auth.admin.deleteUser(user!.id)
    return new Response(JSON.stringify({ error: roleError.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true, user_id: user!.id }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error('Server misconfiguration: missing environment variables.')
    }

    // 1. Create client from authorization header to identify the caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
        throw new Error('Missing authorization header')
    }
    
    const jwt = authHeader.replace('Bearer ', '')
    const userClient = createClient(supabaseUrl, supabaseAnonKey)

    const { data: { user: callerUser }, error: userError } = await userClient.auth.getUser(jwt)
    if (userError || !callerUser) throw new Error('Unauthorized: ' + (userError?.message || 'No user'))

    const { data: callerProfile, error: profileError } = await userClient
      .from('profiles')
      .select('role, archived, status')
      .eq('id', callerUser.id)
      .single()

    if (profileError || !callerProfile) throw new Error('Profile not found')
    
    // Check if caller is Admin and active
    const adminRoles = ['Admin', 'Administrator']
    if (!adminRoles.includes(callerProfile.role) || callerProfile.archived || callerProfile.status !== 'Active') {
      return new Response(JSON.stringify({ error: 'Forbidden. Only active admins can perform this action.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const { admin_current_password, target_user_id, new_password } = await req.json()

    if (!admin_current_password || !target_user_id || !new_password) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    if (new_password.length < 6) {
      return new Response(JSON.stringify({ error: 'New password must be at least 6 characters' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 2. Re-authenticate the admin with the provided password
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    })
    
    const { error: signInError } = await anonClient.auth.signInWithPassword({
      email: callerUser.email!,
      password: admin_current_password
    })

    if (signInError) {
      return new Response(JSON.stringify({ error: 'Invalid admin password.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 3. Create service role client to bypass RLS and change the password
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Verify target user is Staff
    const { data: targetProfile, error: targetError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', target_user_id)
      .single()

    if (targetError || !targetProfile) {
      return new Response(JSON.stringify({ error: 'Target user not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }
    
    const staffRoles = ['Staff', 'Encoder']
    if (!staffRoles.includes(targetProfile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden. You can only reset passwords for staff accounts.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 4. Update the user's password
    const { error: updateError } = await adminClient.auth.admin.updateUserById(target_user_id, {
      password: new_password
    })

    if (updateError) {
      throw updateError
    }

    // 5. Update profiles.must_change_password to true
    const { error: profileUpdateError } = await adminClient
      .from('profiles')
      .update({ must_change_password: true, updated_at: new Date().toISOString() })
      .eq('id', target_user_id)

    if (profileUpdateError) {
       console.error("Failed to update must_change_password:", profileUpdateError)
    }

    // 6. Log the action
    await adminClient
      .from('admin_action_logs')
      .insert({
        actor_id: callerUser.id,
        action: 'password_reset',
        target_id: target_user_id
      })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

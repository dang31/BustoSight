import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * enforce-single-session
 *
 * Called immediately after a successful sign-in to record which device owns the
 * account, and to revoke refresh tokens belonging to a previously-seen *other*
 * device.
 *
 * The device_id is a per-browser value from localStorage, so every tab of the
 * same browser shares it. That is what lets a second tab sign in without
 * kicking the first, while a genuinely different device does take over.
 *
 * Requires the caller to already hold a valid access token, so it cannot be used
 * to revoke sessions without proving the current password.
 */
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

    // 1. Identify the caller from the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const jwt = authHeader.replace('Bearer ', '')
    const userClient = createClient(supabaseUrl, supabaseAnonKey)

    const { data: { user: callerUser }, error: userError } = await userClient.auth.getUser(jwt)
    if (userError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { data: callerProfile, error: profileError } = await userClient
      .from('profiles')
      .select('username, role, archived, status')
      .eq('id', callerUser.id)
      .single()

    if (profileError || !callerProfile || callerProfile.archived || callerProfile.status !== 'Active') {
      return new Response(JSON.stringify({ error: 'Forbidden. Account is not active.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const { session_id, device_id } = await req.json()
    if (!session_id || !device_id) {
      return new Response(JSON.stringify({ error: 'Missing session_id or device_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 2. Service role client bypasses RLS to read/claim ownership
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: previousOwner, error: ownerError } = await adminClient
      .from('user_sessions')
      .select('session_id, device_id')
      .eq('user_id', callerUser.id)
      .maybeSingle()

    if (ownerError) {
      console.error('Failed to read current session owner:', ownerError)
    }

    const tookOverOtherDevice = Boolean(previousOwner && previousOwner.device_id !== device_id)

    // 3. A different device took over: revoke every other refresh token so the
    //    previous device cannot keep working off a valid access token.
    let revokedOthers = false
    if (tookOverOtherDevice) {
      const { error: signOutError } = await adminClient.auth.admin.signOut(jwt, 'others')
      if (signOutError) {
        console.error('Failed to revoke other refresh tokens:', signOutError)
      } else {
        revokedOthers = true
      }
    }

    // 4. Claim ownership
    const { error: claimError } = await adminClient
      .from('user_sessions')
      .upsert(
        {
          user_id: callerUser.id,
          session_id,
          device_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )

    if (claimError) {
      throw claimError
    }

    // 5. Audit
    const who = callerProfile.username || callerUser.email || 'User'

    try {
      await adminClient.from('transaction_logs').insert({
        timestamp: new Date().toISOString(),
        user_name: who,
        user_role: callerProfile.role || 'Staff',
        action: tookOverOtherDevice ? 'Session Revoked — Signed In Elsewhere' : 'Session Claimed',
        category: 'Authentication',
        details: tookOverOtherDevice
          ? `${who} signed in on a new device; the previous session was revoked.`
          : `${who} claimed a session on the same device.`,
      })
    } catch (logErr) {
      console.error('transaction_logs insert failed:', logErr)
    }

    try {
      await adminClient.from('admin_action_logs').insert({
        actor_id: callerUser.id,
        action: tookOverOtherDevice ? 'single_session_takeover' : 'single_session_claim',
        target_id: callerUser.id,
      })
    } catch (logErr) {
      console.error('admin_action_logs insert failed:', logErr)
    }

    return new Response(
      JSON.stringify({
        success: true,
        tookOverOtherDevice,
        revokedOthers,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
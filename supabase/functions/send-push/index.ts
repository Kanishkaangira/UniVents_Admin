import { createClient } from 'npm:@supabase/supabase-js@2';

const encoder = new TextEncoder();
const oauthScope = 'https://www.googleapis.com/auth/firebase.messaging';
const oauthAudience = 'https://oauth2.googleapis.com/token';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type EventRow = {
  id: string;
  content_type: string;
  approval: string;
  organizer_scope: string;
  visibility: string;
  skill_faculty_id: string | null;
  department_id: string | null;
  club_id: string | null;
};

type NotificationRow = {
  id: string;
  event_id: string;
  content_type: string;
  title: string;
  message: string;
  visibility: string;
  image_url: string | null;
};

type AdminRow = {
  id: string;
  scope_type: string;
  skill_faculty_id: string | null;
  department_id: string | null;
  club_id: string | null;
};

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function encodeJson(value: unknown) {
  return base64Url(encoder.encode(JSON.stringify(value)));
}

async function getFirebaseAccessToken(serviceAccount: Record<string, string>) {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.value;
  }

  const privateKeyPem = serviceAccount.private_key?.replace(/\\n/g, '\n');
  if (!serviceAccount.client_email || !privateKeyPem) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT must contain client_email and private_key.');
  }

  const keyBytes = Uint8Array.from(
    atob(privateKeyPem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')),
    character => character.charCodeAt(0),
  );
  const privateKey = await crypto.subtle.importKey(
    'pkcs8', keyBytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const unsignedAssertion = `${encodeJson({ alg: 'RS256', typ: 'JWT' })}.${encodeJson({
    iss: serviceAccount.client_email,
    scope: oauthScope,
    aud: oauthAudience,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, encoder.encode(unsignedAssertion));
  const assertion = `${unsignedAssertion}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(oauthAudience, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) {
    console.error('Google OAuth token request failed:', response.status, await response.text());
    throw new Error('Firebase authentication failed. Check the FIREBASE_SERVICE_ACCOUNT secret.');
  }

  const token = await response.json();
  cachedAccessToken = {
    value: token.access_token,
    expiresAt: Date.now() + Number(token.expires_in ?? 3600) * 1000,
  };
  return cachedAccessToken.value;
}

function adminCanReviewEvent(admin: AdminRow, event: EventRow) {
  return admin.scope_type === 'super'
    || (admin.scope_type === 'skill_faculty'
      && ['skill_faculty', 'department'].includes(event.organizer_scope)
      && event.skill_faculty_id === admin.skill_faculty_id)
    || (admin.scope_type === 'department'
      && event.organizer_scope === 'department'
      && event.department_id === admin.department_id)
    || (admin.scope_type === 'club'
      && event.organizer_scope === 'club'
      && event.club_id === admin.club_id);
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const authorization = request.headers.get('authorization') ?? '';
  const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const isDatabaseWebhook = !!serviceKey && constantTimeEqual(bearerToken, serviceKey);
  if (!supabaseUrl || !serviceKey || (!isDatabaseWebhook && !anonKey)) {
    console.error('Missing Supabase runtime configuration for send-push.');
    return json({ error: 'Push service is not configured.' }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400);
  }

  let adminUserId = '';
  if (!isDatabaseWebhook) {
    if (!bearerToken) return json({ error: 'Sign in to an admin account first.' }, 401);
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(bearerToken);
    if (authError || !authData.user) {
      return json({ error: 'Your admin session is invalid or expired.' }, 401);
    }
    adminUserId = authData.user.id;
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    let notification: NotificationRow;
    if (isDatabaseWebhook) {
      if (body.type !== 'INSERT' || body.table !== 'event_notifications' || !body.record) {
        return json({ ignored: true, reason: 'Not an event notification insert.' });
      }
      notification = body.record as NotificationRow;
    } else {
      const eventId = typeof body.event_id === 'string' ? body.event_id : '';
      if (!eventId) return json({ error: 'event_id is required.' }, 400);

      const [{ data: admin, error: adminError }, { data: event, error: eventError }] = await Promise.all([
        adminClient.from('admins')
          .select('id, scope_type, skill_faculty_id, department_id, club_id')
          .eq('id', adminUserId)
          .maybeSingle(),
        adminClient.from('events')
          .select('id, content_type, approval, organizer_scope, skill_faculty_id, department_id, club_id')
          .eq('id', eventId)
          .maybeSingle(),
      ]);
      if (adminError || eventError) throw adminError ?? eventError;
      if (!admin || !event || !adminCanReviewEvent(admin as AdminRow, event as EventRow)) {
        return json({ error: 'This event is outside your admin scope.' }, 403);
      }
      if (!['event', 'notice'].includes(event.content_type) || event.approval !== 'approved') {
        return json({ error: 'Only approved events and notices can send a push notification.' }, 409);
      }

      const { data, error: notificationError } = await adminClient
        .from('event_notifications')
        .select('id, event_id, content_type, title, message, visibility, image_url')
        .eq('event_id', eventId)
        .maybeSingle();
      if (notificationError) throw notificationError;
      if (!data) return json({ error: 'The approved post notification row was not created.' }, 409);
      notification = data as NotificationRow;
    }

    if (!notification.id || !notification.event_id || !notification.title || !notification.message
      || !['event', 'notice'].includes(notification.content_type)) {
      return json({ error: 'The post notification row is missing required fields.' }, 400);
    }

    const recipientUserTypes = notification.visibility === 'all'
      ? ['student', 'faculty']
      : ['student', 'faculty'].includes(notification.visibility)
        ? [notification.visibility]
        : null;
    if (!recipientUserTypes) return json({ error: 'The post has an unsupported notification audience.' }, 400);

    const tokens: { fcm_token: string }[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: deviceTokens, error: tokenError } = await adminClient.rpc(
        'get_event_push_device_tokens',
        { p_user_types: recipientUserTypes, p_offset: offset, p_limit: 1000 },
      );
      if (tokenError) throw tokenError;
      const page = deviceTokens ?? [];
      tokens.push(...page);
      if (page.length < 1000) break;
    }
    if (tokens.length === 0) return json({ sent: false, reason: 'no_registered_devices' });

    // Claim this event's one push atomically so retries or duplicate clicks do not spam users.
    const { data: claimed, error: claimError } = await adminClient
      .from('event_notifications')
      .update({ push_sent_at: new Date().toISOString() })
      .eq('id', notification.id)
      .is('push_sent_at', null)
      .select('id')
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return json({ sent: false, reason: 'already_sent' });

    try {
      const rawServiceAccount = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
      if (!rawServiceAccount) throw new Error('Set the FIREBASE_SERVICE_ACCOUNT Edge Function secret.');
      const serviceAccount = JSON.parse(rawServiceAccount);
      if (!serviceAccount.project_id) throw new Error('Firebase service account has no project_id.');
      const firebaseToken = await getFirebaseAccessToken(serviceAccount);
      const sendToToken = async (device: { fcm_token: string }) => {
        const fcmResponse = await fetch(
          `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(serviceAccount.project_id)}/messages:send`,
          {
            method: 'POST',
            headers: { authorization: `Bearer ${firebaseToken}`, 'content-type': 'application/json' },
            body: JSON.stringify({
              message: {
                token: device.fcm_token,
                notification: { title: notification.title, body: notification.message },
                android: {
                  priority: 'high',
                  notification: {
                    channel_id: 'univents_event_updates_v2',
                    icon: 'ic_stat_univents',
                    color: '#5B4BFF',
                    sound: 'default',
                    ...(notification.image_url ? { image: notification.image_url } : {}),
                  },
                },
                data: {
                  notification_id: notification.id,
                  event_id: notification.event_id,
                  type: `${notification.content_type}_published`,
                },
              },
            }),
          },
        );
        if (fcmResponse.ok) return { sent: true, token: device.fcm_token };
        return {
          sent: false,
          token: device.fcm_token,
          status: fcmResponse.status,
          details: await fcmResponse.text(),
        };
      };

      const results: Awaited<ReturnType<typeof sendToToken>>[] = [];
      for (let index = 0; index < tokens.length; index += 10) {
        results.push(...await Promise.all(tokens.slice(index, index + 10).map(sendToToken)));
      }
      const sentTokens = results.filter(result => result.sent);
      const failedTokens = results.filter(result => !result.sent);
      const invalidTokens = failedTokens.filter(result => {
        try {
          const error = JSON.parse(result.details);
          return error.error?.details?.some((detail: { errorCode?: string }) =>
            detail.errorCode === 'UNREGISTERED');
        } catch {
          return false;
        }
      });
      if (invalidTokens.length) {
        const { error: cleanupError } = await adminClient.from('device_tokens')
          .delete().in('fcm_token', invalidTokens.map(result => result.token));
        if (cleanupError) console.error('Could not remove invalid push device tokens:', cleanupError.message);
      }
      if (failedTokens.length) console.error(
        `FCM rejected ${failedTokens.length} of ${results.length} post push deliveries.`,
        failedTokens.map(result => ({ status: result.status, details: result.details })),
      );
      if (!sentTokens.length) throw new Error('Firebase rejected all push notification deliveries.');

      return json({ sent: true, sent_count: sentTokens.length, failed_count: failedTokens.length });
    } catch (error) {
      const { error: releaseError } = await adminClient.from('event_notifications')
        .update({ push_sent_at: null }).eq('id', notification.id);
      if (releaseError) console.error('Could not release failed push claim:', releaseError.message);
      throw error;
    }
  } catch (error) {
    console.error('send-push failed:', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: error instanceof Error ? error.message : 'Push could not be sent.' }, 500);
  }
});

import { json } from '@sveltejs/kit';
import { adminAuth } from '$lib/firebase/admin.ts';

export async function POST({ request, cookies }) {
  try {
    const { idToken } = await request.json();
    
    // Create session cookie (expires in 5 days)
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    
    // Set secure cookie
    cookies.set('__session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax'
    });
    
    return json({ success: true });
  } catch (error) {
    console.error('Session creation failed:', error);
    return json({ error: 'Failed to create session' }, { status: 401 });
  }
}
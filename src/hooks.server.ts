import { adminAuth } from '$lib/firebase/admin';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Get session cookie (matching what the session endpoint creates)
  const sessionCookie = event.cookies.get('__session');
  
  if (sessionCookie) {
    try {
      // Verify the session cookie
      const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
      
      event.locals.userId = decodedClaims.uid;
      event.locals.user = {
        uid: decodedClaims.uid,
        email: decodedClaims.email || '',
        displayName: decodedClaims.name || null,
        photoURL: decodedClaims.picture || null
      };
    } catch (error) {
      console.error('Session verification failed:', error);
      event.locals.userId = null;
      event.locals.user = null;
    }
  } else {
    event.locals.userId = null;
    event.locals.user = null;
  }
  
  return resolve(event);
};

import { getToken } from './auth.js';

export function requireAuth(next) {
  const token = getToken();
  if (!token) {
    location.hash = '/login';
    return;
  }
  next();
}

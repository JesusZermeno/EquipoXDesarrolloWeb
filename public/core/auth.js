const API_BASE = 'http://localhost:3000';

export function saveToken(t){ localStorage.setItem('idToken', t); }
export function getToken(){ return localStorage.getItem('idToken'); }
export function logout(){ localStorage.removeItem('idToken'); }

export async function register(payload){
  const r = await fetch(`${API_BASE}/auth/register`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if(!r.ok) throw new Error(data.error || 'Registro fallido');
  return data;
}

export async function login(email, password){
  const r = await fetch(`${API_BASE}/auth/login`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email, password })
  });
  const data = await r.json();
  if(!r.ok) throw new Error(data.error || 'Login fallido');
  saveToken(data.idToken);
  return data;
}

export async function me(){
  const token = getToken();
  const r = await fetch(`${API_BASE}/me`, {
    headers:{ Authorization:`Bearer ${token||''}` }
  });
  return r.json();
}

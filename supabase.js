/* ============================================
   QUANTUMREPORT — Supabase Client (REST API directa)
   Sin dependencias externas
   ============================================ */

const SUPABASE_URL = 'https://pdmkaimtseshngyuqjyn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkbWthaW10c2VzaG5neXVxanluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MzQ1NDUsImV4cCI6MjA5NjExMDU0NX0.rRwcl0BX2zFxTYHWFYdMQsIi9ddm4MmXbCYi1BPSCuM';

const AUTH_URL = `${SUPABASE_URL}/auth/v1`;
const REST_URL = `${SUPABASE_URL}/rest/v1`;

const HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Content-Type': 'application/json',
};

// --- Auth API ---
window.__supabase = {
  auth: {
    signUp: async ({ email, password, options }) => {
      const res = await fetch(`${AUTH_URL}/signup`, {
        method: 'POST',
        headers: { ...HEADERS, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          email,
          password,
          data: options?.data || {},
        }),
      });
      const data = await res.json();
      if (res.ok) {
        // Guardar sesión en localStorage
        if (data.access_token) {
          localStorage.setItem('sb-session', JSON.stringify(data));
        }
        return { data: { user: data.user, session: data }, error: null };
      }
      return { data: { user: null, session: null }, error: { message: data.msg || data.error || 'Error al registrarse' } };
    },

    signInWithPassword: async ({ email, password }) => {
      const res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('sb-session', JSON.stringify(data));
        return { data: { user: data.user, session: data }, error: null };
      }
      return { data: { user: null, session: null }, error: { message: data.msg || data.error || 'Credenciales inválidas' } };
    },

    signOut: async () => {
      localStorage.removeItem('sb-session');
      return { error: null };
    },

    getSession: async () => {
      try {
        const raw = localStorage.getItem('sb-session');
        const session = raw ? JSON.parse(raw) : null;
        if (!session || !session.access_token) {
          return { data: { session: null }, error: null };
        }
        // Verificar si el token sigue siendo válido
        const res = await fetch(`${AUTH_URL}/user`, {
          headers: { ...HEADERS, 'Authorization': `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          return { data: { session }, error: null };
        }
        // Token inválido
        localStorage.removeItem('sb-session');
        return { data: { session: null }, error: null };
      } catch {
        return { data: { session: null }, error: null };
      }
    },

    onAuthStateChange: () => {
      // No-op simplificado
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
  },

  // --- Base de datos (solo read por ahora) ---
  from: (table) => ({
    select: (columns = '*') => ({
      limit: (n) => ({
        single: async () => {
          const session = JSON.parse(localStorage.getItem('sb-session') || '{}');
          const res = await fetch(
            `${REST_URL}/${table}?select=${encodeURIComponent(columns)}&limit=${n}`,
            {
              headers: {
                ...HEADERS,
                'Authorization': `Bearer ${session.access_token || SUPABASE_ANON_KEY}`,
                'Prefer': 'return=representation',
              },
            }
          );
          const data = await res.json();
          if (res.ok) {
            return { data: data[0] || null, error: null };
          }
          return { data: null, error: data };
        },
      }),
      eq: (col, val) => ({
        single: async () => {
          const session = JSON.parse(localStorage.getItem('sb-session') || '{}');
          const res = await fetch(
            `${REST_URL}/${table}?select=${encodeURIComponent(columns)}&${col}=eq.${encodeURIComponent(val)}`,
            {
              headers: {
                ...HEADERS,
                'Authorization': `Bearer ${session.access_token || SUPABASE_ANON_KEY}`,
                'Prefer': 'return=representation',
              },
            }
          );
          const data = await res.json();
          if (res.ok) {
            return { data: data[0] || null, error: null };
          }
          return { data: null, error: data };
        },
      }),
    }),

    update: (values) => ({
      eq: (col, val) => ({
        then: async (cb) => {
          const session = JSON.parse(localStorage.getItem('sb-session') || '{}');
          const res = await fetch(
            `${REST_URL}/${table}?${col}=eq.${encodeURIComponent(val)}`,
            {
              method: 'PATCH',
              headers: {
                ...HEADERS,
                'Authorization': `Bearer ${session.access_token || SUPABASE_ANON_KEY}`,
                'Prefer': 'return=representation',
              },
              body: JSON.stringify(values),
            }
          );
          const data = await res.json();
          cb({ data, error: res.ok ? null : data });
        },
      }),
    }),

    insert: async (values) => {
      const session = JSON.parse(localStorage.getItem('sb-session') || '{}');
      const res = await fetch(
        `${REST_URL}/${table}`,
        {
          method: 'POST',
          headers: {
            ...HEADERS,
            'Authorization': `Bearer ${session.access_token || SUPABASE_ANON_KEY}`,
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(values),
        }
      );
      const data = await res.json();
      if (res.ok) {
        return { data: data[0] || data, error: null };
      }
      return { data: null, error: data };
    },
  }),

  // --- Storage ---
  storage: {
    from: (bucket) => ({
      upload: async (path, file, options = {}) => {
        const session = JSON.parse(localStorage.getItem('sb-session') || '{}');
        const headers = {
          ...HEADERS,
          'Authorization': `Bearer ${session.access_token || SUPABASE_ANON_KEY}`,
          'Content-Type': file.type || 'application/octet-stream',
        };
        if (options.upsert) {
          headers['x-upsert'] = 'true';
        }
        const res = await fetch(
          `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
          {
            method: 'POST',
            headers: headers,
            body: file,
          }
        );
        const data = await res.json();
        return { data: res.ok ? data : null, error: res.ok ? null : data };
      },

      getPublicUrl: (path) => {
        return {
          data: { publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}` },
        };
      },
    }),
  },

  functions: {
    invoke: async (functionName, options = {}) => {
      const session = JSON.parse(localStorage.getItem('sb-session') || '{}');
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/${functionName}`,
        {
          method: options.method || 'POST',
          headers: {
            ...HEADERS,
            'Authorization': `Bearer ${session.access_token || SUPABASE_ANON_KEY}`,
            ...options.headers,
          },
          body: JSON.stringify(options.body),
        }
      );
      const data = await res.json();
      return { data: res.ok ? data : null, error: res.ok ? null : data };
    },
  },
};

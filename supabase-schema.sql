-- ============================================
-- QUANTUMREPORT — Esquema de Base de Datos
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. TABLA DE CONSULTORIOS
CREATE TABLE IF NOT EXISTS consultorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT,
  slogan TEXT,
  logo_url TEXT,
  plan TEXT NOT NULL DEFAULT 'Gratis' CHECK (plan IN ('Gratis', 'Inicial', 'Pro', 'Premium')),
  limite_analisis INTEGER NOT NULL DEFAULT 10,
  analisis_usados INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT,
  suscripcion_activa BOOLEAN NOT NULL DEFAULT false,
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABLA DE INFORMES
CREATE TABLE IF NOT EXISTS informes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultorio_id UUID NOT NULL REFERENCES consultorios(id) ON DELETE CASCADE,
  paciente_nombre TEXT,
  paciente_telefono TEXT,
  archivo_original TEXT NOT NULL,
  archivo_storage_path TEXT,
  resumen_ia TEXT,
  pdf_generado_path TEXT,
  enviado_whatsapp BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABLA DE PAGOS / SUSCRIPCIONES
CREATE TABLE IF NOT EXISTS suscripciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultorio_id UUID NOT NULL REFERENCES consultorios(id) ON DELETE CASCADE,
  stripe_payment_id TEXT,
  monto DECIMAL(10,2) NOT NULL,
  moneda TEXT NOT NULL DEFAULT 'usd',
  plan TEXT NOT NULL,
  periodo_inicio TIMESTAMPTZ NOT NULL,
  periodo_fin TIMESTAMPTZ NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. TABLA DE CONFIGURACIÓN DEL ADMIN (cambiar credenciales)
CREATE TABLE IF NOT EXISTS admin_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario TEXT NOT NULL UNIQUE DEFAULT 'admin',
  password_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- RLS (Row Level Security)
-- ============================================

-- Habilitar RLS
ALTER TABLE consultorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE informes ENABLE ROW LEVEL SECURITY;
ALTER TABLE suscripciones ENABLE ROW LEVEL SECURITY;

-- Políticas para consultorios: cada consultorio ve/edita solo su propio registro
CREATE POLICY "consultorios_select_own" ON consultorios
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "consultorios_insert_own" ON consultorios
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "consultorios_update_own" ON consultorios
  FOR UPDATE USING (auth.uid() = user_id);

-- Políticas para informes: cada consultorio ve solo sus informes
CREATE POLICY "informes_select_own" ON informes
  FOR SELECT USING (
    consultorio_id IN (SELECT id FROM consultorios WHERE user_id = auth.uid())
  );

CREATE POLICY "informes_insert_own" ON informes
  FOR INSERT WITH CHECK (
    consultorio_id IN (SELECT id FROM consultorios WHERE user_id = auth.uid())
  );

-- Políticas para suscripciones
CREATE POLICY "suscripciones_select_own" ON suscripciones
  FOR SELECT USING (
    consultorio_id IN (SELECT id FROM consultorios WHERE user_id = auth.uid())
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_consultorios_updated_at
  BEFORE UPDATE ON consultorios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- FUNCIONES ÚTILES
-- ============================================

-- Obtener el consultorio del usuario actual
CREATE OR REPLACE FUNCTION get_mi_consultorio()
RETURNS SETOF consultorios
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM consultorios WHERE user_id = auth.uid() LIMIT 1;
$$;

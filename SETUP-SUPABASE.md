# Setup Supabase para QuantumReport

## 1. Crear tablas en la base de datos

1. Ve a https://supabase.com/dashboard/project/pdmkaimtseshngyuqjyn
2. En la barra lateral izquierda, haz clic en **SQL Editor**
3. Haz clic en **New Query**
4. Copia y pega TODO el contenido de `supabase-schema.sql`
5. Haz clic en **Run**

## 2. Crear bucket de Storage y configurar políticas

1. En la barra lateral, ve a **Storage**
2. Haz clic en **New Bucket**
3. Nombre: `informes`
4. Marca **Make bucket public**
5. Haz clic en **Create bucket**
6. Ve a **SQL Editor** y ejecuta el siguiente script para permitir la subida y lectura de archivos en el bucket:

```sql
-- Políticas para el bucket de Storage 'informes'
CREATE POLICY "Permitir subida a usuarios autenticados" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'informes');

CREATE POLICY "Permitir actualizacion a usuarios autenticados" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'informes');

CREATE POLICY "Permitir lectura publica" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'informes');
```

---

## 3. Configurar Auto-Auth (opcional)

Para que al registrarse se cree automáticamente un registro en la tabla `consultorios`:

1. Ve a **SQL Editor**
2. Ejecuta este SQL:

```sql
-- Trigger: al registrarse un usuario, crear su consultorio
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.consultorios (user_id, nombre, email, plan, limite_analisis)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre_consultorio', 'Mi Consultorio'),
    NEW.email,
    'Gratis',
    10
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Borrar si ya existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

## 4. Verificar Authentication

1. Ve a **Authentication → Settings**
2. Asegúrate de que **Email Auth** esté habilitado (confirmar email opcional)
3. Si quieres registros sin confirmar email, desactiva **Confirm email** en la sección SMTP

# ⚠️  FALTA CONFIGURAR DATABASE_URL

## 🔴 Problema Detectado

El archivo `backend/.env` tiene el campo `DATABASE_URL` vacío:

```bash
DATABASE_URL=
```

## ✅ Solución

### 1. Obtener la URL de Neon Console

Se abrió Neon Console en tu navegador. Sigue estos pasos:

1. **Inicia sesión** en https://console.neon.tech
2. **Selecciona tu proyecto** COCOCYS
3. **Ve a la sección "Connection Details"** o "Dashboard"
4. **Copia la Connection String** que se ve así:
   ```
   postgresql://neondb_owner:TU_PASSWORD@ep-xxx-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

### 2. Agregar la URL al archivo .env

Abre el archivo y pega la URL:

```bash
# Editar el archivo
code backend/.env

# O con nano
nano backend/.env
```

Reemplaza esta línea:
```bash
DATABASE_URL=
```

Por (ejemplo):
```bash
DATABASE_URL=postgresql://neondb_owner:tu_password_aqui@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### 3. Guardar y verificar

Después de pegar la URL correcta:

1. **Guarda el archivo** (Cmd+S o Ctrl+S)
2. **Ejecuta nuevamente el test**:
   ```bash
   cd backend
   ./venv/bin/python test_db_connection.py
   ```

## 🔒 Importante

- **NUNCA** commiteeseste archivo con credenciales reales
- El archivo `.env` ya está en `.gitignore`
- Solo `.env.example` debe tener placeholders

---

**Una vez que agregues la DATABASE_URL, ejecuta:**
```bash
cd backend
./venv/bin/python test_db_connection.py
```

Y verás si la conexión es exitosa! ✅

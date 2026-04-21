# 🦶 OnlyFeets — Guía Completa de Despliegue

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Framer Motion |
| Backend | Node.js, Express, TypeScript, Socket.IO |
| Base de datos | PostgreSQL 16 + Prisma ORM |
| Caché / Colas | Redis 7 + Bull |
| Almacenamiento | AWS S3 + CloudFront CDN |
| Pagos | Stripe |
| Email | SendGrid |
| Push notifications | Firebase Cloud Messaging |
| Live streaming | Agora.io |
| Proxy / SSL | Nginx + Let's Encrypt |
| Contenedores | Docker + Docker Compose |

---

## 📁 Estructura del Proyecto

```
onlyfeets/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma       # Esquema completo de la BD
│   └── src/
│       ├── main.ts             # Servidor principal
│       ├── auth/               # Login, registro, 2FA, JWT
│       ├── posts/              # CRUD posts, likes, PPV, propinas
│       ├── messages/           # Chat, Mass DM, PPV en DMs
│       ├── subscriptions/      # Suscripciones recurrentes con Stripe
│       ├── payments/           # Stripe, billetera, retiros
│       ├── upload/             # S3 upload, avatares, KYC
│       ├── admin/              # Panel de administración
│       ├── creators/           # Perfiles, estadísticas, analytics
│       ├── search/             # Búsqueda y exploración
│       ├── notifications/      # Push, email, in-app
│       ├── live/               # Live streaming con Agora
│       └── config/             # DB, Redis, Socket.IO, Email
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── (main)/
│       │   │   ├── feed/       # Feed principal
│       │   │   ├── explore/    # Explorar creadoras
│       │   │   ├── messages/   # Chat en tiempo real
│       │   │   ├── notifications/ # Notificaciones
│       │   │   ├── settings/   # Perfil, pagos, seguridad
│       │   │   ├── [username]/ # Perfil de creadora
│       │   │   └── creator/    # Dashboard, posts, analytics
│       │   └── (auth)/
│       │       ├── login/
│       │       └── register/
│       ├── components/
│       │   ├── post/           # PostCard, MediaViewer, Comments
│       │   ├── modals/         # Subscribe, Tip, PPV Unlock
│       │   ├── creator/        # CreatorCard, SuggestedCreators
│       │   └── ui/             # Componentes reutilizables
│       ├── store/              # Zustand (auth)
│       └── lib/                # API client, Socket.IO
├── nginx/nginx.conf
├── docker-compose.yml
└── .env.example
```

---

## 🚀 Instalación Local (Desarrollo)

### 1. Prerequisitos
```bash
node --version   # >= 20
docker --version # >= 24
```

### 2. Clonar y configurar
```bash
git clone https://github.com/tu-usuario/onlyfeets.git
cd onlyfeets
cp .env.example .env
# Edita .env con tus credenciales reales
```

### 3. Levantar servicios de infraestructura
```bash
docker compose up postgres redis -d
```

### 4. Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

### 5. Frontend
```bash
cd frontend
npm install
npm run dev
```

La app estará disponible en:
- Frontend: http://localhost:3000
- API: http://localhost:4000
- API Health: http://localhost:4000/health

---

## 🐳 Despliegue con Docker Compose (Producción)

### 1. Configurar el servidor
```bash
# Ubuntu 22.04 LTS recomendado
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

### 2. Clonar y configurar
```bash
git clone https://github.com/tu-usuario/onlyfeets.git /opt/onlyfeets
cd /opt/onlyfeets
cp .env.example .env
nano .env  # Configura TODAS las variables
```

### 3. Configurar DNS
```
A    @          → IP_DEL_SERVIDOR
A    www        → IP_DEL_SERVIDOR
```

### 4. Obtener SSL (primera vez)
```bash
# Temporalmente abre puerto 80 sin SSL
docker compose up certbot nginx

# Luego el nginx.conf completo con SSL funcionará
```

### 5. Construir y levantar todo
```bash
docker compose build
docker compose up -d
docker compose logs -f  # Ver logs
```

### 6. Migraciones de base de datos
```bash
docker compose exec backend npx prisma migrate deploy
```

---

## ☁️ Despliegue en AWS (Recomendado para escalar)

### Arquitectura AWS
```
Internet
    ↓
CloudFront CDN (caché + SSL)
    ↓
Application Load Balancer
    ↓           ↓
ECS Frontend   ECS Backend (múltiples instancias)
    ↓               ↓
              RDS PostgreSQL (Multi-AZ)
              ElastiCache Redis (Cluster)
              S3 (medios privados)
```

### Servicios AWS a configurar
```bash
# 1. VPC con subnets públicas y privadas
# 2. RDS PostgreSQL Multi-AZ
# 3. ElastiCache Redis
# 4. S3 Bucket (privado) + CloudFront
# 5. ECR para imágenes Docker
# 6. ECS Fargate para contenedores
# 7. ALB (Application Load Balancer)
# 8. ACM (SSL/TLS gratis de AWS)
# 9. SES (emails)
# 10. WAF + Shield (protección DDoS)
```

### Despliegue con AWS CLI
```bash
# Autenticar con ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build y push imágenes
docker build -t onlyfeets-backend ./backend
docker tag onlyfeets-backend:latest $ECR_URI/onlyfeets-backend:latest
docker push $ECR_URI/onlyfeets-backend:latest

# Actualizar ECS service
aws ecs update-service --cluster onlyfeets --service backend --force-new-deployment
```

---

## 🔐 APIs Externas — Configuración

### Stripe
1. Crea cuenta en https://stripe.com
2. Dashboard → Developers → API keys
3. Copia `Publishable key` (frontend) y `Secret key` (backend)
4. Configura webhook: `https://tudominio.com/api/payments/webhook`
   - Eventos: `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.*`
5. Copia el `Webhook signing secret`

### AWS S3
1. Crea bucket S3 (onlyfeets-media) en tu región
2. Configura CORS del bucket:
```json
[{
  "AllowedHeaders": ["*"],
  "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
  "AllowedOrigins": ["https://tudominio.com"],
  "ExposeHeaders": ["ETag"]
}]
```
3. Crea usuario IAM con permisos S3 y obtén credenciales
4. Configura CloudFront distribution apuntando al bucket

### SendGrid
1. Cuenta en https://sendgrid.com
2. Settings → API Keys → Create API Key (Full Access)
3. Verifica tu dominio de envío

### Firebase (Push)
1. Crear proyecto en https://console.firebase.google.com
2. Project Settings → Service accounts → Generate private key
3. Descarga el JSON y extrae las credenciales

---

## 💳 Comisiones de la Plataforma

| Tipo | Plataforma | Creadora |
|------|-----------|---------|
| Suscripciones | 20% | 80% |
| PPV Posts | 20% | 80% |
| PPV DMs | 20% | 80% |
| Propinas | 20% | 80% |

---

## 📊 Costos Estimados de Infraestructura

| Usuarios | DigitalOcean | AWS |
|---------|-------------|-----|
| < 1,000 | ~$50/mes | ~$200/mes |
| ~10,000 | ~$200/mes | ~$800/mes |
| ~100,000 | ~$800/mes | ~$3,500/mes |
| > 500,000 | Custom | Custom |

**Recomendación por fase:**
- **MVP (0-5k usuarios)**: DigitalOcean Droplet $48/mes
- **Crecimiento (5k-50k)**: DigitalOcean Managed Services
- **Escala (50k+)**: AWS con ECS + RDS Multi-AZ

---

## 🔒 Seguridad Implementada

- ✅ JWT con refresh tokens rotables
- ✅ 2FA con TOTP (Google Authenticator)
- ✅ Bcrypt (12 rounds) para contraseñas
- ✅ Rate limiting por endpoint
- ✅ Validación con Zod en backend y frontend
- ✅ Helmet.js (headers de seguridad)
- ✅ CORS configurado
- ✅ Archivos S3 privados con URLs firmadas
- ✅ Webhook signature verification (Stripe)
- ✅ KYC para verificación de creadores
- ✅ Bloqueo de usuarios
- ✅ Detección de cuentas baneadas

---

## 📱 App Móvil (React Native)

El código de la app móvil reutiliza toda la lógica de negocio a través de la misma API REST y Socket.IO. Para implementarla:

```bash
npx create-expo-app onlyfeets-mobile --template
cd onlyfeets-mobile
npx expo install expo-camera expo-image-picker @stripe/stripe-react-native
```

Las mismas APIs del backend funcionan sin modificaciones para la app móvil.

---

## 🛠️ Comandos Útiles

```bash
# Ver logs en tiempo real
docker compose logs -f backend

# Acceder a la base de datos
docker compose exec postgres psql -U onlyfeets onlyfeets

# Backup de base de datos
docker compose exec postgres pg_dump -U onlyfeets onlyfeets > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker compose exec -T postgres psql -U onlyfeets onlyfeets < backup.sql

# Resetear Redis
docker compose exec redis redis-cli -a redissecret FLUSHALL

# Ver estadísticas del sistema
docker stats
```

---

## 📞 Soporte

Para dudas o problemas con la implementación, revisa:
- Logs: `docker compose logs [servicio]`
- Health check: `curl http://localhost:4000/health`
- Prisma Studio: `npx prisma studio` (visualizar BD)

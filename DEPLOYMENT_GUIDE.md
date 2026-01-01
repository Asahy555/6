# 🚀 Руководство по развертыванию SX AI

Этот документ содержит пошаговые инструкции по развертыванию приложения SX AI в различных средах.

## 📋 Содержание

- [Локальная разработка](#локальная-разработка)
- [Продакшн развертывание](#продакшн-развертывание)
- [Docker развертывание](#docker-развертывание)
- [Vercel развертывание](#vercel-развертывание)
- [Netlify развертывание](#netlify-развертывание)
- [Собственный сервер](#собственный-сервер)
- [Мониторинг и поддержка](#мониторинг-и-поддержка)

## 🛠️ Локальная разработка

### Предварительные требования

- Node.js 18+ 
- npm или yarn
- Аккаунт в Yandex Cloud

### Быстрый старт

```bash
# Клонирование репозитория
git clone <repository-url>
cd sx-ai

# Установка зависимостей
npm install

# Настройка переменных окружения
cp .env.example .env

# Запуск в режиме разработки
npm run dev
```

Приложение будет доступно по адресу: `http://localhost:5173`

### Проверка сборки

```bash
# Проверка типов TypeScript
npm run type-check

# Сборка для продакшена
npm run build

# Предварительный просмотр сборки
npm run preview
```

## 🌐 Продакшн развертывание

### Подготовка продакшн среды

1. **Настройте переменные окружения:**

```bash
# .env.production
NODE_ENV=production
VITE_APP_URL=https://your-domain.com
VITE_ENABLE_COMPRESSION=true
VITE_DEBUG=false

# Yandex Cloud API ключи
YANDEX_API_KEY=your_production_yandex_api_key
YANDEX_FOLDER_ID=your_production_folder_id
YANDEX_SPEECH_KEY=your_production_speech_key
```

2. **Оптимизируйте сборку:**

```bash
# Установите дополнительные зависимости для оптимизации
npm install --save-dev rollup-plugin-visualizer

# Обновите vite.config.ts для анализа размера бандла
```

### Конфигурация Vite для продакшена

Создайте/обновите `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['./components/Button']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 5173,
    host: true
  },
  preview: {
    port: 4173,
    host: true
  }
})
```

## 🐳 Docker развертывание

### Dockerfile

Создайте `Dockerfile`:

```dockerfile
# Базовый образ
FROM node:18-alpine AS builder

# Установка рабочей директории
WORKDIR /app

# Копирование файлов зависимостей
COPY package*.json ./
RUN npm ci --only=production

# Копирование исходного кода
COPY . .

# Сборка приложения
RUN npm run build

# Продакшн образ
FROM nginx:alpine

# Копирование собранного приложения
COPY --from=builder /app/dist /usr/share/nginx/html

# Копирование конфигурации nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Открытие порта
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "80:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    
  # Опционально: nginx для reverse proxy
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx-ssl.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped
```

### Сборка и запуск

```bash
# Сборка образа
docker build -t sx-ai .

# Запуск контейнера
docker run -p 80:80 sx-ai

# Или через docker-compose
docker-compose up -d
```

## ☁️ Vercel развертывание

### vercel.json

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Настройка переменных окружения в Vercel

1. Перейдите в настройки проекта
2. Добавьте переменные окружения:
   - `YANDEX_API_KEY`
   - `YANDEX_FOLDER_ID`
   - `YANDEX_SPEECH_KEY`
   - `VITE_APP_URL`

### Развертывание

```bash
# Установка Vercel CLI
npm i -g vercel

# Логин в Vercel
vercel login

# Развертывание
vercel --prod
```

## 🌐 Netlify развертывание

### netlify.toml

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[context.production.environment]
  NODE_ENV = "production"
```

### Переменные окружения

В настройках Netlify добавьте:
- `YANDEX_API_KEY`
- `YANDEX_FOLDER_ID`
- `YANDEX_SPEECH_KEY`
- `VITE_APP_URL`

### Развертывание

1. Подключите GitHub репозиторий
2. Настройте ветку для деплоя
3. Настройте переменные окружения
4. Автоматический деплой при пуше

## 🖥️ Собственный сервер

### Ubuntu/Debian сервер

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка PM2
sudo npm install -g pm2

# Установка nginx
sudo apt install nginx -y

# Клонирование проекта
git clone <repository-url>
cd sx-ai
npm install

# Сборка проекта
npm run build

# Настройка PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### ecosystem.config.js для PM2

```javascript
module.exports = {
  apps: [{
    name: 'sx-ai',
    script: 'npm',
    args: 'run preview',
    env: {
      NODE_ENV: 'production',
      PORT: 4173
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
}
```

### Конфигурация Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:4173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📊 Мониторинг и поддержка

### Логирование

```bash
# Просмотр логов PM2
pm2 logs sx-ai

# Мониторинг процессов
pm2 monit

# Перезапуск приложения
pm2 restart sx-ai
```

### Здоровье приложения

Создайте endpoint для проверки здоровья:

```typescript
// health-check.ts
export async function healthCheck() {
  try {
    // Проверка подключения к Yandex Cloud
    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${process.env.YANDEX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelUri: `gpt://${process.env.YANDEX_FOLDER_ID}/yandexgpt-lite`,
        completionOptions: {
          stream: false,
          temperature: 0.1,
          maxTokens: 10
        },
        messages: [
          {
            role: 'user',
            text: 'Привет'
          }
        ]
      })
    });

    return { status: 'healthy', yandex: response.ok };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}
```

### Бэкапы

```bash
# Скрипт бэкапа
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf "backup_$DATE.tar.gz" /path/to/app/data
aws s3 cp "backup_$DATE.tar.gz" s3://your-backup-bucket/
```

## 🚨 Troubleshooting

### Частые проблемы

1. **Ошибки сборки:**
   - Проверьте версию Node.js (требуется 18+)
   - Очистите кэш: `rm -rf node_modules package-lock.json && npm install`

2. **Ошибки API:**
   - Проверьте правильность API ключей
   - Убедитесь в корректности folder ID
   - Проверьте квоты в Yandex Cloud

3. **Проблемы с портами:**
   - Убедитесь что порты свободны
   - Проверьте firewall настройки

### Логи и отладка

```bash
# Включение подробных логов
VITE_DEBUG=true npm run dev

# Проверка конфигурации
npm run type-check

# Анализ размера бандла
npm run build -- --analyze
```

## 📝 Checklist для продакшена

- [ ] Все переменные окружения настроены
- [ ] API ключи валидны и имеют необходимые разрешения
- [ ] Сборка проходит без ошибок
- [ ] Приложение работает на продакшн порту
- [ ] SSL сертификат настроен (если используется)
- [ ] Мониторинг настроен
- [ ] Бэкапы настроены
- [ ] Домен указывает на сервер
- [ ] Firewall настроен корректно

---

**Важно**: Всегда тестируйте развертывание в staging окружении перед продакшном!
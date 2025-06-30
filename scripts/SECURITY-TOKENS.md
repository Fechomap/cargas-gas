# 🔐 Configuración Segura de Tokens

## ⚠️ IMPORTANTE: Nunca hardcodear tokens en scripts

Para mantener la seguridad de los tokens de Telegram, siempre usa variables de entorno.

## Configuración para `sync-prod-to-local-dev.sh`

### 1. Configura la variable de entorno para desarrollo:

```bash
export TELEGRAM_BOT_TOKEN_DEV="tu_token_de_bot_de_desarrollo_aqui"
```

### 2. Para hacerlo permanente, agrega a tu `~/.bashrc` o `~/.zshrc`:

```bash
echo 'export TELEGRAM_BOT_TOKEN_DEV="tu_token_de_bot_de_desarrollo_aqui"' >> ~/.bashrc
```

### 3. Recarga tu terminal:

```bash
source ~/.bashrc
```

## Verificar configuración

```bash
echo $TELEGRAM_BOT_TOKEN_DEV
```

## ✅ Buenas prácticas

- ✅ Usar variables de entorno para tokens
- ✅ Nunca hacer commit de tokens en el código
- ✅ Usar tokens diferentes para desarrollo y producción
- ✅ Rotar tokens regularmente

## ❌ Nunca hacer

- ❌ Hardcodear tokens en scripts
- ❌ Hacer commit de archivos .env
- ❌ Compartir tokens en chats o documentos
- ❌ Usar el mismo token para dev y prod
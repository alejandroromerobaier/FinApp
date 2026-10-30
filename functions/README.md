# FinApp Backend: Bot de WhatsApp (Firebase Cloud Functions)

Este módulo implementa el Webhook oficial para la **WhatsApp Cloud API de Meta**.

---

## 🛠️ Requisitos Previos en Meta for Developers

1. Ingresar a [Meta for Developers](https://developers.facebook.com/) y crear una App de tipo **"Negocio"** (Business).
2. Agregar el producto **WhatsApp**.
3. En la sección **API Setup**:
   * Obtendrás un **Token de acceso temporal/permanente** (`META_ACCESS_TOKEN`).
   * Obtendrás tu **Phone Number ID** (`META_PHONE_NUMBER_ID`).
4. En la sección **Configuration > Webhook**:
   * **Callback URL:** `https://<region>-<project-id>.cloudfunctions.net/whatsappWebhook`
   * **Verify Token:** El valor que definas en `META_VERIFY_TOKEN` (por defecto: `finapp_webhook_verify_secret`).
   * Suscribirse a los campos del webhook: `messages`.

---

## 🚀 Despliegue de Functions en Firebase

Para desplegar las Cloud Functions en Firebase:

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

Para configurar las variables de entorno en Cloud Functions:

```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set META_ACCESS_TOKEN
firebase functions:secrets:set META_PHONE_NUMBER_ID
```

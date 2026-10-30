import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import { MetaWhatsAppClient } from './metaService';
import { handleIncomingMessage } from './botLogic';

admin.initializeApp();

const metaClient = new MetaWhatsAppClient();

/**
 * Webhook HTTP endpoint for WhatsApp Cloud API.
 * Route: /whatsappWebhook
 */
export const whatsappWebhook = onRequest({ cors: true }, async (req, res) => {
  // 1. GET: Verification handshake for Meta Cloud API
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = process.env.META_VERIFY_TOKEN || 'finapp_webhook_verify_secret';

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('Webhook verification successful with Meta.');
      res.status(200).send(challenge);
      return;
    } else {
      console.warn('Webhook verification failed. Invalid token.');
      res.status(403).send('Forbidden');
      return;
    }
  }

  // 2. POST: Event Notifications
  if (req.method === 'POST') {
    try {
      const body = req.body;

      // Check if WhatsApp notification
      if (body.object === 'whatsapp_business_account' && body.entry) {
        for (const entry of body.entry) {
          const changes = entry.changes || [];
          for (const change of changes) {
            const value = change.value;
            const messages = value?.messages || [];

            for (const msg of messages) {
              const fromPhone = msg.from; // e.g. "5491112345678"
              let incomingText = '';

              if (msg.type === 'text') {
                incomingText = msg.text?.body || '';
              } else if (msg.type === 'audio' || msg.type === 'voice') {
                incomingText = 'Audio recibido (transcripción pendiente de configuración multimedia)';
              }

              if (incomingText) {
                // Process message and generate reply
                const reply = await handleIncomingMessage(fromPhone, incomingText);
                // Send reply back to WhatsApp user
                await metaClient.sendTextMessage(fromPhone, reply);
              }
            }
          }
        }
      }

      res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
      console.error('Error handling WhatsApp webhook payload:', err);
      res.status(500).send('INTERNAL_ERROR');
    }
    return;
  }

  res.status(405).send('Method Not Allowed');
});

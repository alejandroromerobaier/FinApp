/**
 * Service to interact with Meta WhatsApp Cloud API.
 */
export class MetaWhatsAppClient {
  private accessToken: string;
  private phoneNumberId: string;

  constructor() {
    this.accessToken = process.env.META_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.META_PHONE_NUMBER_ID || '';
  }

  /**
   * Send a text message to a WhatsApp phone number.
   */
  async sendTextMessage(to: string, message: string): Promise<boolean> {
    if (!this.accessToken || !this.phoneNumberId) {
      console.warn('Meta WhatsApp credentials not set. Message not sent:', { to, message });
      return false;
    }

    try {
      const url = `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to.replace('+', '').trim(),
          type: 'text',
          text: {
            preview_url: false,
            body: message
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Error sending WhatsApp message via Meta API:', errorData);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Network error sending WhatsApp message:', err);
      return false;
    }
  }

  /**
   * Fetch temporary media URL (for incoming audio/voice messages)
   */
  async getMediaUrl(mediaId: string): Promise<string | null> {
    if (!this.accessToken) return null;
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      if (!res.ok) return null;
      const data = await res.json() as any;
      return data.url || null;
    } catch (err) {
      console.error('Error fetching media URL from Meta:', err);
      return null;
    }
  }
}

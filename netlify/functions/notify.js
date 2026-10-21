// Netlify Serverless Function: Secure Server-Side Notification Dispatcher
// Prevents exposing bot tokens or making direct third-party calls in browser JavaScript

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const message = payload.message || payload.text;

    if (!message) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message required' }) };
    }

    // Bot credentials stored securely on server side
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8987826516:AAFx2sNsEOHxUL8m0OKP8w7qpv8yaEMV9oU';
    const CHAT_IDS = (process.env.TELEGRAM_ADMIN_CHAT_ID ? [process.env.TELEGRAM_ADMIN_CHAT_ID] : [8828015300, 5038100074]);

    if (BOT_TOKEN) {
      const tgPromises = CHAT_IDS.map(chatId => {
        return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
          })
        }).catch(err => console.warn('Telegram send error for chat', chatId, err));
      });

      await Promise.all(tgPromises);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, status: 'dispatched' })
    };
  } catch (err) {
    console.error('Notify function error:', err);
    return {
      statusCode: 200, // Return 200 to avoid breaking frontend UI
      headers,
      body: JSON.stringify({ ok: false, warning: err.message })
    };
  }
};

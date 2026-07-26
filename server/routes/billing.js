const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;

function getBusiness(userId) {
  return db.prepare('SELECT * FROM businesses WHERE user_id = ?').get(userId);
}

router.get('/status', requireAuth, (req, res) => {
  const business = getBusiness(req.userId);
  res.json({
    configured: !!stripe && !!STRIPE_PRICE_ID,
    planStatus: business ? business.plan_status : 'free',
  });
});

router.post('/create-checkout-session', requireAuth, async (req, res) => {
  if (!stripe || !STRIPE_PRICE_ID) {
    return res.status(503).json({ error: 'Billing is not configured on this server yet. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID.' });
  }
  const business = getBusiness(req.userId);
  if (!business) return res.status(404).json({ error: 'Build your company before upgrading.' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      customer_email: business.stripe_customer_id ? undefined : user.email,
      customer: business.stripe_customer_id || undefined,
      // Stripe Checkout needs the customer's address to calculate tax; for a
      // new customer it collects this automatically, for an existing one it
      // needs explicit permission to update the address it has on file.
      customer_update: business.stripe_customer_id ? { address: 'auto', name: 'auto' } : undefined,
      automatic_tax: { enabled: true },
      client_reference_id: String(req.userId),
      subscription_data: {
        metadata: { userId: String(req.userId), businessId: String(business.id) },
        // 20% revenue share is billed separately/manually per the pricing
        // model (usage-based revenue share isn't a native Stripe Billing
        // primitive) — this checkout only covers the flat $49/mo seat.
      },
      success_url: `${APP_URL}/?upgraded=1`,
      cancel_url: `${APP_URL}/?upgrade_cancelled=1`,
    });
    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: 'Could not start checkout', detail: e.message });
  }
});

// Registered in server/index.js with express.raw() so the signature can be verified.
async function webhookHandler(req, res) {
  if (!stripe) return res.status(503).send('Stripe not configured');
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    event = webhookSecret
      ? stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
      : JSON.parse(req.body.toString());
  } catch (e) {
    return res.status(400).send(`Webhook signature verification failed: ${e.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = parseInt(session.client_reference_id, 10);
      if (userId) {
        db.prepare('UPDATE businesses SET plan_status = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE user_id = ?')
          .run('active', session.customer, session.subscription, userId);
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      db.prepare('UPDATE businesses SET plan_status = ? WHERE stripe_subscription_id = ?').run('free', sub.id);
    }
  } catch (e) {
    console.error('[billing webhook] handling error:', e.message);
  }

  res.json({ received: true });
}

module.exports = { router, webhookHandler };

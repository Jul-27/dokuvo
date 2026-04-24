const express = require('express');
const path = require('path');
const fs = require('fs');
const Stripe = require('stripe');
const { supabase } = require('../lib/db');
const { verifyUser } = require('../lib/auth');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// Stripe Webhook (Raw-Body-Middleware ist in index.js gemountet)
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook Fehler:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'customer.subscription.created') {
    const subscription = event.data.object;
    const customerId = subscription.customer;
    const metaUserId = subscription.metadata?.user_id;
    const customer = await stripe.customers.retrieve(customerId);
    const email = customer.email;
    if (metaUserId) {
      await supabase.from('users').upsert({ id: metaUserId, email, plan: 'premium', stripe_customer_id: customerId });
      console.log(`Premium aktiviert für user_id ${metaUserId} (${email})`);
    } else {
      console.error('Webhook: subscription.created ohne metadata.user_id', customerId);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customerId = subscription.customer;
    await supabase.from('users').update({ plan: 'free' }).eq('stripe_customer_id', customerId);
    console.log(`Premium deaktiviert für stripe_customer ${customerId}`);
  }

  res.json({ received: true });
});

// Checkout Session erstellen
router.post('/create-checkout', verifyUser, async (req, res) => {
  const user_id = req.authUser.id;
  const email = req.authUser.email;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/`,
      metadata: { user_id }
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe Fehler:', error.message);
    res.status(500).json({ error: 'Checkout konnte nicht erstellt werden.' });
  }
});

// Nach erfolgreichem Kauf
router.get('/success', async (req, res) => {
  const htmlPath = path.join(__dirname, '..', 'public', 'success.html');
  res.send(fs.readFileSync(htmlPath, 'utf8'));
});

module.exports = router;

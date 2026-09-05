const Iyzipay = require('iyzipay');
const { createClient } = require('@supabase/supabase-js');
const createIyzi = () => new Iyzipay({ apiKey: process.env.IYZICO_API_KEY, secretKey: process.env.IYZICO_SECRET_KEY, uri: process.env.IYZICO_BASE_URL || 'https://api.iyzipay.com' });
module.exports = async (req,res) => {
  try {
    const token = String((req.method === 'POST' ? req.body?.token : req.query?.token) || '');
    const orderId = String(req.query?.order || '');
    if (!token || !orderId) return res.status(400).send('Geçersiz ödeme dönüşü.');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const result = await new Promise((resolve,reject)=>createIyzi().checkoutForm.retrieve({ locale:Iyzipay.LOCALE.TR, conversationId:orderId, token }, (err,r)=>err?reject(err):resolve(r)));
    const { data: order } = await supabase.from('credit_orders').select('*').eq('order_id',orderId).maybeSingle();
    if (!order) return res.status(404).send('Sipariş bulunamadı.');
    if (result.status !== 'success' || result.paymentStatus !== 'SUCCESS') {
      await supabase.from('credit_orders').update({ status:'failed', provider_response:result }).eq('order_id',orderId);
      return res.redirect(302, `${process.env.SITE_URL || '/'}?payment=failed`);
    }
    if (order.status !== 'paid') {
      const { data: profile } = await supabase.from('profiles').select('credits').eq('id',order.user_id).single();
      const newBalance = Number(profile?.credits || 0) + Number(order.credit_amount || 0);
      await supabase.from('profiles').update({ credits:newBalance }).eq('id',order.user_id);
      await supabase.from('credit_orders').update({ status:'paid', paid_at:new Date().toISOString(), provider_response:result }).eq('order_id',orderId).eq('status','pending');
    }
    return res.redirect(302, `${process.env.SITE_URL || '/'}?payment=success&credits=${encodeURIComponent(order.credit_amount)}`);
  } catch(e) { return res.status(500).send('Ödeme doğrulanamadı.'); }
};

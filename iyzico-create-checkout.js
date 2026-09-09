const Iyzipay = require('iyzipay');
const { createClient } = require('@supabase/supabase-js');

const PACKAGES = {
  '50': { credit: 50, price: '50.00' },
  '100': { credit: 100, price: '100.00' },
  '300': { credit: 300, price: '300.00' },
  '500': { credit: 500, price: '500.00' },
  '1000': { credit: 1000, price: '1000.00' },
  '3000': { credit: 3000, price: '3000.00' },
  '5000': { credit: 5000, price: '5000.00' },
  '10000': { credit: 10000, price: '10000.00' }
};

const json = (res, status, body) => { res.status(status).setHeader('Content-Type','application/json'); res.end(JSON.stringify(body)); };
const createIyzi = () => new Iyzipay({ apiKey: process.env.IYZICO_API_KEY, secretKey: process.env.IYZICO_SECRET_KEY, uri: process.env.IYZICO_BASE_URL || 'https://api.iyzipay.com' });

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!process.env.IYZICO_API_KEY || !process.env.IYZICO_SECRET_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) return json(res, 500, { error: 'Sunucu ödeme ayarları eksik.' });
  try {
    const auth = String(req.headers.authorization || '');
    if (!auth.startsWith('Bearer ')) return json(res, 401, { error: 'Oturum gerekli.' });
    const token = auth.slice(7);
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return json(res, 401, { error: 'Oturum doğrulanamadı.' });
    const user = userData.user;

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const pack = PACKAGES[String(body.credit || '')];
    if (!pack) return json(res, 400, { error: 'Geçersiz kredi paketi.' });

    const orderId = `HB-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const origin = process.env.SITE_URL || `https://${req.headers.host}`;
    const callbackUrl = `${origin}/api/iyzico-callback?order=${encodeURIComponent(orderId)}`;
    const buyerName = (user.user_metadata?.full_name || user.email?.split('@')[0] || 'Habibi Müşteri').trim();
    const parts = buyerName.split(/\s+/); const firstName = parts[0] || 'Habibi'; const lastName = parts.slice(1).join(' ') || 'Müşteri';
    const email = user.email || `customer-${user.id}@habibi.local`;

    const { error: insertError } = await supabase.from('credit_orders').insert({
      order_id: orderId, user_id: user.id, credit_amount: pack.credit, amount_try: Number(pack.price), status: 'pending', provider: 'iyzico'
    });
    if (insertError) return json(res, 500, { error: 'Ödeme siparişi oluşturulamadı.' });

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: orderId,
      price: pack.price,
      paidPrice: pack.price,
      currency: Iyzipay.CURRENCY.TRY,
      basketId: orderId,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl,
      buyer: {
        id: user.id.slice(0, 20), name: firstName.slice(0,50), surname: lastName.slice(0,50), gsmNumber: user.user_metadata?.phone || '+905000000000', email,
        identityNumber: '11111111111', registrationAddress: 'Türkiye', city: user.user_metadata?.city || 'Istanbul', country: 'Turkey', zipCode: '34000'
      },
      shippingAddress: { contactName: buyerName, city: user.user_metadata?.city || 'Istanbul', country: 'Turkey', address: 'Türkiye', zipCode: '34000' },
      billingAddress: { contactName: buyerName, city: user.user_metadata?.city || 'Istanbul', country: 'Turkey', address: 'Türkiye', zipCode: '34000' },
      basketItems: [{ id: `KREDI-${pack.credit}`, name: `${pack.credit} Habibi Kredisi`, category1: 'Dijital Hizmet', itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL, price: pack.price }]
    };

    createIyzi().checkoutFormInitialize.create(request, async (err, result) => {
      if (err || !result || result.status !== 'success') {
        await supabase.from('credit_orders').update({ status: 'failed', provider_response: result || { error: String(err || 'Iyzico initialize failed') } }).eq('order_id', orderId);
        return json(res, 502, { error: result?.errorMessage || err?.message || 'İyzico ödeme başlatılamadı.' });
      }
      await supabase.from('credit_orders').update({ iyzico_token: result.token, provider_response: result }).eq('order_id', orderId);
      return json(res, 200, { orderId, token: result.token, checkoutFormContent: result.checkoutFormContent || '', paymentPageUrl: result.paymentPageUrl || null });
    });
  } catch (e) { return json(res, 500, { error: e.message || 'Sunucu hatası.' }); }
};

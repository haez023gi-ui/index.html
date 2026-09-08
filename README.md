# Habibi – İyzico gerçek ödeme paketi

Bu proje, Habibi’nin mevcut ana HTML dosyasını koruyarak İyzico Checkout Form entegrasyonu için hazırlanmıştır.

## Vercel
1. GitHub repository köküne `index.html`, `package.json` ve `api/` klasörünü yükleyin.
2. Vercel’de bu repository’yi import edin.
3. Environment Variables ekleyin: `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`.
4. `SITE_URL` olarak `https://www.habibifal.site` kullanın.
5. Supabase SQL Editor’da `supabase-credit-orders.sql` dosyasını bir kez çalıştırın.

Kart bilgileri Habibi’nin HTML’inde tutulmaz; ödeme alanı İyzico Checkout Form tarafından sağlanır.

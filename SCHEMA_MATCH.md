# مطابقة التطبيق مع قاعدة بيانات نبع عربا

هذا التطبيق يقرأ ويكتب أسماء الجداول والحقول التالية كما أنشأها ملف SQL الأساسي الذي نُفّذ في Supabase:

- `profiles`: `id, full_name, phone, role` والقيم `admin, courier, customer`
- `categories`: `id, name, sort_order, is_active`
- `products`: `id, category_id, name, description, price, unit, image_url, stock, is_active`
- `delivery_fees`: `neighborhood, fee, is_active`
- `orders`: `customer_id, courier_id, customer_name, customer_phone, neighborhood, address, notes, subtotal, delivery_fee, total, payment_method, payment_status, status, created_at`
- `order_items`: `order_id, product_id, product_name, unit, quantity, unit_price, line_total`

قيم الحالة المستخدمة: `pending, accepted, preparing, ready, out_for_delivery, delivered, cancelled`.
قيم الدفع: `cash, card`.

لا تشغّل ملف إنشاء قاعدة البيانات مرة ثانية إذا ظهرت الجداول بالفعل. هذا الملف للتوثيق فقط.

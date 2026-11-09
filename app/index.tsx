import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase, configured } from '../lib/supabase';

type Role = 'admin' | 'courier' | 'customer';
type Profile = { id: string; full_name: string; phone: string; role: Role };
type Category = { id: string; name: string; is_active: boolean };
type Product = { id: string; category_id: string | null; name: string; description: string | null; price: number; unit: string; stock: number; image_url: string | null; is_active: boolean };
type Order = { id: string; customer_id: string; courier_id: string | null; customer_name: string; customer_phone: string; neighborhood: string; address: string; notes: string | null; subtotal: number; delivery_fee: number; total: number; payment_method: 'cash' | 'card'; payment_status: string; status: string; created_at: string };

const GREEN = '#176B45';
const statuses: Record<string, string> = {
  pending: 'بانتظار القبول',
  accepted: 'تم قبول الطلب',
  preparing: 'قيد التجهيز',
  ready: 'جاهز للاستلام',
  out_for_delivery: 'خرج للتوصيل',
  delivered: 'تم التسليم',
  cancelled: 'ملغي'
};

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<'shop' | 'myorders' | 'courier' | 'admin'>('shop');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState<'cash' | 'card'>('cash');
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newUnit, setNewUnit] = useState('حبة');
  const [newCategory, setNewCategory] = useState('');
  const [courierId, setCourierId] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    void refreshCatalog();
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) void refreshAccount();
    else {
      setProfile(null);
      setOrders([]);
    }
  }, [session?.user?.id]);

  async function refreshCatalog() {
    const [c, p] = await Promise.all([
      supabase.from('categories').select('id,name,is_active').eq('is_active', true).order('sort_order'),
      supabase.from('products').select('id,category_id,name,description,price,unit,stock,image_url,is_active').eq('is_active', true).order('name')
    ]);
    if (c.error) console.warn(c.error.message);
    else {
      setCategories(c.data ?? []);
      if (!selectedCategory && c.data?.[0]) setSelectedCategory(c.data[0].id);
    }
    if (p.error) console.warn(p.error.message);
    else setProducts((p.data ?? []) as Product[]);
  }

  async function refreshAccount() {
    if (!session?.user?.id) return;
    const { data: p, error } = await supabase.from('profiles')
      .select('id,full_name,phone,role').eq('id', session.user.id).maybeSingle();
    if (error) {
      Alert.alert('تعذر تحميل الحساب', error.message);
      return;
    }
    if (!p) {
      Alert.alert('الحساب غير مكتمل', 'لم يتم العثور على ملف الحساب في جدول المستخدمين.');
      return;
    }
    const current = p as Profile;
    setProfile(current);
    setPhone(current.phone || '');
    setTab(current.role === 'admin' ? 'admin' : current.role === 'courier' ? 'courier' : 'shop');
    const { data: o, error: oe } = await supabase.from('orders').select('*')
      .order('created_at', { ascending: false }).limit(100);
    if (!oe) setOrders((o ?? []) as Order[]);
    else console.warn(oe.message);
  }

  async function signIn() {
    if (!configured) return Alert.alert('إعداد الاتصال ناقص', 'إعدادات قاعدة البيانات غير موجودة.');
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) Alert.alert('تعذر تسجيل الدخول', error.message);
  }

  async function signUp() {
    if (!name.trim() || !email.trim() || !phone.trim() || password.length < 8)
      return Alert.alert('أكمل البيانات', 'أدخل الاسم والبريد والجوال وكلمة مرور من 8 خانات على الأقل.');
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim(), phone: phone.trim() } }
    });
    setBusy(false);
    if (error) Alert.alert('تعذر إنشاء الحساب', error.message);
    else Alert.alert('تم إنشاء الحساب', 'إذا كان تأكيد البريد مفعلاً، أكّد بريدك ثم سجّل الدخول.');
  }

  const cartProducts = useMemo(
    () => products.filter(p => (cart[p.id] ?? 0) > 0),
    [products, cart]
  );
  const subtotal = cartProducts.reduce(
    (sum, p) => sum + Number(p.price) * (cart[p.id] ?? 0), 0
  );

  async function checkout() {
    if (!profile || !session) return Alert.alert('سجّل الدخول', 'سجّل الدخول أولاً.');
    if (!phone.trim() || !neighborhood.trim() || !address.trim())
      return Alert.alert('العنوان ناقص', 'أدخل الجوال والحي والعنوان.');
    if (!cartProducts.length) return Alert.alert('السلة فارغة', 'أضف منتجات أولاً.');
    setBusy(true);
    const { data: fee } = await supabase.from('delivery_fees').select('fee')
      .eq('neighborhood', neighborhood.trim()).eq('is_active', true).maybeSingle();
    const deliveryFee = Number(fee?.fee ?? 0);
    const { data: order, error } = await supabase.from('orders').insert({
      customer_id: session.user.id,
      customer_name: profile.full_name || name || 'عميل نبع عربا',
      customer_phone: phone.trim(),
      neighborhood: neighborhood.trim(),
      address: address.trim(),
      notes: notes.trim(),
      subtotal,
      delivery_fee: deliveryFee,
      total: subtotal + deliveryFee,
      payment_method: payment,
      payment_status: 'unpaid',
      status: 'pending'
    }).select().single();
    if (error || !order) {
      setBusy(false);
      return Alert.alert('تعذر إنشاء الطلب', error?.message || 'حاول مرة أخرى.');
    }
    const rows = cartProducts.map(p => ({
      order_id: order.id,
      product_id: p.id,
      product_name: p.name,
      unit: p.unit,
      quantity: cart[p.id],
      unit_price: Number(p.price),
      line_total: Number(p.price) * cart[p.id]
    }));
    const { error: itemError } = await supabase.from('order_items').insert(rows);
    setBusy(false);
    if (itemError) return Alert.alert('تنبيه', 'تم إنشاء الطلب، لكن تفاصيل الأصناف لم تحفظ: ' + itemError.message);
    setCart({});
    Alert.alert('تم استلام الطلب', 'رقم الطلب: ' + order.id.slice(0, 8));
    await refreshAccount();
    setTab('myorders');
  }

  async function changeStatus(orderId: string, status: string) {
    const { error } = await supabase.from('orders').update({
      status,
      ...(status === 'delivered' ? { payment_status: 'paid' } : {})
    }).eq('id', orderId);
    if (error) Alert.alert('تعذر تحديث الطلب', error.message);
    else await refreshAccount();
  }

  async function assignOrder(orderId: string) {
    if (!courierId.trim()) return Alert.alert('رقم حساب المندوب مطلوب', 'الصق معرّف المستخدم للمندوب.');
    const { data: person, error: lookupError } = await supabase.from('profiles')
      .select('id,role').eq('id', courierId.trim()).maybeSingle();
    if (lookupError || !person || person.role !== 'courier')
      return Alert.alert('المندوب غير موجود', 'تأكد أن الحساب موجود وأن صلاحية حسابه courier.');
    const { error } = await supabase.from('orders').update({
      courier_id: courierId.trim(), status: 'accepted'
    }).eq('id', orderId);
    if (error) Alert.alert('تعذر إسناد الطلب', error.message);
    else {
      Alert.alert('تم', 'تم إسناد الطلب للمندوب.');
      await refreshAccount();
    }
  }

  async function addProduct() {
    const price = Number(newPrice);
    if (!newName.trim() || !newCategory || !Number.isFinite(price) || price <= 0)
      return Alert.alert('بيانات ناقصة', 'أدخل اسم المنتج والسعر والقسم.');
    setBusy(true);
    const { error } = await supabase.from('products').insert({
      name: newName.trim(), category_id: newCategory, price,
      unit: newUnit.trim() || 'حبة', stock: 0, is_active: true
    });
    setBusy(false);
    if (error) Alert.alert('تعذر إضافة المنتج', error.message);
    else {
      setNewName('');
      setNewPrice('');
      Alert.alert('تم', 'تمت إضافة المنتج.');
      await refreshCatalog();
    }
  }

  const button = (label: string, action: () => void, primary = false) => (
    <Pressable onPress={action} style={{
      backgroundColor: primary ? GREEN : '#E6F0E9',
      padding: 12, borderRadius: 11, marginVertical: 4, alignItems: 'center'
    }}>
      <Text style={{ color: primary ? 'white' : GREEN, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );

  const field = (value: string, set: (s: string) => void, placeholder: string, secure = false) => (
    <TextInput value={value} onChangeText={set} placeholder={placeholder}
      secureTextEntry={secure} textAlign="right"
      style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#D5E2D9', padding: 12, borderRadius: 10, marginVertical: 4 }} />
  );

  const card = (children: React.ReactNode) => (
    <View style={{ backgroundColor: 'white', padding: 13, borderRadius: 12, marginVertical: 5 }}>
      {children}
    </View>
  );

  if (!configured) return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F4F7F4' }}>
      <Text style={{ fontSize: 28, fontWeight: '800', textAlign: 'center', color: GREEN }}>نبع عربا</Text>
      <Text style={{ textAlign: 'center', marginTop: 12 }}>إعدادات الاتصال بقاعدة البيانات غير مكتملة.</Text>
    </View>
  );

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={GREEN} />
      <Text>جارٍ التحميل</Text>
    </View>
  );

  if (!session) return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 22, backgroundColor: '#F4F7F4' }}>
      <Text style={{ fontSize: 29, fontWeight: '800', textAlign: 'center', color: GREEN }}>نبع عربا</Text>
      <Text style={{ textAlign: 'center', marginVertical: 12 }}>توصيل السوبرماركت والخضار والفواكه في بريدة</Text>
      {field(name, setName, 'الاسم لإنشاء حساب')}
      {field(email, setEmail, 'البريد الإلكتروني')}
      {field(phone, setPhone, 'رقم الجوال')}
      {field(password, setPassword, 'كلمة المرور (8 خانات على الأقل)', true)}
      {button(busy ? 'جارٍ التنفيذ...' : 'تسجيل الدخول', signIn, true)}
      {button('إنشاء حساب عميل', signUp)}
    </ScrollView>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F4F7F4' }}
      contentContainerStyle={{ padding: 16, paddingTop: 48, paddingBottom: 40 }}>
      <Text style={{ fontSize: 26, fontWeight: '800', color: GREEN, textAlign: 'right' }}>نبع عربا</Text>
      <Text style={{ textAlign: 'right', marginBottom: 10 }}>
        مرحباً {profile?.full_name || ''} — {profile?.role === 'admin' ? 'المدير' : profile?.role === 'courier' ? 'المندوب' : 'العميل'}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 }}>
        {profile?.role === 'customer' ? button('المتجر', () => setTab('shop')) : null}
        {profile?.role === 'customer' ? button('طلباتي', () => setTab('myorders')) : null}
        {profile?.role === 'courier' ? button('طلبات المندوب', () => setTab('courier')) : null}
        {profile?.role === 'admin' ? button('لوحة الإدارة', () => setTab('admin')) : null}
      </View>

      {tab === 'shop' && profile?.role === 'customer' && <>
        <Text style={{ fontSize: 20, fontWeight: '700', textAlign: 'right', marginVertical: 10 }}>الأقسام</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 }}>
          {categories.map(c => button((selectedCategory === c.id ? '✓ ' : '') + c.name, () => setSelectedCategory(c.id), selectedCategory === c.id))}
        </View>
        {products.filter(p => p.category_id === selectedCategory).map(p => card(
          <>
            <Text style={{ textAlign: 'right', fontSize: 17, fontWeight: '700' }}>{p.name}</Text>
            <Text style={{ textAlign: 'right', color: GREEN }}>{Number(p.price).toFixed(2)} ريال / {p.unit}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 18 }}>
              <Pressable onPress={() => setCart(c => ({ ...c, [p.id]: Math.max(0, (c[p.id] || 0) - (p.unit === 'كيلو' ? 0.5 : 1)) }))}>
                <Text style={{ fontSize: 24, color: GREEN }}>−</Text>
              </Pressable>
              <Text>{cart[p.id] || 0}</Text>
              <Pressable onPress={() => setCart(c => ({ ...c, [p.id]: (c[p.id] || 0) + (p.unit === 'كيلو' ? 0.5 : 1) }))}>
                <Text style={{ fontSize: 24, color: GREEN }}>＋</Text>
              </Pressable>
            </View>
          </>
        ))}
        <Text style={{ textAlign: 'right', fontWeight: '700', marginTop: 12 }}>بيانات التوصيل</Text>
        {field(phone, setPhone, 'رقم الجوال')}
        {field(neighborhood, setNeighborhood, 'الحي في بريدة')}
        {field(address, setAddress, 'الشارع ورقم المنزل وعلامة مميزة')}
        {field(notes, setNotes, 'ملاحظات للسائق')}
        <Text style={{ textAlign: 'right', fontWeight: '700' }}>الدفع عند المندوب</Text>
        {button(payment === 'cash' ? '✓ نقداً' : 'نقداً', () => setPayment('cash'), payment === 'cash')}
        {button(payment === 'card' ? '✓ بطاقة على جهاز المندوب' : 'مدى أو Apple Pay على جهاز المندوب', () => setPayment('card'), payment === 'card')}
        <Text style={{ textAlign: 'right', fontWeight: '700' }}>المجموع قبل التوصيل: {subtotal.toFixed(2)} ريال</Text>
        {button(busy ? 'جارٍ إرسال الطلب...' : 'إرسال الطلب', checkout, true)}
      </>}

      {tab === 'myorders' && profile?.role === 'customer' && <>
        <Text style={{ fontSize: 20, fontWeight: '700', textAlign: 'right' }}>طلباتي</Text>
        {orders.filter(o => o.customer_id === session.user.id).map(o => card(
          <>
            <Text style={{ textAlign: 'right' }}>طلب {o.id.slice(0, 8)} — {statuses[o.status] || o.status}</Text>
            <Text style={{ textAlign: 'right' }}>الإجمالي {o.total} ريال — {o.payment_method === 'cash' ? 'نقداً' : 'بطاقة على جهاز المندوب'}</Text>
          </>
        ))}
      </>}

      {tab === 'courier' && profile?.role === 'courier' && <>
        <Text style={{ fontSize: 20, fontWeight: '700', textAlign: 'right' }}>الطلبات المسندة إليك</Text>
        {orders.filter(o => o.courier_id === session.user.id).map(o => card(
          <>
            <Text style={{ textAlign: 'right', fontWeight: '700' }}>طلب {o.id.slice(0, 8)} — {o.neighborhood}</Text>
            <Text style={{ textAlign: 'right' }}>العميل: {o.customer_name} — {o.customer_phone}</Text>
            <Text style={{ textAlign: 'right' }}>العنوان: {o.address}</Text>
            <Text style={{ textAlign: 'right' }}>المبلغ: {o.total} ريال</Text>
            <Text style={{ textAlign: 'right' }}>الحالة: {statuses[o.status] || o.status}</Text>
            {button('قيد التجهيز', () => changeStatus(o.id, 'preparing'))}
            {button('جاهز للاستلام', () => changeStatus(o.id, 'ready'))}
            {button('خرج للتوصيل', () => changeStatus(o.id, 'out_for_delivery'))}
            {button('تم التسليم واستلام المبلغ', () => changeStatus(o.id, 'delivered'), true)}
          </>
        ))}
      </>}

      {tab === 'admin' && profile?.role === 'admin' && <>
        <Text style={{ fontSize: 20, fontWeight: '800', textAlign: 'right' }}>لوحة المدير</Text>
        <Text style={{ textAlign: 'right' }}>إضافة منتج</Text>
        {field(newName, setNewName, 'اسم المنتج')}
        {field(newPrice, setNewPrice, 'السعر بالريال')}
        {field(newUnit, setNewUnit, 'وحدة البيع: حبة أو كيلو أو نصف كيلو أو كرتون')}
        <Text style={{ textAlign: 'right', fontWeight: '700' }}>القسم</Text>
        {categories.map(c => button((newCategory === c.id ? '✓ ' : '') + c.name, () => setNewCategory(c.id), newCategory === c.id))}
        {button(busy ? 'جارٍ الحفظ...' : 'حفظ المنتج', addProduct, true)}
        <Text style={{ fontSize: 20, fontWeight: '800', textAlign: 'right', marginTop: 16 }}>جميع الطلبات</Text>
        {orders.map(o => card(
          <>
            <Text style={{ textAlign: 'right', fontWeight: '700' }}>طلب {o.id.slice(0, 8)} — {o.neighborhood} — {o.total} ريال</Text>
            <Text style={{ textAlign: 'right' }}>العميل: {o.customer_name} — {o.customer_phone}</Text>
            <Text style={{ textAlign: 'right' }}>العنوان: {o.address}</Text>
            <Text style={{ textAlign: 'right' }}>الحالة: {statuses[o.status] || o.status}</Text>
            {field(courierId, setCourierId, 'معرّف حساب المندوب')}
            {button('إسناد للمندوب', () => assignOrder(o.id))}
            {button('إلغاء الطلب', () => changeStatus(o.id, 'cancelled'))}
          </>
        ))}
      </>}
      {button('تحديث البيانات', async () => { await refreshCatalog(); await refreshAccount(); })}
      {button('تسجيل الخروج', () => supabase.auth.signOut())}
    </ScrollView>
  );
  }

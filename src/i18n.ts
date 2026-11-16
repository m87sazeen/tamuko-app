// UI languages from the Middle East to East Asia.
// Draft translations for the most visible UI strings; anything missing falls back to English.
// Per the design system (§5.4.7) every string needs native-speaker review before launch —
// especially payment, tax and legal copy.
import { getLocales } from 'expo-localization';
import { useApp } from './store';

const KEYS = [
  'sell', 'rail', 'reports', 'items', 'settings', 'newSale', 'charge', 'total', 'subtotal', 'discount',
  'tax', 'cash', 'qr', 'change', 'token', 'receipt', 'print', 'share', 'received', 'preparing',
  'ready', 'collected', 'today', 'sales', 'expenses', 'profit', 'save', 'cancel', 'search', 'language',
] as const;
export type Key = (typeof KEYS)[number] | string;

export type Lang = { code: string; name: string; native: string; rtl?: boolean; region: string; t: string[] };

export const LANGS: Lang[] = [
  { code: 'en', name: 'English', native: 'English', region: 'Global', t: ['Sell', 'Orders', 'Reports', 'Items', 'Settings', 'New sale', 'Charge', 'Total', 'Subtotal', 'Discount', 'Tax', 'Cash', 'QR pay', 'Change', 'Token', 'Receipt', 'Print', 'Share', 'Received', 'Preparing', 'Ready', 'Collected', 'Today', 'Sales', 'Expenses', 'Profit', 'Save', 'Cancel', 'Search', 'Language'] },
  { code: 'ar', name: 'Arabic', native: 'العربية', rtl: true, region: 'Middle East', t: ['بيع', 'الطلبات', 'التقارير', 'المنتجات', 'الإعدادات', 'بيع جديد', 'الدفع', 'الإجمالي', 'المجموع الفرعي', 'خصم', 'ضريبة', 'نقدًا', 'دفع QR', 'الباقي', 'رقم الطلب', 'إيصال', 'طباعة', 'مشاركة', 'مستلم', 'قيد التحضير', 'جاهز', 'تم الاستلام', 'اليوم', 'المبيعات', 'المصروفات', 'الربح', 'حفظ', 'إلغاء', 'بحث', 'اللغة'] },
  { code: 'fa', name: 'Persian', native: 'فارسی', rtl: true, region: 'Middle East', t: ['فروش', 'سفارش‌ها', 'گزارش‌ها', 'کالاها', 'تنظیمات', 'فروش جدید', 'پرداخت', 'جمع کل', 'جمع جزء', 'تخفیف', 'مالیات', 'نقد', 'پرداخت QR', 'باقی‌مانده', 'شماره نوبت', 'رسید', 'چاپ', 'اشتراک', 'دریافت شد', 'در حال آماده‌سازی', 'آماده', 'تحویل شد', 'امروز', 'فروش‌ها', 'هزینه‌ها', 'سود', 'ذخیره', 'لغو', 'جستجو', 'زبان'] },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', region: 'Middle East', t: ['Satış', 'Siparişler', 'Raporlar', 'Ürünler', 'Ayarlar', 'Yeni satış', 'Tahsil et', 'Toplam', 'Ara toplam', 'İndirim', 'Vergi', 'Nakit', 'QR ödeme', 'Para üstü', 'Sıra no', 'Fiş', 'Yazdır', 'Paylaş', 'Alındı', 'Hazırlanıyor', 'Hazır', 'Teslim edildi', 'Bugün', 'Satışlar', 'Giderler', 'Kâr', 'Kaydet', 'İptal', 'Ara', 'Dil'] },
  { code: 'ru', name: 'Russian', native: 'Русский', region: 'Central Asia', t: ['Продажа', 'Заказы', 'Отчёты', 'Товары', 'Настройки', 'Новая продажа', 'Оплатить', 'Итого', 'Подытог', 'Скидка', 'Налог', 'Наличные', 'Оплата QR', 'Сдача', 'Номер', 'Чек', 'Печать', 'Отправить', 'Принят', 'Готовится', 'Готов', 'Выдан', 'Сегодня', 'Продажи', 'Расходы', 'Прибыль', 'Сохранить', 'Отмена', 'Поиск', 'Язык'] },
  { code: 'ur', name: 'Urdu', native: 'اردو', rtl: true, region: 'South Asia', t: ['فروخت', 'آرڈرز', 'رپورٹس', 'اشیاء', 'ترتیبات', 'نئی فروخت', 'ادائیگی', 'کل', 'ذیلی کل', 'رعایت', 'ٹیکس', 'نقد', 'QR ادائیگی', 'بقایا', 'ٹوکن', 'رسید', 'پرنٹ', 'شیئر', 'موصول', 'تیار ہو رہا ہے', 'تیار', 'وصول کر لیا', 'آج', 'فروخت', 'اخراجات', 'منافع', 'محفوظ کریں', 'منسوخ', 'تلاش', 'زبان'] },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', region: 'South Asia', t: ['बेचें', 'ऑर्डर', 'रिपोर्ट', 'आइटम', 'सेटिंग्स', 'नई बिक्री', 'भुगतान लें', 'कुल', 'उप-योग', 'छूट', 'कर', 'नकद', 'QR भुगतान', 'बाकी', 'टोकन', 'रसीद', 'प्रिंट', 'शेयर', 'प्राप्त', 'तैयार हो रहा है', 'तैयार', 'ले लिया', 'आज', 'बिक्री', 'खर्च', 'मुनाफ़ा', 'सहेजें', 'रद्द करें', 'खोजें', 'भाषा'] },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', region: 'South Asia', t: ['বিক্রি', 'অর্ডার', 'রিপোর্ট', 'পণ্য', 'সেটিংস', 'নতুন বিক্রি', 'টাকা নিন', 'মোট', 'উপমোট', 'ছাড়', 'কর', 'নগদ', 'QR পেমেন্ট', 'ফেরত', 'টোকেন', 'রসিদ', 'প্রিন্ট', 'শেয়ার', 'গৃহীত', 'তৈরি হচ্ছে', 'প্রস্তুত', 'নেওয়া হয়েছে', 'আজ', 'বিক্রি', 'খরচ', 'লাভ', 'সংরক্ষণ', 'বাতিল', 'খুঁজুন', 'ভাষা'] },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', region: 'South Asia', t: ['விற்பனை', 'ஆர்டர்கள்', 'அறிக்கைகள்', 'பொருட்கள்', 'அமைப்புகள்', 'புதிய விற்பனை', 'பணம் பெறு', 'மொத்தம்', 'துணை மொத்தம்', 'தள்ளுபடி', 'வரி', 'ரொக்கம்', 'QR கட்டணம்', 'மீதி', 'டோக்கன்', 'ரசீது', 'அச்சிடு', 'பகிர்', 'பெறப்பட்டது', 'தயாராகிறது', 'தயார்', 'பெற்றுக்கொண்டார்', 'இன்று', 'விற்பனை', 'செலவுகள்', 'லாபம்', 'சேமி', 'ரத்து', 'தேடு', 'மொழி'] },
  { code: 'si', name: 'Sinhala', native: 'සිංහල', region: 'South Asia', t: ['විකුණන්න', 'ඇණවුම්', 'වාර්තා', 'භාණ්ඩ', 'සැකසුම්', 'නව විකිණීම', 'ගෙවීම', 'එකතුව', 'උප එකතුව', 'වට්ටම', 'බද්ද', 'මුදල්', 'QR ගෙවීම', 'ඉතිරි', 'ටෝකනය', 'රිසිට්පත', 'මුද්‍රණය', 'බෙදාගන්න', 'ලැබුණි', 'සූදානම් වෙමින්', 'සූදානම්', 'ලබාගත්තා', 'අද', 'විකුණුම්', 'වියදම්', 'ලාභය', 'සුරකින්න', 'අවලංගු', 'සොයන්න', 'භාෂාව'] },
  { code: 'ne', name: 'Nepali', native: 'नेपाली', region: 'South Asia', t: ['बिक्री', 'अर्डर', 'रिपोर्ट', 'सामान', 'सेटिङ', 'नयाँ बिक्री', 'भुक्तानी', 'जम्मा', 'उप-जम्मा', 'छुट', 'कर', 'नगद', 'QR भुक्तानी', 'फिर्ता', 'टोकन', 'रसिद', 'प्रिन्ट', 'सेयर', 'प्राप्त', 'तयार हुँदै', 'तयार', 'लगियो', 'आज', 'बिक्री', 'खर्च', 'नाफा', 'सुरक्षित', 'रद्द', 'खोज्नुहोस्', 'भाषा'] },
  { code: 'th', name: 'Thai', native: 'ไทย', region: 'Southeast Asia', t: ['ขาย', 'ออเดอร์', 'รายงาน', 'สินค้า', 'ตั้งค่า', 'ขายใหม่', 'เก็บเงิน', 'ยอดรวม', 'ยอดก่อนภาษี', 'ส่วนลด', 'ภาษี', 'เงินสด', 'จ่าย QR', 'เงินทอน', 'คิว', 'ใบเสร็จ', 'พิมพ์', 'แชร์', 'รับออเดอร์', 'กำลังทำ', 'พร้อม', 'ลูกค้ารับแล้ว', 'วันนี้', 'ยอดขาย', 'ค่าใช้จ่าย', 'กำไร', 'บันทึก', 'ยกเลิก', 'ค้นหา', 'ภาษา'] },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', region: 'Southeast Asia', t: ['Bán', 'Đơn hàng', 'Báo cáo', 'Sản phẩm', 'Cài đặt', 'Đơn mới', 'Thu tiền', 'Tổng cộng', 'Tạm tính', 'Giảm giá', 'Thuế', 'Tiền mặt', 'Trả QR', 'Tiền thối', 'Số thứ tự', 'Hóa đơn', 'In', 'Chia sẻ', 'Đã nhận', 'Đang làm', 'Sẵn sàng', 'Đã lấy', 'Hôm nay', 'Doanh thu', 'Chi phí', 'Lợi nhuận', 'Lưu', 'Hủy', 'Tìm kiếm', 'Ngôn ngữ'] },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', region: 'Southeast Asia', t: ['Jual', 'Pesanan', 'Laporan', 'Produk', 'Pengaturan', 'Penjualan baru', 'Tagih', 'Total', 'Subtotal', 'Diskon', 'Pajak', 'Tunai', 'Bayar QR', 'Kembalian', 'Nomor antre', 'Struk', 'Cetak', 'Bagikan', 'Diterima', 'Disiapkan', 'Siap', 'Diambil', 'Hari ini', 'Penjualan', 'Pengeluaran', 'Laba', 'Simpan', 'Batal', 'Cari', 'Bahasa'] },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu', region: 'Southeast Asia', t: ['Jual', 'Pesanan', 'Laporan', 'Item', 'Tetapan', 'Jualan baharu', 'Caj', 'Jumlah', 'Subjumlah', 'Diskaun', 'Cukai', 'Tunai', 'Bayar QR', 'Baki', 'Nombor giliran', 'Resit', 'Cetak', 'Kongsi', 'Diterima', 'Sedang disediakan', 'Sedia', 'Diambil', 'Hari ini', 'Jualan', 'Perbelanjaan', 'Untung', 'Simpan', 'Batal', 'Cari', 'Bahasa'] },
  { code: 'fil', name: 'Filipino', native: 'Filipino', region: 'Southeast Asia', t: ['Benta', 'Mga order', 'Ulat', 'Mga item', 'Settings', 'Bagong benta', 'Singilin', 'Kabuuan', 'Subtotal', 'Diskwento', 'Buwis', 'Cash', 'QR bayad', 'Sukli', 'Numero', 'Resibo', 'I-print', 'Ibahagi', 'Natanggap', 'Inihahanda', 'Handa na', 'Nakuha na', 'Ngayon', 'Benta', 'Gastos', 'Kita', 'I-save', 'Kanselahin', 'Hanapin', 'Wika'] },
  { code: 'km', name: 'Khmer', native: 'ខ្មែរ', region: 'Southeast Asia', t: ['លក់', 'ការកម្មង់', 'របាយការណ៍', 'ទំនិញ', 'ការកំណត់', 'ការលក់ថ្មី', 'គិតលុយ', 'សរុប', 'សរុបរង', 'បញ្ចុះតម្លៃ', 'ពន្ធ', 'សាច់ប្រាក់', 'បង់ QR', 'លុយអាប់', 'លេខរង់ចាំ', 'វិក្កយបត្រ', 'បោះពុម្ព', 'ចែករំលែក', 'បានទទួល', 'កំពុងរៀបចំ', 'រួចរាល់', 'បានយក', 'ថ្ងៃនេះ', 'ការលក់', 'ចំណាយ', 'ប្រាក់ចំណេញ', 'រក្សាទុក', 'បោះបង់', 'ស្វែងរក', 'ភាសា'] },
  { code: 'lo', name: 'Lao', native: 'ລາວ', region: 'Southeast Asia', t: ['ຂາຍ', 'ອໍເດີ', 'ລາຍງານ', 'ສິນຄ້າ', 'ຕັ້ງຄ່າ', 'ຂາຍໃໝ່', 'ເກັບເງິນ', 'ລວມ', 'ລວມຍ່ອຍ', 'ສ່ວນຫຼຸດ', 'ອາກອນ', 'ເງິນສົດ', 'ຈ່າຍ QR', 'ເງິນທອນ', 'ຄິວ', 'ໃບບິນ', 'ພິມ', 'ແບ່ງປັນ', 'ໄດ້ຮັບແລ້ວ', 'ກຳລັງກະກຽມ', 'ພ້ອມແລ້ວ', 'ຮັບແລ້ວ', 'ມື້ນີ້', 'ຍອດຂາຍ', 'ລາຍຈ່າຍ', 'ກຳໄລ', 'ບັນທຶກ', 'ຍົກເລີກ', 'ຄົ້ນຫາ', 'ພາສາ'] },
  { code: 'my', name: 'Burmese', native: 'မြန်မာ', region: 'Southeast Asia', t: ['ရောင်း', 'အော်ဒါများ', 'အစီရင်ခံစာ', 'ပစ္စည်းများ', 'ဆက်တင်', 'အရောင်းအသစ်', 'ငွေရှင်း', 'စုစုပေါင်း', 'စုစုပေါင်းခွဲ', 'လျှော့စျေး', 'အခွန်', 'ငွေသား', 'QR ဖြင့်ပေး', 'ပြန်အမ်းငွေ', 'နံပါတ်', 'ပြေစာ', 'ပရင့်', 'မျှဝေ', 'လက်ခံပြီး', 'ပြင်ဆင်နေသည်', 'အသင့်', 'ယူပြီး', 'ယနေ့', 'အရောင်း', 'အသုံးစရိတ်', 'အမြတ်', 'သိမ်း', 'ပယ်ဖျက်', 'ရှာ', 'ဘာသာစကား'] },
  { code: 'zh', name: 'Chinese (Simplified)', native: '简体中文', region: 'East Asia', t: ['收银', '订单', '报表', '商品', '设置', '新订单', '收款', '合计', '小计', '折扣', '税', '现金', '扫码支付', '找零', '取餐号', '小票', '打印', '分享', '已接单', '制作中', '已完成', '已取走', '今天', '销售额', '支出', '利润', '保存', '取消', '搜索', '语言'] },
  { code: 'zh-Hant', name: 'Chinese (Traditional)', native: '繁體中文', region: 'East Asia', t: ['收銀', '訂單', '報表', '商品', '設定', '新訂單', '收款', '合計', '小計', '折扣', '稅', '現金', '掃碼支付', '找零', '取餐號', '收據', '列印', '分享', '已接單', '製作中', '已完成', '已取走', '今天', '銷售額', '支出', '利潤', '儲存', '取消', '搜尋', '語言'] },
  { code: 'ja', name: 'Japanese', native: '日本語', region: 'East Asia', t: ['販売', '注文', 'レポート', '商品', '設定', '新規販売', 'お会計', '合計', '小計', '割引', '税', '現金', 'QR決済', 'お釣り', '番号', 'レシート', '印刷', '共有', '受付済み', '準備中', '完成', '受け取り済み', '今日', '売上', '経費', '利益', '保存', 'キャンセル', '検索', '言語'] },
  { code: 'ko', name: 'Korean', native: '한국어', region: 'East Asia', t: ['판매', '주문', '리포트', '상품', '설정', '새 판매', '결제', '합계', '소계', '할인', '세금', '현금', 'QR 결제', '거스름돈', '번호', '영수증', '인쇄', '공유', '접수됨', '준비 중', '준비 완료', '수령 완료', '오늘', '매출', '지출', '이익', '저장', '취소', '검색', '언어'] },
];

const byCode = new Map(LANGS.map((l) => [l.code, l]));

export function deviceLang(): string {
  const loc = getLocales()[0];
  const tag = loc?.languageTag ?? 'en';
  if (/^zh-(Hant|TW|HK|MO)/.test(tag)) return 'zh-Hant';
  const code = loc?.languageCode ?? 'en';
  return byCode.has(code) ? code : 'en';
}

export const langOf = (code: string) => byCode.get(code) ?? byCode.get('en')!;

const DEFAULT_STAGES = ['Received', 'Preparing', 'Ready', 'Collected'];
const STAGE_KEYS = ['received', 'preparing', 'ready', 'collected'];

export function useT() {
  const code = useApp((s) => s.settings.language) || deviceLang();
  const lang = langOf(code);
  const en = byCode.get('en')!;
  const t = (k: Key, fallback?: string) => {
    const i = (KEYS as readonly string[]).indexOf(k);
    if (i < 0) return fallback ?? k;
    return lang.t[i] || en.t[i];
  };
  /** Translate a step name when it is one of the built-in ones; custom names show as typed. */
  const stage = (label: string) => {
    const i = DEFAULT_STAGES.indexOf(label);
    return i >= 0 ? t(STAGE_KEYS[i]) : label;
  };
  return { t, stage, lang, rtl: !!lang.rtl };
}

// Business catalogue — every business type on the tamuko website (4 groups, 31 types, plus the
// names people use locally). Each type decides, at onboarding:
//   • which workflow template and steps orders move through (e.g. laundry: Received → Washing → Ironing → Ready …)
//   • which tools are switched on (tables, options, recipes, stock, rewards, bookings, job details, weight, barcodes)
//   • a starter menu / price list, scaled to the local currency
// Owners can change all of it later in Manage.
import type { IconName } from './brand/Icon';
import type { Step, Template } from './workflow';

export type Features = {
  tables: boolean; // dine-in tables
  modifiers: boolean; // item options: size, sugar, add-ons
  recipes: boolean; // ingredients & recipes, food cost
  stock: boolean; // count stock per item, low-stock alerts
  rewards: boolean; // stamp card & customers
  bookings: boolean; // appointments, classes, walk-in queue
  jobs: boolean; // job details on orders: customer, notes (plate, IMEI, measurements), due date, ready message
  weight: boolean; // sell by kg / g / metre / litre
  barcode: boolean; // scan barcodes at the till
};

export const NO_FEATURES: Features = { tables: false, modifiers: false, recipes: false, stock: false, rewards: false, bookings: false, jobs: false, weight: false, barcode: false };
export const ALL_FEATURES: Features = { tables: true, modifiers: true, recipes: true, stock: true, rewards: true, bookings: true, jobs: true, weight: true, barcode: true };

export const FEATURE_INFO: Record<keyof Features, { label: string; hint: string; icon: IconName }> = {
  tables: { label: 'Tables', hint: 'Dine-in orders by table, one bill per table.', icon: 'table' },
  modifiers: { label: 'Item options', hint: 'Size, sugar, add-ons with extra prices.', icon: 'list' },
  recipes: { label: 'Recipes & food cost', hint: 'Ingredients deduct as you sell; real margin per item.', icon: 'box' },
  stock: { label: 'Stock counts', hint: 'Count down as you sell; low-stock warnings.', icon: 'box' },
  rewards: { label: 'Customers & rewards', hint: '“Buy 10, get 1 free” stamp cards.', icon: 'star' },
  bookings: { label: 'Bookings & queue', hint: 'Appointments, classes and walk-ins.', icon: 'clock' },
  jobs: { label: 'Job details', hint: 'Customer, notes, due date and a ready message on every job.', icon: 'receipt' },
  weight: { label: 'Sell by weight', hint: 'Price per kg, g, metre or litre.', icon: 'cash' },
  barcode: { label: 'Barcode scanning', hint: 'Scan products with the camera.', icon: 'search' },
};

export type Unit = 'each' | 'kg' | 'g' | 'm' | 'L';
export type Sample = { name: string; price: number; unit?: Unit; options?: { name: string; multi?: boolean; choices: string } }; // price in AED, scaled per currency

export type CategoryId = 'food' | 'retail' | 'services' | 'active';
export const CATEGORIES: { id: CategoryId; label: string; icon: IconName }[] = [
  { id: 'food', label: 'Food & drink', icon: 'flame' },
  { id: 'retail', label: 'Shops', icon: 'bag' },
  { id: 'services', label: 'Services', icon: 'settings' },
  { id: 'active', label: 'Fitness & activities', icon: 'users' },
];

export type BizType = {
  id: string;
  label: string;
  hint: string;
  category: CategoryId;
  template: Template; // workflow presets and serving modes
  steps?: string[]; // custom job/order steps (take away mode): first = order, last = done, 'Paid' = payment step
  rail: boolean;
  features: Partial<Features>;
  samples: Sample[];
  permit?: boolean; // usually needs a local permit or licence
  doneWord?: string;
};

const F = (f: Partial<Features>) => f;

export const BUSINESS_TYPES: BizType[] = [
  // ---------- Food & drink ----------
  { id: 'street', label: 'Street food stall', hint: 'Cash and QR in seconds, token on screen.', category: 'food', template: 'stall', rail: true, permit: true, features: F({ rewards: true }), samples: [{ name: 'Karak chai', price: 1 }, { name: 'Samosa', price: 1.5 }, { name: 'Egg paratha', price: 5 }] },
  { id: 'truck', label: 'Food truck', hint: 'Favourites menu, pre-orders and pickup.', category: 'food', template: 'stall', rail: true, permit: true, features: F({ modifiers: true, rewards: true }), samples: [{ name: 'Smash burger', price: 18, options: { name: 'Extras', multi: true, choices: 'Cheese +2, Jalapeños +1' } }, { name: 'Fries', price: 8 }, { name: 'Soft drink', price: 4 }] },
  { id: 'kiosk', label: 'Kiosk / cafeteria', hint: 'Fast counter mode, tokens and stamps.', category: 'food', template: 'stall', rail: true, features: F({ rewards: true, stock: true }), samples: [{ name: 'Karak chai', price: 1 }, { name: 'Chips sandwich', price: 4 }, { name: 'Fresh orange juice', price: 7 }] },
  { id: 'cafe', label: 'Café / coffee shop', hint: 'Options like size and milk, bar rail, stamp card.', category: 'food', template: 'cafe', rail: true, features: F({ modifiers: true, rewards: true, tables: true, recipes: true }), samples: [{ name: 'Flat white', price: 14, options: { name: 'Milk', choices: 'Full fat, Oat +2, Almond +2' } }, { name: 'Iced latte', price: 16, options: { name: 'Size', choices: 'Regular, Large +3' } }, { name: 'Croissant', price: 9 }] },
  { id: 'juice', label: 'Juice & smoothie bar', hint: 'Sizes and add-ons, combos, stamp card.', category: 'food', template: 'stall', rail: true, features: F({ modifiers: true, rewards: true, recipes: true }), samples: [{ name: 'Mango juice', price: 10, options: { name: 'Size', choices: 'Small, Large +4' } }, { name: 'Avocado shake', price: 15, options: { name: 'Sugar', choices: 'Normal, Less, None' } }, { name: 'Fruit cocktail', price: 14 }] },
  { id: 'bakery', label: 'Bakery & sweets', hint: 'Recipes deduct ingredients, pre-orders for cakes.', category: 'food', template: 'stall', rail: true, features: F({ recipes: true, stock: true, jobs: true }), samples: [{ name: 'Croissant', price: 6 }, { name: 'Sourdough loaf', price: 18 }, { name: 'Birthday cake (1 kg)', price: 120 }] },
  { id: 'restaurant', label: 'Restaurant', hint: 'Tables, kitchen rail, split bills, bill at the end.', category: 'food', template: 'restaurant', rail: true, features: F({ tables: true, modifiers: true, recipes: true, rewards: true }), samples: [{ name: 'Chicken biryani', price: 28, options: { name: 'Spice', choices: 'Mild, Medium, Hot' } }, { name: 'Mixed grill', price: 45 }, { name: 'Fresh lime', price: 8 }] },
  { id: 'cloud', label: 'Cloud kitchen / delivery', hint: 'One rail for counter, phone and delivery orders.', category: 'food', template: 'cafe', rail: true, features: F({ recipes: true, modifiers: true, jobs: true }), samples: [{ name: 'Shawarma box', price: 22 }, { name: 'Loaded fries', price: 16 }, { name: 'Delivery fee', price: 5 }] },
  { id: 'catering', label: 'Catering & tiffin', hint: 'Orders for a date, deposits, recipes.', category: 'food', template: 'service', steps: ['Order', 'Confirmed', 'Preparing', 'Ready', 'Paid', 'Delivered'], rail: true, features: F({ jobs: true, recipes: true }), samples: [{ name: 'Lunch tiffin', price: 18 }, { name: 'Party tray (10 people)', price: 250 }] },
  // ---------- Shops ----------
  { id: 'grocery', label: 'Grocery / minimart', hint: 'Barcode scan, sell by weight, low-stock alerts.', category: 'retail', template: 'retail', rail: false, features: F({ barcode: true, weight: true, stock: true }), samples: [{ name: 'Water 500 ml', price: 1 }, { name: 'Basmati rice 5 kg', price: 35 }, { name: 'Tomatoes', price: 6, unit: 'kg' }] },
  { id: 'produce', label: 'Fruit & vegetable stall', hint: 'Price by kg, change prices daily.', category: 'retail', template: 'retail', rail: false, permit: true, features: F({ weight: true }), samples: [{ name: 'Tomatoes', price: 6, unit: 'kg' }, { name: 'Bananas', price: 7, unit: 'kg' }, { name: 'Onions', price: 4, unit: 'kg' }] },
  { id: 'fashion', label: 'Fashion & clothing', hint: 'Sizes and colours, exchanges, markdowns.', category: 'retail', template: 'retail', rail: false, features: F({ modifiers: true, stock: true, barcode: true, rewards: true }), samples: [{ name: 'T-shirt', price: 49, options: { name: 'Size', choices: 'S, M, L, XL' } }, { name: 'Abaya', price: 250 }, { name: 'Scarf', price: 35 }] },
  { id: 'electronics', label: 'Mobile & electronics', hint: 'Serial / IMEI on the receipt, warranty, trade-ins.', category: 'retail', template: 'retail', rail: false, features: F({ stock: true, barcode: true, jobs: true }), samples: [{ name: 'Phone charger', price: 35 }, { name: 'Screen protector', price: 25 }, { name: 'Recharge card', price: 20 }] },
  { id: 'beauty', label: 'Beauty & perfume', hint: 'Variants, gift sets, stamp card.', category: 'retail', template: 'retail', rail: false, features: F({ modifiers: true, stock: true, rewards: true }), samples: [{ name: 'Oud perfume 50 ml', price: 150 }, { name: 'Body lotion', price: 30 }, { name: 'Gift set', price: 199 }] },
  { id: 'jewellery', label: 'Jewellery & gold', hint: 'Price by weight, making charges, certificates.', category: 'retail', template: 'retail', rail: false, permit: true, features: F({ weight: true, jobs: true }), samples: [{ name: 'Gold 22K', price: 250, unit: 'g' }, { name: 'Making charge', price: 50 }, { name: 'Silver ring', price: 80 }] },
  { id: 'pharmacy', label: 'Pharmacy', hint: 'Barcode scan, batch and expiry notes, suppliers.', category: 'retail', template: 'retail', rail: false, permit: true, features: F({ barcode: true, stock: true }), samples: [{ name: 'Paracetamol 500 mg', price: 8 }, { name: 'Vitamin C', price: 25 }, { name: 'Face masks (50)', price: 15 }] },
  { id: 'hardware', label: 'Hardware & building', hint: 'Sell by piece, box or metre; trade accounts.', category: 'retail', template: 'retail', rail: false, features: F({ barcode: true, weight: true, stock: true }), samples: [{ name: 'Screws (box)', price: 10 }, { name: 'Electric cable', price: 3, unit: 'm' }, { name: 'Paint 4 L', price: 85 }] },
  { id: 'books', label: 'Books & stationery', hint: 'Barcode scan, pre-orders, back-to-school bundles.', category: 'retail', template: 'retail', rail: false, features: F({ barcode: true, stock: true, rewards: true }), samples: [{ name: 'Notebook', price: 6 }, { name: 'Pen', price: 2 }, { name: 'Novel', price: 45 }] },
  // ---------- Services ----------
  { id: 'laundry', label: 'Laundry & dry cleaning', hint: 'Item intake, wash stages, ready-to-collect messages.', category: 'services', template: 'service', steps: ['Received', 'Washing', 'Ironing', 'Ready', 'Paid', 'Collected'], rail: true, features: F({ jobs: true, weight: true, rewards: true }), samples: [{ name: 'Wash & fold', price: 8, unit: 'kg' }, { name: 'Shirt press', price: 3 }, { name: 'Dry clean suit', price: 35 }] },
  { id: 'salon', label: 'Salon & barber', hint: 'Bookings and walk-in queue, client notes, packages.', category: 'services', template: 'service', steps: ['Checked in', 'In the chair', 'Paid', 'Done'], rail: true, features: F({ bookings: true, rewards: true, jobs: true }), samples: [{ name: 'Haircut', price: 40 }, { name: 'Beard trim', price: 20 }, { name: 'Hair colour', price: 120 }] },
  { id: 'repair', label: 'Phone & device repair', hint: 'Job cards from intake to handover, quotes, parts.', category: 'services', template: 'service', steps: ['Received', 'Diagnosing', 'Repairing', 'Ready', 'Paid', 'Collected'], rail: true, features: F({ jobs: true, stock: true }), samples: [{ name: 'Screen repair', price: 150 }, { name: 'Battery replacement', price: 90 }, { name: 'Diagnosis', price: 20 }] },
  { id: 'tailoring', label: 'Tailoring & alterations', hint: 'Measurements, fittings, deposits, ready message.', category: 'services', template: 'service', steps: ['Received', 'Cutting', 'Stitching', 'Fitting', 'Ready', 'Paid', 'Collected'], rail: true, features: F({ jobs: true, bookings: true }), samples: [{ name: 'Shirt stitching', price: 60 }, { name: 'Alteration', price: 25 }, { name: 'Abaya stitching', price: 180 }] },
  { id: 'carwash', label: 'Car wash', hint: 'Queue by plate number, wash packages, wash card.', category: 'services', template: 'service', steps: ['Waiting', 'Washing', 'Drying', 'Ready', 'Paid', 'Collected'], rail: true, features: F({ jobs: true, rewards: true }), samples: [{ name: 'Exterior wash', price: 25 }, { name: 'Full wash', price: 45 }, { name: 'Polish', price: 120 }] },
  { id: 'garage', label: 'Garage & auto repair', hint: 'Job cards by plate, quotes, parts used.', category: 'services', template: 'service', steps: ['Received', 'Inspecting', 'Repairing', 'Ready', 'Paid', 'Collected'], rail: true, permit: true, features: F({ jobs: true, stock: true }), samples: [{ name: 'Oil change', price: 120 }, { name: 'Brake pads', price: 250 }, { name: 'Inspection', price: 50 }] },
  { id: 'pet', label: 'Pet grooming', hint: 'Bookings, pet notes, packages, ready message.', category: 'services', template: 'service', steps: ['Checked in', 'Grooming', 'Ready', 'Paid', 'Collected'], rail: true, features: F({ bookings: true, jobs: true, rewards: true }), samples: [{ name: 'Bath & brush', price: 80 }, { name: 'Full groom', price: 150 }, { name: 'Nail trim', price: 30 }] },
  { id: 'printing', label: 'Printing & copy shop', hint: 'Job cards, daily prices, ready message.', category: 'services', template: 'service', steps: ['Received', 'Printing', 'Ready', 'Paid', 'Collected'], rail: true, features: F({ jobs: true }), samples: [{ name: 'A4 print (b/w)', price: 0.5 }, { name: 'A4 print (colour)', price: 2 }, { name: 'Business cards (100)', price: 60 }] },
  { id: 'cleaning', label: 'Cleaning services', hint: 'Bookings by address, team schedules, packages.', category: 'services', template: 'service', steps: ['Booked', 'On the way', 'Cleaning', 'Done', 'Paid', 'Closed'], rail: true, features: F({ bookings: true, jobs: true }), samples: [{ name: 'Home cleaning (hour)', price: 35 }, { name: 'Deep clean', price: 350 }, { name: 'Sofa cleaning', price: 120 }] },
  // ---------- Fitness & activities ----------
  { id: 'gym', label: 'Gym', hint: 'Memberships, check-in at the door, payment links.', category: 'active', template: 'retail', rail: false, features: F({ bookings: true, rewards: true }), samples: [{ name: 'Day pass', price: 50 }, { name: 'Monthly membership', price: 300 }, { name: 'Personal training session', price: 150 }] },
  { id: 'studio', label: 'Yoga & fitness studio', hint: 'Class timetable, class packs, members.', category: 'active', template: 'retail', rail: false, features: F({ bookings: true, rewards: true }), samples: [{ name: 'Drop-in class', price: 60 }, { name: '10-class pack', price: 500 }, { name: 'Mat rental', price: 10 }] },
  { id: 'tutoring', label: 'Tutoring & classes', hint: 'Lessons, members, check-in, invoices.', category: 'active', template: 'retail', rail: false, permit: true, features: F({ bookings: true, jobs: true }), samples: [{ name: 'Lesson (1 hour)', price: 100 }, { name: 'Monthly package (8 lessons)', price: 700 }] },
  { id: 'play', label: 'Kids play area', hint: 'Timed entry, party bookings, stamp card.', category: 'active', template: 'service', steps: ['Checked in', 'Playing', 'Paid', 'Done'], rail: true, permit: true, features: F({ bookings: true, rewards: true, jobs: true }), samples: [{ name: 'One hour pass', price: 40 }, { name: 'Party package', price: 900 }, { name: 'Socks', price: 8 }] },
];

export const typeById = (id: string) => BUSINESS_TYPES.find((t) => t.id === id);

/** Names people use locally, mapped to a base type (from the website). */
export const LOCAL_NAMES: Record<string, [string, string][]> = {
  AE: [['Cafeteria', 'kiosk'], ['Karak truck', 'truck'], ['Perfume & oud shop', 'beauty'], ['Gold souk shop', 'jewellery'], ['Abaya tailoring', 'tailoring']],
  SA: [['Cafeteria', 'kiosk'], ['Perfume & oud shop', 'beauty'], ['Gold souk shop', 'jewellery']],
  QA: [['Cafeteria', 'kiosk'], ['Karak truck', 'truck']], KW: [['Cafeteria', 'kiosk']], BH: [['Cafeteria', 'kiosk']], OM: [['Cafeteria', 'kiosk'], ['Halwa shop', 'bakery']],
  IN: [['Kirana store', 'grocery'], ['Chai & chaat stall', 'street'], ['Tiffin service', 'catering'], ['Mobile recharge shop', 'electronics'], ['Sweet shop (mithai)', 'bakery']],
  PK: [['Kiryana store', 'grocery'], ['Dhaba', 'restaurant'], ['Chai dhaba', 'street']],
  BD: [['Tong tea stall', 'street'], ['Mudi dokan', 'grocery']],
  LK: [['Boutique kade', 'grocery'], ['Kottu stall', 'street'], ['Short-eats bakery', 'bakery']],
  NP: [['Momo stall', 'street'], ['Kirana pasal', 'grocery'], ['Bhatti (tea house)', 'cafe']],
  ID: [['Warung', 'restaurant'], ['Kaki lima cart', 'street'], ['Toko kelontong', 'grocery']],
  MY: [['Mamak stall', 'restaurant'], ['Hawker stall', 'street'], ['Kedai runcit', 'grocery']],
  SG: [['Hawker stall', 'street'], ['Kopitiam', 'cafe'], ['Provision shop', 'grocery']],
  PH: [['Sari-sari store', 'grocery'], ['Carinderia', 'restaurant'], ['Ihaw-ihaw stall', 'street']],
  TH: [['Street food cart', 'street'], ['Shophouse café', 'cafe'], ['Night-market stall', 'produce']],
  VN: [['Bánh mì cart', 'street'], ['Cơm tấm shop', 'restaurant'], ['Cà phê stall', 'cafe']],
  KH: [['Num pang cart', 'street'], ['Market stall', 'produce']],
};

// Rough AED → local price scale so starter prices look sensible (owners edit them anyway).
const SCALE: Record<string, number> = {
  AED: 1, SAR: 1, QAR: 1, KWD: 0.083, BHD: 0.1, OMR: 0.1, JOD: 0.19, EGP: 13, TRY: 9, KZT: 140, UZS: 3400, PKR: 75, INR: 22, BDT: 30, LKR: 80, NPR: 36, MVR: 4.2,
  THB: 9.5, VND: 6800, IDR: 4300, MYR: 1.25, SGD: 0.37, PHP: 15.5, KHR: 1100, LAK: 5900, MMK: 570, CNY: 2, HKD: 2.1, TWD: 8.8, JPY: 41, KRW: 370, MNT: 930, USD: 0.27,
};

/** Starter price in the local currency, rounded to a price people would actually charge. */
export function localPrice(aed: number, currency: string): number {
  const v = aed * (SCALE[currency] ?? 1);
  if (v >= 10000) return Math.round(v / 1000) * 1000;
  if (v >= 1000) return Math.round(v / 100) * 100;
  if (v >= 100) return Math.round(v / 5) * 5;
  if (v >= 10) return Math.round(v);
  if (v >= 1) return Math.round(v * 2) / 2;
  return Math.max(0.05, Math.round(v * 20) / 20);
}

/** Full feature set for a type (anything not listed is off). */
export const featuresFor = (t: BizType): Features => ({ ...NO_FEATURES, ...t.features });

/** Turn a type's step names into a workflow: first = order, last = done, "Paid" = payment step. */
export function stepsFor(t: BizType): Step[] | null {
  if (!t.steps) return null;
  return t.steps.map((name, i) => ({ name, kind: i === 0 ? 'order' : i === t.steps!.length - 1 ? 'done' : name === 'Paid' ? 'pay' : 'work' }));
}

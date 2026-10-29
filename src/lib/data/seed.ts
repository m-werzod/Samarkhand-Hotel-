import manifest from '@/lib/media-manifest.json';
import type {
  Amenity,
  Campaign,
  HotelSettings,
  MediaAsset,
  MediaCategory,
  Offer,
  Room,
  SiteContent,
  Testimonial,
} from '@/lib/domain/types';

/**
 * Seed data for a fresh installation.
 *
 * Everything here is demonstration content. Prices, the address, the phone
 * number and the testimonials are placeholders, and every record that holds
 * one carries `isDemoData` / `isSample` so the UI can mark it. An operator
 * clears those flags from the admin settings once the real details are in.
 *
 * The phone numbers use Uzbekistan's +998 99 000 … range written with an
 * all-zero subscriber block, so they are unmistakably illustrative and cannot
 * ring a real person.
 */

const now = '2026-01-01T00:00:00.000Z';

/* -------------------------------------------------------------------------- */
/* Media                                                                       */
/* -------------------------------------------------------------------------- */

interface ManifestEntry {
  path: string;
  type: string;
  kind: string;
  category: string;
  alt: string;
  caption: string;
  bytes: number;
  mimeType: string;
}

/**
 * Media records are derived from the generated manifest so the library can
 * never drift from the files actually on disk.
 */
export const seedMedia: MediaAsset[] = (manifest.media as ManifestEntry[]).map(
  (entry, index) => ({
    id: `media-${entry.path.replace('/media/', '').replace('.svg', '')}`,
    storagePath: entry.path,
    type: entry.type === 'video' ? 'video' : 'image',
    kind: entry.kind === 'photograph' ? 'photograph' : 'illustration',
    category: entry.category as MediaCategory,
    altText: entry.alt,
    caption: entry.caption,
    mimeType: entry.mimeType,
    bytes: entry.bytes,
    width: null,
    height: null,
    createdAt: new Date(Date.parse(now) + index * 1000).toISOString(),
  }),
);

const mediaId = (name: string) => `media-${name}`;

/* -------------------------------------------------------------------------- */
/* Amenities                                                                   */
/* -------------------------------------------------------------------------- */

export const seedAmenities: Amenity[] = [
  {
    id: 'amenity-wifi',
    iconKey: 'wifi',
    name: 'Bepul Wi-Fi',
    description: 'Mehmonxona boʻylab tezkor simsiz internet.',
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'amenity-breakfast',
    iconKey: 'coffee',
    name: 'Nonushta',
    description: 'Har kuni ertalab issiq va sovuq taomlardan iborat nonushta.',
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'amenity-parking',
    iconKey: 'car',
    name: 'Avtoturargoh',
    description: 'Mehmonlar uchun yopiq hovlida bepul parkovka.',
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'amenity-ac',
    iconKey: 'snowflake',
    name: 'Konditsioner',
    description: 'Har bir xonada alohida boshqariladigan iqlim nazorati.',
    isActive: true,
    sortOrder: 4,
  },
  {
    id: 'amenity-transfer',
    iconKey: 'plane',
    name: 'Aeroport transferi',
    description: 'Oldindan kelishilgan holda kutib olish va kuzatib qoʻyish.',
    isActive: true,
    sortOrder: 5,
  },
  {
    id: 'amenity-restaurant',
    iconKey: 'utensils',
    name: 'Restoran',
    description: 'Milliy va yevropa taomlari taqdim etiladigan restoran.',
    isActive: true,
    sortOrder: 6,
  },
  {
    id: 'amenity-laundry',
    iconKey: 'shirt',
    name: 'Kir yuvish xizmati',
    description: 'Kiyimlarni yuvish va dazmollash xizmati.',
    isActive: true,
    sortOrder: 7,
  },
  {
    id: 'amenity-roomservice',
    iconKey: 'bell-ring',
    name: 'Xonaga xizmat',
    description: 'Taom va ichimliklarni bevosita xonangizga yetkazib berish.',
    isActive: true,
    sortOrder: 8,
  },
  {
    id: 'amenity-family',
    iconKey: 'users',
    name: 'Oilaviy xonalar',
    description: 'Bolalar bilan sayohat qiluvchilar uchun kengaytirilgan xonalar.',
    isActive: true,
    sortOrder: 9,
  },
  {
    id: 'amenity-desk',
    iconKey: 'clock',
    name: 'Kechayu kunduz qabulxona',
    description: 'Qabulxona sutkasiga 24 soat ishlaydi.',
    isActive: true,
    sortOrder: 10,
  },
  {
    id: 'amenity-safe',
    iconKey: 'lock',
    name: 'Seyf',
    description: 'Har bir xonada shaxsiy elektron seyf.',
    isActive: true,
    sortOrder: 11,
  },
  {
    id: 'amenity-tv',
    iconKey: 'tv',
    name: 'Smart televizor',
    description: 'Xalqaro kanallar bilan keng ekranli televizor.',
    isActive: true,
    sortOrder: 12,
  },
];

/* -------------------------------------------------------------------------- */
/* Rooms                                                                       */
/* -------------------------------------------------------------------------- */

export const seedRooms: Room[] = [
  {
    id: 'room-standard',
    slug: 'standart-xona',
    name: 'Standart xona',
    shortDescription:
      'Ikki kishiga moʻljallangan, tabiiy yorugʻlikka boy va sokin xona.',
    description:
      'Standart xonalarimiz qisqa safarlar uchun eng qulay tanlov. Ravoqli deraza oldidagi ish stoli, yumshoq toʻshak va yopiq hovliga qaragan sokin manzara kun boʻyi yurgandan soʻng dam olishga imkon beradi. Xona milliy naqshlardan ilhomlangan, ammo ortiqcha bezaksiz sodda uslubda jihozlangan.',
    maxOccupancy: 2,
    maxAdults: 2,
    maxChildren: 1,
    bedConfiguration: '1 ta katta krovat yoki 2 ta alohida krovat',
    sizeSqm: 22,
    basePrice: { amount: 520_000, currency: 'UZS' },
    status: 'published',
    sortOrder: 1,
    inventoryCount: 8,
    cancellationPolicy:
      'Kelish sanasidan 48 soat oldin bepul bekor qilish mumkin.',
    isDemoData: true,
    amenityIds: [
      'amenity-wifi',
      'amenity-breakfast',
      'amenity-ac',
      'amenity-tv',
      'amenity-safe',
      'amenity-desk',
    ],
    mediaIds: [mediaId('room-standard'), mediaId('bathroom'), mediaId('detail-arch')],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'room-deluxe',
    slug: 'deluxe-xona',
    name: 'Deluxe xona',
    shortDescription:
      'Kengaytirilgan maydon, yumshoq kreslo va shaharga qaragan ikki deraza.',
    description:
      'Deluxe xona kengroq maydoni va yumshoq oʻtirgichi bilan ajralib turadi. Ikkita ravoqli deraza kun boʻyi issiq yorugʻlik kiritadi, kechqurun esa mis chiroqlar xonani yumshoq nurga toʻldiradi. Hammomda alohida dush va mehmonxona tomonidan tayyorlangan parvarish vositalari mavjud.',
    maxOccupancy: 3,
    maxAdults: 2,
    maxChildren: 2,
    bedConfiguration: '1 ta king-size krovat',
    sizeSqm: 32,
    basePrice: { amount: 780_000, currency: 'UZS' },
    status: 'published',
    sortOrder: 2,
    inventoryCount: 6,
    cancellationPolicy:
      'Kelish sanasidan 48 soat oldin bepul bekor qilish mumkin.',
    isDemoData: true,
    amenityIds: [
      'amenity-wifi',
      'amenity-breakfast',
      'amenity-ac',
      'amenity-tv',
      'amenity-safe',
      'amenity-roomservice',
      'amenity-laundry',
      'amenity-desk',
    ],
    mediaIds: [
      mediaId('room-deluxe'),
      mediaId('bathroom'),
      mediaId('detail-tilework'),
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'room-suite',
    slug: 'lyuks-xona',
    name: 'Lyuks xona',
    shortDescription:
      'Alohida mehmon burchagi va ish stoli bilan jihozlangan eng keng xona.',
    description:
      'Lyuks xona uzoqroq qolish va oilaviy sayohatlar uchun moʻljallangan. Yotoq qismidan ajratilgan mehmon burchagi, keng ish stoli va mehmonxonaning eng katta hammomi mavjud. Kechki payt shiftdagi mis qandil xonani iliq nurga choʻmdiradi.',
    maxOccupancy: 4,
    maxAdults: 3,
    maxChildren: 2,
    bedConfiguration: '1 ta king-size krovat va 1 ta divan-krovat',
    sizeSqm: 48,
    basePrice: { amount: 1_240_000, currency: 'UZS' },
    status: 'published',
    sortOrder: 3,
    inventoryCount: 3,
    cancellationPolicy:
      'Kelish sanasidan 72 soat oldin bepul bekor qilish mumkin.',
    isDemoData: true,
    amenityIds: [
      'amenity-wifi',
      'amenity-breakfast',
      'amenity-ac',
      'amenity-tv',
      'amenity-safe',
      'amenity-roomservice',
      'amenity-laundry',
      'amenity-family',
      'amenity-transfer',
      'amenity-desk',
    ],
    mediaIds: [
      mediaId('room-suite'),
      mediaId('bathroom'),
      mediaId('lobby-reception'),
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'room-family',
    slug: 'oilaviy-xona',
    name: 'Oilaviy xona',
    shortDescription:
      'Bolalar bilan sayohat qiluvchilar uchun ikki zonali keng xona.',
    description:
      'Oilaviy xona ikki zonaga boʻlingan: kattalar uchun alohida yotoq qismi va bolalar uchun qoʻshimcha krovatlar joylashgan burchak. Xavfsizlik uchun derazalarga qulf oʻrnatilgan, hammomda esa bolalar uchun qoʻshimcha jihozlar mavjud.',
    maxOccupancy: 5,
    maxAdults: 2,
    maxChildren: 3,
    bedConfiguration: '1 ta katta krovat va 2 ta alohida krovat',
    sizeSqm: 42,
    basePrice: { amount: 1_050_000, currency: 'UZS' },
    status: 'published',
    sortOrder: 4,
    inventoryCount: 4,
    cancellationPolicy:
      'Kelish sanasidan 48 soat oldin bepul bekor qilish mumkin.',
    isDemoData: true,
    amenityIds: [
      'amenity-wifi',
      'amenity-breakfast',
      'amenity-ac',
      'amenity-tv',
      'amenity-family',
      'amenity-safe',
      'amenity-parking',
      'amenity-desk',
    ],
    mediaIds: [mediaId('room-deluxe'), mediaId('room-standard'), mediaId('bathroom')],
    createdAt: now,
    updatedAt: now,
  },
];

/* -------------------------------------------------------------------------- */
/* Offers                                                                      */
/* -------------------------------------------------------------------------- */

export const seedOffers: Offer[] = [
  {
    id: 'offer-early-bird',
    name: 'Erta bron chegirmasi',
    description:
      'Kamida uch kecha uchun oldindan bron qilganlarga 15% chegirma.',
    discountType: 'percentage',
    discountValue: 15,
    eligibleRoomIds: [],
    startsAt: null,
    endsAt: null,
    minimumNights: 3,
    conditions:
      'Chegirma faqat toʻgʻridan-toʻgʻri mehmonxona orqali bron qilinganda amal qiladi.',
    status: 'published',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'offer-long-stay',
    name: 'Uzoq qolish',
    description: 'Yetti kecha va undan koʻp qolishda 22% chegirma.',
    discountType: 'percentage',
    discountValue: 22,
    eligibleRoomIds: [],
    startsAt: null,
    endsAt: null,
    minimumNights: 7,
    conditions: 'Boshqa aksiyalar bilan birga qoʻllanilmaydi.',
    status: 'published',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'offer-suite-welcome',
    name: 'Lyuks xona taklifi',
    description: 'Lyuks xonalarda har bir bron uchun 150 000 soʻm chegirma.',
    discountType: 'fixed',
    discountValue: 150_000,
    eligibleRoomIds: ['room-suite'],
    startsAt: null,
    endsAt: null,
    minimumNights: 2,
    conditions: 'Faqat lyuks xonalar uchun.',
    status: 'published',
    createdAt: now,
    updatedAt: now,
  },
];

/* -------------------------------------------------------------------------- */
/* Campaigns                                                                   */
/* -------------------------------------------------------------------------- */

export const seedCampaigns: Campaign[] = [
  {
    id: 'campaign-autumn',
    title: 'Kuzgi Samarqand',
    subtitle:
      'Sentyabrdan noyabrgacha — shaharning eng tiniq havosi va eng sokin kunlari.',
    badge: 'Mavsumiy',
    mediaId: mediaId('campaign-autumn'),
    mobileMediaId: mediaId('campaign-autumn-mobile'),
    ctaLabel: 'Xonalarni koʻrish',
    ctaHref: '/rooms',
    offerId: null,
    roomId: null,
    status: 'published',
    priority: 100,
    startsAt: null,
    endsAt: null,
    textAlign: 'left',
    overlay: 'medium',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'campaign-earlybird',
    title: 'Erta bron qiling, 15% tejang',
    subtitle: 'Uch kecha va undan koʻp qolishda chegirma avtomatik qoʻllanadi.',
    badge: '15% chegirma',
    mediaId: mediaId('campaign-earlybird'),
    mobileMediaId: mediaId('campaign-earlybird-mobile'),
    ctaLabel: 'Takliflarni koʻrish',
    ctaHref: '/offers',
    offerId: 'offer-early-bird',
    roomId: null,
    status: 'published',
    priority: 90,
    startsAt: null,
    endsAt: null,
    textAlign: 'left',
    overlay: 'strong',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'campaign-weekend',
    title: 'Dam olish kunlari',
    subtitle: 'Juma va shanba kechalari uchun lyuks xonada maxsus taklif.',
    badge: 'Lyuks',
    mediaId: mediaId('campaign-weekend'),
    mobileMediaId: mediaId('campaign-weekend-mobile'),
    ctaLabel: 'Lyuks xonani koʻrish',
    ctaHref: '/rooms/lyuks-xona',
    offerId: 'offer-suite-welcome',
    roomId: 'room-suite',
    status: 'published',
    priority: 80,
    startsAt: null,
    endsAt: null,
    textAlign: 'center',
    overlay: 'medium',
    createdAt: now,
    updatedAt: now,
  },
];

/* -------------------------------------------------------------------------- */
/* Settings                                                                    */
/* -------------------------------------------------------------------------- */

export const seedHotelSettings: HotelSettings = {
  id: 'settings',
  brandName: 'Samarkhand Hotel',
  tagline: 'Samarqand mehmondoʻstligi, zamonaviy qulaylik bilan',
  // Illustrative only: +998 99 000 xx xx is written with an all-zero
  // subscriber block so it cannot reach a real subscriber.
  phone: '+998990000000',
  email: 'hello@samarkhand-hotel.example',
  whatsappNumber: '+998990000000',
  address: {
    line1: 'Namuna manzil — tahrirlanishi kerak',
    line2: null,
    city: 'Samarqand',
    region: 'Samarqand viloyati',
    postalCode: null,
    country: 'Oʻzbekiston',
    latitude: null,
    longitude: null,
    mapsUrl: null,
  },
  social: {
    instagram: null,
    telegram: null,
    whatsapp: null,
    facebook: null,
    youtube: null,
  },
  currency: 'UZS',
  timeZone: 'Asia/Samarkand',
  locale: 'uz',
  taxRatePercent: 0,
  serviceFeeMinor: 0,
  checkInTime: '14:00',
  checkOutTime: '12:00',
  seoTitle: 'Samarkhand Hotel — Samarqandda qulay va zamonaviy mehmonxona',
  seoDescription:
    'Samarkhand Hotel — Samarqand markazida joylashgan mehmonxona. Standart, deluxe, lyuks va oilaviy xonalar, nonushta, Wi-Fi va avtoturargoh.',
  isDemoData: true,
  updatedAt: now,
};

export const seedSiteContent: SiteContent = {
  heroHeadline: 'Samarqandda uyingizdek kutib olamiz',
  heroSubheadline:
    'Shahar markazidagi sokin mehmonxona: keng xonalar, iliq nonushta va har bir mehmonni ismi bilan taniydigan jamoa.',
  heroMediaId: mediaId('exterior-dusk'),
  heroVideoUrl: null,
  aboutTitle: 'Mehmondoʻstlik — bizning kasbimiz emas, odatimiz',
  aboutBody:
    'Samarkhand Hotel kichik, ammo eʼtiborli mehmonxona. Biz har bir mehmonga alohida yondashamiz: kelishingizdan oldin xonani tayyorlaymiz, kech kelsangiz nonushtani saqlab qoʻyamiz, shaharni birinchi marta koʻrayotgan boʻlsangiz qayerdan boshlashni maslahat beramiz. Binomiz Samarqand meʼmorchiligidan ilhomlangan — ravoqlar, iliq gʻisht ranglari va sokin hovli.',
  benefits: [
    {
      iconKey: 'heart-handshake',
      title: 'Samimiy xizmat',
      description:
        'Kichik jamoa, shuning uchun har bir soʻrovingiz eʼtibordan chetda qolmaydi.',
    },
    {
      iconKey: 'bed-double',
      title: 'Qulay xonalar',
      description:
        'Sifatli toʻshaklar, sokin derazalar va har kuni tozalanadigan xonalar.',
    },
    {
      iconKey: 'map-pin',
      title: 'Qulay joylashuv',
      description:
        'Shahar markazi va asosiy diqqatga sazovor joylarga yaqin.',
    },
    {
      iconKey: 'message-circle',
      title: 'Aniq muloqot',
      description:
        'Bron holatini oʻz vaqtida xabar qilamiz — noaniqlik qoldirmaymiz.',
    },
  ],
  footerBlurb:
    'Samarkhand Hotel — Samarqand markazidagi oilaviy mehmonxona. Xonalar, takliflar va bron qilish boʻyicha savollaringizga javob berishdan mamnunmiz.',
  privacyPolicy: `## Maxfiylik siyosati

Bu matn namuna sifatida tayyorlangan va huquqiy maslahat emas. Mehmonxona ishga tushirilishidan oldin yurist tomonidan koʻrib chiqilishi shart.

### Qanday maʼlumot yigʻamiz

Bron soʻrovi yuborganingizda ismingiz, email manzilingiz, telefon raqamingiz, tanlangan sanalar va xona turini saqlaymiz. Aloqa formasi orqali yuborilgan xabarlar ham saqlanadi.

### Nima uchun ishlatamiz

Yigʻilgan maʼlumotlar faqat soʻrovingizga javob berish, bronni tasdiqlash va mehmonxona xizmatini koʻrsatish uchun ishlatiladi. Biz maʼlumotlaringizni uchinchi shaxslarga sotmaymiz.

### Qancha saqlaymiz

Bron yozuvlari buxgalteriya talablariga koʻra saqlanadi. Aloqa xabarlari javob berilgandan keyin 24 oy ichida oʻchiriladi.

### Sizning huquqlaringiz

Oʻzingiz haqingizdagi maʼlumotni koʻrish, tuzatish yoki oʻchirishni soʻrashingiz mumkin. Buning uchun mehmonxonaning email manziliga yozing.`,
  bookingTerms: `## Bron shartlari

Bu matn namuna sifatida tayyorlangan va mehmonxona tomonidan tasdiqlanishi kerak.

### Bron soʻrovi

Saytda yuborilgan forma — bu **bron soʻrovi**, avtomatik tasdiqlangan rezervatsiya emas. Mehmonxona soʻrovni koʻrib chiqib, telefon yoki email orqali tasdiqlaydi.

### Toʻlov

Toʻlov mehmonxonada, kelganingizda amalga oshiriladi. Saytda karta maʼlumotlari soʻralmaydi va saqlanmaydi.

### Bekor qilish

Har bir xona turi uchun bekor qilish shartlari xona sahifasida koʻrsatilgan.

### Kelish va chiqish

Kelish soat 14:00 dan, chiqish soat 12:00 gacha. Boshqa vaqt kerak boʻlsa, oldindan xabar bering.

### Narxlar

Saytdagi narxlar taxminiy hisob-kitob boʻlib, yakuniy summa mehmonxona tomonidan tasdiqlanadi.`,
  galleryCategories: [
    { key: 'exterior', label: 'Tashqi koʻrinish' },
    { key: 'lobby', label: 'Lobbi' },
    { key: 'rooms', label: 'Xonalar' },
    { key: 'amenities', label: 'Qulayliklar' },
    { key: 'dining', label: 'Restoran' },
    { key: 'details', label: 'Tafsilotlar' },
  ],
  updatedAt: now,
};

/* -------------------------------------------------------------------------- */
/* Testimonials                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Sample testimonials, clearly flagged.
 *
 * These are written as illustrative examples of the kind of feedback the
 * hotel might receive. They are not real guests, carry no real names, and the
 * UI states that plainly. Replacing them with genuine approved reviews is a
 * launch-checklist item.
 */
export const seedTestimonials: Testimonial[] = [
  {
    id: 'testimonial-1',
    authorLabel: 'Namuna sharh — mehmon A.',
    body: 'Xona sokin va toza edi, nonushta esa kutganimdan ham yaxshi. Qabulxona xodimlari shahar boʻylab yurish uchun yaxshi maslahat berishdi.',
    rating: 5,
    isSample: true,
    isPublished: true,
    sortOrder: 1,
  },
  {
    id: 'testimonial-2',
    authorLabel: 'Namuna sharh — mehmon B.',
    body: 'Oilam bilan uch kecha qoldik. Bolalar uchun qoʻshimcha krovat oldindan tayyorlangan edi — bu juda qulay boʻldi.',
    rating: 5,
    isSample: true,
    isPublished: true,
    sortOrder: 2,
  },
  {
    id: 'testimonial-3',
    authorLabel: 'Namuna sharh — mehmon C.',
    body: 'Joylashuvi qulay, markazga piyoda yetib borish mumkin. Kechqurun hovlida choy ichish yoqimli edi.',
    rating: 4,
    isSample: true,
    isPublished: true,
    sortOrder: 3,
  },
];

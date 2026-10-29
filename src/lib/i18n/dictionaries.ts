import { DEFAULT_LOCALE, type Locale } from '@/lib/domain/types';

/**
 * UI copy, keyed by locale.
 *
 * Uzbek Latin is the shipping language. Russian and English are declared in
 * `LOCALES` and fall back to Uzbek until their dictionaries are written —
 * adding them is a matter of filling in this file and introducing a
 * `/[locale]` segment, not of touching any component.
 *
 * Components read strings from here rather than inlining them, which is what
 * makes that true. Long-form marketing copy lives in the database instead, so
 * the hotel can edit it without a deploy.
 */

export interface Dictionary {
  nav: {
    rooms: string;
    amenities: string;
    gallery: string;
    offers: string;
    location: string;
    contact: string;
    book: string;
    menu: string;
    close: string;
    skipToContent: string;
  };
  common: {
    from: string;
    perNight: string;
    night: string;
    nights: string;
    guests: string;
    adults: string;
    children: string;
    rooms: string;
    viewDetails: string;
    bookNow: string;
    loading: string;
    retry: string;
    somethingWentWrong: string;
    demoNotice: string;
    illustrationNotice: string;
    required: string;
    optional: string;
  };
  search: {
    title: string;
    checkIn: string;
    checkOut: string;
    submit: string;
    summary: string;
    editSearch: string;
  };
  booking: {
    inquiryTitle: string;
    inquiryIntro: string;
    fullName: string;
    email: string;
    phone: string;
    specialRequests: string;
    acceptTerms: string;
    submit: string;
    submitting: string;
    successTitle: string;
    successBody: string;
    referenceLabel: string;
    notConfirmedWarning: string;
    estimateLabel: string;
    estimateNote: string;
  };
  errors: {
    invalid_check_in: string;
    invalid_check_out: string;
    check_in_in_past: string;
    check_out_not_after_check_in: string;
    stay_too_long: string;
    too_far_ahead: string;
    adults_too_few: string;
    adults_too_many: string;
    children_negative: string;
    children_too_many: string;
    rooms_too_few: string;
    rooms_too_many: string;
    more_rooms_than_adults: string;
    room_unavailable: string;
    room_not_bookable: string;
    rate_limited: string;
    generic: string;
  };
}

const uz: Dictionary = {
  nav: {
    rooms: 'Xonalar',
    amenities: 'Qulayliklar',
    gallery: 'Galereya',
    offers: 'Takliflar',
    location: 'Manzil',
    contact: 'Aloqa',
    book: 'Xona bron qilish',
    menu: 'Menyu',
    close: 'Yopish',
    skipToContent: 'Asosiy kontentga oʻtish',
  },
  common: {
    from: 'dan',
    perNight: 'bir kecha uchun',
    night: 'kecha',
    nights: 'kecha',
    guests: 'mehmon',
    adults: 'Kattalar',
    children: 'Bolalar',
    rooms: 'Xonalar',
    viewDetails: 'Batafsil',
    bookNow: 'Bron qilish',
    loading: 'Yuklanmoqda…',
    retry: 'Qayta urinish',
    somethingWentWrong: 'Nimadir notoʻgʻri ketdi.',
    demoNotice:
      'Bu maʼlumot namuna sifatida kiritilgan va mehmonxona tomonidan hali tasdiqlanmagan.',
    illustrationNotice:
      'Tasvir — kontseptual illyustratsiya, haqiqiy fotosurat emas.',
    required: 'majburiy',
    optional: 'ixtiyoriy',
  },
  search: {
    title: 'Xona qidirish',
    checkIn: 'Kelish sanasi',
    checkOut: 'Chiqish sanasi',
    submit: 'Xonalarni koʻrish',
    summary: 'Tanlangan sanalar',
    editSearch: 'Qidiruvni oʻzgartirish',
  },
  booking: {
    inquiryTitle: 'Bron soʻrovi',
    inquiryIntro:
      'Formani toʻldiring — mehmonxona soʻrovingizni koʻrib chiqib, siz bilan bogʻlanadi.',
    fullName: 'Ism familiya',
    email: 'Email',
    phone: 'Telefon',
    specialRequests: 'Qoʻshimcha izoh',
    acceptTerms: 'Bron shartlari bilan tanishdim va roziman',
    submit: 'Soʻrovni yuborish',
    submitting: 'Yuborilmoqda…',
    successTitle: 'Soʻrovingiz qabul qilindi',
    successBody:
      'Mehmonxona siz bilan tez orada bogʻlanadi. Quyidagi raqamni saqlab qoʻying.',
    referenceLabel: 'Soʻrov raqami',
    notConfirmedWarning:
      'Bu — bron soʻrovi, tasdiqlangan rezervatsiya emas. Mehmonxona tasdiqlagandan soʻng bronlash yakunlanadi.',
    estimateLabel: 'Taxminiy narx',
    estimateNote:
      'Yakuniy summa mehmonxona tomonidan tasdiqlanadi. Saytda toʻlov qabul qilinmaydi.',
  },
  errors: {
    invalid_check_in: 'Kelish sanasi notoʻgʻri.',
    invalid_check_out: 'Chiqish sanasi notoʻgʻri.',
    check_in_in_past: 'Kelish sanasi oʻtmishda boʻlishi mumkin emas.',
    check_out_not_after_check_in:
      'Chiqish sanasi kelish sanasidan keyin boʻlishi kerak.',
    stay_too_long: 'Bir martalik bron 30 kechadan oshmasligi kerak.',
    too_far_ahead: 'Bu sana juda uzoq kelajakda.',
    adults_too_few: 'Kamida bitta kattalar boʻlishi kerak.',
    adults_too_many: 'Kattalar soni juda koʻp.',
    children_negative: 'Bolalar soni notoʻgʻri.',
    children_too_many: 'Bolalar soni juda koʻp.',
    rooms_too_few: 'Kamida bitta xona tanlang.',
    rooms_too_many: 'Xonalar soni juda koʻp.',
    more_rooms_than_adults:
      'Har bir xonada kamida bitta kattalar boʻlishi kerak.',
    room_unavailable: 'Tanlangan sanalarda bu xona band.',
    room_not_bookable: 'Bu xona hozircha bron qilish uchun ochiq emas.',
    rate_limited: 'Juda koʻp soʻrov yuborildi. Bir necha daqiqadan soʻng urinib koʻring.',
    generic: 'Soʻrovni yuborib boʻlmadi. Birozdan soʻng qayta urinib koʻring.',
  },
};

const dictionaries: Record<Locale, Dictionary> = {
  uz,
  // Not yet translated — falls back to Uzbek rather than showing keys.
  ru: uz,
  en: uz,
};

export function getDictionary(locale: Locale = DEFAULT_LOCALE): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

/** Uzbek pluralisation for night counts, which the language keeps simple. */
export function formatNights(count: number, dict: Dictionary): string {
  return `${count} ${count === 1 ? dict.common.night : dict.common.nights}`;
}

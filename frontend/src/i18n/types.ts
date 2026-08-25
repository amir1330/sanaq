export type Locale = "ru" | "en" | "kk";
export type LocalePreference = "auto" | Locale;

export type Messages = {
  meta: { title: string; docLang: string };
  common: {
    save: string;
    cancel: string;
    close: string;
    back: string;
    add: string;
    delete: string;
    loading: string;
    error: string;
    yes: string;
    no: string;
  };
  nav: {
    reports: string;
    products: string;
    stock: string;
    revisions: string;
    staff: string;
    expenses: string;
    shifts: string;
    till: string;
    settings: string;
    shops: string;
    users: string;
    leads: string;
    branch: string;
    pointFallback: string;
  };
  account: {
    title: string;
    theme: string;
    themeAuto: string;
    themeAutoNote: string;
    themeLight: string;
    themeLightNote: string;
    themeDark: string;
    themeDarkNote: string;
    language: string;
    languageAuto: string;
    languageAutoNote: string;
    languageRu: string;
    languageEn: string;
    languageKk: string;
    logout: string;
  };
  landing: {
    featuresNav: string;
    cabinet: string;
    signIn: string;
    kicker: string;
    headline: string;
    lead: string;
    ctaRequest: string;
    ctaHow: string;
    featTill: string;
    featTillNote: string;
    featStock: string;
    featStockNote: string;
    featShifts: string;
    featShiftsNote: string;
    featMoney: string;
    featMoneyNote: string;
    requestKicker: string;
    requestTitle: string;
    requestDoneKicker: string;
    requestDoneTitle: string;
    requestDoneBody: string;
    requestAgain: string;
    connectKicker: string;
    fieldShop: string;
    fieldShopPh: string;
    fieldCity: string;
    fieldCityPh: string;
    fieldName: string;
    fieldPhone: string;
    fieldEmail: string;
    fieldComment: string;
    submit: string;
    submitting: string;
    submitFail: string;
    footerBlurb: string;
    license: string;
  };
  login: {
    kicker: string;
    title: string;
    fieldLogin: string;
    fieldPassword: string;
    submit: string;
    submitting: string;
    fail: string;
  };
  settings: {
    kicker: string;
    title: string;
    hint: string;
    shopName: string;
    address: string;
    addressPh: string;
    timezone: string;
    saved: string;
    logo: string;
    logoHint: string;
    replace: string;
    upload: string;
    removeLogo: string;
    vitrine: string;
    openVitrine: string;
    ofd: string;
  };
  pay: {
    cash: string;
    card: string;
  };
  pos: {
    refundTitle: string;
    refundAlwaysMoney: string;
    refundAsk: string;
    refundGiven: string;
    refundGivenNote: string;
    refundKept: string;
    refundKeptNote: string;
    refundSubmit: string;
    refundPending: string;
    refundOkRestored: string;
    refundOkKept: string;
  };
  products: {
    kicker: string;
    title: string;
    hint: string;
    addOne: string;
    addBulk: string;
    viewList: string;
    viewTiles: string;
    colName: string;
    colPrice: string;
    colStatus: string;
    active: string;
    hidden: string;
    bulkTitle: string;
    bulkHint: string;
    bulkCategory: string;
    bulkNoCategory: string;
    bulkList: string;
    bulkReady: string;
    bulkErrors: string;
    bulkCreate: string;
    bulkCreating: string;
  };
  vitrine: {
    menu: string;
    empty: string;
    back: string;
    fullscreen: string;
    exitFullscreen: string;
    other: string;
  };
};

export const localeNames: Record<Locale, string> = {
  ru: "Русский",
  en: "English",
  kk: "Қазақша",
};

export interface ClientContactPerson {
  id: string;
  role: string; // np. "Kupiec / Zamówienia", "Magazyn / Awizacje", "Faktury / Księgowość"
  name?: string;
  email: string;
  phone?: string;
}

export interface ClientNote {
  id: string;
  createdAt: string; // ISO lub czytelna data
  author?: string;
  content: string;
  isPinned?: boolean;
  category?: 'ustalenia' | 'faktury' | 'logistyka' | 'inne';
}

export interface KeyClientProfile {
  id: string;
  shortName: string; // np. "DOZ", "Dr. Max", "Super-Pharm", "Gemini"
  fullName: string;
  nip: string;
  glnBuyer?: string;
  glnDelivery?: string;
  idWew?: string;
  colorTheme: 'amber' | 'emerald' | 'blue' | 'purple' | 'rose' | 'teal' | 'indigo' | 'slate';

  // 1. Wymagania dotyczące wystawiania FV
  invoiceSystem: 'KSeF_FA3' | 'ZEWNETRZNY_SYSTEM' | 'KSEF_I_PORTAL';
  invoiceSystemLabel: string; // np. "KSeF FA(3) XML + dokument WZ" lub "Inny system / bez FV w KSeF"
  paymentDays: number;
  ksefLogisticsFormat: string; // np. "GS1 (NumerSeriiDataPrzydatnosciIlosc)" lub "Osobne pola (Data ważności + Seria)"
  invoiceRequirements: string; // Szczegółowy opis wymogów fakturowych

  // 2. Wymagana data ważności produktów (MHD)
  minExpiryRequirement: string; // np. "Minimum 12 miesięcy od dnia dostawy"
  shortExpiryPolicy: string; // np. "Krótsza data wyłącznie po wcześniejszej pisemnej zgodzie kupca"

  // 3. Forma awizacji dostawy
  avisoMethod: string; // np. "Awizacja mailowa / Portal dostawcy min. 24-48h przed dostawą"
  avisoDetails: string; // Szczegóły (np. okno czasowe, wymogi dot. WZ, palet/paczek)

  // 4. Adres do wysyłki (Magazyn docelowy) i adres siedziby
  headquartersAddress: string;
  shippingWarehouseName: string;
  shippingAddress: string;
  shippingRemarks?: string; // np. "Rampa 17-21, dołączyć papierową WZ do paczki"

  // 5. Adresy mailowe do korespondencji
  contacts: ClientContactPerson[];

  // 6. Notatki i historia nowych ustaleń
  notes: ClientNote[];

  updatedAt: string;
}

export const INITIAL_KEY_CLIENTS: KeyClientProfile[] = [
  {
    id: 'client-doz',
    shortName: 'DOZ',
    fullName: 'DOZ S.A. Direct Sp. k. – Hurtownia Farmaceutyczna',
    nip: '8271807718',
    glnBuyer: '5909000828476',
    glnDelivery: '5909000848054',
    colorTheme: 'amber',
    invoiceSystem: 'KSeF_FA3',
    invoiceSystemLabel: 'KSeF FA(3) XML + obowiązkowy Podmiot3 (GLN odbiorcy)',
    paymentDays: 60,
    ksefLogisticsFormat: 'Klucz łączony GS1 (NumerSeriiDataPrzydatnosciIlosc) + kod GTIN w <UU_ID>',
    invoiceRequirements:
      '• Obowiązkowy blok <Podmiot3> z Rolą 2 (Odbiorca) i kodem GLN miejsca dostawy (5909000848054).\n• Numer zamówienia (np. 22882/2026/KPD) oraz data zamówienia w sekcji <WarunkiTransakcji><Zamowienie>.\n• Termin płatności: standardowo 60 dni.\n• Serie (LOT) i daty ważności (MHD) przekazywane w kluczu NumerSeriiDataPrzydatnosciIlosc.',
    minExpiryRequirement: 'Minimum 12 miesięcy od daty dostawy (lub zgodnie z umową handlową)',
    shortExpiryPolicy: 'Wysyłka towaru z krótszą datą ważności wymaga uprzedniej akceptacji mailowej ze strony kupca DOZ.',
    avisoMethod: 'Obowiązkowa wcześniejsza awizacja dostawy na magazyn centralny w Łodzi',
    avisoDetails:
      'Zamówienia często wpływają z wyprzedzeniem (nawet miesiąc przed datą awizacji). Fakturę i wysyłkę realizujemy zgodnie z wyznaczonym terminem awizacji. Do przesyłki dołączamy dokument WZ z seriami i datami ważności.',
    headquartersAddress: 'ul. Kinga C. Gillette 11, 94-406 Łódź',
    shippingWarehouseName: 'DOZ S.A. Direct Sp. k. – Magazyn Hurtowni Farmaceutycznej',
    shippingAddress: 'ul. Kinga C. Gillette 1, 9, 11 (rampa 17-21), 94-406 Łódź',
    shippingRemarks: 'GLN miejsca dostawy: 5909000848054 · Zwrócić uwagę na numer rampy (17-21) podany na zamówieniu.',
    contacts: [
      {
        id: 'doz-c1',
        role: 'Rozliczenia / Faktury',
        name: 'Dział Rozliczeń DOZ',
        email: 'rozliczenia@doz.pl',
        phone: '',
      },
      {
        id: 'doz-c2',
        role: 'Awizacja / Magazyn Łódź',
        name: 'Sekcja Awizacji Dostaw',
        email: 'awizacje@doz.pl',
        phone: '',
      },
    ],
    notes: [
      {
        id: 'doz-n1',
        createdAt: '2026-10-01 10:00',
        category: 'faktury',
        isPinned: true,
        content:
          'W fakturach dla DOZ zawsze pilnować, aby w <Podmiot3> był wpisany GLN miejsca dostawy 5909000848054 oraz dokładny adres z numerem rampy (ul. Kinga C. Gillette 1, 9, 11 r. 17-21).',
      },
    ],
    updatedAt: '2026-10-03T12:00:00.000Z',
  },
  {
    id: 'client-drmax',
    shortName: 'Dr. Max',
    fullName: 'Dr. Max Lekomat Sp. z o.o.',
    nip: '8943149010',
    colorTheme: 'emerald',
    invoiceSystem: 'KSeF_FA3',
    invoiceSystemLabel: 'KSeF FA(3) XML + dokument WZ do dostawy',
    paymentDays: 32,
    ksefLogisticsFormat: 'Klucz łączony GS1 (NumerSeriiDataPrzydatnosciIlosc)',
    invoiceRequirements:
      '• Nabywca: DR. MAX LEKOMAT SP. Z O.O. (NIP: 8943149010).\n• Termin płatności: 32 dni od daty wystawienia.\n• Wymagany numer zamówienia (np. ZZ-1009/09/26) w <WarunkiTransakcji><Zamowienie>.\n• Serie i daty ważności (LOT/MHD) dla każdej pozycji towarowej.',
    minExpiryRequirement: 'Minimum 12 miesięcy (dla krótkich serii wymagane potwierdzenie z działem zakupów)',
    shortExpiryPolicy: 'Każda partia poniżej wymaganego progu ważności musi być zgłoszona mailowo przed wysyłką.',
    avisoMethod: 'Awizacja mailowa / zgodnie z harmonogramem dostaw magazynu Wrocław',
    avisoDetails: 'Przed wysyłką kurierską upewnić się, że serie i ilości na WZ zgadzają się w 100% z zawartością paczek.',
    headquartersAddress: 'ul. Krzemieniecka 60A, 54-613 Wrocław',
    shippingWarehouseName: 'Magazyn Dr. Max Lekomat Wrocław',
    shippingAddress: 'ul. Krzemieniecka 60A, 54-613 Wrocław',
    shippingRemarks: 'Do każdej przesyłki dołączyć wydrukowany dokument WZ z numerem zamówienia ZZ-...',
    contacts: [
      {
        id: 'drmax-c1',
        role: 'Faktury / Księgowość',
        name: 'Dział Faktur Dr. Max',
        email: 'faktury@drmax.pl',
        phone: '',
      },
      {
        id: 'drmax-c2',
        role: 'Zamówienia / Kupiec',
        name: 'Dział Zakupów',
        email: 'zamowienia@drmax.pl',
        phone: '',
      },
    ],
    notes: [
      {
        id: 'drmax-n1',
        createdAt: '2026-10-01 11:30',
        category: 'ustalenia',
        isPinned: true,
        content: 'Sprawdzać zgodność cen jednostkowych netto na zamówieniu PDF z aktualnym cennikiem Eubiosis przed wygenerowaniem XML.',
      },
    ],
    updatedAt: '2026-10-03T12:00:00.000Z',
  },
  {
    id: 'client-superpharm',
    shortName: 'Super-Pharm',
    fullName: 'Super-Pharm Holding Sp. z o.o.',
    nip: '5213842837',
    idWew: '5213842837-54936',
    colorTheme: 'blue',
    invoiceSystem: 'KSeF_FA3',
    invoiceSystemLabel: 'KSeF FA(3) XML + Podmiot3 (IDWew Magazynu Teresin)',
    paymentDays: 46,
    ksefLogisticsFormat: 'Osobne pola w <DodatkowyOpis>: "Data ważności" oraz "Seria"',
    invoiceRequirements:
      '• Nabywca: SUPER-PHARM HOLDING SP. Z O.O. (ul. Domaniewska 48, Warszawa).\n• Obowiązkowy <Podmiot3> (Odbiorca, Rola 2): Magazyn Centralny Teresin z identyfikatorem wewnętrznym <IDWew>5213842837-54936</IDWew>.\n• Format serii: Osobne pola ("Data ważności" + "Seria").\n• Termin płatności: 46 dni.',
    minExpiryRequirement: 'Minimum 12 miesięcy od daty dostawy do Magazynu Centralnego w Teresinie',
    shortExpiryPolicy: 'Wymagana akceptacja kupca przed awizacją towaru z krótszą datą.',
    avisoMethod: 'Awizacja dostawy do Magazynu Centralnego w Teresinie (okno czasowe)',
    avisoDetails: 'Na listach przewozowych i dokumentach WZ zawsze wskazywać adres dostawy w Teresinie (Aleja 20-lecia 23), a nie siedzibę w Warszawie!',
    headquartersAddress: 'ul. Domaniewska 48, 02-672 Warszawa',
    shippingWarehouseName: 'Magazyn Centralny Super-Pharm Holding',
    shippingAddress: 'Aleja 20-lecia 23, 96-515 Teresin',
    shippingRemarks: 'UWAGA: Wysyłka towaru ZAWSZE do magazynu w Teresinie (96-515 Teresin), nigdy na ul. Domaniewską w Warszawie!',
    contacts: [
      {
        id: 'sp-c1',
        role: 'Faktury / Rozliczenia',
        name: 'Księgowość Super-Pharm',
        email: 'faktury@superpharm.pl',
        phone: '',
      },
      {
        id: 'sp-c2',
        role: 'Magazyn Centralny Teresin / Awizacje',
        name: 'Magazyn Teresin',
        email: 'magazyn.teresin@superpharm.pl',
        phone: '',
      },
    ],
    notes: [
      {
        id: 'sp-n1',
        createdAt: '2026-09-28 09:15',
        category: 'logistyka',
        isPinned: true,
        content: 'Pamiętać: w KSeF dla Super-Pharm używamy formatu "Osobne pola" (Data ważności + Seria) oraz IDWew: 5213842837-54936.',
      },
    ],
    updatedAt: '2026-10-03T12:00:00.000Z',
  },
  {
    id: 'client-gemini',
    shortName: 'Gemini',
    fullName: 'Gemini Polska Sp. z o.o. (Apteki Gemini)',
    nip: '5862276537',
    colorTheme: 'purple',
    invoiceSystem: 'KSeF_FA3',
    invoiceSystemLabel: 'KSeF FA(3) XML / Zgodnie z ustaleniami sieci',
    paymentDays: 21,
    ksefLogisticsFormat: 'Osobne pola w <DodatkowyOpis> ("Data ważności" + "Seria")',
    invoiceRequirements:
      '• Nabywca: GEMINI POLSKA SP. Z O.O. (NIP: 5862276537).\n• Termin płatności: 21 dni.\n• Weryfikacja cen z dedykowanym cennikiem Gemini.',
    minExpiryRequirement: 'Minimum 12 miesięcy od dnia dostawy',
    shortExpiryPolicy: 'Krótsze daty ważności ustalane indywidualnie mailowo.',
    avisoMethod: 'Awizacja mailowa przed wysyłką towaru',
    avisoDetails: 'Przesyłki kurierskie z dołączoną specyfikacją serii i dat ważności (WZ).',
    headquartersAddress: 'ul. Żołnierzy I Armii Wojska Polskiego 10, 81-383 Gdynia',
    shippingWarehouseName: 'Magazyn Gemini Polska',
    shippingAddress: 'ul. Żołnierzy I Armii Wojska Polskiego 10, 81-383 Gdynia',
    shippingRemarks: 'Sprawdzić w zamówieniu, czy dostawa idzie na magazyn główny w Gdyni czy wskazany oddział.',
    contacts: [
      {
        id: 'gem-c1',
        role: 'Faktury / Księgowość',
        name: 'Dział Faktur Gemini',
        email: 'faktury@gemini.pl',
        phone: '',
      },
    ],
    notes: [],
    updatedAt: '2026-10-03T12:00:00.000Z',
  },
];

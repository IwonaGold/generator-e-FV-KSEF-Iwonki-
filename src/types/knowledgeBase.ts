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
  shortName: string; // np. "DOZ", "Dr. Max", "Super-Pharm", "Gemini", "Nabea", "Modum Pharma"
  fullName: string;
  nip: string;
  glnBuyer?: string;
  glnDelivery?: string;
  idWew?: string;
  colorTheme: 'amber' | 'emerald' | 'blue' | 'purple' | 'rose' | 'teal' | 'indigo' | 'slate';

  // 1. Wymagania dotyczące wystawiania FV
  invoiceSystem: 'KSeF_FA3' | 'ZEWNETRZNY_SYSTEM' | 'KSEF_I_PORTAL';
  invoiceSystemLabel: string; // np. "FV KSeF (+ MHD, seria GS1)" lub "FV w-Firma + specyfikacja"
  paymentDays: number;
  ksefLogisticsFormat: string; // np. "GS1 (NumerSeriiDataPrzydatnosciIlosc)" lub "Osobne wiersze (Data ważności + Seria)"
  invoiceRequirements: string; // Szczegółowy opis wymogów fakturowych

  // 2. Wymagana data ważności produktów (MHD)
  minExpiryRequirement: string; // np. "Min. 75% okresu przydatności i nie mniej niż 12 miesięcy"
  shortExpiryPolicy: string; // np. "Krótsza data wyłącznie po potwierdzeniu przez Dział Zaopatrzenia"

  // 3. Forma awizacji dostawy
  avisoMethod: string; // np. "Awizacja mailowa min. 48h przed dostawą na awizacje@gemini.pl"
  avisoDetails: string; // Szczegóły (np. co w tytule maila, co w treści, wymogi dot. kartonów i palet)

  // 4. Adres do wysyłki (Magazyn docelowy) i adres siedziby
  headquartersAddress: string;
  shippingWarehouseName: string;
  shippingAddress: string;
  shippingRemarks?: string; // np. "Max wys. palety 160 cm, max waga 900 kg, przezroczysty stretch"

  // 5. Adresy mailowe do korespondencji
  contacts: ClientContactPerson[];

  // 6. Notatki i historia nowych ustaleń
  notes: ClientNote[];

  updatedAt: string;
}

export const INITIAL_KEY_CLIENTS: KeyClientProfile[] = [
  // ==========================================================================
  // 1. DOZ DIRECT
  // ==========================================================================
  {
    id: 'client-doz',
    shortName: 'DOZ Direct',
    fullName: 'DOZ Spółka Akcyjna Direct Sp. k. – Hurtownia Farmaceutyczna',
    nip: '8271807718',
    glnBuyer: '5909000828476',
    glnDelivery: '5909000848054',
    colorTheme: 'amber',
    invoiceSystem: 'KSeF_FA3',
    invoiceSystemLabel: 'FV KSeF (+ MHD, seria GS1) + wysyłka FV i TABELI na maile DOZ',
    paymentDays: 60,
    ksefLogisticsFormat: 'GS1 (NumerSeriiDataPrzydatnosciIlosc) + kod GTIN/EAN',
    invoiceRequirements:
      '• Termin płatności: 60 dni.\n' +
      '• Wystawiamy: FV KSeF (+ MHD, seria w standardzie GS1).\n' +
      '• Przelicznik cenowy (mnożnik): * 0.975.\n' +
      '• Po wystawieniu wysłać FV oraz TABELĘ (specyfikację) na adresy: kpd_dd@doz.pl oraz dwd_dd@doz.pl.\n' +
      '• Na fakturze obowiązkowe: numer i data zamówienia, nazwa i postać produktu, kod EAN, numer serii/partii, data ważności, ilość, termin płatności oraz dane Nabywcy (ILN: 5909000828476) i Miejsca dostawy (ILN: 5909000848054, Nr zezwolenia: GIF-N-411/820/MSH/14).\n' +
      '• Kierowca przy dostawie musi mieć: fakturę VAT (lub WZ/specyfikację), pomiar temperatury z trasy oraz Oświadczenie o miejscu wydania towaru (chyba że działają dokumenty EDI). Dokumenty umieścić NA BOKU palety/kartonu (zakaz wkładania do środka zaklejonego kartonu!).',
    minExpiryRequirement:
      'Produkty o całkowitym okresie > 12 msc: min. 75% całkowitego okresu przydatności i NIE MNIEJ NIŻ 12 MIESIĘCY. (Produkty < 12 msc: min. 75% okresu i nie mniej niż 6 miesięcy).',
    shortExpiryPolicy:
      'Jeśli termin przydatności jest krótszy, DOZ Direct ma prawo zwrotu towaru. Wyjątki (krótsza data ważności) dopuszczalne WYŁĄCZNIE po każdorazowym pisemnym potwierdzeniu przez Dział Zaopatrzenia DOZ.',
    avisoMethod: 'Potwierdzenie przyjęcia zamówienia, awizacja i ustalenie formy wysyłki: aswinoga@doz.pl',
    avisoDetails:
      '• Nadrzędna zasada pakowania: JEDEN KARTON = JEDEN TERMIN WAŻNOŚCI = JEDNA SERIA = JEDEN NUMER PARTII.\n' +
      '• Kartony niepełne / palety MIX: każdy produkt w oddzielny kartonik/zgrzewkę, okleić inną taśmą (preferowana taśma z napisem „MIX”), a paletę wyraźnie oznaczyć słowem „MIX” z dodatkową etykietą z ilościami i rodzajami produktów.\n' +
      '• Standard palet: wyłącznie palety EUR, EPAL lub CHEP (1200x800 mm), MAKSYMALNA WYSOKOŚĆ: 160 cm, MAKSYMALNA WAGA: 900 kg.\n' +
      '• Paleta musi być owinięta PRZEZROCZYSTYM STRETCHEM (razem z podstawą palety), a kartony ustawione tak, aby etykieta każdego kartonu była widoczna z zewnątrz.',
    headquartersAddress: 'ul. Kinga C. Gillette 11, 94-406 Łódź (ILN: 5909000828476)',
    shippingWarehouseName: 'DOZ S.A. Direct Sp. k. – Hurtownia Farmaceutyczna',
    shippingAddress: 'ul. Kinga C. Gillette 9 i 11 (rampa 17-21), 94-406 Łódź',
    shippingRemarks:
      'ILN dostawy: 5909000848054 · Max wys. palety 160 cm, max waga 900 kg, przezroczysty stretch · Dokumenty na boku palety/kartonu (nigdy w środku!).',
    contacts: [
      {
        id: 'doz-c1',
        role: 'Potwierdzenie przyjęcia, awizacja, forma wysyłki',
        name: 'A. Świnoga (DOZ)',
        email: 'aswinoga@doz.pl',
        phone: '',
      },
      {
        id: 'doz-c2',
        role: 'Faktura (FV) + TABELA (specyfikacja)',
        name: 'KPD DOZ Direct',
        email: 'kpd_dd@doz.pl',
        phone: '',
      },
      {
        id: 'doz-c3',
        role: 'Faktura (FV) + TABELA (specyfikacja)',
        name: 'DWD DOZ Direct',
        email: 'dwd_dd@doz.pl',
        phone: '',
      },
      {
        id: 'doz-c4',
        role: 'Windykacja / Gdy zalegają z płatnością',
        name: 'Dział Płatności BSSCE',
        email: 'fk_platnosci@bssce.com',
        phone: '',
      },
      {
        id: 'doz-c5',
        role: 'Dokumenty EDI (FV, WZ, potwierdzenia)',
        name: 'Bramka EDI DOZ',
        email: 'edidokumenty@doz.pl',
        phone: '',
      },
      {
        id: 'doz-c6',
        role: 'Konfiguracja EDI',
        name: 'Małgorzata Matyja',
        email: 'mmatyja@doz.pl',
        phone: '+48 532 792 038',
      },
    ],
    notes: [
      {
        id: 'doz-n1',
        createdAt: '2026-10-03 15:20',
        category: 'ustalenia',
        isPinned: true,
        content:
          'ŚCIĄGA OPERACYJNA DOZ DIRECT:\n• Termin płatności: 60 dni, FV KSeF (+ MHD, seria GS1), przelicznik *0.975\n• aswinoga@doz.pl – potwierdzenie przyjęcia, awizacja, forma wysyłki\n• kpd_dd@doz.pl , dwd_dd@doz.pl – wysyłka FV + TABELA\n• fk_platnosci@bssce.com – pisać tutaj, gdy zalegają z płatnością!',
      },
      {
        id: 'doz-n2',
        createdAt: '2026-10-03 15:21',
        category: 'logistyka',
        isPinned: true,
        content:
          'WYMOGI MAGAZYNOWE DOZ:\n• Jeden karton = Jeden termin ważności = Jedna seria.\n• Kartony niepełne oklejać taśmą „MIX”.\n• Paleta EUR/EPAL max 160 cm wysokości i max 900 kg wagi, owinięta przezroczystym stretchem (etykiety kartonów widoczne na zewnątrz).\n• Zmiany EAN, gramatury, VAT lub wymiarów zgłaszać min. 30 dni wcześniej do Opiekuna Dostawcy (inaczej dostawa zostanie cofnięta).',
      },
    ],
    updatedAt: '2026-10-03T15:25:00.000Z',
  },

  // ==========================================================================
  // 2. DR. MAX (HURTOWNIA DROGERYJNA LEKOMAT)
  // ==========================================================================
  {
    id: 'client-drmax',
    shortName: 'Dr. Max (Lekomat)',
    fullName: 'Dr. Max Hurtownia Drogeryjna Lekomat (Dr. Max Lekomat Sp. z o.o.)',
    nip: '8943149010',
    colorTheme: 'emerald',
    invoiceSystem: 'KSeF_FA3',
    invoiceSystemLabel: 'FV KSeF (Hurtownia Drogeryjna Lekomat: bez MHD/serii lub wg wytycznych GS1)',
    paymentDays: 30,
    ksefLogisticsFormat:
      'Hurtownia Drogeryjna Lekomat: bez MHD/serii | Pozostałe spółki Dr. Max: GS1 (NumerSeryjny / DataPrzydatnosci lub SerialNumberExpiratonDateQuantity: (10)SERIA(17)RRMMDD(37)ILOSC)',
    invoiceRequirements:
      '• Termin płatności: 30 dni.\n' +
      '• Dla Dr. Max Hurtownia Drogeryjna Lekomat: FV KSeF (bez MHD/serii), wysyłka FV na dostawyecom@ / zamowieniaecom@.\n' +
      '• Wytyczne KSeF Grupy Dr. Max:\n' +
      '  – Numer zamówienia na poziomie pozycji w <DodatkowyOpis>: <Klucz>NrZamowieniaZew</Klucz> (numer zamówienia Dr. Max, max 30 znaków) lub <Klucz>NrZamowieniaWew</Klucz>.\n' +
      '  – Dla spółek aptecznych w nagłówku <DodatkowyOpis>: <Klucz>NrApteki</Klucz> lub <Klucz>KamsoftID</Klucz>.\n' +
      '  – Kody przyczyn korekt w KSeF (<PrzyczynaKorekty>): „Korekta - program lekowy”, „Korekta – rabat” (lub „Rabat za okres”), „Korekta – gazetka” (rozliczenia z tytułu gazetki Lekomat).',
    minExpiryRequirement: 'Minimum 12 miesięcy od daty dostawy (zgodnie z umową handlową)',
    shortExpiryPolicy:
      'Krótsza data ważności wymaga wcześniejszej akceptacji przed wysłaniem formularza awizacji.',
    avisoMethod:
      'lekomat.dostawy@drmax.com.pl – potwierdzenie zamówienia, FORMULARZ awizacji oraz ustalenie formy wysyłki',
    avisoDetails:
      '• Przed dostawą wysłać wypełniony FORMULARZ awizacji oraz potwierdzenie i formę wysyłki na adres: lekomat.dostawy@drmax.com.pl.\n' +
      '• Dokument logistyczny (WZ) powinien zawierać: NIP Dostawcy, NIP Odbiorcy, numer faktury dostawcy, KSeF ID (jeśli już nadany), numer zamówienia Dr. Max oraz pozycje (EAN, BLOZ, nazwa, ilość, cena netto, stawka VAT, seria i data ważności).',
    headquartersAddress: 'ul. Krzemieniecka 60A, 54-613 Wrocław (NIP: 8943149010)',
    shippingWarehouseName: 'Magazyn Dr. Max Lekomat (FM Logistic Łubna)',
    shippingAddress: 'ul. Łubińska 1a, 05-532 Łubna (lub ul. Krzemieniecka 60A, 54-613 Wrocław wg zamówienia)',
    shippingRemarks:
      'Sprawdzić na zamówieniu lokalizację magazynu docelowego (Łubna: ul. Łubińska 1a, 05-532 Łubna). Awizacja przez formularz na lekomat.dostawy@drmax.com.pl.',
    contacts: [
      {
        id: 'drmax-c1',
        role: 'Potwierdzenie, FORMULARZ awizacji, forma wysyłki',
        name: 'Magazyn Dostawy Lekomat',
        email: 'lekomat.dostawy@drmax.com.pl',
        phone: '',
      },
      {
        id: 'drmax-c2',
        role: 'Wysyłka FV (E-commerce / Dostawy)',
        name: 'Dostawy E-com Dr. Max',
        email: 'dostawyecom@drmax.com.pl',
        phone: '',
      },
      {
        id: 'drmax-c3',
        role: 'Wysyłka FV (Zamówienia E-com)',
        name: 'Zamówienia E-com Dr. Max',
        email: 'zamowieniaecom@drmax.com.pl',
        phone: '',
      },
    ],
    notes: [
      {
        id: 'drmax-n1',
        createdAt: '2026-10-03 15:20',
        category: 'ustalenia',
        isPinned: true,
        content:
          'ŚCIĄGA OPERACYJNA DR. MAX HURTOWNIA DROGERYJNA LEKOMAT:\n• Termin płatności: 30 dni, FV KSeF (bez MHD/serii)\n• lekomat.dostawy@drmax.com.pl – potwierdzenie, FORMULARZ awizacji, forma wysyłki\n• dostawyecom@ , zamowieniaecom@ – wysyłka FV\n• Lokalizacja magazynu: ul. Łubińska 1a, 05-532 Łubna.',
      },
      {
        id: 'drmax-n2',
        createdAt: '2026-10-03 15:22',
        category: 'faktury',
        isPinned: false,
        content:
          'WYTYCZNE KOREKT KSeF DR. MAX (<PrzyczynaKorekty>):\n• Program lekowy: „Korekta - program lekowy”\n• Rabaty: „Korekta – rabat” lub „Rabat za okres”\n• Rozliczenia z tytułu gazetki Lekomat: „Korekta – gazetka”',
      },
    ],
    updatedAt: '2026-10-03T15:25:00.000Z',
  },

  // ==========================================================================
  // 3. GEMINI (GEMINI APPS / GEMINI POLSKA)
  // ==========================================================================
  {
    id: 'client-gemini',
    shortName: 'Gemini',
    fullName: 'Gemini Apps Sp. z o.o. (NIP: 5252801825) / Gemini Polska Sp. z o.o.',
    nip: '5252801825',
    colorTheme: 'purple',
    invoiceSystem: 'ZEWNETRZNY_SYSTEM',
    invoiceSystemLabel: 'FV w-Firma + specyfikacja (oraz kopia XML/PDF + papierowa FV do dostawy)',
    paymentDays: 45,
    ksefLogisticsFormat: 'FV wystawiana w w-Firma + osobna specyfikacja (tabela) + kody GTIN na FV/WZ',
    invoiceRequirements:
      '• Termin płatności: 45 dni.\n' +
      '• Nabywca/Płatnik (wg Standardu Dostaw Gemini Apps): Gemini Apps Sp. z o.o., Al. Grunwaldzka 411, 80-309 Gdańsk, NIP: 525-280-18-25.\n' +
      '• Wystawianie: FV w-Firma + specyfikacja (tabela).\n' +
      '• Po potwierdzeniu awizacji wysłać informację (kiedy wysyłamy, jak, fakturę oraz tabelę/specyfikację) na: ri@gemini.pl oraz aleksandra.teclaw@gemini.pl (oraz kopię XML/PDF na faktury@gemini.pl).\n' +
      '• OBOWIĄZKOWE PRZY DOSTAWIE FIZYCZNEJ (Standard Dostaw str. 3): Do każdej dostawy MUSI być dołączona PAPIEROWA wersja faktury VAT (pomimo wysłania elektronicznej!) oraz dokument WZ z indywidualnymi kodami GTIN produktów.\n' +
      '• Papierową fakturę umieścić na OZNACZONYM kartonie lub na górze/boku OZNACZONEJ palety (zakaz wkładania papierowej FV w środek opakowania zbiorczego na palecie!).\n' +
      '• Kody przyczyn korekt Gemini: GEM.K01 (ilościowa), GEM.K02 (błąd ceny), GEM.K03 (stawka VAT), GEM.K04 (błędy w danych niewartościowych np. seria/data), GEM.K05 (ustalenia stron/FUS), GEM.K06 (programy specjalne), GEM.K07 (akcja sprzedażowa), GEM.K08 (rabat).',
    minExpiryRequirement:
      'Zgodnie z umową handlową. Każdy produkt musi posiadać serię i datę ważności na opakowaniu oraz na etykiecie kartonu zbiorczego (*data ważności nieobowiązkowa dla kosmetyków).',
    shortExpiryPolicy:
      'Jeżeli data ważności lub numer serii są zakodowane, dostawca ma obowiązek wysłać instrukcję ich odkodowania na adres: awizacje@gemini.pl (brak instrukcji jest traktowany jak brak daty ważności!).',
    avisoMethod:
      'Obowiązkowa awizacja mailowa na awizacje@gemini.pl min. 48h przed planowaną dostawą (awizacja telefoniczna nie jest brana pod uwagę!)',
    avisoDetails:
      '• KROK 1 (Propozycja awizacji min. 48h przed dostawą na awizacje@gemini.pl):\n' +
      '  – W tytule maila: nazwa dostawcy + data planowanej dostawy.\n' +
      '  – W treści maila: liczba palet/kartonów, forma dostarczenia faktury, nazwa firmy transportowej.\n' +
      '• KROK 2 (Po potwierdzeniu awizacji przez Gemini): wysłać maila na ri@gemini.pl oraz aleksandra.teclaw@gemini.pl z informacją: kiedy wysyłamy, jak (kurier/paleta), załączyć fakturę oraz tabelę (specyfikację).\n' +
      '• ZASADY PAKOWANIA GEMINI:\n' +
      '  – Na etykiecie kartonu zbiorczego: nazwa produktu, liczba sztuk w kartonie, seria i data ważności.\n' +
      '  – Kartony niepełne NIE MOGĄ być uzupełniane innym produktem ani inną serią/datą — muszą mieć wyraźny napis „karton niepełny” lub przekreślenie.\n' +
      '  – Maksymalnie 1 paleta MIX w dostawie (produkty na palecie MIX wyraźnie oddzielone). Palety licencjonowane EUR EPAL 1200x800 mm.',
    headquartersAddress: 'Al. Grunwaldzka 411, 80-309 Gdańsk (NIP: 525-280-18-25)',
    shippingWarehouseName: 'Magazyn Logistyki Gemini (MB)',
    shippingAddress: 'ul. Azymutalna 15, 80-298 Gdańsk (przyjęcia pn–pt w godz. 7:00–17:00)',
    shippingRemarks:
      'Przyjęcia dostaw pn–pt 7:00–17:00 wyłącznie po potwierdzonej awizacji · Dołączyć papierową FV i WZ z kodami GTIN na oznaczonym kartonie/palecie!',
    contacts: [
      {
        id: 'gem-c1',
        role: '1. Propozycja terminu awizacji (min. 48h przed), ile palet/kartonów',
        name: 'Awizacje Magazyn Gemini',
        email: 'awizacje@gemini.pl',
        phone: '',
      },
      {
        id: 'gem-c2',
        role: '2. Po potwierdzeniu awizacji (kiedy wysyłamy, jak, FV, tabela)',
        name: 'Dział RI Gemini',
        email: 'ri@gemini.pl',
        phone: '',
      },
      {
        id: 'gem-c3',
        role: '2. Po potwierdzeniu awizacji (kiedy wysyłamy, jak, FV, tabela)',
        name: 'Aleksandra Tecław',
        email: 'aleksandra.teclaw@gemini.pl',
        phone: '',
      },
      {
        id: 'gem-c4',
        role: 'Kopia faktury VAT (format XML oraz PDF)',
        name: 'Księgowość / Faktury Gemini',
        email: 'faktury@gemini.pl',
        phone: '',
      },
      {
        id: 'gem-c5',
        role: 'Adres z którego spływają zamówienia Gemini',
        name: 'System zamówień PMS Gemini',
        email: 'pms-no-reply_k1@gemini.pl',
        phone: '',
      },
    ],
    notes: [
      {
        id: 'gem-n1',
        createdAt: '2026-10-03 15:20',
        category: 'ustalenia',
        isPinned: true,
        content:
          'ŚCIĄGA OPERACYJNA GEMINI (zamówienia z: pms-no-reply_k1@gemini.pl):\n• Termin płatności: 45 dni, FV w-Firma + specyfikacja\n• 1) awizacje@gemini.pl – propozycja terminu awizacji (min. 48h wcześniej), podać na ilu paletach/kartonach\n• 2) ri@gemini.pl oraz aleksandra.teclaw@gemini.pl – po potwierdzeniu awizacji: napisać kiedy wysyłamy, jak, załączyć fakturę i tabelę!',
      },
      {
        id: 'gem-n2',
        createdAt: '2026-10-03 15:22',
        category: 'faktury',
        isPinned: true,
        content:
          'TABELA KODÓW PRZYCZYN KOREKTY GEMINI:\n• GEM.K01 – Korekta ilościowa (zmiana ilości towaru)\n• GEM.K02 – Korekta cenowa (błąd wystawiającego fakturę)\n• GEM.K03 – Korekta cenowa (zmiana stawki VAT)\n• GEM.K04 – Korekta danych niewartościowych (błędy w serii, dacie ważności, opisie, adresie)\n• GEM.K05 – Korekta wartościowa z ustaleń stron (np. FUS)\n• GEM.K06 – Korekta cenowa dla produktów specjalnych\n• GEM.K07 – Korekta cenowa z umowy / akcji sprzedażowej\n• GEM.K08 – Korekta wartościowa z umowy – rabat',
      },
    ],
    updatedAt: '2026-10-03T15:25:00.000Z',
  },

  // ==========================================================================
  // 4. SUPER-PHARM
  // ==========================================================================
  {
    id: 'client-superpharm',
    shortName: 'Super-Pharm',
    fullName: 'Super-Pharm Holding Sp. z o.o.',
    nip: '5213842837',
    idWew: '5213842837-54936',
    colorTheme: 'blue',
    invoiceSystem: 'KSeF_FA3',
    invoiceSystemLabel: 'FV KSeF (+ MHD, seria w osobnych wierszach) + wysyłka na dsiwinski@superpharm.pl',
    paymentDays: 45,
    ksefLogisticsFormat: 'Osobne wiersze w <DodatkowyOpis>: "Data ważności" oraz "Seria" + Podmiot3 IDWew: 5213842837-54936',
    invoiceRequirements:
      '• Termin płatności: 45 dni.\n' +
      '• Wystawiamy: FV KSeF (+ MHD i seria w osobnych wierszach).\n' +
      '• Nabywca: SUPER-PHARM HOLDING SP. Z O.O. (ul. Domaniewska 48, 02-672 Warszawa, NIP: 5213842837).\n' +
      '• Obowiązkowy <Podmiot3> (Rola 2 – Odbiorca): Magazyn Centralny Super-Pharm Holding, Aleja 20-lecia 23, 96-515 Teresin, <IDWew>5213842837-54936</IDWew>.\n' +
      '• Potwierdzenie realizacji zamówienia oraz fakturę wysyłać na adres: dsiwinski@superpharm.pl.',
    minExpiryRequirement: 'Minimum 12 miesięcy od daty dostawy',
    shortExpiryPolicy: 'Krótsza data ważności wymaga wcześniejszej zgody kupca przed awizacją w systemie DMS.',
    avisoMethod: 'Awizacja w systemie DMS + potwierdzenie realizacji zamówienia na dsiwinski@superpharm.pl',
    avisoDetails:
      '• Awizacja dokonywana w systemie DMS.\n' +
      '• Potwierdzenie realizacji zamówienia oraz faktura na maila: dsiwinski@superpharm.pl.\n' +
      '• WYMÓG OZNACZENIA PALETY I KARTONÓW:\n' +
      '  – Na palecie MUSI być widoczna NAZWA FIRMY oraz NUMER ZAMÓWIENIA!\n' +
      '  – MIX: każdy produkt pakowany w OSOBNE KARTONY.',
    headquartersAddress: 'ul. Domaniewska 48, 02-672 Warszawa (NIP: 5213842837)',
    shippingWarehouseName: 'Magazyn Centralny Super-Pharm Holding',
    shippingAddress: 'Aleja 20-lecia 23, 96-515 Teresin',
    shippingRemarks:
      'Na palecie MUSI być nazwa firmy oraz nr zamówienia! · MIX pakować w osobne kartony · Wysyłka zawsze do magazynu w Teresinie (96-515 Teresin).',
    contacts: [
      {
        id: 'sp-c1',
        role: 'Potwierdzenie realizacji zamówienia oraz wysyłka faktury',
        name: 'Damian Siwiński (Super-Pharm)',
        email: 'dsiwinski@superpharm.pl',
        phone: '',
      },
    ],
    notes: [
      {
        id: 'sp-n1',
        createdAt: '2026-10-03 15:20',
        category: 'ustalenia',
        isPinned: true,
        content:
          'ŚCIĄGA OPERACYJNA SUPER-PHARM:\n• Termin płatności: 45 dni, FV KSeF (+ MHD, seria w osobnych wierszach)\n• Awizacja w systemie DMS\n• dsiwinski@superpharm.pl – potwierdzenie realizacji zamówienia oraz faktura\n• Na palecie MUSI być nazwa firmy oraz nr zamówienia!\n• MIX – osobne kartony.',
      },
    ],
    updatedAt: '2026-10-03T15:25:00.000Z',
  },

  // ==========================================================================
  // 5. NABEA
  // ==========================================================================
  {
    id: 'client-nabea',
    shortName: 'Nabea',
    fullName: 'Nabea (Zamówienia drogeryjne / bez FV w KSeF)',
    nip: 'Brak / wg zamówienia',
    colorTheme: 'rose',
    invoiceSystem: 'ZEWNETRZNY_SYSTEM',
    invoiceSystemLabel: 'FV w-Firma (bez specyfikacji) – wysyłka PDF i XML na Fh@nabea.pl',
    paymentDays: 21,
    ksefLogisticsFormat: 'FV wystawiana w systemie w-Firma (bez specyfikacji) – wysyłka PDF + XML',
    invoiceRequirements:
      '• Termin płatności: 21 dni.\n' +
      '• Wystawianie: FV w-Firma (BEZ specyfikacji).\n' +
      '• Fakturę w formacie PDF oraz XML wysłać na adres: Fh@nabea.pl.\n' +
      '• W naszym programie zamówienia Nabea można wrzucać w kafelce „NOWE” -> „NOWE ZAMÓWIENIE BEZ FAKTURY” (do zaplanowania pakowania i śledzenia wysyłki).',
    minExpiryRequirement: 'Zgodnie z zamówieniem (standardowo min. 12 miesięcy)',
    shortExpiryPolicy: 'Krótsze daty uzgadniać mailowo przy potwierdzaniu zamówienia.',
    avisoMethod:
      'Awizacja w 2-dniowym przedziale na e.tracz@nabea.pl (DW: b.gielecinska@nabea.pl)',
    avisoDetails:
      '• Awizacja w 2-dniowym przedziale czasowym.\n' +
      '• Potwierdzenie zamówienia, numery listów przewozowych oraz awizację wysyłać na: e.tracz@nabea.pl (z kopią DW do: b.gielecinska@nabea.pl).\n' +
      '• OBOWIĄZKOWE OZNACZENIE KARTONÓW:\n' +
      '  – Na każdym kartonie MUSI być wpisany NUMER ZAMÓWIENIA oraz OPIS NUMERYCZNY KARTONÓW, np.:\n' +
      '    444111 1/3\n' +
      '    444111 2/3\n' +
      '    444111 3/3 itd.',
    headquartersAddress: 'Zgodnie z zamówieniem Nabea',
    shippingWarehouseName: 'Magazyn Nabea',
    shippingAddress: 'Zgodnie z adresem dostawy na zamówieniu Nabea',
    shippingRemarks:
      'WAŻNE: Na kartonach MUSI być nr zamówienia i numeracja paczek (np. 444111 1/3, 2/3, 3/3)! · Numery listów przewozowych wysłać na e.tracz@nabea.pl (DW: b.gielecinska@nabea.pl).',
    contacts: [
      {
        id: 'nab-c1',
        role: 'Potwierdzenie, numery listów przewozowych, awizacja (Główny)',
        name: 'E. Tracz (Nabea)',
        email: 'e.tracz@nabea.pl',
        phone: '',
      },
      {
        id: 'nab-c2',
        role: 'DW (kopia): Potwierdzenie, listy przewozowe, awizacja',
        name: 'B. Gielecińska (Nabea)',
        email: 'b.gielecinska@nabea.pl',
        phone: '',
      },
      {
        id: 'nab-c3',
        role: 'Wysyłka faktury (format PDF oraz XML)',
        name: 'Dział Faktur Nabea',
        email: 'Fh@nabea.pl',
        phone: '',
      },
    ],
    notes: [
      {
        id: 'nab-n1',
        createdAt: '2026-10-03 15:20',
        category: 'ustalenia',
        isPinned: true,
        content:
          'ŚCIĄGA OPERACYJNA NABEA:\n• Termin płatności: 21 dni, FV w-Firma (bez specyfikacji)\n• Awizacja w 2-dniowym przedziale\n• e.tracz@nabea.pl (DW: b.gielecinska@nabea.pl) – potwierdzenie, numery listów przewozowych, awizacja\n• Fh@nabea.pl – faktura (PDF, XML)\n• Na kartonach MUSI być nr zamówienia i opis numeryczny (np. 444111 1/3 itd.)!',
      },
    ],
    updatedAt: '2026-10-03T15:25:00.000Z',
  },

  // ==========================================================================
  // 6. MODUM PHARMA
  // ==========================================================================
  {
    id: 'client-modumpharma',
    shortName: 'Modum Pharma',
    fullName: 'Modum Pharma',
    nip: 'Brak / wg zamówienia',
    colorTheme: 'teal',
    invoiceSystem: 'ZEWNETRZNY_SYSTEM',
    invoiceSystemLabel: 'FV w-Firma + specyfikacja (wysyłka na zakupy.sprzedaz@modumpharma.pl)',
    paymentDays: 60,
    ksefLogisticsFormat: 'FV w-Firma + osobna specyfikacja towarowa',
    invoiceRequirements:
      '• Termin płatności: 60 dni.\n' +
      '• Wystawianie: FV w-Firma + specyfikacja.\n' +
      '• Fakturę (FV) wraz ze specyfikacją wysłać na adres: zakupy.sprzedaz@modumpharma.pl.',
    minExpiryRequirement: 'PRODUKTY MINIMUM 13 MIESIĘCY WAŻNOŚCI!',
    shortExpiryPolicy:
      'Uwaga: Modum Pharma wymaga minimum 13 miesięcy daty ważności (dłużej niż standardowe 12 miesięcy!). Krótsza data wyłącznie po wcześniejszej zgodzie.',
    avisoMethod:
      'Proponowany termin awizacji wysłać mailowo na: dzialhandlowy@modumpharma.pl oraz logistyka@modumpharma.pl',
    avisoDetails:
      '• Przed wysyłką zgłosić proponowany termin awizacji na dwa adresy: dzialhandlowy@modumpharma.pl oraz logistyka@modumpharma.pl.\n' +
      '• Po przygotowaniu dostawy przesłać FV oraz specyfikację na: zakupy.sprzedaz@modumpharma.pl.',
    headquartersAddress: 'Zgodnie z zamówieniem Modum Pharma',
    shippingWarehouseName: 'Magazyn Modum Pharma',
    shippingAddress: 'Zgodnie z adresem dostawy na zamówieniu Modum Pharma',
    shippingRemarks:
      'PAMIĘTAĆ: Produkty dla Modum Pharma muszą mieć MINIMUM 13 MIESIĘCY daty ważności!',
    contacts: [
      {
        id: 'mod-c1',
        role: 'Proponowany termin awizacji',
        name: 'Dział Handlowy Modum Pharma',
        email: 'dzialhandlowy@modumpharma.pl',
        phone: '',
      },
      {
        id: 'mod-c2',
        role: 'Proponowany termin awizacji',
        name: 'Logistyka Modum Pharma',
        email: 'logistyka@modumpharma.pl',
        phone: '',
      },
      {
        id: 'mod-c3',
        role: 'Faktura (FV) oraz specyfikacja',
        name: 'Zakupy i Sprzedaż Modum Pharma',
        email: 'zakupy.sprzedaz@modumpharma.pl',
        phone: '',
      },
    ],
    notes: [
      {
        id: 'mod-n1',
        createdAt: '2026-10-03 15:20',
        category: 'ustalenia',
        isPinned: true,
        content:
          'ŚCIĄGA OPERACYJNA MODUM PHARMA:\n• Termin płatności: 60 dni, FV w-Firma + specyfikacja\n• Produkty MINIMUM 13 MIESIĘCY ważności!\n• Proponowany termin awizacji -> dzialhandlowy@modumpharma.pl , logistyka@modumpharma.pl\n• FV i specyfikacja -> zakupy.sprzedaz@modumpharma.pl',
      },
    ],
    updatedAt: '2026-10-03T15:25:00.000Z',
  },
];

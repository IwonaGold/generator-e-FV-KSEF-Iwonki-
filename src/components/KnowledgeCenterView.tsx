import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Building2,
  FileText,
  Calendar,
  Truck,
  MapPin,
  Mail,
  MessageSquarePlus,
  Pin,
  Trash2,
  Edit3,
  Check,
  X,
  Plus,
  Copy,
  CheckCircle2,
  Search,
  Clock,
  ShieldAlert,
  Sparkles,
  Phone,
  UserPlus,
} from 'lucide-react';
import {
  KeyClientProfile,
  ClientContactPerson,
  ClientNote,
} from '../types/knowledgeBase';
import {
  getKeyClients,
  saveKeyClient,
  deleteKeyClient,
} from '../utils/knowledgeStorage';

const THEME_STYLES: Record<
  KeyClientProfile['colorTheme'],
  {
    badge: string;
    activeTab: string;
    headerBg: string;
    iconBg: string;
    accentText: string;
    border: string;
  }
> = {
  amber: {
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    activeTab: 'bg-gradient-to-br from-amber-50 via-orange-50/40 to-white border-amber-500 ring-2 ring-amber-400/30',
    headerBg: 'from-amber-500/10 via-orange-500/5 to-transparent',
    iconBg: 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white',
    accentText: 'text-amber-800',
    border: 'border-amber-200',
  },
  emerald: {
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    activeTab: 'bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white border-emerald-500 ring-2 ring-emerald-400/30',
    headerBg: 'from-emerald-500/10 via-teal-500/5 to-transparent',
    iconBg: 'bg-gradient-to-tr from-emerald-500 to-teal-500 text-white',
    accentText: 'text-emerald-800',
    border: 'border-emerald-200',
  },
  blue: {
    badge: 'bg-blue-100 text-blue-900 border-blue-300',
    activeTab: 'bg-gradient-to-br from-blue-50 via-indigo-50/40 to-white border-blue-500 ring-2 ring-blue-400/30',
    headerBg: 'from-blue-500/10 via-indigo-500/5 to-transparent',
    iconBg: 'bg-gradient-to-tr from-blue-500 to-indigo-500 text-white',
    accentText: 'text-blue-800',
    border: 'border-blue-200',
  },
  purple: {
    badge: 'bg-purple-100 text-purple-900 border-purple-300',
    activeTab: 'bg-gradient-to-br from-purple-50 via-fuchsia-50/40 to-white border-purple-500 ring-2 ring-purple-400/30',
    headerBg: 'from-purple-500/10 via-fuchsia-500/5 to-transparent',
    iconBg: 'bg-gradient-to-tr from-purple-500 to-fuchsia-500 text-white',
    accentText: 'text-purple-800',
    border: 'border-purple-200',
  },
  rose: {
    badge: 'bg-rose-100 text-rose-900 border-rose-300',
    activeTab: 'bg-gradient-to-br from-rose-50 via-pink-50/40 to-white border-rose-500 ring-2 ring-rose-400/30',
    headerBg: 'from-rose-500/10 via-pink-500/5 to-transparent',
    iconBg: 'bg-gradient-to-tr from-rose-500 to-pink-500 text-white',
    accentText: 'text-rose-800',
    border: 'border-rose-200',
  },
  teal: {
    badge: 'bg-teal-100 text-teal-900 border-teal-300',
    activeTab: 'bg-gradient-to-br from-teal-50 via-cyan-50/40 to-white border-teal-500 ring-2 ring-teal-400/30',
    headerBg: 'from-teal-500/10 via-cyan-500/5 to-transparent',
    iconBg: 'bg-gradient-to-tr from-teal-500 to-cyan-500 text-white',
    accentText: 'text-teal-800',
    border: 'border-teal-200',
  },
  indigo: {
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    activeTab: 'bg-gradient-to-br from-indigo-50 via-violet-50/40 to-white border-indigo-500 ring-2 ring-indigo-400/30',
    headerBg: 'from-indigo-500/10 via-violet-500/5 to-transparent',
    iconBg: 'bg-gradient-to-tr from-indigo-500 to-violet-500 text-white',
    accentText: 'text-indigo-800',
    border: 'border-indigo-200',
  },
  slate: {
    badge: 'bg-slate-200 text-slate-900 border-slate-300',
    activeTab: 'bg-gradient-to-br from-slate-100 via-slate-50 to-white border-slate-600 ring-2 ring-slate-400/30',
    headerBg: 'from-slate-500/10 via-slate-500/5 to-transparent',
    iconBg: 'bg-gradient-to-tr from-slate-700 to-slate-900 text-white',
    accentText: 'text-slate-800',
    border: 'border-slate-300',
  },
};

const NOTE_CATEGORY_BADGES: Record<
  NonNullable<ClientNote['category']>,
  { label: string; classes: string }
> = {
  ustalenia: {
    label: '🤝 Ustalenia handlowe',
    classes: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  },
  faktury: {
    label: '🧾 Faktury / KSeF',
    classes: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  logistyka: {
    label: '🚚 Logistyka / Awizacja',
    classes: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  inne: {
    label: '💡 Inne informacje',
    classes: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

export const KnowledgeCenterView: React.FC = () => {
  const [clients, setClients] = useState<KeyClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('client-doz');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);

  // Stan edycji głównej karty klienta
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [editDraft, setEditDraft] = useState<KeyClientProfile | null>(null);

  // Stan dodawania nowego klienta
  const [isAddingNewClient, setIsAddingNewClient] = useState<boolean>(false);
  const [newClientShortName, setNewClientShortName] = useState<string>('');
  const [newClientFullName, setNewClientFullName] = useState<string>('');
  const [newClientNip, setNewClientNip] = useState<string>('');

  // Stan dodawania kontaktu mailowego
  const [isAddingContact, setIsAddingContact] = useState<boolean>(false);
  const [contactRole, setContactRole] = useState<string>('');
  const [contactName, setContactName] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');

  // Stan dodawania nowej notatki / ustalenia
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [newNoteCategory, setNewNoteCategory] = useState<NonNullable<ClientNote['category']>>('ustalenia');
  const [newNotePinned, setNewNotePinned] = useState<boolean>(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState<string>('');

  useEffect(() => {
    getKeyClients().then((loaded) => {
      setClients(loaded);
      if (loaded.length > 0 && !loaded.some((c) => c.id === selectedClientId)) {
        setSelectedClientId(loaded[0].id);
      }
    });
  }, []);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const inBasic =
        c.shortName.toLowerCase().includes(q) ||
        c.fullName.toLowerCase().includes(q) ||
        c.nip.toLowerCase().includes(q) ||
        c.shippingAddress.toLowerCase().includes(q) ||
        c.invoiceRequirements.toLowerCase().includes(q) ||
        c.minExpiryRequirement.toLowerCase().includes(q) ||
        c.avisoMethod.toLowerCase().includes(q);
      const inContacts = c.contacts.some(
        (ct) =>
          ct.email.toLowerCase().includes(q) ||
          ct.role.toLowerCase().includes(q) ||
          (ct.name || '').toLowerCase().includes(q)
      );
      const inNotes = c.notes.some((n) => n.content.toLowerCase().includes(q));
      return inBasic || inContacts || inNotes;
    });
  }, [clients, searchQuery]);

  const activeClient = useMemo(() => {
    return (
      filteredClients.find((c) => c.id === selectedClientId) ||
      clients.find((c) => c.id === selectedClientId) ||
      filteredClients[0] ||
      clients[0] ||
      null
    );
  }, [clients, filteredClients, selectedClientId]);

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showNotice(`📋 Skopiowano do schowka: ${label} (${text})`);
  };

  const handleStartEditProfile = () => {
    if (!activeClient) return;
    setEditDraft({ ...activeClient });
    setIsEditingProfile(true);
  };

  const handleSaveProfileEdit = async () => {
    if (!editDraft) return;
    const saved = await saveKeyClient(editDraft);
    setClients((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
    setIsEditingProfile(false);
    setEditDraft(null);
    showNotice(`✅ Zapisano zaktualizowane wymagania dla sieci ${saved.shortName}!`);
  };

  const handleCreateNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientShortName.trim()) return;

    const themes: KeyClientProfile['colorTheme'][] = [
      'rose',
      'teal',
      'indigo',
      'amber',
      'emerald',
      'blue',
      'purple',
    ];
    const randomTheme = themes[clients.length % themes.length];

    const newProfile: KeyClientProfile = {
      id: `client-${Date.now()}`,
      shortName: newClientShortName.trim(),
      fullName: newClientFullName.trim() || newClientShortName.trim(),
      nip: newClientNip.trim() || 'Brak NIP',
      colorTheme: randomTheme,
      invoiceSystem: 'KSeF_FA3',
      invoiceSystemLabel: 'KSeF FA(3) XML',
      paymentDays: 30,
      ksefLogisticsFormat: 'Klucz łączony GS1 (NumerSeriiDataPrzydatnosciIlosc)',
      invoiceRequirements: '• Wpisz wymagania dotyczące wystawiania faktur dla tego klienta...',
      minExpiryRequirement: 'Minimum 12 miesięcy od daty dostawy',
      shortExpiryPolicy: 'Krótsza data ważności po uzgodnieniu mailowym.',
      avisoMethod: 'Awizacja mailowa przed dostawą',
      avisoDetails: 'Szczegóły awizacji i dostawy...',
      headquartersAddress: '',
      shippingWarehouseName: `Magazyn ${newClientShortName.trim()}`,
      shippingAddress: 'Wpisz adres magazynu do wysyłki...',
      shippingRemarks: '',
      contacts: [],
      notes: [],
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveKeyClient(newProfile);
    setClients((prev) => [...prev, saved]);
    setSelectedClientId(saved.id);
    setNewClientShortName('');
    setNewClientFullName('');
    setNewClientNip('');
    setIsAddingNewClient(false);
    setEditDraft({ ...saved });
    setIsEditingProfile(true);
    showNotice(`➕ Dodano nowego klienta: ${saved.shortName}. Możesz teraz uzupełnić jego szczegółowe wymagania!`);
  };

  const handleDeleteCurrentClient = async () => {
    if (!activeClient) return;
    if (
      !window.confirm(
        `Czy na pewno chcesz usunąć kartę klienta "${activeClient.shortName} (${activeClient.fullName})" z Centrum Wiedzy?`
      )
    ) {
      return;
    }
    await deleteKeyClient(activeClient.id);
    const remaining = clients.filter((c) => c.id !== activeClient.id);
    setClients(remaining);
    if (remaining.length > 0) {
      setSelectedClientId(remaining[0].id);
    }
    showNotice(`🗑️ Usunięto kartę klienta ${activeClient.shortName}.`);
  };

  // Dodawanie adresu mailowego / kontaktu
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient || !contactEmail.trim()) return;

    const newContact: ClientContactPerson = {
      id: `cnt-${Date.now()}`,
      role: contactRole.trim() || 'Kontakt ogólny / Zamówienia',
      name: contactName.trim(),
      email: contactEmail.trim(),
      phone: contactPhone.trim(),
    };

    const updated: KeyClientProfile = {
      ...activeClient,
      contacts: [...activeClient.contacts, newContact],
    };

    const saved = await saveKeyClient(updated);
    setClients((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
    setContactRole('');
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setIsAddingContact(false);
    showNotice(`✉️ Dodano adres e-mail (${newContact.email}) dla sieci ${activeClient.shortName}.`);
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!activeClient) return;
    const updated: KeyClientProfile = {
      ...activeClient,
      contacts: activeClient.contacts.filter((c) => c.id !== contactId),
    };
    const saved = await saveKeyClient(updated);
    setClients((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
    showNotice('🗑️ Usunięto kontakt z karty klienta.');
  };

  // Dodawanie nowej notatki / ustalenia
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient || !newNoteContent.trim()) return;

    const nowFormatted = new Date().toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const note: ClientNote = {
      id: `note-${Date.now()}`,
      createdAt: nowFormatted,
      content: newNoteContent.trim(),
      category: newNoteCategory,
      isPinned: newNotePinned,
    };

    const updated: KeyClientProfile = {
      ...activeClient,
      notes: [note, ...activeClient.notes],
    };

    const saved = await saveKeyClient(updated);
    setClients((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
    setNewNoteContent('');
    setNewNotePinned(false);
    showNotice(`📌 Dodano nowe ustalenie/notatkę dla klienta ${activeClient.shortName}!`);
  };

  const handleTogglePinNote = async (noteId: string) => {
    if (!activeClient) return;
    const updated: KeyClientProfile = {
      ...activeClient,
      notes: activeClient.notes.map((n) =>
        n.id === noteId ? { ...n, isPinned: !n.isPinned } : n
      ),
    };
    const saved = await saveKeyClient(updated);
    setClients((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
  };

  const handleSaveEditedNote = async (noteId: string) => {
    if (!activeClient || !editingNoteText.trim()) return;
    const updated: KeyClientProfile = {
      ...activeClient,
      notes: activeClient.notes.map((n) =>
        n.id === noteId ? { ...n, content: editingNoteText.trim() } : n
      ),
    };
    const saved = await saveKeyClient(updated);
    setClients((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
    setEditingNoteId(null);
    setEditingNoteText('');
    showNotice('✅ Zaktualizowano treść ustalenia.');
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!activeClient) return;
    if (!window.confirm('Czy na pewno chcesz usunąć tę notatkę / ustalenie?')) return;
    const updated: KeyClientProfile = {
      ...activeClient,
      notes: activeClient.notes.filter((n) => n.id !== noteId),
    };
    const saved = await saveKeyClient(updated);
    setClients((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
    showNotice('🗑️ Usunięto notatkę.');
  };

  const sortedNotes = useMemo(() => {
    if (!activeClient) return [];
    return [...activeClient.notes].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });
  }, [activeClient]);

  const theme = activeClient
    ? THEME_STYLES[activeClient.colorTheme] || THEME_STYLES.rose
    : THEME_STYLES.rose;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* POWIADOMIENIE */}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-bold shadow-xs animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* GÓRNY NAGŁÓWEK CENTRUM WIEDZY + WYSZUKIWARKA + DODAWANIE KLIENTA */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-fuchsia-600 text-white flex items-center justify-center text-2xl shadow-md shadow-indigo-200 shrink-0">
              📚
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                  Baza CRM & Wytyczne Sieci
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs font-semibold text-slate-500">
                  {clients.length} klientów kluczowych
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                Centrum Wiedzy – CRM Klientów Kluczowych
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Wymagania dot. wystawiania FV, minimalne daty ważności (MHD), formy awizacji, adresy magazynów wysyłkowych, kontakty e-mail oraz bieżące ustalenia.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Wyszukiwarka */}
            <div className="relative min-w-[240px] flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj sieci, e-maila, adresu, ustalenia..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-400 focus:outline-none text-slate-800"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsAddingNewClient(!isAddingNewClient)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Dodaj klienta / sieć</span>
            </button>
          </div>
        </div>

        {/* FORMULARZ DODAWANIA NOWEGO KLIENTA */}
        {isAddingNewClient && (
          <form
            onSubmit={handleCreateNewClient}
            className="mt-4 pt-4 border-t border-slate-100 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-200/80 animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Nowy Klient Kluczowy / Sieć Apteczna</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingNewClient(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nazwa skrócona (np. Ziko, Melissa, Cefarm) *
                </label>
                <input
                  type="text"
                  required
                  value={newClientShortName}
                  onChange={(e) => setNewClientShortName(e.target.value)}
                  placeholder="np. Ziko Apteka"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Pełna nazwa firmy (Nabywca)
                </label>
                <input
                  type="text"
                  value={newClientFullName}
                  onChange={(e) => setNewClientFullName(e.target.value)}
                  placeholder="np. ZIKO APTEKA SP. Z O.O."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  NIP klienta
                </label>
                <input
                  type="text"
                  value={newClientNip}
                  onChange={(e) => setNewClientNip(e.target.value)}
                  placeholder="np. 6792689959"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingNewClient(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs cursor-pointer"
              >
                Utwórz kartę klienta i przejdź do edycji
              </button>
            </div>
          </form>
        )}

        {/* KAFELKI WYBORU KLIENTA KLUCZOWEGO */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {filteredClients.map((client) => {
            const isSelected = activeClient?.id === client.id;
            const cTheme = THEME_STYLES[client.colorTheme] || THEME_STYLES.rose;
            const pinnedCount = client.notes.filter((n) => n.isPinned).length;

            return (
              <button
                key={client.id}
                type="button"
                onClick={() => {
                  setSelectedClientId(client.id);
                  setIsEditingProfile(false);
                }}
                className={`text-left p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? `${cTheme.activeTab} shadow-sm scale-[1.01]`
                    : 'bg-slate-50/70 hover:bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <span
                      className={`px-2 py-0.5 text-xs font-black rounded-lg border truncate ${cTheme.badge}`}
                    >
                      {client.shortName}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-800 line-clamp-1 mt-1">
                    {client.fullName}
                  </p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate">
                    NIP: {client.nip}
                  </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-semibold">⏳ {client.paymentDays} dni</span>
                  <div className="flex items-center gap-1">
                    <span>✉️ {client.contacts.length}</span>
                    <span>·</span>
                    <span className={pinnedCount > 0 ? 'font-bold text-rose-600' : ''}>
                      📌 {client.notes.length}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SZCZEGÓŁOWA KARTA WYBRANEGO KLIENTA KLUCZOWEGO */}
      {activeClient && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* PASEK TYTUŁOWY KARTY KLIENTA */}
          <div
            className={`p-5 sm:p-6 bg-gradient-to-r ${theme.headerBg} border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-14 h-14 rounded-2xl ${theme.iconBg} flex items-center justify-center text-2xl font-black shadow-sm shrink-0`}
              >
                {activeClient.shortName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 text-xs font-black rounded-lg border ${theme.badge}`}
                  >
                    {activeClient.shortName}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                    NIP: {activeClient.nip}
                  </span>
                  {activeClient.glnDelivery && (
                    <span className="text-xs font-mono text-slate-600 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                      GLN dostawy: {activeClient.glnDelivery}
                    </span>
                  )}
                  {activeClient.idWew && (
                    <span className="text-xs font-mono text-slate-600 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                      IDWew: {activeClient.idWew}
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-2xl font-black text-slate-900 mt-1">
                  {activeClient.fullName}
                </h2>
                {activeClient.headquartersAddress && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Siedziba rejestrowa: <strong className="text-slate-700">{activeClient.headquartersAddress}</strong>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isEditingProfile ? (
                <>
                  <button
                    type="button"
                    onClick={handleStartEditProfile}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edytuj wymagania klienta</span>
                  </button>
                  {![
                    'client-doz',
                    'client-drmax',
                    'client-superpharm',
                    'client-gemini',
                    'client-nabea',
                    'client-modumpharma',
                  ].includes(activeClient.id) && (
                    <button
                      type="button"
                      onClick={handleDeleteCurrentClient}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
                      title="Usuń kartę tego klienta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingProfile(false);
                      setEditDraft(null);
                    }}
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Anuluj</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfileEdit}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Zapisz wszystkie zmiany</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* TRYB EDYCJI WYTYCZNYCH KLIENTA */}
          {isEditingProfile && editDraft ? (
            <div className="p-6 bg-slate-50/70 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nazwa skrócona sieci
                  </label>
                  <input
                    type="text"
                    value={editDraft.shortName}
                    onChange={(e) => setEditDraft({ ...editDraft, shortName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pełna nazwa nabywcy (do faktury)
                  </label>
                  <input
                    type="text"
                    value={editDraft.fullName}
                    onChange={(e) => setEditDraft({ ...editDraft, fullName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">NIP</label>
                    <input
                      type="text"
                      value={editDraft.nip}
                      onChange={(e) => setEditDraft({ ...editDraft, nip: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Termin płatności (dni)
                    </label>
                    <input
                      type="number"
                      value={editDraft.paymentDays}
                      onChange={(e) =>
                        setEditDraft({
                          ...editDraft,
                          paymentDays: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Edycja wymagań dot. wystawiania FV */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-fuchsia-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-fuchsia-600" />
                    <span>1. Wymagania dotyczące wystawiania FV</span>
                  </h3>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Sposób / system fakturowania
                    </label>
                    <input
                      type="text"
                      value={editDraft.invoiceSystemLabel}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, invoiceSystemLabel: e.target.value })
                      }
                      placeholder="np. KSeF FA(3) XML lub Inny system zewnętrzny"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Format serii i dat ważności (LOT/MHD) na fakturze
                    </label>
                    <input
                      type="text"
                      value={editDraft.ksefLogisticsFormat}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, ksefLogisticsFormat: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Szczegółowe wymagania fakturowe
                    </label>
                    <textarea
                      rows={4}
                      value={editDraft.invoiceRequirements}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, invoiceRequirements: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                {/* 2. Edycja wymaganej daty ważności */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>2. Wymagana data ważności (MHD)</span>
                  </h3>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Minimalny wymagany termin ważności przy dostawie
                    </label>
                    <input
                      type="text"
                      value={editDraft.minExpiryRequirement}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, minExpiryRequirement: e.target.value })
                      }
                      placeholder="np. Minimum 12 miesięcy od dnia dostawy"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Zasady przy krótszej dacie ważności
                    </label>
                    <textarea
                      rows={4}
                      value={editDraft.shortExpiryPolicy}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, shortExpiryPolicy: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                {/* 3. Edycja formy awizacji */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span>3. Forma awizacji dostawy</span>
                  </h3>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Sposób awizacji (portal / e-mail / telefon)
                    </label>
                    <input
                      type="text"
                      value={editDraft.avisoMethod}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, avisoMethod: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Szczegóły awizacji i dokumentów dostawy (WZ / palety / paczki)
                    </label>
                    <textarea
                      rows={4}
                      value={editDraft.avisoDetails}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, avisoDetails: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                {/* 4. Edycja adresu do wysyłki */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>4. Adres do wysyłki (Magazyn docelowy)</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Nazwa magazynu odbiorczego
                      </label>
                      <input
                        type="text"
                        value={editDraft.shippingWarehouseName}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            shippingWarehouseName: e.target.value,
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Adres siedziby (rejestrowy)
                      </label>
                      <input
                        type="text"
                        value={editDraft.headquartersAddress}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            headquartersAddress: e.target.value,
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Dokładny adres dostawy / wysyłki towaru
                    </label>
                    <input
                      type="text"
                      value={editDraft.shippingAddress}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, shippingAddress: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        GLN miejsca dostawy (opcjonalnie)
                      </label>
                      <input
                        type="text"
                        value={editDraft.glnDelivery || ''}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, glnDelivery: e.target.value })
                        }
                        className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        IDWew Podmiot3 (opcjonalnie)
                      </label>
                      <input
                        type="text"
                        value={editDraft.idWew || ''}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, idWew: e.target.value })
                        }
                        className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Ważne uwagi dla kuriera / rampy / dostawy
                    </label>
                    <textarea
                      rows={2}
                      value={editDraft.shippingRemarks || ''}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, shippingRemarks: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* WIDOK KARTY WYTYCZNYCH KLIENTA (4 GŁÓWNE SEKCJE + MAILE + NOTATKI) */
            <div className="p-5 sm:p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* KARTA 1: WYMAGANIA DOTYCZĄCE WYSTAWIANIA FV */}
                <div className="bg-fuchsia-50/40 rounded-2xl border border-fuchsia-200/80 p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-fuchsia-900">
                        <FileText className="w-4 h-4 text-fuchsia-600" />
                        <span>1. Wymagania dotyczące wystawiania FV</span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200">
                        Termin płatności: {activeClient.paymentDays} dni
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="bg-white/90 p-3 rounded-xl border border-fuchsia-100">
                        <span className="text-[11px] font-bold text-slate-500 block">
                          System / Tryb fakturowania:
                        </span>
                        <strong className="text-slate-900 font-bold">
                          {activeClient.invoiceSystemLabel}
                        </strong>
                      </div>

                      <div className="bg-white/90 p-3 rounded-xl border border-fuchsia-100">
                        <span className="text-[11px] font-bold text-slate-500 block">
                          Format serii (LOT) i daty ważności (MHD) w XML:
                        </span>
                        <strong className="text-fuchsia-900 font-bold">
                          {activeClient.ksefLogisticsFormat}
                        </strong>
                      </div>

                      <div className="bg-white/90 p-3 rounded-xl border border-fuchsia-100 whitespace-pre-line text-slate-700 leading-relaxed">
                        {activeClient.invoiceRequirements}
                      </div>
                    </div>
                  </div>
                </div>

                {/* KARTA 2: WYMAGANA DATA WAŻNOŚCI (MHD) */}
                <div className="bg-amber-50/40 rounded-2xl border border-amber-200/80 p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-900">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span>2. Wymagana data ważności produktów (MHD)</span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        Wymóg MHD
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="bg-white/90 p-3.5 rounded-xl border border-amber-200/80 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-black">
                          ⏳
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-500 block">
                            Minimalna wymagana data ważności przy dostawie:
                          </span>
                          <span className="text-sm font-black text-amber-950">
                            {activeClient.minExpiryRequirement}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white/90 p-3.5 rounded-xl border border-amber-100 text-slate-700 leading-relaxed">
                        <span className="text-[11px] font-bold text-amber-800 block mb-1">
                          Procedura przy krótszej dacie ważności:
                        </span>
                        {activeClient.shortExpiryPolicy}
                      </div>
                    </div>
                  </div>
                </div>

                {/* KARTA 3: FORMA AWIZACJI DOSTAWY */}
                <div className="bg-blue-50/40 rounded-2xl border border-blue-200/80 p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-blue-900">
                        <Truck className="w-4 h-4 text-blue-600" />
                        <span>3. Forma awizacji dostawy</span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        Logistyka & Awizacja
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="bg-white/90 p-3.5 rounded-xl border border-blue-200/80">
                        <span className="text-[11px] font-bold text-slate-500 block">
                          Wymagana forma awizacji:
                        </span>
                        <strong className="text-sm font-black text-blue-950">
                          {activeClient.avisoMethod}
                        </strong>
                      </div>

                      <div className="bg-white/90 p-3.5 rounded-xl border border-blue-100 text-slate-700 leading-relaxed whitespace-pre-line">
                        <span className="text-[11px] font-bold text-blue-800 block mb-1">
                          Szczegóły organizacyjne i dokumentowe (WZ):
                        </span>
                        {activeClient.avisoDetails}
                      </div>
                    </div>
                  </div>
                </div>

                {/* KARTA 4: ADRES DO WYSYŁKI (MAGAZYN DOCELOWY) */}
                <div className="bg-emerald-50/40 rounded-2xl border border-emerald-200/80 p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-900">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <span>4. Adres do wysyłki (Magazyn docelowy)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(
                            `${activeClient.shippingWarehouseName}, ${activeClient.shippingAddress}`,
                            'Adres wysyłki'
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Kopiuj adres</span>
                      </button>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="bg-white/90 p-3.5 rounded-xl border border-emerald-200/80">
                        <span className="text-[11px] font-bold text-slate-500 block">
                          Magazyn docelowy (Odbiorca przesyłki):
                        </span>
                        <div className="text-sm font-black text-slate-900 mt-0.5">
                          {activeClient.shippingWarehouseName}
                        </div>
                        <div className="text-xs font-bold text-emerald-800 mt-1 flex items-center gap-1.5">
                          <span>📍</span>
                          <span>{activeClient.shippingAddress}</span>
                        </div>
                      </div>

                      {activeClient.shippingRemarks && (
                        <div className="bg-amber-50/90 p-3 rounded-xl border border-amber-200 text-amber-950 text-xs font-semibold flex items-start gap-2">
                          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <span>{activeClient.shippingRemarks}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SEKCJA 5: ADRESY MAILOWE DO KORESPONDENCJI */}
              <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-rose-600" />
                      <span>5. Adresy mailowe do korespondencji ({activeClient.contacts.length})</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Szybkie kopiowanie adresów e-mail do kupców, działu awizacji magazynu oraz księgowości.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddingContact(!isAddingContact)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-2xs transition-colors cursor-pointer shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Dodaj adres e-mail / kontakt</span>
                  </button>
                </div>

                {isAddingContact && (
                  <form
                    onSubmit={handleAddContact}
                    className="mb-4 bg-white p-4 rounded-xl border border-rose-200 grid grid-cols-1 sm:grid-cols-4 gap-3 animate-in fade-in"
                  >
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Dział / Rola (np. Awizacja, Kupiec) *
                      </label>
                      <input
                        type="text"
                        required
                        value={contactRole}
                        onChange={(e) => setContactRole(e.target.value)}
                        placeholder="np. Awizacje Magazyn"
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Imię i nazwisko / Opis
                      </label>
                      <input
                        type="text"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="np. Anna Nowak"
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Adres e-mail *
                      </label>
                      <input
                        type="email"
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="np. awizacja@siec.pl"
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="flex flex-col justify-between">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Telefon (opcjonalnie)
                        </label>
                        <input
                          type="text"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="np. +48 500 000 000"
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-4 flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingContact(false)}
                        className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        Anuluj
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                      >
                        Zapisz kontakt
                      </button>
                    </div>
                  </form>
                )}

                {activeClient.contacts.length === 0 ? (
                  <div className="text-center py-6 bg-white rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                    Brak zapisanych adresów mailowych dla tego klienta. Kliknij „Dodaj adres e-mail / kontakt” powyżej.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {activeClient.contacts.map((ct) => (
                      <div
                        key={ct.id}
                        className="bg-white p-3.5 rounded-xl border border-slate-200/90 flex items-start justify-between gap-2 shadow-2xs"
                      >
                        <div className="min-w-0">
                          <span className="inline-block px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200/70 text-[10px] font-bold uppercase tracking-wider">
                            {ct.role}
                          </span>
                          {ct.name && (
                            <div className="text-xs font-bold text-slate-800 mt-1 truncate">
                              {ct.name}
                            </div>
                          )}
                          <a
                            href={`mailto:${ct.email}`}
                            className="text-xs font-mono font-bold text-indigo-700 hover:underline block truncate mt-0.5"
                            title="Kliknij, aby otworzyć program pocztowy"
                          >
                            {ct.email}
                          </a>
                          {ct.phone && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{ct.phone}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyText(ct.email, ct.role)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200/80 transition-colors cursor-pointer"
                            title="Kopiuj adres e-mail"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteContact(ct.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Usuń ten kontakt"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SEKCJA 6: NOTATKI I NOWE USTALENIA Z KLIENTEM */}
              <div className="bg-gradient-to-br from-indigo-50/50 via-fuchsia-50/30 to-white rounded-2xl border border-indigo-200/80 p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <MessageSquarePlus className="w-4 h-4 text-indigo-600" />
                    <span>6. Notatki i Nowe Ustalenia ({activeClient.notes.length})</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Zapisuj bieżące ustalenia z kupcami (np. zgody na krótsze daty ważności, zmiany godzin awizacji, ustalenia rabatowe).
                  </p>
                </div>

                {/* Formularz nowej notatki */}
                <form
                  onSubmit={handleAddNote}
                  className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-2xs space-y-3 mb-5"
                >
                  <textarea
                    rows={2}
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder={`Wpisz nowe ustalenie lub notatkę dla sieci ${activeClient.shortName} (np. "Ustalono z kupcem zgodę na wysyłkę serii FP11 z datą 10.2026")...`}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500">Kategoria:</span>
                      {(
                        ['ustalenia', 'faktury', 'logistyka', 'inne'] as NonNullable<
                          ClientNote['category']
                        >[]
                      ).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setNewNoteCategory(cat)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                            newNoteCategory === cat
                              ? NOTE_CATEGORY_BADGES[cat].classes + ' ring-2 ring-indigo-300/50'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {NOTE_CATEGORY_BADGES[cat].label}
                        </button>
                      ))}

                      <label className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 cursor-pointer ml-1">
                        <input
                          type="checkbox"
                          checked={newNotePinned}
                          onChange={(e) => setNewNotePinned(e.target.checked)}
                          className="rounded text-rose-600"
                        />
                        <span>📌 Przypnij na górze</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={!newNoteContent.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white shadow-xs transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Zapisz ustalenie</span>
                    </button>
                  </div>
                </form>

                {/* Lista zapisanych notatek / ustaleń */}
                {sortedNotes.length === 0 ? (
                  <div className="text-center py-6 bg-white/80 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                    Brak dodatkowych notatek dla sieci {activeClient.shortName}. Dodaj pierwsze ustalenie powyżej!
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {sortedNotes.map((note) => {
                      const catInfo =
                        NOTE_CATEGORY_BADGES[note.category || 'ustalenia'] ||
                        NOTE_CATEGORY_BADGES.ustalenia;
                      const isEditingThis = editingNoteId === note.id;

                      return (
                        <div
                          key={note.id}
                          className={`p-4 rounded-2xl border transition-all ${
                            note.isPinned
                              ? 'bg-amber-50/70 border-amber-300 shadow-2xs'
                              : 'bg-white border-slate-200/90'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {note.isPinned && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-200/80 text-amber-950">
                                  📌 PRZYPIĘTE USTALENIE
                                </span>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${catInfo.classes}`}
                              >
                                {catInfo.label}
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                🕒 {note.createdAt}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleTogglePinNote(note.id)}
                                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                                  note.isPinned
                                    ? 'text-amber-700 bg-amber-100 hover:bg-amber-200'
                                    : 'text-slate-400 hover:text-amber-700 hover:bg-amber-50'
                                }`}
                                title={note.isPinned ? 'Odepnij notatkę' : 'Przypnij na górze'}
                              >
                                <Pin className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setEditingNoteText(note.content);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="Edytuj treść ustalenia"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteNote(note.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Usuń ustalenie"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {isEditingThis ? (
                            <div className="space-y-2 mt-2">
                              <textarea
                                rows={3}
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-white border border-indigo-300 rounded-xl focus:outline-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteId(null)}
                                  className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                  Anuluj
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditedNote(note.id)}
                                  className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                                >
                                  Zapisz zmianę
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-line leading-relaxed font-medium">
                              {note.content}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

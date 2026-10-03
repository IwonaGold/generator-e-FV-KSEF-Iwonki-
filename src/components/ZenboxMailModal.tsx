import React, { useState, useEffect, useMemo } from 'react';
import {
  Mail,
  Send,
  Paperclip,
  Download,
  CheckCircle2,
  Clock,
  Archive,
  RefreshCw,
  Settings,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Copy,
  ExternalLink,
  Plus,
  Building2,
  Truck,
  Receipt,
  Check,
  X,
  AlertCircle,
  ChevronRight,
  Inbox,
  UserCheck,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { EntityDetails, InvoiceItem, InvoiceMeta } from '../types/ksef';
import { ArchivedOrder } from '../types/ordersHistory';
import { KeyClientProfile } from '../types/knowledgeBase';
import {
  AvisoFormFields,
  DEFAULT_EUBIOSIS_EMAIL_FOOTER,
  EmailAttachmentItem,
  INITIAL_DEMO_ZENBOX_THREADS,
  SuggestedEmailRecipient,
  ZenboxEmailMessage,
  ZenboxMailConfig,
  ZenboxOrderThread,
  buildSuggestedEmailContent,
  downloadAvisoExcelFile,
  generateAvisoExcelBase64,
  getSuggestedRecipientsFromKnowledge,
} from '../utils/zenboxMailAndAvisoGenerator';

interface ZenboxMailModalProps {
  isOpen: boolean;
  onClose: () => void;
  archivedOrders: ArchivedOrder[];
  knowledgeClients: KeyClientProfile[];
  currentMeta: InvoiceMeta;
  currentBuyer: EntityDetails;
  currentItems: InvoiceItem[];
  onLoadOrderFromEmail: (params: {
    chain: 'DOZ' | 'DR_MAX';
    orderNumber: string;
    orderDate: string;
    deliveryDate: string;
    buyer: EntityDetails;
    items: InvoiceItem[];
  }) => void;
  onMarkOrderDeliveredInHistory?: (orderNumber: string, invoiceNumber?: string) => void;
}

const ZENBOX_THREADS_LOCAL_KEY = 'ksef_iwonka_zenbox_threads_v1';
const ZENBOX_CONFIG_LOCAL_KEY = 'ksef_iwonka_zenbox_config_v1';

export const ZenboxMailModal: React.FC<ZenboxMailModalProps> = ({
  isOpen,
  onClose,
  archivedOrders,
  knowledgeClients,
  currentMeta,
  currentBuyer,
  currentItems,
  onLoadOrderFromEmail,
  onMarkOrderDeliveredInHistory,
}) => {
  // Lista wątków pocztowych
  const [threads, setThreads] = useState<ZenboxOrderThread[]>(() => {
    try {
      const raw = localStorage.getItem(ZENBOX_THREADS_LOCAL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_DEMO_ZENBOX_THREADS;
  });

  // Konfiguracja skrzynki Zenbox
  const [config, setConfig] = useState<ZenboxMailConfig>(() => {
    try {
      const raw = localStorage.getItem(ZENBOX_CONFIG_LOCAL_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}
    return {
      emailAddress: 'zamowienia@eubiosis.pl',
      password: '',
      imapHost: 'imap.zenbox.pl',
      imapPort: 993,
      smtpHost: 'smtp.zenbox.pl',
      smtpPort: 465,
      signatureFooter: DEFAULT_EUBIOSIS_EMAIL_FOOTER,
      autoBccSelf: true,
      connected: false,
    };
  });

  // Zakładka skrzynki: 'ACTIVE' (W realizacji) vs 'ARCHIVE' (Archiwum po wysłaniu FV + doręczeniu przesyłki)
  const [activeFolder, setActiveFolder] = useState<'ACTIVE' | 'ARCHIVE'>('ACTIVE');
  const [selectedThreadId, setSelectedThreadId] = useState<string>(
    INITIAL_DEMO_ZENBOX_THREADS[0]?.id || ''
  );

  // Widok boczny: ustawienia lub dodawanie nowego maila
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNewThreadModal, setShowNewThreadModal] = useState(false);

  // Stan formularza odpowiedzi i awizacji
  const [templateType, setTemplateType] = useState<
    'AVISO_TABLE' | 'ORDER_CONFIRMATION' | 'SEND_INVOICE_FV' | 'CUSTOM_REPLY'
  >('AVISO_TABLE');
  const [recipientTo, setRecipientTo] = useState<string>('');
  const [recipientCc, setRecipientCc] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [attachAvisoExcel, setAttachAvisoExcel] = useState<boolean>(true);
  const [attachKsefInvoiceInfo, setAttachKsefInvoiceInfo] = useState<boolean>(false);
  const [showAvisoEditor, setShowAvisoEditor] = useState<boolean>(true);

  // Statusy operacji
  const [isSyncingImap, setIsSyncingImap] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'info' | 'warning';
    text: string;
  } | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Formularz ręcznego dodania nowego wątku zamówieniowego (np. gdy zamówienie przyszło na inny adres)
  const [newThreadChain, setNewThreadChain] = useState<'DR_MAX' | 'DOZ'>('DR_MAX');
  const [newThreadOrderNum, setNewThreadOrderNum] = useState('');
  const [newThreadSenderEmail, setNewThreadSenderEmail] = useState('zamowienia.wroclaw@drmax.com.pl');
  const [newThreadDeliveryDate, setNewThreadDeliveryDate] = useState(
    new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
  );
  const [newThreadWarehouse, setNewThreadWarehouse] = useState(
    'Magazyn Dr. Max Wrocław (ul. Bierutowska 81, 51-317 Wrocław)'
  );

  // Pobranie konfiguracji i wątków z backendu przy otwarciu
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const [cfgRes, thrRes] = await Promise.all([
          fetch('/api/zenbox-config'),
          fetch('/api/zenbox-threads'),
        ]);
        if (cfgRes.ok) {
          const srvCfg = await cfgRes.json();
          setConfig((prev) => ({ ...prev, ...srvCfg }));
        }
        if (thrRes.ok) {
          const srvThreads = await thrRes.json();
          if (Array.isArray(srvThreads) && srvThreads.length > 0) {
            setThreads(srvThreads);
          } else {
            // Inicjalizuj domyślne wątki na serwerze
            await fetch('/api/zenbox-threads', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ threads: INITIAL_DEMO_ZENBOX_THREADS }),
            });
          }
        }
      } catch {}
    })();
  }, [isOpen]);

  // Automatyczna synchronizacja statusów z bazą zamówień (`archivedOrders`):
  // Wątek przechodzi do ARCHIWUM dopiero wtedy, gdy:
  // 1) Wysłano FV (fvSent === true) ORAZ
  // 2) Zamówienie zostało przeniesione do Zakończonych / Dostarczona przesyłka (isDelivered === true lub shippingStatus === 'delivered')
  const synchronizedThreads = useMemo(() => {
    return threads.map((thr) => {
      const normalizedOrderNo = thr.orderNumber.trim().toUpperCase();
      const matchingOrder = archivedOrders.find(
        (ord) =>
          ord.orderNumber?.trim().toUpperCase() === normalizedOrderNo ||
          (thr.linkedOrderId && ord.id === thr.linkedOrderId)
      );

      const isDeliveredInHistory = Boolean(
        matchingOrder &&
          (matchingOrder.isDelivered === true || matchingOrder.shippingStatus === 'delivered')
      );
      const effectiveDelivered = thr.isOrderDelivered || isDeliveredInHistory;
      const effectiveInvoiceNo =
        matchingOrder?.invoiceNumber || thr.avisoData.invoiceNumber || currentMeta.invoiceNumber;

      // Zasada Archiwizacji: DOPIERO po wysłaniu FV ORAZ doręczeniu przesyłki (zamknięciu zamówienia)
      const shouldBeArchived = Boolean(thr.fvSent && effectiveDelivered);

      return {
        ...thr,
        linkedOrderId: matchingOrder?.id || thr.linkedOrderId,
        isOrderDelivered: effectiveDelivered,
        isArchived: shouldBeArchived,
        avisoData: {
          ...thr.avisoData,
          invoiceNumber: effectiveInvoiceNo || thr.avisoData.invoiceNumber,
        },
      };
    });
  }, [threads, archivedOrders, currentMeta.invoiceNumber]);

  const activeThreads = useMemo(
    () => synchronizedThreads.filter((t) => !t.isArchived),
    [synchronizedThreads]
  );
  const archivedThreads = useMemo(
    () => synchronizedThreads.filter((t) => t.isArchived),
    [synchronizedThreads]
  );

  const visibleThreads = activeFolder === 'ACTIVE' ? activeThreads : archivedThreads;

  const selectedThread = useMemo(() => {
    return (
      synchronizedThreads.find((t) => t.id === selectedThreadId) ||
      visibleThreads[0] ||
      synchronizedThreads[0] ||
      null
    );
  }, [synchronizedThreads, visibleThreads, selectedThreadId]);

  // Zapis wątków w localStorage + na serwerze
  const persistThreads = async (updated: ZenboxOrderThread[]) => {
    setThreads(updated);
    try {
      localStorage.setItem(ZENBOX_THREADS_LOCAL_KEY, JSON.stringify(updated));
    } catch {}
    try {
      await fetch('/api/zenbox-threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threads: updated }),
      });
    } catch {}
  };

  // Podpowiadane adresy korespondencyjne z Centrum Wiedzy dla wybranego wątku
  const suggestedRecipients: SuggestedEmailRecipient[] = useMemo(() => {
    if (!selectedThread) return [];
    const firstInbound = selectedThread.messages.find((m) => m.direction === 'INBOUND');
    return getSuggestedRecipientsFromKnowledge(
      selectedThread.chain,
      knowledgeClients,
      firstInbound?.fromEmail
    );
  }, [selectedThread, knowledgeClients]);

  // Gdy zmienia się wybrany wątek lub szablon wiadomości, podpowiedz właściwych adresatów i treść ze stopką
  useEffect(() => {
    if (!selectedThread) return;

    // Domyślny szablon zależny od etapu zamówienia:
    const defaultTpl: 'AVISO_TABLE' | 'SEND_INVOICE_FV' = !selectedThread.avisoSent
      ? 'AVISO_TABLE'
      : 'SEND_INVOICE_FV';
    setTemplateType(defaultTpl);
    setAttachAvisoExcel(defaultTpl === 'AVISO_TABLE');
    setAttachKsefInvoiceInfo(defaultTpl === 'SEND_INVOICE_FV');

    applyTemplateAndRecipients(selectedThread, defaultTpl, suggestedRecipients);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread?.id]);

  const applyTemplateAndRecipients = (
    thread: ZenboxOrderThread,
    tpl: 'AVISO_TABLE' | 'ORDER_CONFIRMATION' | 'SEND_INVOICE_FV' | 'CUSTOM_REPLY',
    recipientsList: SuggestedEmailRecipient[]
  ) => {
    const built = buildSuggestedEmailContent({
      templateType: tpl,
      chain: thread.chain,
      aviso: thread.avisoData,
      items: thread.parsedOrderPayload?.items || currentItems,
      signatureFooter: config.signatureFooter,
    });
    setEmailSubject(built.subject);
    setEmailBody(built.body);

    // Dobierz sugerowany adres Do: na podstawie kategorii szablonu i lokalizacji magazynu
    const whLower = (thread.warehouseLocation || '').toLowerCase();
    if (tpl === 'AVISO_TABLE') {
      if (thread.chain === 'DR_MAX') {
        if (whLower.includes('wrocław') || whLower.includes('wroclaw')) {
          setRecipientTo('awizacje.wroclaw@drmax.com.pl');
        } else if (whLower.includes('czechowice')) {
          setRecipientTo('awizacje.czechowice@drmax.com.pl');
        } else if (whLower.includes('piotrków') || whLower.includes('piotrkow')) {
          setRecipientTo('awizacje.piotrkow@drmax.com.pl');
        } else {
          const av = recipientsList.find((r) => r.category === 'AWIZACJA');
          setRecipientTo(av?.email || 'awizacje.wroclaw@drmax.com.pl');
        }
      } else {
        setRecipientTo('Magazyn_awizacje@doz.pl, dostawy_dozdirect@doz.pl');
      }
      const sender = thread.messages.find((m) => m.direction === 'INBOUND')?.fromEmail || '';
      setRecipientCc(sender);
    } else if (tpl === 'SEND_INVOICE_FV') {
      const fvRec = recipientsList.find((r) => r.category === 'FAKTURY');
      const sender = thread.messages.find((m) => m.direction === 'INBOUND')?.fromEmail || '';
      setRecipientTo(fvRec ? `${fvRec.email}${sender ? `, ${sender}` : ''}` : sender);
      setRecipientCc('');
    } else {
      const sender = thread.messages.find((m) => m.direction === 'INBOUND')?.fromEmail || '';
      setRecipientTo(sender || recipientsList[0]?.email || '');
      setRecipientCc('');
    }
  };

  const handleSelectTemplate = (
    tpl: 'AVISO_TABLE' | 'ORDER_CONFIRMATION' | 'SEND_INVOICE_FV' | 'CUSTOM_REPLY'
  ) => {
    setTemplateType(tpl);
    setAttachAvisoExcel(tpl === 'AVISO_TABLE');
    setAttachKsefInvoiceInfo(tpl === 'SEND_INVOICE_FV');
    if (selectedThread) {
      applyTemplateAndRecipients(selectedThread, tpl, suggestedRecipients);
    }
  };

  // Aktualizacja pola w tabeli awizacyjnej wybranego wątku + odświeżenie podglądu treści maila
  const handleUpdateAvisoField = <K extends keyof AvisoFormFields>(
    field: K,
    value: AvisoFormFields[K]
  ) => {
    if (!selectedThread) return;
    const updatedAviso: AvisoFormFields = {
      ...selectedThread.avisoData,
      [field]: value,
    };
    const updatedThreads = threads.map((t) =>
      t.id === selectedThread.id ? { ...t, avisoData: updatedAviso } : t
    );
    setThreads(updatedThreads);
    try {
      localStorage.setItem(ZENBOX_THREADS_LOCAL_KEY, JSON.stringify(updatedThreads));
    } catch {}

    // Odśwież treść maila z nowymi danymi awizacji
    const built = buildSuggestedEmailContent({
      templateType,
      chain: selectedThread.chain,
      aviso: updatedAviso,
      items: selectedThread.parsedOrderPayload?.items || currentItems,
      signatureFooter: config.signatureFooter,
    });
    setEmailSubject(built.subject);
    setEmailBody(built.body);
  };

  // Pobierz dane z aktualnie otwartej faktury w Generatorze do tabeli awizacyjnej
  const handlePullFromCurrentGenerator = () => {
    if (!selectedThread) return;
    const totalQty = currentItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
    const updatedAviso: AvisoFormFields = {
      ...selectedThread.avisoData,
      orderNumber: currentMeta.orderNumber || selectedThread.avisoData.orderNumber,
      invoiceNumber: currentMeta.invoiceNumber || selectedThread.avisoData.invoiceNumber,
      plannedDeliveryDate: currentMeta.deliveryDate || selectedThread.avisoData.plannedDeliveryDate,
      totalPiecesCount: totalQty > 0 ? totalQty : selectedThread.avisoData.totalPiecesCount,
    };
    const updatedThreads = threads.map((t) =>
      t.id === selectedThread.id
        ? {
            ...t,
            orderNumber: updatedAviso.orderNumber,
            avisoData: updatedAviso,
            parsedOrderPayload:
              currentItems.length > 0
                ? {
                    orderNumber: updatedAviso.orderNumber,
                    orderDate: currentMeta.issueDate,
                    deliveryDate: currentMeta.deliveryDate || updatedAviso.plannedDeliveryDate,
                    buyer: currentBuyer,
                    items: currentItems,
                  }
                : t.parsedOrderPayload,
          }
        : t
    );
    persistThreads(updatedThreads);
    const built = buildSuggestedEmailContent({
      templateType,
      chain: selectedThread.chain,
      aviso: updatedAviso,
      items: currentItems.length > 0 ? currentItems : selectedThread.parsedOrderPayload?.items || [],
      signatureFooter: config.signatureFooter,
    });
    setEmailSubject(built.subject);
    setEmailBody(built.body);
    setStatusBanner({
      type: 'success',
      text: `Pobrano dane z otwartej faktury (${updatedAviso.invoiceNumber}, ${updatedAviso.totalPiecesCount} szt.) do tabeli awizacji.`,
    });
  };

  // Przełączanie adresata z chipów Centrum Wiedzy
  const toggleRecipientEmail = (email: string, target: 'TO' | 'CC' = 'TO') => {
    const currentStr = target === 'TO' ? recipientTo : recipientCc;
    const list = currentStr
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const exists = list.some((e) => e.toLowerCase() === email.toLowerCase());
    const nextList = exists
      ? list.filter((e) => e.toLowerCase() !== email.toLowerCase())
      : [...list, email];
    if (target === 'TO') {
      setRecipientTo(nextList.join(', '));
    } else {
      setRecipientCc(nextList.join(', '));
    }
  };

  // Wczytanie zamówienia z maila bezpośrednio do Generatora Faktur
  const handleLoadThreadToGenerator = (thread: ZenboxOrderThread) => {
    if (!thread.parsedOrderPayload) return;
    onLoadOrderFromEmail({
      chain: thread.chain,
      orderNumber: thread.parsedOrderPayload.orderNumber,
      orderDate: thread.parsedOrderPayload.orderDate,
      deliveryDate: thread.parsedOrderPayload.deliveryDate,
      buyer: thread.parsedOrderPayload.buyer,
      items: thread.parsedOrderPayload.items,
    });
    const updated = threads.map((t) =>
      t.id === thread.id ? { ...t, orderLoadedToGenerator: true } : t
    );
    persistThreads(updated);
    onClose();
  };

  // Sprawdzenie skrzynki IMAP Zenbox (w bezpiecznym trybie EXAMINE Read-Only)
  const handleCheckImapNow = async () => {
    setIsSyncingImap(true);
    setStatusBanner(null);
    try {
      const res = await fetch('/api/zenbox-fetch-imap', { method: 'POST' });
      const data = await res.json();
      setStatusBanner({
        type: data.ok ? 'success' : 'info',
        text: data.message || 'Zsynchronizowano stan skrzynki Zenbox.',
      });
    } catch (e: any) {
      setStatusBanner({
        type: 'warning',
        text: `Nie udało się połączyć z endpointem IMAP: ${e?.message || String(e)}`,
      });
    } finally {
      setIsSyncingImap(false);
    }
  };

  // Wysyłka odpowiedzi bezpośrednio z aplikacji (SMTP Zenbox + zapis w historii wątku + autozałącznik .xlsx)
  const handleSendEmailFromApp = async () => {
    if (!selectedThread) return;
    const toList = recipientTo
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const ccList = recipientCc
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (toList.length === 0) {
      setStatusBanner({
        type: 'warning',
        text: 'Wybierz lub wpisz przynajmniej jeden adres odbiorcy w polu „Do:”.',
      });
      return;
    }

    setIsSendingEmail(true);
    setStatusBanner(null);

    try {
      const outgoingAttachments: EmailAttachmentItem[] = [];
      const orderItems = selectedThread.parsedOrderPayload?.items || currentItems;

      if (attachAvisoExcel) {
        const xlsxGen = generateAvisoExcelBase64(
          selectedThread.avisoData,
          orderItems,
          selectedThread.chain
        );
        outgoingAttachments.push({
          id: `att-aviso-${Date.now()}`,
          filename: xlsxGen.filename,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          sizeKb: xlsxGen.sizeKb,
          kind: 'AVISO_XLSX',
          base64Content: xlsxGen.base64,
        });
      }

      if (attachKsefInvoiceInfo) {
        const invNo = selectedThread.avisoData.invoiceNumber || currentMeta.invoiceNumber || 'FV';
        const safeInv = invNo.replace(/[^a-zA-Z0-9_-]/g, '_');
        outgoingAttachments.push({
          id: `att-fv-${Date.now()}`,
          filename: `Faktura_KSeF_${safeInv}.xml`,
          mimeType: 'application/xml',
          sizeKb: 14,
          kind: 'INVOICE_XML',
        });
      }

      const res = await fetch('/api/zenbox-send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toList,
          cc: ccList,
          subject: emailSubject,
          body: emailBody,
          attachments: outgoingAttachments,
          templateType,
        }),
      });
      const result = await res.json();

      const newMessage: ZenboxEmailMessage = {
        id: `msg-out-${Date.now()}`,
        direction: 'OUTBOUND',
        fromName: 'Dział Zamówień — Eubiosis Sp. z o.o.',
        fromEmail: config.emailAddress || 'zamowienia@eubiosis.pl',
        toEmails: toList,
        ccEmails: ccList,
        subject: emailSubject,
        bodyText: emailBody,
        sentAt: new Date().toISOString(),
        attachments: outgoingAttachments.map(({ base64Content, ...rest }) => rest),
      };

      const isAvisoMsg = templateType === 'AVISO_TABLE' || attachAvisoExcel;
      const isFvMsg = templateType === 'SEND_INVOICE_FV' || attachKsefInvoiceInfo;

      const updatedThreads = threads.map((t) => {
        if (t.id !== selectedThread.id) return t;
        const nextAvisoSent = t.avisoSent || isAvisoMsg;
        const nextFvSent = t.fvSent || isFvMsg;
        const nextArchived = Boolean(nextFvSent && t.isOrderDelivered);
        return {
          ...t,
          avisoSent: nextAvisoSent,
          fvSent: nextFvSent,
          isArchived: nextArchived,
          messages: [...t.messages, newMessage],
        };
      });

      await persistThreads(updatedThreads);

      setStatusBanner({
        type: 'success',
        text:
          result.statusMessage ||
          `Odpowiedź została zapisana w wątku zamówienia ${selectedThread.orderNumber}.`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'warning',
        text: `Błąd podczas wysyłania wiadomości: ${err?.message || String(err)}`,
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Tryb tradycyjny / hybrydowy: Otwórz w domyślnym programie pocztowym (mailto:) + pobierz automatycznie plik .xlsx awizacji
  const handleOpenInExternalMailClient = () => {
    if (!selectedThread) return;
    const orderItems = selectedThread.parsedOrderPayload?.items || currentItems;

    // 1. Jeśli to awizacja, od razu pobierz gotowy plik .xlsx na dysk, żeby użytkowniczka mogła go dołączyć do maila
    if (attachAvisoExcel) {
      downloadAvisoExcelFile(selectedThread.avisoData, orderItems, selectedThread.chain);
    }

    // 2. Zapisz ślad wiadomości w wątku i oznacz etap (Awizacja lub FV)
    const toList = recipientTo
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const ccList = recipientCc
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const newMessage: ZenboxEmailMessage = {
      id: `msg-mailto-${Date.now()}`,
      direction: 'OUTBOUND',
      fromName: 'Eubiosis Sp. z o.o. (Program pocztowy)',
      fromEmail: config.emailAddress || 'zamowienia@eubiosis.pl',
      toEmails: toList,
      ccEmails: ccList,
      subject: emailSubject,
      bodyText: emailBody,
      sentAt: new Date().toISOString(),
      attachments: attachAvisoExcel
        ? [
            {
              id: `att-local-${Date.now()}`,
              filename: `Awizacja_${selectedThread.chain}_${selectedThread.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`,
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              sizeKb: 18,
              kind: 'AVISO_XLSX',
            },
          ]
        : [],
    };

    const isAvisoMsg = templateType === 'AVISO_TABLE' || attachAvisoExcel;
    const isFvMsg = templateType === 'SEND_INVOICE_FV' || attachKsefInvoiceInfo;

    const updatedThreads = threads.map((t) => {
      if (t.id !== selectedThread.id) return t;
      const nextAvisoSent = t.avisoSent || isAvisoMsg;
      const nextFvSent = t.fvSent || isFvMsg;
      return {
        ...t,
        avisoSent: nextAvisoSent,
        fvSent: nextFvSent,
        isArchived: Boolean(nextFvSent && t.isOrderDelivered),
        messages: [...t.messages, newMessage],
      };
    });
    persistThreads(updatedThreads);

    // 3. Wywołaj link mailto:
    const mailtoUrl = `mailto:${encodeURIComponent(toList.join(','))}?${
      ccList.length > 0 ? `cc=${encodeURIComponent(ccList.join(','))}&` : ''
    }subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoUrl;

    setStatusBanner({
      type: 'success',
      text: attachAvisoExcel
        ? 'Otwarto program pocztowy z gotową treścią ze stopką ORAZ pobrano plik Awizacji .xlsx na dysk (dołącz go do wiadomości).'
        : 'Otwarto program pocztowy z gotowym tematem, odbiorcami i treścią ze stopką.',
    });
  };

  // Ręczne przełączniki etapów (gdy użytkowniczka wysłała maila ze zwykłej poczty i chce odhaczyć etap 1 kliknięciem)
  const handleToggleStageFlag = (
    threadId: string,
    stage: 'orderLoadedToGenerator' | 'avisoSent' | 'fvSent' | 'isOrderDelivered'
  ) => {
    const updated = threads.map((t) => {
      if (t.id !== threadId) return t;
      const nextVal = !t[stage];
      const nextThread = {
        ...t,
        [stage]: nextVal,
      };
      nextThread.isArchived = Boolean(nextThread.fvSent && nextThread.isOrderDelivered);

      // Jeśli oznaczono przesyłkę jako dostarczoną, zaktualizuj również w Historii Zamówień
      if (stage === 'isOrderDelivered' && nextVal && onMarkOrderDeliveredInHistory) {
        onMarkOrderDeliveredInHistory(t.orderNumber, t.avisoData.invoiceNumber);
      }

      return nextThread;
    });
    persistThreads(updated);
  };

  // Zapis ustawień skrzynki Zenbox
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(ZENBOX_CONFIG_LOCAL_KEY, JSON.stringify(config));
    } catch {}
    try {
      const res = await fetch('/api/zenbox-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const saved = await res.json();
        setConfig((prev) => ({ ...prev, ...saved }));
      }
    } catch {}
    setShowSettingsModal(false);
    setStatusBanner({
      type: 'success',
      text: 'Zapisano konfigurację skrzynki Zenbox oraz domyślną stopkę firmową.',
    });
  };

  // Dodanie nowego wątku zamówienia
  const handleCreateNewThread = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThreadOrderNum.trim()) return;
    const cleanOrd = newThreadOrderNum.trim();
    const id = `zenbox-thread-${Date.now()}`;
    const newThread: ZenboxOrderThread = {
      id,
      chain: newThreadChain,
      orderNumber: cleanOrd,
      buyerName:
        newThreadChain === 'DR_MAX'
          ? 'Dr. Max Sp. z o.o.'
          : 'DOZ S.A. Direct Sp.k.',
      warehouseLocation: newThreadWarehouse,
      receivedAt: new Date().toISOString(),
      requestedDeliveryDate: newThreadDeliveryDate,
      orderLoadedToGenerator: false,
      avisoSent: false,
      fvSent: false,
      isOrderDelivered: false,
      isArchived: false,
      avisoData: {
        supplierName: 'Eubiosis Sp. z o.o.',
        orderNumber: cleanOrd,
        invoiceNumber: currentMeta.invoiceNumber || 'FV/01/10/2026',
        cartonsCount: 4,
        euroPalletsCount: 1,
        totalPiecesCount:
          currentItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0) || 120,
        plannedDeliveryDate: newThreadDeliveryDate,
        plannedDeliveryTimeWindow: '08:00 - 12:00',
        carrierName: 'DPD Polska / Kurier Paletowy',
        driverName: 'Zgłoszenie kurierskie B2B',
        driverPhone: '+48 500 600 700',
        truckPlates: 'Kurier B2B',
        unloadingWarehouse: newThreadWarehouse,
        notes: 'Produkty z terminem ważności powyżej wymaganego minimum.',
      },
      parsedOrderPayload: {
        orderNumber: cleanOrd,
        orderDate: new Date().toISOString().slice(0, 10),
        deliveryDate: newThreadDeliveryDate,
        buyer: currentBuyer,
        items: currentItems,
      },
      messages: [
        {
          id: `msg-in-${Date.now()}`,
          direction: 'INBOUND',
          fromName:
            newThreadChain === 'DR_MAX'
              ? 'Dział Zakupów Centralnych Dr. Max'
              : 'Dział Zakupów DOZ Direct',
          fromEmail: newThreadSenderEmail,
          toEmails: [config.emailAddress || 'zamowienia@eubiosis.pl'],
          subject: `Zamówienie nr ${cleanOrd} - ${newThreadWarehouse}`,
          bodyText: `Dzień dobry,\nW załączeniu przesyłamy zamówienie nr ${cleanOrd}.\nPlanowana data dostawy: ${newThreadDeliveryDate}.\nProsimy o przesłanie awizacji dostawy.`,
          sentAt: new Date().toISOString(),
          attachments: [
            {
              id: `att-in-${Date.now()}`,
              filename: `Zamowienie_${cleanOrd.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
              mimeType: 'application/pdf',
              sizeKb: 120,
              kind: 'ORDER_PDF',
            },
          ],
        },
      ],
    };

    const updated = [newThread, ...threads];
    persistThreads(updated);
    setSelectedThreadId(id);
    setActiveFolder('ACTIVE');
    setShowNewThreadModal(false);
    setNewThreadOrderNum('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-[1440px] h-[93vh] flex flex-col overflow-hidden">
        {/* GÓRNY PASEK NAGŁÓWKA SKRZYNKI ZENBOX */}
        <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center border border-white/20 shadow-inner">
              <Mail className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  📬 Skrzynka Zamówień i Awizacji Zenbox
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                  Tryb Hybrydowy (IMAP Read-Only + Twoja Poczta + Aplikacja)
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                Dedykowana skrzynka: <strong className="text-white">{config.emailAddress}</strong> •
                Podpowiedzi adresów z Centrum Wiedzy • Autouzupełnianie Awizacji Dr. Max (.xlsx) •
                Archiwizacja po wysłaniu FV i doręczeniu
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCheckImapNow}
              disabled={isSyncingImap}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition cursor-pointer"
              title="Sprawdź nowe maile z zamówieniami na serwerze imap.zenbox.pl (w trybie Read-Only)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingImap ? 'animate-spin' : ''}`} />
              {isSyncingImap ? 'Sprawdzanie Zenbox...' : 'Odśwież pocztę IMAP'}
            </button>

            <button
              type="button"
              onClick={() => setShowNewThreadModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nowy wątek zamówienia
            </button>

            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              Konfiguracja Zenbox i Stopki
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/80 text-white transition cursor-pointer"
              title="Zamknij skrzynkę Zenbox"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BANER KOMUNIKATU STATUSU */}
        {statusBanner && (
          <div
            className={`px-5 py-2.5 text-xs font-bold flex items-center justify-between gap-3 border-b shrink-0 ${
              statusBanner.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : statusBanner.type === 'warning'
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-indigo-50 text-indigo-900 border-indigo-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
              )}
              <span>{statusBanner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-slate-500 hover:text-slate-800 font-black px-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* GŁÓWNY UKŁAD 2-KOLUMNOWY: LISTA WĄTKÓW PO LEWEJ | SZCZEGÓŁY WĄTKU + AWIZACJA + ODPOWIEDŹ PO PRAWEJ */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-50">
          {/* LEWA KOLUMNA: ZAKŁADKI (W REALIZACJI vs ARCHIWUM) + LISTA WĄTKÓW */}
          <div className="w-full lg:w-[370px] xl:w-[400px] border-r border-slate-200 bg-white flex flex-col shrink-0">
            {/* Przełącznik zakładek */}
            <div className="p-3 border-b border-slate-200 bg-slate-50/80">
              <div className="grid grid-cols-2 gap-1.5 bg-slate-200/80 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setActiveFolder('ACTIVE');
                    if (activeThreads[0]) setSelectedThreadId(activeThreads[0].id);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    activeFolder === 'ACTIVE'
                      ? 'bg-white text-indigo-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Inbox className="w-3.5 h-3.5 text-indigo-600" />
                  <span>W Realizacji</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-black">
                    {activeThreads.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveFolder('ARCHIVE');
                    if (archivedThreads[0]) setSelectedThreadId(archivedThreads[0].id);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    activeFolder === 'ARCHIVE'
                      ? 'bg-white text-emerald-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Archive className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Archiwum</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-black">
                    {archivedThreads.length}
                  </span>
                </button>
              </div>

              <div className="mt-2 px-1 text-[11px] text-slate-500 flex items-center justify-between">
                {activeFolder === 'ACTIVE' ? (
                  <span>
                    📌 Wątki przechodzą do <strong>Archiwum</strong> dopiero po wysłaniu FV{' '}
                    <strong>oraz</strong> doręczeniu przesyłki.
                  </span>
                ) : (
                  <span>
                    ✅ Zamknięte wątki (wysłana Faktura VAT + dostarczona przesyłka w Zakończonych).
                  </span>
                )}
              </div>
            </div>

            {/* Lista wątków */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {visibleThreads.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    {activeFolder === 'ACTIVE' ? (
                      <Inbox className="w-6 h-6" />
                    ) : (
                      <Archive className="w-6 h-6" />
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-700">
                    {activeFolder === 'ACTIVE'
                      ? 'Brak aktywnych zamówień w realizacji'
                      : 'Archiwum zamkniętych zamówień jest puste'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {activeFolder === 'ACTIVE'
                      ? 'Wszystkie zamówienia mają już wysłaną FV oraz dostarczoną przesyłkę.'
                      : 'Wątki pojawią się tutaj automatycznie, gdy wyślesz FV i oznaczysz przesyłkę jako dostarczoną.'}
                  </p>
                </div>
              ) : (
                visibleThreads.map((thr) => {
                  const isSelected = selectedThread?.id === thr.id;
                  const lastMsg = thr.messages[thr.messages.length - 1];
                  return (
                    <div
                      key={thr.id}
                      onClick={() => setSelectedThreadId(thr.id)}
                      className={`p-3.5 transition cursor-pointer border-l-4 ${
                        isSelected
                          ? 'bg-indigo-50/70 border-l-indigo-600'
                          : 'hover:bg-slate-50 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            thr.chain === 'DR_MAX'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-amber-100 text-amber-900 border border-amber-200'
                          }`}
                        >
                          {thr.chain === 'DR_MAX' ? '🏥 Dr. Max' : '🟠 DOZ Direct'}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">
                          {new Date(thr.receivedAt).toLocaleDateString('pl-PL', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-black text-slate-900 truncate">
                          Zamówienie {thr.orderNumber}
                        </p>
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full">
                          {thr.messages.length} wiad.
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-slate-600 truncate mt-0.5">
                        📍 {thr.warehouseLocation}
                      </p>

                      {lastMsg && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-1">
                          {lastMsg.direction === 'OUTBOUND' ? '📤 Ty: ' : '📥 Klient: '}
                          {lastMsg.subject}
                        </p>
                      )}

                      {/* Mini-pasek postępu 4 kroków */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            thr.orderLoadedToGenerator
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {thr.orderLoadedToGenerator ? '✓ Wczytano' : '1. Do wczytania'}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            thr.avisoSent
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {thr.avisoSent ? '✓ Awizacja' : '2. Awizacja'}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            thr.fvSent
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {thr.fvSent ? '✓ Wysłano FV' : '3. Wyślij FV'}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            thr.isOrderDelivered
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {thr.isOrderDelivered ? '✓ Dostarczona' : '4. W drodze'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* PRAWA KOLUMNA: SZCZEGÓŁY WĄTKU, PASEK CYKLU ŻYCIA, AUTOUZUPEŁNIANIE AWIZACJI DR. MAX I KOMPOZYTOR ODPOWIEDZI */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {!selectedThread ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
                <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-base font-bold text-slate-700">
                  Wybierz wątek zamówienia z listy po lewej stronie
                </p>
              </div>
            ) : (
              <>
                {/* KARTA NAGŁÓWKOWA WĄTKU + 4-STOPNIOWY CYKL ŻYCIA ZAMÓWIENIA DO ARCHIWUM */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase ${
                            selectedThread.chain === 'DR_MAX'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {selectedThread.chain === 'DR_MAX' ? '🏥 Dr. Max' : '🟠 DOZ Direct'}
                        </span>
                        <h3 className="text-lg sm:text-xl font-black text-slate-900">
                          Zamówienie nr {selectedThread.orderNumber}
                        </h3>
                        {selectedThread.isArchived ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <Archive className="w-3.5 h-3.5" />W Archiwum (Zamknięte)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            <Clock className="w-3.5 h-3.5" />W Realizacji
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                        Nabywca: <strong className="text-slate-900">{selectedThread.buyerName}</strong>{' '}
                        • Miejsce dostawy:{' '}
                        <strong className="text-indigo-900">{selectedThread.warehouseLocation}</strong>{' '}
                        • Planowana dostawa:{' '}
                        <strong className="text-emerald-700">
                          {selectedThread.requestedDeliveryDate}
                        </strong>
                      </p>
                    </div>

                    {/* Przycisk 1-Click: Wczytaj zamówienie do Generatora Faktur */}
                    {selectedThread.parsedOrderPayload && (
                      <button
                        type="button"
                        onClick={() => handleLoadThreadToGenerator(selectedThread)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs sm:text-sm font-black shadow-md transition cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        📥 Wczytaj to zamówienie do Generatora Faktur
                      </button>
                    )}
                  </div>

                  {/* 4-ETAPOWY PASEK POSTĘPU (Z MOŻLIWOŚCIĄ ODHACZENIA RÓWNIEŻ PRZY PRACY PRZEZ ZWYKŁEGO MAILA) */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        Cykl życia zamówienia (kliknij etap, jeśli wykonałaś go tradycyjnie w swoim programie pocztowym):
                      </span>
                      <span className="text-[11px] font-bold text-indigo-700">
                        Archiwizacja następuje automatycznie po spełnieniu Kroku 3 + Kroku 4
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleStageFlag(selectedThread.id, 'orderLoadedToGenerator')
                        }
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                          selectedThread.orderLoadedToGenerator
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 font-black ${
                            selectedThread.orderLoadedToGenerator
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {selectedThread.orderLoadedToGenerator ? <Check className="w-3.5 h-3.5" /> : '1'}
                        </div>
                        <div>
                          <div className="font-extrabold">1. Wczytano zamówienie</div>
                          <div className="text-[10px] opacity-80">Do Generatora Faktur</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStageFlag(selectedThread.id, 'avisoSent')}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                          selectedThread.avisoSent
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-100/70'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 font-black ${
                            selectedThread.avisoSent
                              ? 'bg-emerald-600 text-white'
                              : 'bg-amber-500 text-white'
                          }`}
                        >
                          {selectedThread.avisoSent ? <Check className="w-3.5 h-3.5" /> : '2'}
                        </div>
                        <div>
                          <div className="font-extrabold">2. Ustalono awizację</div>
                          <div className="text-[10px] opacity-80">Wysłano tabelę .xlsx</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStageFlag(selectedThread.id, 'fvSent')}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                          selectedThread.fvSent
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-indigo-50/70 border-indigo-200 text-indigo-900 hover:bg-indigo-100/70'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 font-black ${
                            selectedThread.fvSent
                              ? 'bg-emerald-600 text-white'
                              : 'bg-indigo-600 text-white'
                          }`}
                        >
                          {selectedThread.fvSent ? <Check className="w-3.5 h-3.5" /> : '3'}
                        </div>
                        <div>
                          <div className="font-extrabold">3. Wysłano Fakturę VAT</div>
                          <div className="text-[10px] opacity-80">FV KSeF wysłana do klienta</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleToggleStageFlag(selectedThread.id, 'isOrderDelivered')
                        }
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                          selectedThread.isOrderDelivered
                            ? 'bg-emerald-600 border-emerald-700 text-white shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 font-black ${
                            selectedThread.isOrderDelivered
                              ? 'bg-white text-emerald-700'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {selectedThread.isOrderDelivered ? <Check className="w-3.5 h-3.5" /> : '4'}
                        </div>
                        <div>
                          <div className="font-extrabold">4. Dostarczona (Zakończone)</div>
                          <div className="text-[10px] opacity-85">
                            {selectedThread.isArchived
                              ? 'Przeniesiono do Archiwum'
                              : 'Przenosi wątek do Archiwum'}
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* HISTORIA WIADOMOŚCI W WĄTKU (PRZYCHODZĄCE ZAMÓWIENIE + NASZE ODPOWIEDZI) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    Historia korespondencji w tym zamówieniu ({selectedThread.messages.length})
                  </h4>

                  <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                    {selectedThread.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3.5 rounded-2xl border text-xs ${
                          msg.direction === 'INBOUND'
                            ? 'bg-slate-50 border-slate-200'
                            : 'bg-indigo-50/60 border-indigo-200 ml-4 sm:ml-8'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                msg.direction === 'INBOUND'
                                  ? 'bg-slate-200 text-slate-800'
                                  : 'bg-indigo-600 text-white'
                              }`}
                            >
                              {msg.direction === 'INBOUND' ? '📥 Przychodząca' : '📤 Wysłana odpowiedź'}
                            </span>
                            <span className="font-extrabold text-slate-900">{msg.fromName}</span>
                            <span className="text-slate-500">&lt;{msg.fromEmail}&gt;</span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-semibold">
                            {new Date(msg.sentAt).toLocaleString('pl-PL')}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 mb-2">
                          Do: <strong className="text-slate-700">{msg.toEmails.join(', ')}</strong>
                          {msg.ccEmails && msg.ccEmails.length > 0 && (
                            <>
                              {' '}
                              • DW: <strong className="text-slate-700">{msg.ccEmails.join(', ')}</strong>
                            </>
                          )}
                        </div>

                        <div className="font-bold text-slate-800 mb-1.5">Temat: {msg.subject}</div>
                        <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 bg-white/80 p-3 rounded-xl border border-slate-200/70 leading-relaxed">
                          {msg.bodyText}
                        </pre>

                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            {msg.attachments.map((att) => (
                              <span
                                key={att.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 shadow-2xs"
                              >
                                <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                                {att.filename} ({att.sizeKb} KB)
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* SEKCJA AUTOUZUPEŁNIANIA PLIKU AWIZACJI (.XLSX) DLA DR. MAX / DOZ DIRECT */}
                <div className="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/60 rounded-2xl border-2 border-emerald-200 shadow-sm p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                          📊 Autouzupełnianie Pliku Awizacji Dostawy (.xlsx) —{' '}
                          {selectedThread.chain === 'DR_MAX'
                            ? 'Standard Dr. Max (Załącznik nr 1 Poradnika Dostawcy)'
                            : 'Standard DOZ Direct'}
                        </h4>
                        <p className="text-xs text-emerald-800">
                          Tabela zawiera wszystkie 11 kolumn wymaganych przez magazyn oraz arkusz z
                          numerami serii (LOT) i datami ważności (MHD &gt; 6 msc).
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handlePullFromCurrentGenerator}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold transition cursor-pointer"
                        title="Przepisz numer faktury, datę dostawy i sumę sztuk z aktualnie otwartej faktury w Generatorze"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                        Pobierz dane z otwartej FV
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          downloadAvisoExcelFile(
                            selectedThread.avisoData,
                            selectedThread.parsedOrderPayload?.items || currentItems,
                            selectedThread.chain
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xs transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Pobierz gotowy plik Awizacji (.xlsx)
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowAvisoEditor((v) => !v)}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold transition cursor-pointer"
                      >
                        {showAvisoEditor ? 'Zwiń pola tabeli' : 'Edytuj pola tabeli'}
                      </button>
                    </div>
                  </div>

                  {showAvisoEditor && (
                    <div className="mt-4 pt-4 border-t border-emerald-200/70 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          1. Nazwa Dostawcy
                        </label>
                        <input
                          type="text"
                          value={selectedThread.avisoData.supplierName}
                          onChange={(e) => handleUpdateAvisoField('supplierName', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          2. Nr Zamówienia Klienta
                        </label>
                        <input
                          type="text"
                          value={selectedThread.avisoData.orderNumber}
                          onChange={(e) => handleUpdateAvisoField('orderNumber', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          3. Nr Faktury VAT (KSeF)
                        </label>
                        <input
                          type="text"
                          value={selectedThread.avisoData.invoiceNumber}
                          onChange={(e) => handleUpdateAvisoField('invoiceNumber', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-emerald-400 text-xs font-black bg-white text-emerald-950"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          4. Planowana data dostawy + Okno
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="date"
                            value={selectedThread.avisoData.plannedDeliveryDate}
                            onChange={(e) =>
                              handleUpdateAvisoField('plannedDeliveryDate', e.target.value)
                            }
                            className="w-1/2 px-2 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                          />
                          <input
                            type="text"
                            value={selectedThread.avisoData.plannedDeliveryTimeWindow}
                            onChange={(e) =>
                              handleUpdateAvisoField('plannedDeliveryTimeWindow', e.target.value)
                            }
                            placeholder="08:00 - 12:00"
                            className="w-1/2 px-2 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          5. Ilość kartonów / Palet EUR / Sztuk
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          <input
                            type="number"
                            min={0}
                            value={selectedThread.avisoData.cartonsCount}
                            onChange={(e) =>
                              handleUpdateAvisoField('cartonsCount', Number(e.target.value))
                            }
                            title="Ilość kartonów"
                            className="px-2 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                          />
                          <input
                            type="number"
                            min={0}
                            value={selectedThread.avisoData.euroPalletsCount}
                            onChange={(e) =>
                              handleUpdateAvisoField('euroPalletsCount', Number(e.target.value))
                            }
                            title="Ilość palet EUR"
                            className="px-2 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                          />
                          <input
                            type="number"
                            min={1}
                            value={selectedThread.avisoData.totalPiecesCount}
                            onChange={(e) =>
                              handleUpdateAvisoField('totalPiecesCount', Number(e.target.value))
                            }
                            title="Łączna ilość sztuk"
                            className="px-2 py-1.5 rounded-xl border border-emerald-300 text-xs font-black bg-emerald-50 text-emerald-900"
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">
                          Kartony: {selectedThread.avisoData.cartonsCount} | Palety EUR:{' '}
                          {selectedThread.avisoData.euroPalletsCount} | Sztuk:{' '}
                          {selectedThread.avisoData.totalPiecesCount}
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          6. Spedytor / Przewoźnik
                        </label>
                        <input
                          type="text"
                          value={selectedThread.avisoData.carrierName}
                          onChange={(e) => handleUpdateAvisoField('carrierName', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          7. Kierowca i Nr auta / List przewozowy
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={selectedThread.avisoData.driverName}
                            onChange={(e) => handleUpdateAvisoField('driverName', e.target.value)}
                            placeholder="Kierowca"
                            className="w-1/2 px-2 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                          />
                          <input
                            type="text"
                            value={selectedThread.avisoData.truckPlates}
                            onChange={(e) => handleUpdateAvisoField('truckPlates', e.target.value)}
                            placeholder="Nr rej. / kurier"
                            className="w-1/2 px-2 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          8. Magazyn rozładunku
                        </label>
                        <input
                          type="text"
                          value={selectedThread.avisoData.unloadingWarehouse}
                          onChange={(e) =>
                            handleUpdateAvisoField('unloadingWarehouse', e.target.value)
                          }
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* KOMPOZYTOR ODPOWIEDZI NA MAILA (AWIZACJA -> FAKTURA VAT) Z PODPOWIEDZIAMI Z CENTRUM WIEDZY I STOPKĄ */}
                <div className="bg-white rounded-2xl border-2 border-indigo-200 shadow-sm p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-black text-indigo-950 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      Odpowiedz na zamówienie (Podpowiedzi treści + Adresy z Centrum Wiedzy + Automatyczna Stopka)
                    </h4>
                    <span className="text-[11px] font-bold text-slate-500">
                      Możesz wysłać prosto z aplikacji LUB otworzyć w swoim programie pocztowym
                    </span>
                  </div>

                  {/* Wybór gotowego szablonu odpowiedzi 1 kliknięciem */}
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                      1. Wybierz gotowy szablon wiadomości (automatycznie ustawi temat, treść, załącznik i stopkę):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectTemplate('AVISO_TABLE')}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                          templateType === 'AVISO_TABLE'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50'
                        }`}
                      >
                        <Truck className="w-4 h-4 shrink-0" />
                        <div>
                          <div className="font-black">1. Awizacja dostawy</div>
                          <div className="text-[10px] opacity-85">+ załącznik tabeli .xlsx</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectTemplate('SEND_INVOICE_FV')}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                          templateType === 'SEND_INVOICE_FV'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50'
                        }`}
                      >
                        <Receipt className="w-4 h-4 shrink-0" />
                        <div>
                          <div className="font-black">2. Wyślij Fakturę VAT</div>
                          <div className="text-[10px] opacity-85">Potwierdzenie FV KSeF + WZ</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectTemplate('ORDER_CONFIRMATION')}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                          templateType === 'ORDER_CONFIRMATION'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <div>
                          <div className="font-black">3. Potwierdzenie przyjęcia</div>
                          <div className="text-[10px] opacity-85">Potwierdzenie realizacji</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectTemplate('CUSTOM_REPLY')}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                          templateType === 'CUSTOM_REPLY'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50'
                        }`}
                      >
                        <Mail className="w-4 h-4 shrink-0" />
                        <div>
                          <div className="font-black">4. Własna odpowiedź</div>
                          <div className="text-[10px] opacity-85">Z automatyczną stopką</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Podpowiadane maile korespondencyjne z Centrum Wiedzy */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                        Podpowiadane adresy korespondencyjne z Centrum Wiedzy (kliknij, aby dodać do „Do:”):
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedRecipients.map((rec) => {
                        const isSelectedInTo = recipientTo
                          .toLowerCase()
                          .includes(rec.email.toLowerCase());
                        return (
                          <button
                            key={rec.email}
                            type="button"
                            onClick={() => toggleRecipientEmail(rec.email, 'TO')}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                              isSelectedInTo
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
                            }`}
                            title={`${rec.role} (${rec.chain})`}
                          >
                            <span>
                              {rec.category === 'AWIZACJA'
                                ? '🚚'
                                : rec.category === 'FAKTURY'
                                ? '🧾'
                                : '👤'}
                            </span>
                            <span>{rec.label}:</span>
                            <span className="underline">{rec.email}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pola Do / DW / Temat */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Do (Odbiorcy wiadomości — oddzieleni przecinkiem):
                      </label>
                      <input
                        type="text"
                        value={recipientTo}
                        onChange={(e) => setRecipientTo(e.target.value)}
                        placeholder="np. awizacje.wroclaw@drmax.com.pl"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        DW / CC (Do wiadomości — np. dział zakupów):
                      </label>
                      <input
                        type="text"
                        value={recipientCc}
                        onChange={(e) => setRecipientCc(e.target.value)}
                        placeholder="np. zamowienia@drmax.com.pl"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Temat wiadomości:
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-extrabold text-slate-900"
                    />
                  </div>

                  {/* Załączniki dołączane automatycznie */}
                  <div className="flex flex-wrap items-center gap-4 bg-indigo-50/60 px-3.5 py-2.5 rounded-xl border border-indigo-200/80">
                    <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-indigo-600" />
                      Załączniki do wiadomości:
                    </span>

                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={attachAvisoExcel}
                        onChange={(e) => setAttachAvisoExcel(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                        Awizacja_{selectedThread.chain}_
                        {selectedThread.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx
                        (Autouzupełniony)
                      </span>
                    </label>

                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={attachKsefInvoiceInfo}
                        onChange={(e) => setAttachKsefInvoiceInfo(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-300">
                        <FileText className="w-3.5 h-3.5 text-indigo-700" />
                        Faktura_KSeF_
                        {(selectedThread.avisoData.invoiceNumber || 'FV').replace(
                          /[^a-zA-Z0-9_-]/g,
                          '_'
                        )}
                        .xml
                      </span>
                    </label>
                  </div>

                  {/* Edytor treści wiadomości ze stopką */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-600">
                        Treść wiadomości (stopka firmowa Eubiosis Sp. z o.o. jest zawsze dodana na końcu):
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(emailBody);
                          setCopiedNotice(true);
                          setTimeout(() => setCopiedNotice(false), 2500);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedNotice ? '✓ Skopiowano do schowka!' : 'Kopiuj treść ze stopką'}
                      </button>
                    </div>
                    <textarea
                      rows={10}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full p-3.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 font-sans leading-relaxed focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  {/* DWA SPOSOBY WYSYŁKI (NOWY SPOSÓB Z APLIKACJI ORAZ STANDARDOWO PRZEZ PROGRAM POCZTOWY) */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleSendEmailFromApp}
                        disabled={isSendingEmail}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs sm:text-sm font-black shadow-md transition cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        {isSendingEmail
                          ? 'Wysyłanie przez Zenbox...'
                          : '🚀 Wyślij bezpośrednio z aplikacji (Zenbox + Zapisz w wątku)'}
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenInExternalMailClient}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs sm:text-sm font-extrabold transition cursor-pointer"
                        title="Otwiera Twój tradycyjny program pocztowy z gotowym adresem, tematem i treścią ze stopką oraz pobiera plik .xlsx awizacji na dysk"
                      >
                        <ExternalLink className="w-4 h-4 text-amber-700" />
                        ✉️ Wyślij tradycyjnie przez mój program pocztowy (+ pobierz .xlsx)
                      </button>
                    </div>

                    <span className="text-[11px] text-slate-500 font-medium">
                      💡 Oba tryby automatycznie odhaczają wykonany etap w wątku.
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MODAL USTAWIEŃ SKRZYNKI ZENBOX I STOPKI FIRMOWEJ */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveConfig}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900">
                  Konfiguracja Skrzynki Zamówień Zenbox i Stopki
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">
              🛡️ <strong>Gwarancja bezpieczeństwa poczty:</strong> Aplikacja łączy się z serwerem{' '}
              <code>imap.zenbox.pl</code> wyłącznie w trybie <strong>EXAMINE (Read-Only)</strong>.
              Żaden mail nie jest kasowany ani przenoszony z Twojej skrzynki — możesz cały czas
              korzystać ze swojego dotychczasowego programu pocztowego równolegle z aplikacją.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dedykowany adres e-mail zamówień:
                </label>
                <input
                  type="email"
                  value={config.emailAddress}
                  onChange={(e) => setConfig({ ...config, emailAddress: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hasło skrzynki Zenbox (opcjonalnie dla bezpośredniego IMAP/SMTP):
                </label>
                <input
                  type="password"
                  value={config.password || ''}
                  onChange={(e) => setConfig({ ...config, password: e.target.value })}
                  placeholder="Wpisz hasło do skrzynki Zenbox..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Serwer przychodzący IMAP SSL:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={config.imapHost}
                    onChange={(e) => setConfig({ ...config, imapHost: e.target.value })}
                    className="w-2/3 px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                  <input
                    type="number"
                    value={config.imapPort}
                    onChange={(e) => setConfig({ ...config, imapPort: Number(e.target.value) })}
                    className="w-1/3 px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Serwer wychodzący SMTP SSL:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={config.smtpHost}
                    onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
                    className="w-2/3 px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                  <input
                    type="number"
                    value={config.smtpPort}
                    onChange={(e) => setConfig({ ...config, smtpPort: Number(e.target.value) })}
                    className="w-1/3 px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoBccSelf}
                onChange={(e) => setConfig({ ...config, autoBccSelf: e.target.checked })}
                className="rounded text-indigo-600"
              />
              Wysyłaj automatycznie kopię BCC na mój adres ({config.emailAddress}), abym widziała
              wysłane z aplikacji maile również w tradycyjnym programie pocztowym
            </label>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Stała stopka firmowa (zawsze dodawana na końcu każdego maila):
              </label>
              <textarea
                rows={5}
                value={config.signatureFooter}
                onChange={(e) => setConfig({ ...config, signatureFooter: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs font-medium"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md cursor-pointer"
              >
                Zapisz ustawienia Zenbox i Stopkę
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DODAWANIA NOWEGO WĄTKU ZAMÓWIENIA */}
      {showNewThreadModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateNewThread}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                ➕ Dodaj nowy wątek zamówienia do Skrzynki Zenbox
              </h3>
              <button
                type="button"
                onClick={() => setShowNewThreadModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewThreadChain('DR_MAX');
                  setNewThreadSenderEmail('zamowienia.wroclaw@drmax.com.pl');
                  setNewThreadWarehouse(
                    'Magazyn Dr. Max Wrocław (ul. Bierutowska 81, 51-317 Wrocław)'
                  );
                }}
                className={`p-3 rounded-xl border text-xs font-black cursor-pointer ${
                  newThreadChain === 'DR_MAX'
                    ? 'bg-rose-50 border-rose-400 text-rose-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                🏥 Sieć Dr. Max
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewThreadChain('DOZ');
                  setNewThreadSenderEmail('zamowienia_direct@doz.pl');
                  setNewThreadWarehouse(
                    'Magazyn Centralny DOZ Direct (ul. Kinga C. Gillette 11, 94-406 Łódź)'
                  );
                }}
                className={`p-3 rounded-xl border text-xs font-black cursor-pointer ${
                  newThreadChain === 'DOZ'
                    ? 'bg-amber-50 border-amber-400 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                🟠 Sieć DOZ Direct
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Numer zamówienia klienta:
              </label>
              <input
                type="text"
                required
                value={newThreadOrderNum}
                onChange={(e) => setNewThreadOrderNum(e.target.value)}
                placeholder="np. ZO/2026/10/5120"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                E-mail nadawcy zamówienia:
              </label>
              <input
                type="email"
                value={newThreadSenderEmail}
                onChange={(e) => setNewThreadSenderEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Planowana data dostawy:
                </label>
                <input
                  type="date"
                  value={newThreadDeliveryDate}
                  onChange={(e) => setNewThreadDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Magazyn docelowy:
                </label>
                <input
                  type="text"
                  value={newThreadWarehouse}
                  onChange={(e) => setNewThreadWarehouse(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewThreadModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md cursor-pointer"
              >
                Utwórz wątek zamówienia
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

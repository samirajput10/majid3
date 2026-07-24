'use client';

import { useState, useMemo } from 'react';
import {
  Plus, Search, Building2, Edit2, Trash2, BarChart2,
  Wallet, ShoppingCart, Banknote, PlusCircle, MinusCircle, Printer,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import { formatCurrency, formatCurrencyFull, formatWeight, formatDate, generateId, todayISO, numberToWords } from '@/lib/utils';
import type { Company, LedgerEntry, LedgerExtraCharge, PaymentMethod } from '@/lib/types';
import { getLedgerSummary, getBalanceLabel } from '@/lib/ledger';
import { STEEL_TYPES, CEMENT_TYPES } from '@/lib/constants';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { CHART_COLORS } from '@/lib/utils';

const EMPTY_FORM = { name: '', contactPerson: '', phone: '', address: '', email: '' };
const PAYMENT_METHODS: PaymentMethod[] = ['Bank Transfer', 'Cheque', 'Cash', 'Other'];
const newLedgerItem = () => ({
  id: generateId('li'),
  mode: 'existing' as 'existing' | 'new',
  stockItemId: '',
  name: '',
  qty: '',
  rate: '',
  category: 'Steel' as 'Steel' | 'Cement',
  grade: '',
  unit: 'piece' as 'kg' | 'ton' | 'piece' | 'pack',
  quantity: '',
  batchNumber: '',
  location: '',
  notes: '',
});
type LedgerItemForm = ReturnType<typeof newLedgerItem>;

export default function CompaniesPage() {
  const { state, addCompany, updateCompany, deleteCompany, addLedgerEntry, updateLedgerEntry, deleteLedgerEntry } = useApp();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Company | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [viewId, setViewId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Payment ledger state ───────────────────────────────────────────────────
  const [ledgerCompanyId, setLedgerCompanyId] = useState<string | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [entryFormType, setEntryFormType] = useState<'Purchase' | 'Payment' | null>(null);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [detailEntryId, setDetailEntryId] = useState<string | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [ledgerSaving, setLedgerSaving] = useState(false);

  const [purchaseItems, setPurchaseItems] = useState([newLedgerItem()]);
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [purchaseNote, setPurchaseNote] = useState('');
  const [purchaseExtraCharges, setPurchaseExtraCharges] = useState<LedgerExtraCharge[]>([]);
  const [purchaseDiscount, setPurchaseDiscount] = useState('0');
  const [purchaseDiscountType, setPurchaseDiscountType] = useState<'flat' | 'percent'>('flat');
  const [purchaseAmountPaid, setPurchaseAmountPaid] = useState('');
  const [purchaseVehicle, setPurchaseVehicle] = useState('');
  const [purchaseDueDate, setPurchaseDueDate] = useState('');
  const [purchaseWorkerBId, setPurchaseWorkerBId] = useState('');
  const [purchaseWorkerBCharge, setPurchaseWorkerBCharge] = useState('');

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentDirection, setPaymentDirection] = useState<'to_company' | 'from_company'>('to_company');

  const filtered = state.companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.contactPerson.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm(EMPTY_FORM); setEditTarget(null); setModalOpen(true); };
  const openEdit = (c: Company) => {
    setEditTarget(c);
    setForm({ name: c.name, contactPerson: c.contactPerson, phone: c.phone, address: c.address, email: c.email ?? '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone) return;
    setSaving(true);
    try {
      if (editTarget) {
        await updateCompany({ ...editTarget, ...form });
      } else {
        await addCompany(form);
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const viewCompany = viewId ? state.companies.find(c => c.id === viewId) : null;

  // ── Calculate purchased totals dynamically from stock items ───────────────
  const companyStats = useMemo(() => {
    const map: Record<string, { kg: number; cost: number }> = {};
    state.stockItems.forEach(s => {
      if (!map[s.companyId]) map[s.companyId] = { kg: 0, cost: 0 };
      map[s.companyId].kg   += s.weightKg;
      map[s.companyId].cost += s.weightKg * s.pricePerKg;
    });
    return map;
  }, [state.stockItems]);
  const getPurchased = (id: string) => companyStats[id] ?? { kg: 0, cost: 0 };
  const companyStock = viewId ? state.stockItems.filter(s => s.companyId === viewId) : [];

  const totalStock = state.stockItems.reduce((s, i) => s + i.weightKg, 0);
  const totalCost = Object.values(companyStats).reduce((s, v) => s + v.cost, 0);

  const chartData = state.companies.map(c => ({
    name: c.name.split(' ')[0],
    purchased: (getPurchased(c.id).kg) / 1000,
  }));

  // ── Payment ledger ──────────────────────────────────────────────────────────
  const ledgerCompany = ledgerCompanyId ? state.companies.find(c => c.id === ledgerCompanyId) : null;
  // Hide the ledger list modal (not the flow) while a child modal is active, so
  // only one modal is visually on top at a time — mirrors the view→edit pattern
  // used elsewhere in this app (close the parent, not stack over it).
  const ledgerModalVisible = !!ledgerCompanyId && !entryFormType && !detailEntryId;

  const ledgerCompanyStock = ledgerCompanyId ? state.stockItems.filter(s => s.companyId === ledgerCompanyId) : [];

  const companyLedger = ledgerCompanyId ? state.ledgerEntries.filter(e => e.companyId === ledgerCompanyId) : [];
  const sortedLedger = [...companyLedger].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAt.localeCompare(a.createdAt);
  });
  const filteredLedger = sortedLedger.filter(e => {
    if (!ledgerSearch) return true;
    const q = ledgerSearch.toLowerCase();
    const desc = e.type === 'Purchase'
      ? (e.items ?? []).map(i => i.name).join(' ')
      : `${e.direction === 'from_company' ? 'received' : ''} ${e.method ?? ''} ${e.reference ?? ''}`;
    return e.type.toLowerCase().includes(q) || desc.toLowerCase().includes(q) || (e.note ?? '').toLowerCase().includes(q);
  });
  const ledgerSummary = getLedgerSummary(companyLedger);
  const detailEntry = detailEntryId ? companyLedger.find(e => e.id === detailEntryId) ?? null : null;

  const closeLedger = () => {
    setLedgerCompanyId(null);
    setLedgerSearch('');
    setEntryFormType(null);
    setEditingEntry(null);
    setDetailEntryId(null);
    setDeleteEntryId(null);
  };
  const openLedger = (companyId: string) => { setLedgerCompanyId(companyId); setLedgerSearch(''); };
  const closeEntryForm = () => { setEntryFormType(null); setEditingEntry(null); };

  const openPurchaseForm = (entry?: LedgerEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setPurchaseItems((entry.items ?? []).map(it => ({
        id: it.id || generateId('li'),
        // Items already linked to a real stock batch stay "existing"; items saved
        // before this link existed (or that failed to link) fall back to "new" so
        // they're still editable and will create a fresh stock batch on save.
        mode: it.stockItemId ? 'existing' as const : 'new' as const,
        stockItemId: it.stockItemId || '',
        name: it.name,
        qty: String(it.qty),
        rate: String(it.rate),
        category: (it.category as 'Steel' | 'Cement') || 'Steel',
        grade: it.grade || '',
        unit: (it.unit as 'kg' | 'ton' | 'piece' | 'pack') || 'piece',
        quantity: String(it.quantityUnits ?? 0),
        batchNumber: it.batchNumber || '',
        location: it.location || '',
        notes: it.notes || '',
      })));
      setPurchaseDate(entry.date);
      setPurchaseNote(entry.note ?? '');
      setPurchaseExtraCharges((entry.extraCharges ?? []).map(c => ({ id: c.id || generateId('ec'), description: c.description, amount: c.amount })));
      setPurchaseDiscount(String(entry.discount ?? 0));
      setPurchaseDiscountType(entry.discountType ?? 'flat');
      setPurchaseAmountPaid(entry.amountPaid ? String(entry.amountPaid) : '');
      setPurchaseVehicle(entry.vehicleNumber ?? '');
      setPurchaseDueDate(entry.dueDate ?? '');
      setPurchaseWorkerBId(entry.workerBId ?? '');
      setPurchaseWorkerBCharge(entry.workerBCharge ? String(entry.workerBCharge) : '');
    } else {
      setEditingEntry(null);
      setPurchaseItems([newLedgerItem()]);
      setPurchaseDate(todayISO());
      setPurchaseNote('');
      setPurchaseExtraCharges([]);
      setPurchaseDiscount('0');
      setPurchaseDiscountType('flat');
      setPurchaseAmountPaid('');
      setPurchaseVehicle('');
      setPurchaseDueDate('');
      setPurchaseWorkerBId('');
      setPurchaseWorkerBCharge('');
    }
    setEntryFormType('Purchase');
  };

  const openPaymentForm = (entry?: LedgerEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setPaymentAmount(String(entry.amount));
      setPaymentMethod(entry.method ?? 'Cash');
      setPaymentReference(entry.reference ?? '');
      setPaymentDate(entry.date);
      setPaymentNote(entry.note ?? '');
      setPaymentDirection(entry.direction === 'from_company' ? 'from_company' : 'to_company');
    } else {
      setEditingEntry(null);
      setPaymentAmount('');
      setPaymentMethod('Cash');
      setPaymentReference('');
      setPaymentDate(todayISO());
      setPaymentNote('');
      setPaymentDirection('to_company');
    }
    setEntryFormType('Payment');
  };

  const updatePurchaseItem = (idx: number, field: keyof LedgerItemForm, value: string) => {
    setPurchaseItems(items => items.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };
  const setItemMode = (idx: number, mode: 'existing' | 'new') => {
    setPurchaseItems(items => items.map((it, i) => i === idx ? { ...newLedgerItem(), id: it.id, mode } : it));
  };
  const selectExistingStock = (idx: number, stockItemId: string) => {
    const stock = ledgerCompanyStock.find(s => s.id === stockItemId);
    setPurchaseItems(items => items.map((it, i) => i === idx ? {
      ...it,
      stockItemId,
      name: stock ? `${stock.steelType}${stock.grade ? ` ${stock.grade}` : ''}` : '',
      category: (stock?.category as 'Steel' | 'Cement') ?? it.category,
      grade: stock?.grade ?? '',
      unit: (stock?.unit as 'kg' | 'ton' | 'piece' | 'pack') ?? it.unit,
      rate: stock ? String(stock.pricePerKg) : it.rate,
    } : it));
  };
  const purchaseItemAmount = (it: { qty: string; rate: string }) => (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0);
  const purchaseItemsTotal = purchaseItems.reduce((s, it) => s + purchaseItemAmount(it), 0);
  // Same money rules as the customer invoice form: extra charges fold into
  // the subtotal before discount; status derives from balance.
  const purchaseExtraTotal = purchaseExtraCharges.reduce((s, c) => s + (c.amount || 0), 0);
  const purchaseSubtotal = purchaseItemsTotal + purchaseExtraTotal;
  const purchaseDiscountAmt = purchaseDiscountType === 'percent'
    ? purchaseSubtotal * (parseFloat(purchaseDiscount || '0') / 100)
    : parseFloat(purchaseDiscount || '0');
  const purchaseTotal = Math.max(0, purchaseSubtotal - purchaseDiscountAmt);
  const purchasePaid = parseFloat(purchaseAmountPaid || '0');
  const purchaseBalance = Math.max(0, purchaseTotal - purchasePaid);
  const purchaseStatus: 'Paid' | 'Pending' | 'Partial' =
    purchaseBalance === 0 ? 'Paid' : purchasePaid > 0 ? 'Partial' : 'Pending';
  const purchaseValid = purchaseItems.some(it =>
    (it.mode === 'existing' ? !!it.stockItemId : it.name.trim()) && parseFloat(it.qty) > 0
  );

  const handleSavePurchase = async () => {
    if (!ledgerCompanyId || !purchaseValid || ledgerSaving) return;
    const items = purchaseItems
      .filter(it => (it.mode === 'existing' ? it.stockItemId : it.name.trim()) && parseFloat(it.qty) > 0)
      .map(it => ({
        name: it.name.trim(),
        qty: parseFloat(it.qty) || 0,
        rate: parseFloat(it.rate) || 0,
        stockItemId: it.mode === 'existing' ? it.stockItemId : undefined,
        category: it.category,
        grade: it.grade.trim(),
        unit: it.unit,
        quantityUnits: parseFloat(it.quantity) || 0,
        batchNumber: it.batchNumber.trim(),
        location: it.location.trim(),
        notes: it.notes.trim(),
      }));
    setLedgerSaving(true);
    try {
      const workerB = purchaseWorkerBId ? state.workerBs.find(w => w.id === purchaseWorkerBId) : undefined;
      const data = {
        companyId: ledgerCompanyId, type: 'Purchase' as const, date: purchaseDate, items, note: purchaseNote,
        extraCharges: purchaseExtraCharges
          .filter(c => c.description.trim())
          .map(c => ({ description: c.description.trim(), amount: c.amount || 0 })),
        discount: parseFloat(purchaseDiscount || '0'),
        discountType: purchaseDiscountType,
        subtotal: purchaseSubtotal,
        amount: purchaseTotal,
        amountPaid: purchasePaid,
        balance: purchaseBalance,
        status: purchaseStatus,
        vehicleNumber: purchaseVehicle.trim(),
        dueDate: purchaseDueDate,
        workerBId: workerB?.id ?? '',
        workerBName: workerB?.name ?? '',
        workerBCharge: workerB ? (parseFloat(purchaseWorkerBCharge) || 0) : 0,
      };
      if (editingEntry) await updateLedgerEntry(editingEntry.id, data);
      else await addLedgerEntry(data);
      closeEntryForm();
    } finally {
      setLedgerSaving(false);
    }
  };

  const handleSavePayment = async () => {
    const amt = parseFloat(paymentAmount) || 0;
    if (!ledgerCompanyId || amt <= 0 || ledgerSaving) return;
    setLedgerSaving(true);
    try {
      const data = {
        companyId: ledgerCompanyId, type: 'Payment' as const, date: paymentDate,
        amount: amt, method: paymentMethod, reference: paymentReference, note: paymentNote,
        direction: paymentDirection,
      };
      if (editingEntry) await updateLedgerEntry(editingEntry.id, data);
      else await addLedgerEntry(data);
      closeEntryForm();
    } finally {
      setLedgerSaving(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!deleteEntryId || !ledgerCompanyId) return;
    await deleteLedgerEntry(deleteEntryId, ledgerCompanyId);
    setDeleteEntryId(null);
  };

  // ── Printable ledger statement — the whole account: purchases, payments,
  // running balance. Same standalone print-window approach as the bills. ────
  const handlePrintLedger = () => {
    if (!ledgerCompany || companyLedger.length === 0) return;

    const esc = (s: string | number | undefined | null) =>
      String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const money = (a: number) => a.toLocaleString('en-PK');

    // Statement reads oldest-first, matching how the running balance builds up
    const entries = [...companyLedger].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.createdAt.localeCompare(b.createdAt);
    });

    const rows = entries.map(e => {
      const isPurchase = e.type === 'Purchase';
      const isReceived = !isPurchase && e.direction === 'from_company';
      const details = isPurchase
        ? `${esc(e.invoiceNumber || 'Purchase')}${(e.items ?? []).length
            ? ' — ' + (e.items ?? []).map(i => `${esc(i.name)} (${i.qty} ${i.category === 'Cement' ? 'packs' : 'kg'})`).join(', ')
            : ''}`
        : `${isReceived ? 'Received from company' : 'Payment'} — ${esc(e.method ?? '')}${e.reference ? ` · ${esc(e.reference)}` : ''}`;
      const note = e.note ? `<div class="note">${esc(e.note)}</div>` : '';
      // Debit column: what increases the payable (purchases and money the
      // company handed you); Credit column: what you paid them.
      const debit = isPurchase ? money(e.amount) : (isReceived ? money(e.amount) : '');
      const credit = isPurchase
        ? ((e.amountPaid ?? 0) > 0 ? money(e.amountPaid ?? 0) : '')
        : (isReceived ? '' : money(e.amount));
      return `<tr>
        <td>${esc(formatDate(e.date))}</td>
        <td>${details}${note}</td>
        <td class="r">${debit}</td>
        <td class="r">${credit}</td>
        <td class="r">${money(Math.abs(e.balanceAfter))} ${getBalanceLabel(e.balanceAfter)}</td>
      </tr>`;
    }).join('');

    const s = ledgerSummary;
    const printedOn = formatDate(todayISO());

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Ledger — ${esc(ledgerCompany.name)}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; padding: 24px; font-size: 12px; }
        .sheet { max-width: 800px; margin: 0 auto; }
        .title { text-align: center; }
        .title span { display: inline-block; border: 1.5px solid #000; padding: 4px 28px; font-size: 16px; font-weight: bold; letter-spacing: 1px; }
        .head { display: flex; justify-content: space-between; margin-top: 14px; gap: 24px; }
        .head .col { flex: 1; }
        .row { display: flex; align-items: baseline; margin-bottom: 4px; }
        .row .lbl { font-weight: bold; white-space: nowrap; margin-right: 6px; }
        .row .val { flex: 1; border-bottom: 1px solid #000; min-height: 15px; padding: 0 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; }
        th, td { border: 1px solid #000; padding: 5px 8px; font-size: 12px; }
        th { background: #f0f0f0; text-align: left; }
        td.r, th.r { text-align: right; white-space: nowrap; }
        .note { font-size: 10px; color: #444; font-style: italic; }
        .totals { width: 320px; margin-left: auto; margin-top: 14px; }
        .totals table { margin: 0; }
        .totals td { padding: 4px 8px; }
        .totals td.k { font-weight: bold; border: 1px solid #000; }
        .totals td.v { text-align: right; border: 1px solid #000; }
        .sign { display: flex; justify-content: space-between; margin-top: 48px; }
        .sign .line { border-top: 1px solid #000; padding-top: 4px; width: 200px; text-align: center; font-weight: bold; }
        @media print { @page { margin: 12mm; } body { padding: 0; } }
      </style></head><body>
      <div class="sheet">
        <div class="title"><span>ACCOUNT LEDGER</span></div>
        <div class="head">
          <div class="col">
            <div class="row"><span class="lbl">Supplier:</span><span class="val">${esc(ledgerCompany.name)}</span></div>
            <div class="row"><span class="lbl">Contact:</span><span class="val">${esc(ledgerCompany.contactPerson || '')}</span></div>
            <div class="row"><span class="lbl">Address:</span><span class="val">${esc(ledgerCompany.address || '')}</span></div>
          </div>
          <div class="col">
            <div class="row"><span class="lbl">Phone:</span><span class="val">${esc(ledgerCompany.phone || '')}</span></div>
            <div class="row"><span class="lbl">Printed:</span><span class="val">${esc(printedOn)}</span></div>
            <div class="row"><span class="lbl">Entries:</span><span class="val">${entries.length}</span></div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:90px;">Date</th>
              <th>Details</th>
              <th class="r">Purchase / Received</th>
              <th class="r">Paid</th>
              <th class="r">Balance</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals">
          <table>
            <tr><td class="k">Total Purchases</td><td class="v">${money(s.totalPurchases)}</td></tr>
            ${s.totalReceived > 0 ? `<tr><td class="k">Received from Company</td><td class="v">${money(s.totalReceived)}</td></tr>` : ''}
            <tr><td class="k">Total Payments</td><td class="v">${money(s.totalPayments)}</td></tr>
            <tr><td class="k">Current Balance</td><td class="v">${money(s.balance)} ${esc(s.label)}</td></tr>
          </table>
        </div>
        <div class="sign">
          <div class="line">Signature</div>
        </div>
      </div>
      <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>`);
    win.document.close();
  };

  // ── Printable purchase bill — supplier twin of the sales invoice print ────
  const handlePrintPurchase = () => {
    const entry = detailEntry;
    if (!entry || entry.type !== 'Purchase' || !ledgerCompany) return;

    const esc = (s: string | number | undefined | null) =>
      String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const money = (a: number) => a.toLocaleString('en-PK');

    // Labour charge is folded into the charges list on the slip.
    const labourCharge = entry.workerBCharge || 0;
    const charges: { description: string; amount: number }[] = [
      ...(entry.extraCharges ?? []).map(c => ({ description: c.description, amount: c.amount })),
    ];
    if (labourCharge > 0) {
      charges.push({ description: `Labour${entry.workerBName ? ` - ${entry.workerBName}` : ''}`, amount: labourCharge });
    }

    const slipTotal = (entry.amount ?? 0) + labourCharge;
    const slipPaid = entry.amountPaid ?? 0;
    const slipBalance = Math.max(0, slipTotal - slipPaid);
    const words = numberToWords(slipTotal);
    const amountInWords = words.charAt(0).toUpperCase() + words.slice(1) + ' Only';

    let sn = 0;
    const itemRows = (entry.items ?? []).map(item => {
      sn += 1;
      const isCement = item.category === 'Cement';
      const qty = isCement
        ? `${item.qty.toLocaleString('en-PK')} Packs`
        : `${item.qty.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KGS`;
      return `<tr>
        <td class="c">${sn}</td>
        <td>${esc(item.name)}${item.grade && !item.name.includes(item.grade) ? ` ${esc(item.grade)}` : ''}</td>
        <td>${esc(item.quantityUnits ?? '')} ${esc(item.unit ?? '')}</td>
        <td class="r">${qty}</td>
        <td class="r">${item.rate.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="r">${money(item.amount)}</td>
      </tr>`;
    }).join('');

    const chargeRows = charges.map(ch => {
      sn += 1;
      return `<tr>
        <td class="c">${sn}</td>
        <td>${esc(ch.description)}</td>
        <td></td><td></td><td></td>
        <td class="r">${money(ch.amount)}</td>
      </tr>`;
    }).join('');

    const minRows = 8;
    const usedRows = (entry.items ?? []).length + charges.length;
    let blankRows = '';
    for (let i = usedRows; i < minRows; i++) {
      blankRows += `<tr><td class="c">&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>`;
    }

    const discountAmt = Math.max(0, (entry.subtotal ?? entry.amount ?? 0) - (entry.amount ?? 0));

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${esc(entry.invoiceNumber || 'Purchase Bill')}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; padding: 24px; font-size: 12px; }
        .sheet { max-width: 800px; margin: 0 auto; }
        .title { text-align: center; }
        .title span { display: inline-block; border: 1.5px solid #000; padding: 4px 28px; font-size: 16px; font-weight: bold; letter-spacing: 1px; }
        .head { display: flex; justify-content: space-between; margin-top: 14px; gap: 24px; }
        .head .col { flex: 1; }
        .row { display: flex; align-items: baseline; margin-bottom: 4px; }
        .row .lbl { font-weight: bold; white-space: nowrap; margin-right: 6px; }
        .row .val { flex: 1; border-bottom: 1px solid #000; min-height: 15px; padding: 0 4px; }
        .inline { display: flex; gap: 16px; }
        .inline .row { flex: 1; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; }
        th, td { border: 1px solid #000; padding: 5px 8px; font-size: 12px; }
        th { background: #f0f0f0; text-align: left; }
        td.r, th.r { text-align: right; }
        td.c, th.c { text-align: center; width: 32px; }
        .footer { display: flex; justify-content: space-between; margin-top: 14px; gap: 24px; }
        .words { flex: 1; }
        .words .lbl { font-weight: bold; }
        .words .wval { border-bottom: 1px solid #000; padding: 2px 4px; min-height: 16px; display: block; margin-top: 2px; }
        .totals { width: 280px; }
        .totals table { margin: 0; }
        .totals td { padding: 4px 8px; }
        .totals td.k { font-weight: bold; border: 1px solid #000; }
        .totals td.v { text-align: right; border: 1px solid #000; }
        .sign { display: flex; justify-content: space-between; margin-top: 48px; }
        .sign .line { border-top: 1px solid #000; padding-top: 4px; width: 200px; text-align: center; font-weight: bold; }
        @media print { @page { margin: 12mm; } body { padding: 0; } }
      </style></head><body>
      <div class="sheet">
        <div class="title"><span>PURCHASE BILL</span></div>
        <div class="head">
          <div class="col">
            <div class="row"><span class="lbl">Bill No.:</span><span class="val">${esc(entry.invoiceNumber || '')}</span></div>
            <div class="row"><span class="lbl">Date:</span><span class="val">${esc(formatDate(entry.date))}</span></div>
            <div class="row"><span class="lbl">Supplier:</span><span class="val">${esc(ledgerCompany.name)}</span></div>
            <div class="row"><span class="lbl">Address:</span><span class="val">${esc(ledgerCompany.address || '')}</span></div>
          </div>
          <div class="col">
            <div class="row"><span class="lbl">Contact:</span><span class="val">${esc(ledgerCompany.contactPerson || '')}</span></div>
            <div class="row"><span class="lbl">Phone:</span><span class="val">${esc(ledgerCompany.phone || '')}</span></div>
            <div class="row"><span class="lbl">Due Date:</span><span class="val">${entry.dueDate ? esc(formatDate(entry.dueDate)) : ''}</span></div>
            <div class="row"><span class="lbl">Vehicle #:</span><span class="val">${esc(entry.vehicleNumber || 'Self')}</span></div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th class="c">S#</th>
              <th>Description</th>
              <th>Packing</th>
              <th class="r">Qty</th>
              <th class="r">Rate</th>
              <th class="r">Amount</th>
            </tr>
          </thead>
          <tbody>${itemRows}${chargeRows}${blankRows}</tbody>
        </table>
        <div class="footer">
          <div class="words">
            <span class="lbl">Amount in Words:</span>
            <span class="wval">${esc(amountInWords)}</span>
            ${entry.note ? `<div style="margin-top:8px;"><span class="lbl">Note:</span> ${esc(entry.note)}</div>` : ''}
          </div>
          <div class="totals">
            <table>
              ${discountAmt > 0 ? `<tr><td class="k">Discount</td><td class="v">- ${money(discountAmt)}</td></tr>` : ''}
              <tr><td class="k">Total</td><td class="v">${money(slipTotal)}</td></tr>
              <tr><td class="k">Amount Paid</td><td class="v">${slipPaid > 0 ? money(slipPaid) : '-'}</td></tr>
              <tr><td class="k">Balance Amount</td><td class="v">${money(slipBalance)}</td></tr>
            </table>
          </div>
        </div>
        <div class="sign">
          <div class="line">Signature</div>
        </div>
      </div>
      <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Companies</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage steel suppliers and track purchases</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={16} /> Add Company</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Companies" value={state.companies.length} icon={Building2}
          iconColor="text-purple-600" iconBg="bg-purple-50 dark:bg-purple-900/20" />
        <StatCard title="Total Stock" value={formatWeight(totalStock)} icon={BarChart2}
          iconColor="text-blue-600" iconBg="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard title="Total Purchased" value={formatCurrency(totalCost)} icon={Building2}
          iconColor="text-green-600" iconBg="bg-green-50 dark:bg-green-900/20" />
        <StatCard title="Avg per Company" value={formatCurrency(totalCost / (state.companies.length || 1))} icon={Building2}
          iconColor="text-orange-600" iconBg="bg-orange-50 dark:bg-orange-900/20" />
      </div>

      {chartData.length > 0 && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Company-wise Stock (tons)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.2)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px', fontSize: 12 }}
                formatter={(v: number) => [`${v.toFixed(1)} ton`, 'Purchased']} />
              <Bar dataKey="purchased" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">All Companies ({filtered.length})</h2>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies..." className="input pl-8 py-1.5" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Building2} title="No companies found" description="Add your first steel supplier to get started."
            action={<button onClick={openAdd} className="btn-primary text-sm">Add Company</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                <th className="table-header">Company</th><th className="table-header">Contact</th>
                <th className="table-header">Phone</th><th className="table-header">Address</th>
                <th className="table-header">Total Purchased</th><th className="table-header">Total Cost</th>
                <th className="table-header">Added</th><th className="table-header">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                          <Building2 size={13} className="text-purple-600" />
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                      </div>
                    </td>
                    <td className="table-cell text-gray-500">{c.contactPerson}</td>
                    <td className="table-cell"><a href={`tel:${c.phone}`} className="text-blue-600 hover:underline">{c.phone}</a></td>
                    <td className="table-cell text-gray-500 max-w-[160px] truncate">{c.address}</td>
                    <td className="table-cell font-medium">{formatWeight(getPurchased(c.id).kg)}</td>
                    <td className="table-cell font-medium text-green-600 dark:text-green-400">{formatCurrency(getPurchased(c.id).cost)}</td>
                    <td className="table-cell text-gray-400 text-xs">{formatDate(c.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewId(c.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="View Stock"><BarChart2 size={14} /></button>
                        <button onClick={() => openLedger(c.id)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="Payment Ledger"><Wallet size={14} /></button>
                        <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteId(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit Company' : 'Add New Company'}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn-primary" disabled={!form.name || !form.phone || saving}>
              {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Company'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div><label className="label">Company Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ittefaq Steel Mills" className="input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Contact Person</label><input value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder="Full name" className="input" /></div>
            <div><label className="label">Phone *</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0300-0000000" className="input" /></div>
          </div>
          <div><label className="label">Email</label><input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="company@example.com" className="input" type="email" /></div>
          <div><label className="label">Address</label><textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" rows={2} className="input resize-none" /></div>
        </div>
      </Modal>

      {viewCompany && (
        <Modal open={!!viewId} onClose={() => setViewId(null)} title={viewCompany.name} subtitle="Company details and stock" size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Contact Person', value: viewCompany.contactPerson },
                { label: 'Phone', value: viewCompany.phone },
                { label: 'Total Purchased', value: formatWeight(getPurchased(viewCompany.id).kg) },
                { label: 'Total Cost', value: formatCurrency(getPurchased(viewCompany.id).cost) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Current Stock</h3>
              {companyStock.length === 0 ? <p className="text-sm text-gray-400">No active stock records.</p> : (
                <table className="w-full text-sm">
                  <thead><tr><th className="table-header">Type</th><th className="table-header">Batch</th><th className="table-header">Weight</th><th className="table-header">Status</th></tr></thead>
                  <tbody>
                    {companyStock.map(s => (
                      <tr key={s.id} className="table-row">
                        <td className="table-cell font-medium">{s.steelType}</td>
                        <td className="table-cell text-gray-400 text-xs">{s.batchNumber}</td>
                        <td className="table-cell">{formatWeight(s.weightKg)}</td>
                        <td className="table-cell"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'In Stock' ? 'bg-green-100 text-green-700' : s.status === 'Low Stock' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{s.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) await deleteCompany(deleteId); }}
        title="Delete Company" message="This will remove the company and all its records." />

      {/* ─── Payment Ledger ─── */}
      {ledgerCompany && (
        <Modal
          open={ledgerModalVisible}
          onClose={closeLedger}
          title={ledgerCompany.name}
          subtitle="Payment Ledger — purchases increase what you owe, payments reduce it"
          size="xl"
          footer={
            <>
              {companyLedger.length > 0 && (
                <button onClick={handlePrintLedger} className="btn-secondary" title="Print the full ledger statement">
                  <Printer size={15} /> Print
                </button>
              )}
              <button onClick={() => openPaymentForm()} className="btn-secondary">
                <Banknote size={15} /> Payment ₨
              </button>
              <button onClick={() => openPurchaseForm()} className="btn-primary">
                <ShoppingCart size={15} /> Purchase ₨
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Balance card */}
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Balance</p>
              <p className={`text-3xl font-bold ${
                ledgerSummary.label === 'Payable' ? 'text-red-600 dark:text-red-400'
                  : ledgerSummary.label === 'Advance' ? 'text-blue-600 dark:text-blue-400'
                  : 'text-green-600 dark:text-green-400'
              }`}>
                {formatCurrency(ledgerSummary.balance)}
              </p>
              <div className="mt-2 flex justify-center"><Badge label={ledgerSummary.label} /></div>
              <div className="flex justify-center gap-6 mt-3 text-xs text-gray-400 flex-wrap">
                <span>Total Purchases: <b className="text-gray-600 dark:text-gray-300">{formatCurrency(ledgerSummary.totalPurchases)}</b></span>
                {ledgerSummary.totalReceived > 0 && (
                  <span>Received from Company: <b className="text-blue-600 dark:text-blue-400">{formatCurrency(ledgerSummary.totalReceived)}</b></span>
                )}
                <span>Total Payments: <b className="text-gray-600 dark:text-gray-300">{formatCurrency(ledgerSummary.totalPayments)}</b></span>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={ledgerSearch}
                onChange={e => setLedgerSearch(e.target.value)}
                placeholder="Search entries..."
                className="input pl-8 py-1.5"
              />
            </div>

            {/* Entry list */}
            {filteredLedger.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No ledger entries yet"
                description="Add a purchase or payment using the buttons below."
              />
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {filteredLedger.map(e => {
                  const isPurchase = e.type === 'Purchase';
                  const isReceived = !isPurchase && e.direction === 'from_company';
                  const desc = isPurchase
                    ? `${(e.items ?? []).length} item${(e.items ?? []).length === 1 ? '' : 's'}`
                    : (e.method ?? '');
                  const title = isPurchase
                    ? `${e.invoiceNumber || 'Purchase'} · ${desc}`
                    : `${isReceived ? 'Received' : 'Payment'} · ${desc}`;
                  const afterLabel = getBalanceLabel(e.balanceAfter);
                  return (
                    <button
                      key={e.id}
                      onClick={() => setDetailEntryId(e.id)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isPurchase ? 'bg-green-100 dark:bg-green-900/30' : isReceived ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                          {isPurchase
                            ? <ShoppingCart size={14} className="text-green-600 dark:text-green-400" />
                            : <Banknote size={14} className={isReceived ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex items-center gap-2">
                            {title}
                            {isPurchase && e.status && <Badge label={e.status} className="text-[9px] px-1.5 py-0" />}
                          </p>
                          <p className="text-xs text-gray-400">{formatDate(e.date)}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${isPurchase ? 'text-green-600 dark:text-green-400' : isReceived ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
                          {isPurchase || isReceived ? '+' : '−'} {formatCurrency(e.amount)}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          Bal: {formatCurrency(Math.abs(e.balanceAfter))} {afterLabel}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ─── New / Edit Purchase ─── */}
      <Modal
        open={entryFormType === 'Purchase'}
        onClose={closeEntryForm}
        title={editingEntry ? `Edit Purchase ${editingEntry.invoiceNumber || ''}`.trim() : 'New Purchase Invoice'}
        subtitle={ledgerCompany?.name}
        size="xl"
        footer={
          <>
            <button onClick={closeEntryForm} className="btn-secondary">Cancel</button>
            <button onClick={handleSavePurchase} className="btn-primary" disabled={!purchaseValid || ledgerSaving}>
              {ledgerSaving ? 'Saving…' : editingEntry ? 'Save Changes' : 'Add Purchase'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Items *</label>
              <button
                onClick={() => setPurchaseItems(items => [...items, newLedgerItem()])}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <PlusCircle size={13} /> Add Item
              </button>
            </div>
            <div className="space-y-3">
              {purchaseItems.map((it, idx) => (
                <div key={it.id} className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                      <button
                        type="button"
                        onClick={() => setItemMode(idx, 'existing')}
                        className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${it.mode === 'existing' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                      >
                        Existing Stock
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemMode(idx, 'new')}
                        className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${it.mode === 'new' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                      >
                        New Item
                      </button>
                    </div>
                    {purchaseItems.length > 1 && (
                      <button
                        onClick={() => setPurchaseItems(items => items.filter((_, i) => i !== idx))}
                        className="p-1 text-red-400 hover:text-red-600"
                      >
                        <MinusCircle size={16} />
                      </button>
                    )}
                  </div>

                  {it.mode === 'existing' ? (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-3">
                        <label className="label text-[10px]">Stock Item</label>
                        <select
                          value={it.stockItemId}
                          onChange={e => selectExistingStock(idx, e.target.value)}
                          className="input py-1.5 text-xs"
                        >
                          <option value="">Select stock item</option>
                          {ledgerCompanyStock.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.steelType}{s.grade ? ` ${s.grade}` : ''} — {formatWeight(s.weightKg)} in stock
                            </option>
                          ))}
                        </select>
                        {ledgerCompanyStock.length === 0 && (
                          <p className="text-[10px] text-gray-400 mt-1">No stock yet for this company — switch to &ldquo;New Item&rdquo;.</p>
                        )}
                      </div>
                      <div>
                        <label className="label text-[10px]">Qty to Add ({it.category === 'Cement' ? 'packs' : 'kg'})</label>
                        <input value={it.qty} onChange={e => updatePurchaseItem(idx, 'qty', e.target.value)} type="number" min="0" placeholder="0" className="input py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="label text-[10px]">Rate (PKR)</label>
                        <input value={it.rate} onChange={e => updatePurchaseItem(idx, 'rate', e.target.value)} type="number" min="0" placeholder="0" className="input py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="label text-[10px]">Amount</label>
                        <div className="input py-1.5 text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 font-medium">
                          {formatCurrency(purchaseItemAmount(it))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="label text-[10px]">Category</label>
                        <select value={it.category} onChange={e => updatePurchaseItem(idx, 'category', e.target.value)} className="input py-1.5 text-xs">
                          <option value="Steel">Steel</option>
                          <option value="Cement">Cement</option>
                        </select>
                      </div>
                      <div>
                        <label className="label text-[10px]">Type *</label>
                        <select value={it.name} onChange={e => updatePurchaseItem(idx, 'name', e.target.value)} className="input py-1.5 text-xs">
                          <option value="">Select type</option>
                          {(it.category === 'Cement' ? CEMENT_TYPES : STEEL_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label text-[10px]">Grade / Spec</label>
                        <input value={it.grade} onChange={e => updatePurchaseItem(idx, 'grade', e.target.value)} placeholder="Optional" className="input py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="label text-[10px]">{it.category === 'Cement' ? 'Packs *' : 'Weight (kg) *'}</label>
                        <input value={it.qty} onChange={e => updatePurchaseItem(idx, 'qty', e.target.value)} type="number" min="0" placeholder="0" className="input py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="label text-[10px]">Quantity</label>
                        <div className="flex gap-1">
                          <input value={it.quantity} onChange={e => updatePurchaseItem(idx, 'quantity', e.target.value)} type="number" min="0" placeholder="0" className="input py-1.5 text-xs flex-1" />
                          <select value={it.unit} onChange={e => updatePurchaseItem(idx, 'unit', e.target.value)} className="input py-1.5 text-xs w-16">
                            <option value="piece">pc</option>
                            <option value="kg">kg</option>
                            <option value="ton">ton</option>
                            <option value="pack">pack</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="label text-[10px]">Rate (PKR) *</label>
                        <input value={it.rate} onChange={e => updatePurchaseItem(idx, 'rate', e.target.value)} type="number" min="0" placeholder="0" className="input py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="label text-[10px]">Batch Number</label>
                        <input value={it.batchNumber} onChange={e => updatePurchaseItem(idx, 'batchNumber', e.target.value)} placeholder="Optional" className="input py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="label text-[10px]">Location</label>
                        <input value={it.location} onChange={e => updatePurchaseItem(idx, 'location', e.target.value)} placeholder="Optional" className="input py-1.5 text-xs" />
                      </div>
                      <div>
                        <label className="label text-[10px]">Amount</label>
                        <div className="input py-1.5 text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 font-medium">
                          {formatCurrency(purchaseItemAmount(it))}
                        </div>
                      </div>
                      <div className="col-span-3">
                        <label className="label text-[10px]">Notes</label>
                        <input value={it.notes} onChange={e => updatePurchaseItem(idx, 'notes', e.target.value)} placeholder="Optional" className="input py-1.5 text-xs" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Extra Charges */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">
                Extra Charges{' '}
                <span className="text-gray-400 font-normal">(freight, loading, etc.)</span>
              </label>
              <button
                onClick={() => setPurchaseExtraCharges(c => [...c, { id: generateId('ec'), description: '', amount: 0 }])}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <PlusCircle size={13} /> Add Charge
              </button>
            </div>
            {purchaseExtraCharges.length === 0 ? (
              <p className="text-xs text-gray-400 italic">
                No extra charges — click &ldquo;Add Charge&rdquo; to add freight, loading, etc.
              </p>
            ) : (
              <div className="space-y-2">
                {purchaseExtraCharges.map((ec, idx) => (
                  <div key={ec.id} className="flex gap-2 items-end bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">
                    <div className="flex-1">
                      <label className="label text-[10px]">Description</label>
                      <input
                        value={ec.description}
                        onChange={e => setPurchaseExtraCharges(charges => charges.map((ch, i) => i === idx ? { ...ch, description: e.target.value } : ch))}
                        placeholder="e.g. Freight, Loading fee..."
                        className="input py-1.5 text-xs"
                      />
                    </div>
                    <div className="w-36">
                      <label className="label text-[10px]">Amount (PKR)</label>
                      <input
                        value={ec.amount || ''}
                        onChange={e => setPurchaseExtraCharges(charges => charges.map((ch, i) => i === idx ? { ...ch, amount: parseFloat(e.target.value) || 0 } : ch))}
                        type="number" min="0" placeholder="0"
                        className="input py-1.5 text-xs"
                      />
                    </div>
                    <button
                      onClick={() => setPurchaseExtraCharges(charges => charges.filter((_, i) => i !== idx))}
                      className="p-1.5 text-red-400 hover:text-red-600 pb-2"
                    >
                      <MinusCircle size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dealt By (Worker B) */}
          <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl p-4">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide mb-3">
              Dealt By (Worker B / Agent)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Agent / Broker</label>
                <select
                  value={purchaseWorkerBId}
                  onChange={e => setPurchaseWorkerBId(e.target.value)}
                  className="input"
                >
                  <option value="">— None (direct purchase) —</option>
                  {state.workerBs.map(w => (
                    <option key={w.id} value={w.id}>{w.name}{w.phone ? ` · ${w.phone}` : ''}</option>
                  ))}
                </select>
                {state.workerBs.length === 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">No Worker B registered yet — go to Worker B page to add.</p>
                )}
              </div>
              <div>
                <label className="label">
                  Labour Charge (PKR)
                  {purchaseWorkerBId && <span className="text-indigo-500 ml-1 font-normal">— for {state.workerBs.find(w => w.id === purchaseWorkerBId)?.name}</span>}
                </label>
                <input
                  value={purchaseWorkerBCharge}
                  onChange={e => setPurchaseWorkerBCharge(e.target.value)}
                  type="number"
                  min="0"
                  placeholder="0"
                  disabled={!purchaseWorkerBId}
                  className="input disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Date / Due Date / Vehicle */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Date</label>
              <input value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} type="date" className="input" />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input value={purchaseDueDate} onChange={e => setPurchaseDueDate(e.target.value)} type="date" className="input" />
            </div>
            <div>
              <label className="label">Vehicle Number</label>
              <input value={purchaseVehicle} onChange={e => setPurchaseVehicle(e.target.value)} placeholder="e.g. LES-1234" className="input" />
            </div>
          </div>

          {/* Totals section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="label">Discount</label>
                <div className="flex gap-2">
                  <input
                    value={purchaseDiscount}
                    onChange={e => setPurchaseDiscount(e.target.value)}
                    type="number" min="0" placeholder="0"
                    className="input flex-1"
                  />
                  <select
                    value={purchaseDiscountType}
                    onChange={e => setPurchaseDiscountType(e.target.value as 'flat' | 'percent')}
                    className="input w-24"
                  >
                    <option value="flat">PKR</option>
                    <option value="percent">%</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Amount Paid (PKR)</label>
                <input
                  value={purchaseAmountPaid}
                  onChange={e => setPurchaseAmountPaid(e.target.value)}
                  type="number" min="0" placeholder="0"
                  className="input"
                />
                <p className="text-[10px] text-gray-400 mt-1">Paid now — reduces what you owe this supplier.</p>
              </div>
              <div>
                <label className="label">Note</label>
                <input value={purchaseNote} onChange={e => setPurchaseNote(e.target.value)} placeholder="Optional note" className="input" />
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 space-y-2 h-fit">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Items</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrencyFull(purchaseItemsTotal)}</span>
              </div>
              {purchaseExtraTotal > 0 && (
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Extra Charges</span>
                  <span className="font-medium text-gray-900 dark:text-white">+ {formatCurrencyFull(purchaseExtraTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 pt-1">
                <span>Subtotal</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrencyFull(purchaseSubtotal)}</span>
              </div>
              {purchaseDiscountAmt > 0 && (
                <div className="flex justify-between text-sm text-orange-500">
                  <span>Discount</span>
                  <span>- {formatCurrencyFull(purchaseDiscountAmt)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                <span>Total</span>
                <span>{formatCurrencyFull(purchaseTotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600">
                <span>Amount Paid</span>
                <span>{formatCurrencyFull(purchasePaid)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-red-500">
                <span>Balance</span>
                <span>{formatCurrencyFull(purchaseBalance)}</span>
              </div>
              <div className="pt-1">
                <Badge label={purchaseStatus} />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* ─── New / Edit Payment ─── */}
      <Modal
        open={entryFormType === 'Payment'}
        onClose={closeEntryForm}
        title={editingEntry ? 'Edit Payment' : 'New Payment'}
        subtitle={ledgerCompany?.name}
        size="sm"
        footer={
          <>
            <button onClick={closeEntryForm} className="btn-secondary">Cancel</button>
            <button onClick={handleSavePayment} className="btn-primary" disabled={!(parseFloat(paymentAmount) > 0) || ledgerSaving}>
              {ledgerSaving ? 'Saving…' : editingEntry ? 'Save Changes' : 'Add Payment'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Payment Type *</label>
            <div className="grid grid-cols-2 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
              <button
                type="button"
                onClick={() => setPaymentDirection('to_company')}
                className={`px-3 py-2 text-xs font-medium transition-colors ${paymentDirection === 'to_company' ? 'bg-red-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                Paid to Company
              </button>
              <button
                type="button"
                onClick={() => setPaymentDirection('from_company')}
                className={`px-3 py-2 text-xs font-medium transition-colors ${paymentDirection === 'from_company' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                Received from Company
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {paymentDirection === 'to_company'
                ? 'You paid the company — reduces what you owe.'
                : 'The company gave you money (advance) — increases what you owe.'}
            </p>
          </div>
          <div>
            <label className="label">Amount (PKR) *</label>
            <input value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} type="number" min="0" placeholder="0" className="input" />
          </div>
          <div>
            <label className="label">Method *</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="input">
              {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Reference No. (optional)</label>
            <input value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="e.g. Cheque #, transaction ID" className="input" />
          </div>
          <div>
            <label className="label">Date</label>
            <input value={paymentDate} onChange={e => setPaymentDate(e.target.value)} type="date" className="input" />
          </div>
          <div>
            <label className="label">Note</label>
            <input value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="Optional note" className="input" />
          </div>
        </div>
      </Modal>

      {/* ─── Entry Detail ─── */}
      {detailEntry && (
        <Modal
          open={!!detailEntryId}
          onClose={() => setDetailEntryId(null)}
          title={detailEntry.type === 'Purchase'
            ? `Purchase Invoice${detailEntry.invoiceNumber ? ` ${detailEntry.invoiceNumber}` : ''}`
            : detailEntry.direction === 'from_company' ? 'Received from Company' : 'Payment Details'}
          subtitle={`${formatDate(detailEntry.date)} · ${ledgerCompany?.name ?? ''}`}
          size={detailEntry.type === 'Purchase' ? 'xl' : 'md'}
          footer={
            <>
              <button
                onClick={() => { setDetailEntryId(null); setDeleteEntryId(detailEntry.id); }}
                className="btn-danger"
              >
                <Trash2 size={15} /> Delete
              </button>
              <button
                onClick={() => {
                  const entry = detailEntry;
                  setDetailEntryId(null);
                  if (entry.type === 'Purchase') openPurchaseForm(entry); else openPaymentForm(entry);
                }}
                className="btn-secondary"
              >
                <Edit2 size={15} /> Edit
              </button>
              {detailEntry.type === 'Purchase' && (
                <button onClick={handlePrintPurchase} className="btn-primary">
                  <Printer size={15} /> Print / Download
                </button>
              )}
            </>
          }
        >
          {detailEntry.type === 'Purchase' ? (
            <div className="space-y-4">
              {/* Invoice header */}
              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">Majid Steel</p>
                  <p className="text-xs text-gray-400">Purchase Invoice</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{detailEntry.invoiceNumber || '—'}</p>
                  <p className="text-xs text-gray-400">{formatDate(detailEntry.date)}</p>
                  {detailEntry.status && <div className="mt-1 flex sm:justify-end"><Badge label={detailEntry.status} /></div>}
                </div>
              </div>

              {/* Supplier / meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3 col-span-2">
                  <p className="text-xs text-gray-400 mb-1">Supplier</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{ledgerCompany?.name}</p>
                  <p className="text-xs text-gray-400">{ledgerCompany?.phone}{ledgerCompany?.address ? ` · ${ledgerCompany.address}` : ''}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Dealt By</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{detailEntry.workerBName || '—'}</p>
                  {(detailEntry.workerBCharge ?? 0) > 0 && (
                    <p className="text-xs text-gray-400">Labour: {formatCurrencyFull(detailEntry.workerBCharge ?? 0)}</p>
                  )}
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Vehicle · Due Date</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{detailEntry.vehicleNumber || 'Self'}</p>
                  <p className="text-xs text-gray-400">{detailEntry.dueDate ? formatDate(detailEntry.dueDate) : 'No due date'}</p>
                </div>
              </div>

              {/* Items */}
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="table-header">Item</th>
                    <th className="table-header text-right">Qty</th>
                    <th className="table-header text-right">Rate</th>
                    <th className="table-header text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailEntry.items ?? []).map((it, i) => (
                    <tr key={i} className="table-row">
                      <td className="table-cell font-medium">
                        {it.name}
                        {it.grade && !it.name.includes(it.grade) ? ` ${it.grade}` : ''}
                        {it.category === 'Cement' && <span className="ml-1.5 text-[10px] text-amber-600">Cement</span>}
                      </td>
                      <td className="table-cell text-right">{it.qty} {it.category === 'Cement' ? 'packs' : 'kg'}</td>
                      <td className="table-cell text-right">{formatCurrencyFull(it.rate)}</td>
                      <td className="table-cell text-right font-semibold">{formatCurrencyFull(it.amount)}</td>
                    </tr>
                  ))}
                  {(detailEntry.extraCharges ?? []).map((c, i) => (
                    <tr key={`ec-${i}`} className="table-row">
                      <td className="table-cell text-gray-500 italic" colSpan={3}>{c.description}</td>
                      <td className="table-cell text-right font-semibold">{formatCurrencyFull(c.amount)}</td>
                    </tr>
                  ))}
                  {(detailEntry.workerBCharge ?? 0) > 0 && (
                    <tr className="table-row">
                      <td className="table-cell text-gray-500 italic" colSpan={3}>Labour{detailEntry.workerBName ? ` - ${detailEntry.workerBName}` : ''}</td>
                      <td className="table-cell text-right font-semibold">{formatCurrencyFull(detailEntry.workerBCharge ?? 0)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Totals */}
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span>{formatCurrencyFull(detailEntry.subtotal ?? detailEntry.amount)}</span>
                </div>
                {(detailEntry.subtotal ?? 0) > (detailEntry.amount ?? 0) && (
                  <div className="flex justify-between text-sm text-orange-500">
                    <span>Discount{detailEntry.discountType === 'percent' ? ` (${detailEntry.discount}%)` : ''}</span>
                    <span>- {formatCurrencyFull((detailEntry.subtotal ?? 0) - detailEntry.amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-600 pt-1.5">
                  <span>Total</span>
                  <span>{formatCurrencyFull(detailEntry.amount)}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Amount Paid</span>
                  <span>{formatCurrencyFull(detailEntry.amountPaid ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-red-500">
                  <span>Balance</span>
                  <span>{formatCurrencyFull(detailEntry.balance ?? Math.max(0, detailEntry.amount - (detailEntry.amountPaid ?? 0)))}</span>
                </div>
              </div>

              {detailEntry.note && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">&ldquo;{detailEntry.note}&rdquo;</p>
              )}
              <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">
                <span className="text-sm text-gray-600 dark:text-gray-300">Company Balance After This Entry</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  {formatCurrencyFull(Math.abs(detailEntry.balanceAfter))}
                  <Badge label={getBalanceLabel(detailEntry.balanceAfter)} />
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Type</p>
                  <p className={`text-sm font-semibold ${detailEntry.direction === 'from_company' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                    {detailEntry.direction === 'from_company' ? 'Received from Company' : 'Paid to Company'}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Method</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{detailEntry.method}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Reference</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{detailEntry.reference || '—'}</p>
                </div>
              </div>
              {detailEntry.note && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">&ldquo;{detailEntry.note}&rdquo;</p>
              )}
              <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-700 pt-3">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Amount</span>
                <span className={`text-lg font-bold ${detailEntry.direction === 'from_company' ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
                  {detailEntry.direction === 'from_company' ? '+ ' : ''}{formatCurrencyFull(detailEntry.amount)}
                </span>
              </div>
              <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">
                <span className="text-sm text-gray-600 dark:text-gray-300">Balance After This Entry</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  {formatCurrencyFull(Math.abs(detailEntry.balanceAfter))}
                  <Badge label={getBalanceLabel(detailEntry.balanceAfter)} />
                </span>
              </div>
            </div>
          )}
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteEntryId}
        onClose={() => setDeleteEntryId(null)}
        onConfirm={handleDeleteEntry}
        title="Delete Ledger Entry"
        message="This will permanently remove this entry and recalculate the balance. Continue?"
      />
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Plus, Search, FileText, Printer, Trash2, Eye, Edit2,
  DollarSign, X, PlusCircle, MinusCircle, UserPlus,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import { formatCurrency, formatCurrencyFull, formatDate, todayISO, generateId, normalizePhone } from '@/lib/utils';
import type { Invoice, InvoiceItem, ExtraCharge, SteelType, CementType, ProductCategory, InvoiceType, InvoiceStatus } from '@/lib/types';

const STEEL_TYPES: SteelType[] = ['Rod', 'Sheet', 'Bar', 'Angle', 'Channel', 'Pipe', 'Coil', 'Beam'];
const CEMENT_TYPES: CementType[] = ['OPC', 'SRC', 'White Cement', 'Block Cement', 'Other'];

function newItem(category: ProductCategory = 'Steel'): InvoiceItem {
  return {
    id: generateId('ii'),
    stockItemId: '',
    category,
    steelType: category === 'Cement' ? 'OPC' : 'Rod',
    description: '',
    weightKg: 0,
    quantity: 1,
    unit: category === 'Cement' ? 'pack' : 'piece',
    pricePerKg: 0,
    totalPrice: 0,
  };
}

function newCharge(): ExtraCharge {
  return { id: generateId('ec'), description: '', amount: 0 };
}

function calcItem(item: InvoiceItem): InvoiceItem {
  return { ...item, totalPrice: item.weightKg * item.pricePerKg };
}

// ─── Amount in words (international system) ──────────────────────────────────
function numberToWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'zero';
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const scales = ['', 'thousand', 'million', 'billion', 'trillion'];

  const under1000 = (num: number): string => {
    let str = '';
    if (num >= 100) {
      str += ones[Math.floor(num / 100)] + ' hundred';
      num %= 100;
      if (num) str += ' ';
    }
    if (num >= 20) {
      str += tens[Math.floor(num / 10)];
      if (num % 10) str += ' ' + ones[num % 10];
    } else if (num > 0) {
      str += ones[num];
    }
    return str;
  };

  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    parts.push(under1000(groups[i]) + (scales[i] ? ' ' + scales[i] : ''));
  }
  return parts.join(' ');
}

const EMPTY_NEW_CUSTOMER = { name: '', phone: '', address: '' };

export default function InvoicesPage() {
  const { state, addInvoice, updateInvoice, deleteInvoice, addCustomer } = useApp();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Invoice form state
  const [formCustomerId, setFormCustomerId] = useState('');
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [newCustomer, setNewCustomer] = useState(EMPTY_NEW_CUSTOMER);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formInvoiceType, setFormInvoiceType] = useState<InvoiceType>('Steel');
  const [formItems, setFormItems] = useState<InvoiceItem[]>([newItem()]);
  const [formDiscount, setFormDiscount] = useState('0');
  const [formDiscountType, setFormDiscountType] = useState<'flat' | 'percent'>('flat');
  const [formAmountPaid, setFormAmountPaid] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formVehicle, setFormVehicle] = useState('');
  const [formExtraCharges, setFormExtraCharges] = useState<ExtraCharge[]>([]);
  const [formWorkerBId, setFormWorkerBId] = useState('');
  const [formWorkerBCharge, setFormWorkerBCharge] = useState('');

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      const inv = state.invoices.find(i => i.id === id);
      if (inv) setViewInvoice(inv);
    }
  }, [searchParams, state.invoices]);

  const filtered = state.invoices.filter(inv => {
    const q = search.toLowerCase();
    if (search && !inv.invoiceNumber.toLowerCase().includes(q) && !inv.customerName.toLowerCase().includes(q) && !inv.customerPhone.includes(q)) return false;
    if (filterStatus && inv.status !== filterStatus) return false;
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const extraTotal = formExtraCharges.reduce((s, e) => s + (e.amount || 0), 0);
  const subtotal = formItems.reduce((s, i) => s + i.totalPrice, 0) + extraTotal;
  const discountAmt = formDiscountType === 'percent'
    ? subtotal * (parseFloat(formDiscount || '0') / 100)
    : parseFloat(formDiscount || '0');
  const total = Math.max(0, subtotal - discountAmt);
  const balance = Math.max(0, total - parseFloat(formAmountPaid || '0'));
  const status: InvoiceStatus = balance === 0 ? 'Paid' : parseFloat(formAmountPaid || '0') > 0 ? 'Partial' : 'Pending';

  // If the typed phone belongs to a registered customer, we reuse them instead of duplicating
  const phoneMatch = newCustomer.phone.trim()
    ? state.customers.find(c => normalizePhone(c.phone) === normalizePhone(newCustomer.phone.trim()))
    : undefined;

  const customerReady = customerMode === 'new'
    ? Boolean(newCustomer.name.trim() && newCustomer.phone.trim())
    : Boolean(formCustomerId);

  // Live stock check — an invoice can never sell more than a batch holds.
  // When editing, the old invoice's quantities count as available because
  // the server restores them before deducting the new ones.
  const oldByBatch: Record<string, number> = {};
  (editInvoice?.items ?? []).forEach(it => {
    if (it.stockItemId && it.weightKg) {
      oldByBatch[it.stockItemId] = (oldByBatch[it.stockItemId] ?? 0) + it.weightKg;
    }
  });
  const requestedByBatch: Record<string, number> = {};
  formItems.forEach(it => {
    if (it.stockItemId && it.weightKg) {
      requestedByBatch[it.stockItemId] = (requestedByBatch[it.stockItemId] ?? 0) + it.weightKg;
    }
  });
  const availableFor = (batchId: string) => {
    const stock = state.stockItems.find(s => s.id === batchId);
    return stock ? stock.weightKg + (oldByBatch[batchId] ?? 0) : 0;
  };
  const stockErrors = Object.entries(requestedByBatch).flatMap(([id, qty]) => {
    const stock = state.stockItems.find(s => s.id === id);
    if (!stock) return [];
    const available = availableFor(id);
    if (qty <= available) return [];
    const unit = (stock.category ?? 'Steel') === 'Cement' ? 'packs' : 'kg';
    return [`${stock.steelType}${stock.grade ? ` (${stock.grade})` : ''}: only ${available.toLocaleString()} ${unit} in stock — this invoice needs ${qty.toLocaleString()}`];
  });

  const resetForm = () => {
    setFormError('');
    setFormCustomerId('');
    setCustomerMode(state.customers.length === 0 ? 'new' : 'existing');
    setNewCustomer(EMPTY_NEW_CUSTOMER);
    setFormInvoiceType('Steel');
    setFormItems([newItem('Steel')]);
    setFormDiscount('0');
    setFormDiscountType('flat');
    setFormAmountPaid('');
    setFormNotes('');
    setFormDueDate('');
    setFormVehicle('');
    setFormExtraCharges([]);
    setFormWorkerBId('');
    setFormWorkerBCharge('');
  };

  const openEdit = (inv: Invoice) => {
    setFormError('');
    setFormCustomerId(inv.customerId);
    setCustomerMode('existing');
    setNewCustomer(EMPTY_NEW_CUSTOMER);
    setFormInvoiceType(inv.invoiceType ?? 'Steel');
    setFormItems(inv.items.map(i => ({ ...i, category: i.category ?? 'Steel' })));
    setFormExtraCharges((inv.extraCharges ?? []).map(e => ({ ...e })));
    setFormDiscount(String(inv.discount));
    setFormDiscountType(inv.discountType);
    setFormAmountPaid(String(inv.amountPaid));
    setFormNotes(inv.notes ?? '');
    setFormDueDate(inv.dueDate ?? '');
    setFormVehicle(inv.vehicleNumber ?? '');
    setFormWorkerBId(inv.workerBId ?? '');
    setFormWorkerBCharge(inv.workerBCharge ? String(inv.workerBCharge) : '');
    setEditInvoice(inv);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!customerReady || formItems.length === 0 || saving || stockErrors.length > 0) return;
    setFormError('');
    setSaving(true);
    try {
      // Customer first: register the new customer (or reuse the one matching this phone),
      // then create the invoice against them.
      let customer;
      if (customerMode === 'new' && !editInvoice) {
        customer = phoneMatch ?? await addCustomer({
          name: newCustomer.name.trim(),
          phone: newCustomer.phone.trim(),
          address: newCustomer.address.trim(),
          email: '',
          city: '',
        });
      } else {
        customer = state.customers.find(c => c.id === formCustomerId);
        if (!customer) return;
      }
      const payload = {
        invoiceType: formInvoiceType,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        items: formItems,
        extraCharges: formExtraCharges,
        subtotal,
        discount: parseFloat(formDiscount || '0'),
        discountType: formDiscountType,
        total,
        amountPaid: parseFloat(formAmountPaid || '0'),
        balance,
        status,
        notes: formNotes,
        vehicleNumber: formVehicle.trim(),
        createdAt: editInvoice ? editInvoice.createdAt : todayISO(),
        dueDate: formDueDate || undefined,
        workerBId: formWorkerBId || undefined,
        workerBName: formWorkerBId ? (state.workerBs.find(w => w.id === formWorkerBId)?.name ?? '') : undefined,
        workerBCharge: formWorkerBCharge ? parseFloat(formWorkerBCharge) : undefined,
      };
      if (editInvoice) {
        await updateInvoice({ ...editInvoice, ...payload });
      } else {
        await addInvoice(payload);
      }
      setCreateOpen(false);
      setEditInvoice(null);
      resetForm();
    } catch (e) {
      // Surface server-side rejections (e.g. stock validation) in the modal
      const raw = e instanceof Error ? e.message : 'Failed to save invoice';
      setFormError(raw.includes('— ') ? raw.split('— ').slice(1).join('— ') : raw);
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (idx: number, field: keyof InvoiceItem, value: string | number) => {
    setFormItems(items => items.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: typeof value === 'string' && ['weightKg', 'quantity', 'pricePerKg'].includes(field) ? parseFloat(value) || 0 : value };
      return calcItem(updated);
    }));
  };

  const selectStockBatch = (idx: number, stockId: string) => {
    const stock = state.stockItems.find(s => s.id === stockId);
    if (!stock) return;
    setFormItems(items => items.map((it, i) => {
      if (i !== idx) return it;
      return calcItem({
        ...it,
        stockItemId: stock.id,
        category: stock.category ?? 'Steel',
        steelType: stock.steelType,
        unit: stock.unit,
        description: stock.grade || stock.batchNumber || '',
        pricePerKg: stock.pricePerKg,
      });
    }));
  };

  // Stock batches available for a given category (with stock remaining)
  const batchesFor = (cat: ProductCategory) =>
    state.stockItems.filter(s => (s.category ?? 'Steel') === cat && s.weightKg > 0);

  const handlePrint = () => {
    const inv = viewInvoice;
    if (!inv) return;

    const customer = state.customers.find(c => c.id === inv.customerId);
    const address = customer?.address || '';
    const esc = (s: string | number | undefined | null) =>
      String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const money = (a: number) => a.toLocaleString('en-PK');

    // Dealt-by labour charge is folded into the extra charges on the slip.
    const labourCharge = inv.workerBCharge || 0;
    const charges: { description: string; amount: number }[] = [
      ...(inv.extraCharges ?? []).map(e => ({ description: e.description, amount: e.amount })),
    ];
    if (labourCharge > 0) {
      charges.push({ description: `Labour${inv.workerBName ? ` - ${inv.workerBName}` : ''}`, amount: labourCharge });
    }

    // Slip totals include the folded-in labour charge so the bill is self-consistent.
    const slipTotal = inv.total + labourCharge;
    const slipBalance = Math.max(0, slipTotal - inv.amountPaid);
    const words = numberToWords(slipTotal);
    const amountInWords = words.charAt(0).toUpperCase() + words.slice(1) + ' Only';

    let sn = 0;
    const itemRows = inv.items.map(item => {
      sn += 1;
      const isCement = item.category === 'Cement';
      const qty = isCement
        ? `${item.weightKg.toLocaleString('en-PK')} Packs`
        : `${item.weightKg.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KGS`;
      return `<tr>
        <td class="c">${sn}</td>
        <td>${esc(item.steelType)}${item.description ? ` ${esc(item.description)}` : ''}</td>
        <td>${esc(item.quantity)} ${esc(item.unit)}</td>
        <td class="r">${qty}</td>
        <td class="r">${item.pricePerKg.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="r">${money(item.totalPrice)}</td>
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

    // Pad table so it keeps a consistent height like the paper bill.
    const minRows = 8;
    const usedRows = inv.items.length + charges.length;
    let blankRows = '';
    for (let i = usedRows; i < minRows; i++) {
      blankRows += `<tr><td class="c">&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>`;
    }

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${esc(inv.invoiceNumber)}</title>
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
        <div class="title"><span>ESTIMATE / BILL</span><div style="font-size:11px;font-weight:bold;margin-top:4px;">${esc(inv.invoiceType ?? 'Steel')}</div></div>
        <div class="head">
          <div class="col">
            <div class="row"><span class="lbl">Sr. No.:</span><span class="val">${esc(inv.invoiceNumber)}</span></div>
            <div class="row"><span class="lbl">Date:</span><span class="val">${esc(formatDate(inv.createdAt))}</span></div>
            <div class="row"><span class="lbl">Name:</span><span class="val">${esc(inv.customerName)}</span></div>
            <div class="row"><span class="lbl">Address:</span><span class="val">${esc(address)}</span></div>
            <div class="row"><span class="lbl">D-Address:</span><span class="val">${esc(address)}</span></div>
          </div>
          <div class="col">
            <div class="row"><span class="lbl">DC No.:</span><span class="val">${esc(inv.invoiceNumber)}</span></div>
            <div class="row"><span class="lbl">Date:</span><span class="val">${esc(formatDate(inv.createdAt))}</span></div>
            <div class="row"><span class="lbl">CNIC #:</span><span class="val"></span></div>
            <div class="row"><span class="lbl">NTN #:</span><span class="val"></span></div>
            <div class="row"><span class="lbl">GST #:</span><span class="val"></span></div>
          </div>
        </div>
        <div class="inline" style="margin-top:4px;">
          <div class="row"><span class="lbl">Ph # 1:</span><span class="val"></span></div>
          <div class="row"><span class="lbl">Ph # 2:</span><span class="val">${esc(inv.customerPhone)}</span></div>
          <div class="row"><span class="lbl">Vehicle #:</span><span class="val">${esc(inv.vehicleNumber || 'Self')}</span></div>
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
          </div>
          <div class="totals">
            <table>
              <tr><td class="k">Total</td><td class="v">${money(slipTotal)}</td></tr>
              <tr><td class="k">Advance Received</td><td class="v">${inv.amountPaid > 0 ? money(inv.amountPaid) : '-'}</td></tr>
              <tr><td class="k">Cash Received</td><td class="v">-</td></tr>
              <tr><td class="k">Adjust</td><td class="v">0</td></tr>
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

  const totalRevenue = state.invoices.reduce((s, i) => s + i.total, 0);
  const totalPaid = state.invoices.reduce((s, i) => s + i.amountPaid, 0);
  const totalPending = state.invoices.reduce((s, i) => s + i.balance, 0);
  const paidCount = state.invoices.filter(i => i.status === 'Paid').length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Invoices</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Create, manage, and print customer invoices</p>
        </div>
        <button onClick={() => { resetForm(); setCreateOpen(true); }} className="btn-primary">
          <Plus size={16} /> New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Invoices" value={state.invoices.length} icon={FileText}
          iconColor="text-blue-600" iconBg="bg-blue-50 dark:bg-blue-900/20" />
        <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign}
          iconColor="text-green-600" iconBg="bg-green-50 dark:bg-green-900/20" />
        <StatCard title="Collected" value={formatCurrency(totalPaid)} sub={`${paidCount} paid invoices`} icon={DollarSign}
          iconColor="text-teal-600" iconBg="bg-teal-50 dark:bg-teal-900/20" />
        <StatCard title="Pending" value={formatCurrency(totalPending)} icon={DollarSign}
          iconColor="text-red-600" iconBg="bg-red-50 dark:bg-red-900/20" />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice, customer, phone..." className="input pl-8 py-1.5" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input w-auto py-1.5">
            <option value="">All Status</option>
            <option>Paid</option>
            <option>Pending</option>
            <option>Partial</option>
            <option>Cancelled</option>
          </select>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} invoices</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices found"
            description="Create your first invoice to get started."
            action={
              <button onClick={() => setCreateOpen(true)} className="btn-primary text-sm">
                New Invoice
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Invoice #</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Phone</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Due Date</th>
                  <th className="table-header">Subtotal</th>
                  <th className="table-header">Discount</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">Paid</th>
                  <th className="table-header">Balance</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">labour</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id} className="table-row">
                    <td className="table-cell font-semibold text-blue-600 dark:text-blue-400 text-xs">{inv.invoiceNumber}</td>
                    <td className="table-cell text-xs">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {inv.invoiceType ?? 'Steel'}
                      </span>
                    </td>
                    <td className="table-cell font-medium">{inv.customerName}</td>
                    <td className="table-cell text-gray-400 text-xs">{inv.customerPhone}</td>
                    <td className="table-cell text-xs text-gray-400">{formatDate(inv.createdAt)}</td>
                    <td className="table-cell text-xs text-gray-400">{inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
                    <td className="table-cell">{formatCurrency(inv.subtotal)}</td>
                    <td className="table-cell text-orange-500">
                      {inv.discount > 0 ? (inv.discountType === 'percent' ? `${inv.discount}%` : formatCurrency(inv.discount)) : '—'}
                    </td>
                    <td className="table-cell font-bold">{formatCurrency(inv.total)}</td>
                    <td className="table-cell text-green-600">{formatCurrency(inv.amountPaid)}</td>
                    <td className="table-cell text-red-500 font-medium">{inv.balance > 0 ? formatCurrency(inv.balance) : '—'}</td>
                    <td className="table-cell"><Badge label={inv.status} /></td>
                    <td className="table-cell text-xs text-indigo-500">
                      {inv.workerBName ? (
                        <div>
                          <div className="font-medium">{inv.workerBName}</div>
                          {inv.workerBCharge ? <div className="text-gray-400">{formatCurrency(inv.workerBCharge)}</div> : null}
                        </div>
                      ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewInvoice(inv)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => openEdit(inv)}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteId(inv.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Invoice Modal */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setEditInvoice(null); resetForm(); }}
        title={editInvoice ? 'Edit Invoice' : 'New Invoice'}
        subtitle={editInvoice ? `Editing ${editInvoice.invoiceNumber}` : 'Create a professional invoice for your customer'}
        size="xl"
        footer={
          <>
            <button
              onClick={() => { setCreateOpen(false); setEditInvoice(null); resetForm(); }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button onClick={handleCreate} className="btn-primary" disabled={!customerReady || saving || stockErrors.length > 0}>
              <FileText size={15} />
              {saving ? 'Saving…' : stockErrors.length > 0 ? 'Not Enough Stock' : editInvoice ? 'Save Changes' : 'Create Invoice'}
            </button>
          </>
        }
      >
        <div className="space-y-5">

          {/* Customer + Invoice Type + Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Customer *</label>
                {!editInvoice && (
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                    <button
                      type="button"
                      onClick={() => setCustomerMode('existing')}
                      className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${customerMode === 'existing' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                      Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerMode('new')}
                      className={`px-2.5 py-1 text-[11px] font-medium flex items-center gap-1 transition-colors ${customerMode === 'new' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                      <UserPlus size={11} /> New
                    </button>
                  </div>
                )}
              </div>
              {(customerMode === 'existing' || editInvoice) ? (
                <>
                  <select value={formCustomerId} onChange={e => setFormCustomerId(e.target.value)} className="input">
                    <option value="">Select customer...</option>
                    {state.customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
                    ))}
                  </select>
                  {state.customers.length === 0 && !editInvoice && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      No customers yet — switch to &ldquo;New&rdquo; to register one right here.
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={newCustomer.name}
                      onChange={e => setNewCustomer(f => ({ ...f, name: e.target.value }))}
                      placeholder="Customer name *"
                      className="input py-2 text-sm"
                    />
                    <input
                      value={newCustomer.phone}
                      onChange={e => setNewCustomer(f => ({ ...f, phone: e.target.value }))}
                      placeholder="Phone * (e.g. 0300-0000000)"
                      className="input py-2 text-sm"
                    />
                  </div>
                  <input
                    value={newCustomer.address}
                    onChange={e => setNewCustomer(f => ({ ...f, address: e.target.value }))}
                    placeholder="Address (optional)"
                    className="input py-2 text-sm"
                  />
                  {phoneMatch ? (
                    <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg px-2.5 py-1.5">
                      <p className="text-[11px] text-blue-700 dark:text-blue-300 flex-1">
                        This phone is already registered to <b>{phoneMatch.name}</b> — the invoice will use them.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setCustomerMode('existing'); setFormCustomerId(phoneMatch.id); setNewCustomer(EMPTY_NEW_CUSTOMER); }}
                        className="text-[11px] font-semibold text-blue-600 hover:underline flex-shrink-0"
                      >
                        Select
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400">
                      Saved to Customers automatically when the invoice is created.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="label">Invoice Type *</label>
              <select
                value={formInvoiceType}
                onChange={e => {
                  const t = e.target.value as InvoiceType;
                  setFormInvoiceType(t);
                  // Reset items to a fresh row matching the chosen type
                  setFormItems([newItem(t === 'Cement' ? 'Cement' : 'Steel')]);
                }}
                className="input"
              >
                <option value="Steel">Steel</option>
                <option value="Cement">Cement</option>
                <option value="Both">Both (Steel + Cement)</option>
              </select>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input value={formDueDate} onChange={e => setFormDueDate(e.target.value)} type="date" className="input" />
            </div>
            <div>
              <label className="label">Transport Vehicle</label>
              <input
                value={formVehicle}
                onChange={e => setFormVehicle(e.target.value)}
                placeholder="e.g. LES-1234 or Self"
                className="input"
              />
            </div>
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
                  value={formWorkerBId}
                  onChange={e => setFormWorkerBId(e.target.value)}
                  className="input"
                >
                  <option value="">— None (direct sale) —</option>
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
                  {formWorkerBId && <span className="text-indigo-500 ml-1 font-normal">— for {state.workerBs.find(w => w.id === formWorkerBId)?.name}</span>}
                </label>
                <input
                  value={formWorkerBCharge}
                  onChange={e => setFormWorkerBCharge(e.target.value)}
                  type="number"
                  min="0"
                  placeholder="0"
                  disabled={!formWorkerBId}
                  className="input disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Items *</label>
              <div className="flex items-center gap-3">
                {(formInvoiceType === 'Steel' || formInvoiceType === 'Both') && (
                  <button
                    onClick={() => setFormItems(i => [...i, newItem('Steel')])}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <PlusCircle size={13} /> Add Steel
                  </button>
                )}
                {(formInvoiceType === 'Cement' || formInvoiceType === 'Both') && (
                  <button
                    onClick={() => setFormItems(i => [...i, newItem('Cement')])}
                    className="text-xs text-amber-600 hover:underline flex items-center gap-1"
                  >
                    <PlusCircle size={13} /> Add Cement
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {formItems.map((item, idx) => {
                const isCement = item.category === 'Cement';
                const unitWord = isCement ? 'pack' : 'kg';
                const batches = batchesFor(item.category ?? 'Steel');
                const selected = state.stockItems.find(st => st.id === item.stockItemId);
                return (
                <div key={item.id} className={`space-y-2 rounded-xl p-3 ${isCement ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-gray-50 dark:bg-gray-700/30'}`}>
                  {/* Stock batch row */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="label text-[10px] flex items-center gap-1.5">
                        Stock Batch
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${isCement ? 'bg-amber-200 text-amber-800 dark:bg-amber-800/40 dark:text-amber-300' : 'bg-blue-200 text-blue-800 dark:bg-blue-800/40 dark:text-blue-300'}`}>
                          {isCement ? 'CEMENT' : 'STEEL'}
                        </span>
                      </label>
                      <select
                        value={item.stockItemId ?? ''}
                        onChange={e => selectStockBatch(idx, e.target.value)}
                        className="input py-1.5 text-xs"
                      >
                        <option value="">— Select {isCement ? 'cement' : 'steel'} batch —</option>
                        {batches.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.steelType}{s.grade ? ` (${s.grade})` : ''} — {s.weightKg.toLocaleString()} {isCement ? 'packs' : 'kg'} @ PKR {s.pricePerKg}/{unitWord}
                          </option>
                        ))}
                      </select>
                      {item.stockItemId && (() => {
                        const avail = availableFor(item.stockItemId!);
                        const over = (requestedByBatch[item.stockItemId!] ?? 0) > avail;
                        return (
                          <p className={`text-[10px] mt-0.5 ${over ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                            Available: {avail.toLocaleString()} {isCement ? 'packs' : 'kg'}
                            {over && ' — not enough stock!'}
                          </p>
                        );
                      })()}
                    </div>
                    {formItems.length > 1 && (
                      <button
                        onClick={() => setFormItems(items => items.filter((_, i) => i !== idx))}
                        className="p-1.5 text-red-400 hover:text-red-600 mb-0.5"
                      >
                        <MinusCircle size={16} />
                      </button>
                    )}
                  </div>
                  {/* Qty / Price / Total row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="label text-[10px]">{isCement ? 'Packs' : 'Weight (kg)'}</label>
                      <input
                        value={item.weightKg || ''}
                        onChange={e => updateItem(idx, 'weightKg', e.target.value)}
                        type="number" min="0" step={isCement ? '1' : '0.01'} placeholder="0"
                        className="input py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="label text-[10px]">{isCement ? 'Price/pack (PKR)' : 'Price/kg (PKR)'}</label>
                      <input
                        value={item.pricePerKg || ''}
                        onChange={e => updateItem(idx, 'pricePerKg', e.target.value)}
                        type="number" min="0" placeholder="0"
                        className="input py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="label text-[10px]">Total</label>
                      <div className="input py-1.5 text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 font-medium">
                        {formatCurrency(item.totalPrice)}
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
            {(stockErrors.length > 0 || formError) && (
              <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3 space-y-1">
                {stockErrors.map((err, i) => (
                  <p key={i} className="text-xs font-medium text-red-600 dark:text-red-400">⚠ {err}</p>
                ))}
                {formError && (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">⚠ {formError}</p>
                )}
              </div>
            )}
          </div>

          {/* Extra Charges */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">
                Extra Charges{' '}
                <span className="text-gray-400 font-normal">(labour, transport, etc.)</span>
              </label>
              <button
                onClick={() => setFormExtraCharges(e => [...e, newCharge()])}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <PlusCircle size={13} /> Add Charge
              </button>
            </div>
            {formExtraCharges.length === 0 ? (
              <p className="text-xs text-gray-400 italic">
                No extra charges — click &ldquo;Add Charge&rdquo; to add labour, transport, etc.
              </p>
            ) : (
              <div className="space-y-2">
                {formExtraCharges.map((ec, idx) => (
                  <div key={ec.id} className="flex gap-2 items-end bg-gray-50 dark:bg-gray-700/30 rounded-xl p-3">
                    <div className="flex-1">
                      <label className="label text-[10px]">Description</label>
                      <input
                        value={ec.description}
                        onChange={e => setFormExtraCharges(charges => charges.map((ch, i) => i === idx ? { ...ch, description: e.target.value } : ch))}
                        placeholder="e.g. Labour charges, Transport, Loading fee..."
                        className="input py-1.5 text-xs"
                      />
                    </div>
                    <div className="w-36">
                      <label className="label text-[10px]">Amount (PKR)</label>
                      <input
                        value={ec.amount || ''}
                        onChange={e => setFormExtraCharges(charges => charges.map((ch, i) => i === idx ? { ...ch, amount: parseFloat(e.target.value) || 0 } : ch))}
                        type="number" min="0" placeholder="0"
                        className="input py-1.5 text-xs"
                      />
                    </div>
                    <button
                      onClick={() => setFormExtraCharges(charges => charges.filter((_, i) => i !== idx))}
                      className="p-1.5 text-red-400 hover:text-red-600 pb-2"
                    >
                      <MinusCircle size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="label">Discount</label>
                <div className="flex gap-2">
                  <input
                    value={formDiscount}
                    onChange={e => setFormDiscount(e.target.value)}
                    type="number" min="0" placeholder="0"
                    className="input flex-1"
                  />
                  <select
                    value={formDiscountType}
                    onChange={e => setFormDiscountType(e.target.value as 'flat' | 'percent')}
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
                  value={formAmountPaid}
                  onChange={e => setFormAmountPaid(e.target.value)}
                  type="number" min="0" placeholder="0"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Optional payment notes..."
                  rows={2}
                  className="input resize-none"
                />
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 space-y-2 h-fit">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Steel Items</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrencyFull(subtotal - extraTotal)}</span>
              </div>
              {extraTotal > 0 && (
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Extra Charges</span>
                  <span className="font-medium text-gray-900 dark:text-white">+ {formatCurrencyFull(extraTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 pt-1">
                <span>Subtotal</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrencyFull(subtotal)}</span>
              </div>
              {discountAmt > 0 && (
                <div className="flex justify-between text-sm text-orange-500">
                  <span>Discount</span>
                  <span>- {formatCurrencyFull(discountAmt)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                <span>Total</span>
                <span>{formatCurrencyFull(total)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600">
                <span>Amount Paid</span>
                <span>{formatCurrencyFull(parseFloat(formAmountPaid || '0'))}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-red-500">
                <span>Balance Due</span>
                <span>{formatCurrencyFull(balance)}</span>
              </div>
              <div className="pt-1">
                <Badge label={status} />
              </div>
            </div>
          </div>

        </div>
      </Modal>

      {/* Invoice View / Print Modal */}
      {viewInvoice && (
        <Modal
          open={!!viewInvoice}
          onClose={() => setViewInvoice(null)}
          title={`Invoice ${viewInvoice.invoiceNumber}`}
          subtitle={`${viewInvoice.invoiceType ?? 'Steel'} · ${viewInvoice.customerName} · ${formatDate(viewInvoice.createdAt)}`}
          size="xl"
          footer={
            <>
              <button onClick={() => setViewInvoice(null)} className="btn-secondary">
                Close
              </button>
              <button
                onClick={() => { const inv = viewInvoice; setViewInvoice(null); openEdit(inv); }}
                className="btn-secondary"
              >
                <Edit2 size={15} /> Edit
              </button>
              <button onClick={handlePrint} className="btn-primary">
                <Printer size={15} /> Print / Download
              </button>
            </>
          }
        >
          <div ref={printRef}>
            {/* Invoice Header */}
            <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <div className="text-xl font-black text-gray-900 dark:text-white">Majid Steel</div>
                <div className="text-xs text-gray-400 mt-0.5">Steel Warehouse Management</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-blue-600">{viewInvoice.invoiceNumber}</div>
                <div className="text-xs text-gray-400 mt-0.5">Date: {formatDate(viewInvoice.createdAt)}</div>
                {viewInvoice.dueDate && (
                  <div className="text-xs text-gray-400">Due: {formatDate(viewInvoice.dueDate)}</div>
                )}
                <div className="mt-1">
                  <Badge label={viewInvoice.status} />
                </div>
              </div>
            </div>

            {/* Bill To + Dealt By */}
            <div className="flex flex-wrap gap-6 mb-4">
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Bill To</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{viewInvoice.customerName}</div>
                <div className="text-xs text-gray-500">{viewInvoice.customerPhone}</div>
              </div>
              {viewInvoice.workerBName && (
                <div>
                  <div className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-1">Dealt By</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{viewInvoice.workerBName}</div>
                </div>
              )}
              {viewInvoice.vehicleNumber && (
                <div>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Vehicle</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{viewInvoice.vehicleNumber}</div>
                </div>
              )}
            </div>

            {/* Items Table */}
            <table className="w-full mb-4 text-sm">
              <thead>
                <tr>
                  <th className="table-header rounded-l-lg">Item</th>
                  <th className="table-header">Description</th>
                  <th className="table-header text-right">Qty</th>
                  <th className="table-header text-right">Rate</th>
                  <th className="table-header text-right rounded-r-lg">Total</th>
                </tr>
              </thead>
              <tbody>
                {viewInvoice.items.map(item => {
                  const isCement = item.category === 'Cement';
                  return (
                  <tr key={item.id} className="table-row">
                    <td className="table-cell font-medium">{item.steelType}</td>
                    <td className="table-cell text-gray-400">{item.description || '—'}</td>
                    <td className="table-cell text-right">{item.weightKg.toLocaleString()} {isCement ? 'packs' : 'kg'}</td>
                    <td className="table-cell text-right">PKR {item.pricePerKg}/{isCement ? 'pack' : 'kg'}</td>
                    <td className="table-cell text-right font-semibold">{formatCurrencyFull(item.totalPrice)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Extra Charges (dealt-by labour folded in) */}
            {(() => {
              const charges = [
                ...(viewInvoice.extraCharges ?? []).map(ec => ({ id: ec.id, description: ec.description, amount: ec.amount })),
              ];
              if (viewInvoice.workerBCharge) {
                charges.push({
                  id: 'labour',
                  description: `Labour${viewInvoice.workerBName ? ` - ${viewInvoice.workerBName}` : ''}`,
                  amount: viewInvoice.workerBCharge,
                });
              }
              if (charges.length === 0) return null;
              return (
                <div className="mb-4">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Extra Charges</div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="table-header rounded-l-lg">Description</th>
                        <th className="table-header text-right rounded-r-lg">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {charges.map(ec => (
                        <tr key={ec.id} className="table-row">
                          <td className="table-cell text-gray-600 dark:text-gray-300">{ec.description}</td>
                          <td className="table-cell text-right font-semibold">{formatCurrencyFull(ec.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span>{formatCurrencyFull(viewInvoice.subtotal)}</span>
                </div>
                {viewInvoice.discount > 0 && (
                  <div className="flex justify-between text-orange-500">
                    <span>
                      Discount ({viewInvoice.discountType === 'percent' ? `${viewInvoice.discount}%` : 'flat'})
                    </span>
                    <span>
                      &mdash;{' '}
                      {formatCurrencyFull(viewInvoice.discountType === 'percent'
                        ? viewInvoice.subtotal * viewInvoice.discount / 100
                        : viewInvoice.discount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-1.5">
                  <span>Total</span>
                  <span>{formatCurrencyFull(viewInvoice.total)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Amount Paid</span>
                  <span>{formatCurrencyFull(viewInvoice.amountPaid)}</span>
                </div>
                {viewInvoice.balance > 0 && (
                  <div className="flex justify-between font-bold text-red-500">
                    <span>Balance Due</span>
                    <span>{formatCurrencyFull(viewInvoice.balance)}</span>
                  </div>
                )}
              </div>
            </div>

            {viewInvoice.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-400 font-medium mb-1">Notes</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{viewInvoice.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) await deleteInvoice(deleteId); }}
        title="Delete Invoice"
        message="This will permanently delete the invoice. This cannot be undone."
      />

    </div>
  );
}

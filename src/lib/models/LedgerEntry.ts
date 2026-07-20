import { Schema, model, models } from 'mongoose';

const LedgerItemSchema = new Schema({
  name:   { type: String, required: true },   // display cache: steelType (+ grade)
  qty:    { type: Number, required: true },    // weightKg delta (kg for Steel, packs for Cement)
  rate:   { type: Number, required: true },    // pricePerKg/pack used for this entry's amount
  amount: { type: Number, default: 0 },
  stockItemId:   { type: String, default: '' },              // real link, set server-side on save
  category:      { type: String, enum: ['Steel', 'Cement'], default: 'Steel' },
  grade:         { type: String, default: '' },
  unit:          { type: String, enum: ['kg', 'ton', 'piece', 'pack'], default: 'piece' },
  quantityUnits: { type: Number, default: 0 },  // piece/ton count, mirrors StockItem.quantity
  batchNumber:   { type: String, default: '' }, // only used when creating a new StockItem
  location:      { type: String, default: '' },
  notes:         { type: String, default: '' },
}, { _id: true });

const ExtraChargeSchema = new Schema({
  description: { type: String, required: true },
  amount:      { type: Number, default: 0 },
}, { _id: true });

const LedgerEntrySchema = new Schema({
  companyId:   { type: String, required: true },
  type:        { type: String, enum: ['Purchase', 'Payment'], required: true },
  date:        { type: String, required: true },   // YYYY-MM-DD, user-assigned entry date
  amount:      { type: Number, default: 0 },        // Purchase: invoice total (subtotal − discount) · Payment: amount paid
  items:       { type: [LedgerItemSchema], default: undefined },  // Purchase only
  method:      { type: String, enum: ['Bank Transfer', 'Cheque', 'Cash', 'Other'], default: undefined }, // Payment only
  reference:   { type: String, default: '' },       // Payment only
  note:        { type: String, default: '' },
  // ── Purchase-invoice fields (Purchase only, mirror of Invoice.ts) ────────
  invoiceNumber: { type: String, default: '' },     // PB-{year}-{0001}, server-assigned
  subtotal:      { type: Number, default: 0 },       // items + extra charges
  discount:      { type: Number, default: 0 },
  discountType:  { type: String, enum: ['flat', 'percent'], default: 'flat' },
  extraCharges:  { type: [ExtraChargeSchema], default: undefined },
  amountPaid:    { type: Number, default: 0 },       // paid at purchase time — reduces payable
  balance:       { type: Number, default: 0 },       // amount − amountPaid
  status:        { type: String, enum: ['Paid', 'Pending', 'Partial'], default: undefined },
  vehicleNumber: { type: String, default: '' },
  dueDate:       { type: String, default: '' },
  workerBId:     { type: String, default: '' },
  workerBName:   { type: String, default: '' },
  workerBCharge: { type: Number, default: 0 },
}, { timestamps: true });

LedgerEntrySchema.index({ companyId: 1, date: 1, createdAt: 1 });

export const LedgerEntry = models.LedgerEntry || model('LedgerEntry', LedgerEntrySchema);

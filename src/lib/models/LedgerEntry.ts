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

const LedgerEntrySchema = new Schema({
  companyId:   { type: String, required: true },
  type:        { type: String, enum: ['Purchase', 'Payment'], required: true },
  date:        { type: String, required: true },   // YYYY-MM-DD, user-assigned entry date
  amount:      { type: Number, default: 0 },        // Purchase: sum of items · Payment: amount paid
  items:       { type: [LedgerItemSchema], default: undefined },  // Purchase only
  method:      { type: String, enum: ['Bank Transfer', 'Cheque', 'Cash', 'Other'], default: undefined }, // Payment only
  reference:   { type: String, default: '' },       // Payment only
  note:        { type: String, default: '' },
}, { timestamps: true });

LedgerEntrySchema.index({ companyId: 1, date: 1, createdAt: 1 });

export const LedgerEntry = models.LedgerEntry || model('LedgerEntry', LedgerEntrySchema);

import { Schema, model, models } from 'mongoose';

const LedgerItemSchema = new Schema({
  name:   { type: String, required: true },
  qty:    { type: Number, required: true },
  rate:   { type: Number, required: true },
  amount: { type: Number, default: 0 },
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

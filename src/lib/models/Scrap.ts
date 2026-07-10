import { Schema, model, models } from 'mongoose';

const ScrapSchema = new Schema({
  stockItemId: { type: String, required: true },
  category:    { type: String, enum: ['Steel', 'Cement'], default: 'Steel' },
  steelType:   { type: String, required: true },
  grade:       { type: String, default: '' },
  weightKg:    { type: Number, required: true },   // kg for steel, packs for cement
  unit:        { type: String, default: 'kg' },
  pricePerKg:  { type: Number, default: 0 },
  companyName: { type: String, default: '' },
  batchNumber: { type: String, default: '' },
  date:        { type: String, default: () => new Date().toISOString().split('T')[0] },
  notes:       { type: String, default: '' },
});

ScrapSchema.index({ stockItemId: 1 });

export const Scrap = models.Scrap || model('Scrap', ScrapSchema);

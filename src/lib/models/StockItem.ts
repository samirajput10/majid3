import { Schema, model, models } from 'mongoose';

const StockItemSchema = new Schema({
  category:    { type: String, enum: ['Steel', 'Cement'], default: 'Steel' },
  steelType:   { type: String, required: true },
  grade:       { type: String, default: '' },
  weightKg:    { type: Number, required: true, default: 0 },
  quantity:    { type: Number, default: 0 },
  unit:        { type: String, enum: ['kg', 'ton', 'piece', 'pack'], default: 'piece' },
  pricePerKg:  { type: Number, default: 0 },
  companyId:   { type: String, required: true },
  companyName: { type: String, required: true },
  batchNumber: { type: String, default: '' },
  dateAdded:   { type: String, default: () => new Date().toISOString().split('T')[0] },
  location:    { type: String, default: '' },
  notes:       { type: String, default: '' },
  status:      { type: String, enum: ['In Stock', 'Low Stock', 'Out of Stock'], default: 'In Stock' },
}, { timestamps: true });

export const StockItem = models.StockItem || model('StockItem', StockItemSchema);

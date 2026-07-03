import { Schema, model, models } from 'mongoose';

const InvoiceItemSchema = new Schema({
  stockItemId: { type: String, default: '' },
  category:    { type: String, enum: ['Steel', 'Cement'], default: 'Steel' },
  steelType:   { type: String, required: true },
  description: { type: String, default: '' },
  weightKg:    { type: Number, default: 0 },
  quantity:    { type: Number, default: 1 },
  unit:        { type: String, default: 'piece' },
  pricePerKg:  { type: Number, default: 0 },
  totalPrice:  { type: Number, default: 0 },
}, { _id: true });


const ExtraChargeSchema = new Schema({
  description: { type: String, required: true },
  amount:      { type: Number, default: 0 },
}, { _id: true });

const InvoiceSchema = new Schema({
  invoiceNumber:  { type: String, required: true, unique: true },
  invoiceType:    { type: String, enum: ['Steel', 'Cement', 'Both'], default: 'Steel' },
  customerId:     { type: String, required: true },
  customerName:   { type: String, required: true },
  customerPhone:  { type: String, required: true },
  items:          { type: [InvoiceItemSchema], default: [] },
  extraCharges:   { type: [ExtraChargeSchema], default: [] },
  subtotal:       { type: Number, default: 0 },
  discount:       { type: Number, default: 0 },
  discountType:   { type: String, enum: ['flat', 'percent'], default: 'flat' },
  total:          { type: Number, default: 0 },
  amountPaid:     { type: Number, default: 0 },
  balance:        { type: Number, default: 0 },
  status:         { type: String, enum: ['Paid', 'Pending', 'Partial', 'Cancelled'], default: 'Pending' },
  notes:          { type: String, default: '' },
  vehicleNumber:  { type: String, default: '' },
  createdAt:      { type: String },
  dueDate:        { type: String, default: '' },
  workerBId:      { type: String, default: '' },
  workerBName:    { type: String, default: '' },
  workerBCharge:  { type: Number, default: 0 },
});

InvoiceSchema.index({ customerId: 1 });
InvoiceSchema.index({ customerPhone: 1 });

export const Invoice = models.Invoice || model('Invoice', InvoiceSchema);

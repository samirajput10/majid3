import { Schema, model, models } from 'mongoose';

const CustomerSchema = new Schema({
  name:            { type: String, required: true },
  phone:           { type: String, required: true, unique: true },
  address:         { type: String, default: '' },
  email:           { type: String, default: '' },
  city:            { type: String, default: '' },
  totalPurchases:  { type: Number, default: 0 },
  totalSpent:      { type: Number, default: 0 },
  pendingBalance:  { type: Number, default: 0 },
}, { timestamps: true });

export const Customer = models.Customer || model('Customer', CustomerSchema);

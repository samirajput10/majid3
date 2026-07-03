import mongoose, { Schema, model, models } from 'mongoose';

const CompanySchema = new Schema({
  name:           { type: String, required: true },
  contactPerson:  { type: String, default: '' },
  phone:          { type: String, required: true },
  address:        { type: String, default: '' },
  email:          { type: String, default: '' },
  totalPurchased: { type: Number, default: 0 },
  totalCost:      { type: Number, default: 0 },
}, { timestamps: true });

export const Company = models.Company || model('Company', CompanySchema);

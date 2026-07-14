import { Schema, model, models } from 'mongoose';

const ExpenseSchema = new Schema({
  description: { type: String, required: true },
  amount:      { type: Number, required: true },
  date:        { type: String, default: () => new Date().toISOString().split('T')[0] },
  note:        { type: String, default: '' },
}, { timestamps: true });

export const Expense = models.Expense || model('Expense', ExpenseSchema);

import { Schema, model, models } from 'mongoose';

const WorkerBSchema = new Schema({
  name:          { type: String, required: true },
  phone:         { type: String, default: '' },
  notes:         { type: String, default: '' },
  createdAt:     { type: String, default: () => new Date().toISOString().split('T')[0] },
  totalEarnings: { type: Number, default: 0 },
  totalPaid:     { type: Number, default: 0 },
  totalDeals:    { type: Number, default: 0 },
});

export const WorkerB = models.WorkerB || model('WorkerB', WorkerBSchema);

import { Schema, model, models } from 'mongoose';

const WorkerSchema = new Schema({
  name:        { type: String, required: true },
  phone:       { type: String, required: true },
  role:        { type: String, enum: ['Loader', 'Supervisor', 'Driver', 'Welder', 'Guard', 'Accountant', 'Other'], default: 'Loader' },
  salaryType:  { type: String, enum: ['Daily', 'Weekly', 'Monthly'], default: 'Daily' },
  salaryRate:  { type: Number, default: 0 },
  joiningDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  address:     { type: String, default: '' },
  cnic:        { type: String, default: '' },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

export const Worker = models.Worker || model('Worker', WorkerSchema);

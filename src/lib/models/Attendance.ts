import { Schema, model, models } from 'mongoose';

const AttendanceSchema = new Schema({
  workerId:  { type: String, required: true },
  date:      { type: String, required: true },   // YYYY-MM-DD
  present:   { type: Boolean, default: false },
  overtime:  { type: Number, default: 0 },
  notes:     { type: String, default: '' },
}, { timestamps: true });

// One record per worker per day
AttendanceSchema.index({ workerId: 1, date: 1 }, { unique: true });

export const Attendance = models.Attendance || model('Attendance', AttendanceSchema);

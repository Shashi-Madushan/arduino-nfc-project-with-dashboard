import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAttendanceLog extends Document {
  employeeId: string;
  employeeName: string;
  department: string;
  timestamp: Date;
  deviceIp: string;
  status: "present" | "unknown";
}

const AttendanceLogSchema = new Schema<IAttendanceLog>(
  {
    employeeId:   { type: String, required: true, index: true },
    employeeName: { type: String, default: "Unknown" },
    department:   { type: String, default: "" },
    timestamp:    { type: Date, default: () => new Date(), index: true },
    deviceIp:     { type: String, default: "" },
    status:       { type: String, enum: ["present", "unknown"], default: "present" },
  },
  { timestamps: false }
);

// Compound index for efficient date-range + employee queries
AttendanceLogSchema.index({ timestamp: -1, employeeId: 1 });

const AttendanceLog: Model<IAttendanceLog> =
  mongoose.models.AttendanceLog ??
  mongoose.model<IAttendanceLog>("AttendanceLog", AttendanceLogSchema);

export default AttendanceLog;

import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAttendanceLog extends Document {
  studentId: string;
  studentName: string;
  course: string;
  timestamp: Date;
  deviceIp: string;
  status: "present" | "unknown";
}

const AttendanceLogSchema = new Schema<IAttendanceLog>(
  {
    studentId:   { type: String, required: true, index: true },
    studentName: { type: String, default: "Unknown" },
    course:      { type: String, default: "" },
    timestamp:   { type: Date, default: () => new Date(), index: true },
    deviceIp:    { type: String, default: "" },
    status:      { type: String, enum: ["present", "unknown"], default: "present" },
  },
  { timestamps: false }
);

// Compound index for efficient date-range + student queries
AttendanceLogSchema.index({ timestamp: -1, studentId: 1 });

const AttendanceLog: Model<IAttendanceLog> =
  mongoose.models.AttendanceLog ??
  mongoose.model<IAttendanceLog>("AttendanceLog", AttendanceLogSchema);

export default AttendanceLog;

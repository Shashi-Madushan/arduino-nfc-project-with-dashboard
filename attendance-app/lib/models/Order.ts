import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOrder extends Document {
  employeeId: string;
  employeeName: string;
  department?: string;
  date: string; // YYYY-MM-DD
  orderedAt?: Date | null;
  takenAt?: Date | null;
  status: "ordered" | "taken";
  deviceIp?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    employeeId:   { type: String, required: true, index: true },
    employeeName: { type: String, default: "Unknown" },
    department:   { type: String, default: "" },
    date:         { type: String, required: true, index: true },
    orderedAt:    { type: Date, default: null },
    takenAt:      { type: Date, default: null },
    status:       { type: String, enum: ["ordered", "taken"], required: true },
    deviceIp:     { type: String, default: "" },
  },
  { timestamps: true }
);

OrderSchema.index({ date: 1, employeeId: 1 }, { unique: true });

const Order: Model<IOrder> =
  mongoose.models.Order ?? mongoose.model<IOrder>("Order", OrderSchema);

export default Order;

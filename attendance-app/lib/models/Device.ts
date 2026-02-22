import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDevice extends Document {
  name: string;
  description: string;
  token: string;      // raw random secret (64-char hex), stored plaintext
  lastSeen: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema = new Schema<IDevice>(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    token:       { type: String, required: true, unique: true, index: true },
    lastSeen:    { type: Date, default: null },
  },
  { timestamps: true }
);

const Device: Model<IDevice> =
  mongoose.models.Device ?? mongoose.model<IDevice>("Device", DeviceSchema);

export default Device;

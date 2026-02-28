import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISetting extends Document {
  orderCutoff: string; // HH:MM (24h)
}

const SettingSchema = new Schema<ISetting>(
  {
    orderCutoff: { type: String, required: true, default: "10:00" },
  },
  { timestamps: true }
);

const Setting: Model<ISetting> =
  mongoose.models.Setting ?? mongoose.model<ISetting>("Setting", SettingSchema);

export default Setting;

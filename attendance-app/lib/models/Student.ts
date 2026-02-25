import mongoose, { Schema, Document, Model } from "mongoose";

export interface IStudent extends Document {
  studentId: string;   // the string written onto the NFC card (max 16 chars)
  name: string;
  email?: string;
  course?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    studentId: { type: String, required: true, unique: true, maxlength: 16, trim: true },
    name:      { type: String, required: true, trim: true },
    email:     { type: String, trim: true, lowercase: true, default: "" },
    course:    { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const Student: Model<IStudent> =
  mongoose.models.Student ?? mongoose.model<IStudent>("Student", StudentSchema);

export default Student;

import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEmployee extends Document {
  employeeId: string;   // the string written onto the NFC card (max 16 chars)
  name: string;
  email?: string;
  department?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    employeeId: { type: String, required: true, unique: true, maxlength: 16, trim: true },
    name:       { type: String, required: true, trim: true },
    email:      { type: String, trim: true, lowercase: true, default: "" },
    department: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const Employee: Model<IEmployee> =
  mongoose.models.Employee ?? mongoose.model<IEmployee>("Employee", EmployeeSchema);

export default Employee;

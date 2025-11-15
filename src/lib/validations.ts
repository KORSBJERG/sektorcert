import { z } from "zod";

// Helper to handle empty strings as null/undefined
const optionalString = (maxLength: number, fieldName: string) =>
  z.string().trim().max(maxLength, `${fieldName} must be less than ${maxLength} characters`).transform(val => val === "" ? null : val).nullable();

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name must be less than 200 characters"),
  address: optionalString(500, "Address"),
  contact_person: optionalString(100, "Contact person"),
  contact_email: z.string().trim().max(255, "Email must be less than 255 characters")
    .transform(val => val === "" ? null : val)
    .refine((val) => val === null || z.string().email().safeParse(val).success, "Invalid email address")
    .nullable(),
  contact_phone: optionalString(20, "Phone"),
  operation_type: z.enum(["IT", "OT", "BOTH"]),
});

export const assessmentSchema = z.object({
  customer_id: z.string().uuid("Invalid customer ID"),
  consultant_name: z.string().trim().min(1, "Consultant name is required").max(100, "Consultant name must be less than 100 characters"),
  assessment_date: z.string().min(1, "Assessment date is required"),
});

export const assessmentItemSchema = z.object({
  maturity_level: z.number().int().min(1).max(4).nullable(),
  status: z.enum(["not_started", "in_progress", "completed", "not_applicable"]).nullable(),
  notes: optionalString(2000, "Notes"),
  recommended_actions: optionalString(2000, "Recommended actions"),
});

export const authSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72, "Password must be less than 72 characters"),
});

export const uuidSchema = z.string().uuid("Invalid UUID format");

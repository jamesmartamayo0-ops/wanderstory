import { z } from "zod";

export const createDestinationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  country: z.string().min(1, "Country is required"),
  region: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  featured: z.boolean().optional(),
});

export const updateDestinationSchema = z.object({
  name: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  region: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  heroMediaId: z.string().optional().or(z.literal("")),
  featured: z.boolean().optional(),
});

export type CreateDestinationInput = z.infer<typeof createDestinationSchema>;
export type UpdateDestinationInput = z.infer<typeof updateDestinationSchema>;
import { z } from "zod";
import { CONTINENT_SLUGS } from "@/data/continents";

const continentValue = z
  .string()
  .refine(
    (value) =>
      value === "" ||
      (CONTINENT_SLUGS as readonly string[]).includes(value),
    "Continent must be one of the supported continents"
  );

export const createDestinationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  country: z.string().min(1, "Country is required"),
  continent: continentValue.optional().or(z.literal("")),
  featuredPlace: z.string().max(200).optional().or(z.literal("")),
  region: z.string().optional().or(z.literal("")),
  description: z.string().max(5000).optional().or(z.literal("")),
  featured: z.boolean().optional(),
  published: z.boolean().optional(),
});

export const updateDestinationSchema = z.object({
  name: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  continent: continentValue.optional().or(z.literal("")),
  featuredPlace: z.string().max(200).optional().or(z.literal("")),
  region: z.string().optional().or(z.literal("")),
  description: z.string().max(5000).optional().or(z.literal("")),
  heroMediaId: z.string().optional().or(z.literal("")),
  featured: z.boolean().optional(),
  published: z.boolean().optional(),
});

export type CreateDestinationInput = z.infer<typeof createDestinationSchema>;
export type UpdateDestinationInput = z.infer<typeof updateDestinationSchema>;

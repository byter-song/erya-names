import { z } from "zod";

export const namingProjectSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(80),
  stage: z.enum(["onboarding", "generation", "funnel", "comparison", "finalization"]),
  status: z.enum(["draft", "active", "archived", "completed"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type NamingProject = z.infer<typeof namingProjectSchema>;

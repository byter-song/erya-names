import { z, type Infer } from "../shared/zod";

export const namingProjectSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(80),
  stage: z.enum(["configuration", "naming", "export"]),
  status: z.enum(["draft", "active", "completed"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type NamingProject = Infer<typeof namingProjectSchema>;

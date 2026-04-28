import { z } from 'zod';

export const UserSchema = z.object({
  id: z.number(),
  name: z.string().nullable().optional(),
  email: z.string(),
  role: z.string().nullable().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const ProjectSchema = z.object({
  id: z.number(),
  code: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const TaskSchema = z.object({
  id: z.number(),
  title: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  priority: z.string().nullable().optional(),
  project: ProjectSchema.nullable().optional(),
  assignee: UserSchema.nullable().optional(),
  start_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  last_activity_at: z.string().nullable().optional(),
  heat_score: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const ListEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ data: z.array(item) });

export const ItemEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ data: item });

export const LoginResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
});

export const CommentSchema = z.object({
  id: z.number(),
  content: z.string(),
  user: UserSchema.nullable().optional(),
  created_at: z.string().nullable().optional(),
});
export type Comment = z.infer<typeof CommentSchema>;

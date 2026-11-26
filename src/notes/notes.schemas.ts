import { z } from 'zod';

const title = z.string().trim().min(1).max(200);
const content = z.string().max(10_000);

export const createNoteSchema = z.object({
  title,
  content: content.default(''),
});
export type CreateNoteDto = z.infer<typeof createNoteSchema>;

// Not createNoteSchema.partial(): it would keep content's default,
// and a PATCH with only a title would erase the content.
export const updateNoteSchema = z
  .object({ title: title.optional(), content: content.optional() })
  .refine(
    (changes) => changes.title !== undefined || changes.content !== undefined,
    'Nothing to update',
  );
export type UpdateNoteDto = z.infer<typeof updateNoteSchema>;

export const noteIdSchema = z.uuid();

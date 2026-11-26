import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticationContext } from '@nestjs/authentication';
import { AuthorizationService } from '@nestjs/authorization';
import type { Note } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotePolicy } from './note.policy.js';
import type { CreateNoteDto, UpdateNoteDto } from './notes.schemas.js';

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly context: AuthenticationContext, // the current user
  ) {}

  create(data: CreateNoteDto) {
    const user = this.context.requireUser();
    return this.prisma.note.create({ data: { ...data, ownerId: user.id } });
  }

  /** Users get their own notes, admins get all of them. */
  list() {
    const user = this.context.requireUser();
    return this.prisma.note.findMany({
      where: user.role === 'admin' ? {} : { ownerId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.findAllowed(id, 'view');
  }

  async update(id: string, changes: UpdateNoteDto) {
    await this.findAllowed(id, 'edit');
    return this.prisma.note.update({ where: { id }, data: changes });
  }

  async remove(id: string) {
    await this.findAllowed(id, 'edit');
    await this.prisma.note.delete({ where: { id } });
  }

  /**
   * The note, if the current user may view or edit it. Someone else's note
   * is a 404 rather than a 403, so the API doesn't reveal that it exists.
   */
  private async findAllowed(
    id: string,
    ability: 'view' | 'edit',
  ): Promise<Note> {
    const user = this.context.requireUser();
    const note = await this.prisma.note.findUnique({ where: { id } });
    if (
      !note ||
      !(await this.authorization.can(NotePolicy, ability, user, note))
    ) {
      throw new NotFoundException('Note not found');
    }
    return note;
  }
}

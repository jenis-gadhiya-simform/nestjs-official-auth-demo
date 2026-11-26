import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Can } from '@nestjs/authorization';
import { NotePolicy } from './note.policy.js';
import {
  createNoteSchema,
  noteIdSchema,
  updateNoteSchema,
  type CreateNoteDto,
  type UpdateNoteDto,
} from './notes.schemas.js';
import { NotesService } from './notes.service.js';

@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Post()
  @Can(NotePolicy, 'create')
  create(@Body({ schema: createNoteSchema }) body: CreateNoteDto) {
    return this.notes.create(body);
  }

  // @Can.Anyone(): any signed-in user. The service checks each note.
  @Get()
  @Can.Anyone()
  list() {
    return this.notes.list();
  }

  @Get(':id')
  @Can.Anyone()
  findOne(@Param('id', { schema: noteIdSchema }) id: string) {
    return this.notes.findOne(id);
  }

  @Patch(':id')
  @Can.Anyone()
  update(
    @Param('id', { schema: noteIdSchema }) id: string,
    @Body({ schema: updateNoteSchema }) body: UpdateNoteDto,
  ) {
    return this.notes.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Can.Anyone()
  remove(@Param('id', { schema: noteIdSchema }) id: string) {
    return this.notes.remove(id);
  }
}

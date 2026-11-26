import { Module } from '@nestjs/common';
import { NotePolicy } from './note.policy.js';
import { NotesController } from './notes.controller.js';
import { NotesService } from './notes.service.js';

@Module({
  controllers: [NotesController],
  providers: [NotesService, NotePolicy],
})
export class NotesModule {}

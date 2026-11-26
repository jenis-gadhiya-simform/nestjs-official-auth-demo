import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import type { User } from './user.js';
import { UserPolicy } from './user.policy.js';
import { UsersRepository } from './users.repository.js';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersRepository) {}

  @Get('me')
  @Can.Anyone()
  me(@CurrentUser() user: User) {
    return user;
  }

  @Get('admin/users')
  @Can(UserPolicy, 'list')
  list() {
    return this.users.findAll();
  }
}

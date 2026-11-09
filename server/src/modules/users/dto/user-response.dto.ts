import { UserDocument } from '../user.schema.js';

export class UserResponseDto {
  id: string;
  email: string;
  name: string;

  static fromDocument(user: UserDocument): UserResponseDto {
    return { id: user.id, email: user.email, name: user.name };
  }
}

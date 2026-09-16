import { IsEmail } from 'class-validator';

export class SendFriendRequestDto {
  @IsEmail()
  targetEmail: string;
}

import { IsOptional, IsString } from 'class-validator';

/** Omitting planId clears the user's subscription (reverts to the free tier). */
export class SetUserPlanDto {
  @IsOptional()
  @IsString()
  planId?: string;
}

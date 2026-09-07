import { Body, Controller, Delete, Get, Headers, HttpCode, Post, Req, Request } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { BillingService } from './billing.service';
import { CheckoutDto } from './dto/checkout.dto';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @ApiBearerAuth()
  @Get('subscription')
  @ApiOperation({ summary: "Get the current user's subscription" })
  @ApiResponse({ status: 200, description: 'Current subscription, or null' })
  getSubscription(@Request() req: any) {
    return this.billingService.getSubscription(req.user.id);
  }

  @ApiBearerAuth()
  @Post('checkout')
  @ApiOperation({ summary: 'Start a subscription checkout for a plan' })
  @ApiResponse({ status: 201, description: 'Checkout started (live redirect URL or demo-mode activation)' })
  checkout(@Request() req: any, @Body() dto: CheckoutDto) {
    return this.billingService.checkout(req.user.id, dto.planId);
  }

  @ApiBearerAuth()
  @Delete('subscription')
  @ApiOperation({ summary: 'Cancel the current subscription' })
  @ApiResponse({ status: 200, description: 'Subscription canceled' })
  cancel(@Request() req: any) {
    return this.billingService.cancel(req.user.id);
  }

  @Public()
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Stripe webhook receiver (no-op until a merchant account is configured)' })
  handleWebhook(@Req() req: RawBodyRequest<ExpressRequest>, @Headers('stripe-signature') signature?: string) {
    return this.billingService.handleWebhook(req.rawBody as Buffer, signature);
  }
}

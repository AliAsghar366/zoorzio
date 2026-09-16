import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { WhatsAppService, WhatsAppButton } from './whatsapp.service';
import { WhatsAppUnofficialService } from './whatsapp-unofficial.service';

/**
 * Single point every other module sends WhatsApp messages through, so
 * RemindersService/ChatService/BriefingService don't each need to know which
 * of the two transports is actually live.
 *
 * Routing rule: if the unofficial (QR-linked) connection is paired, it
 * handles everything - it's the same physical number, and once that's linked
 * it is what's actually receiving the user's replies. Otherwise this falls
 * back to the official Cloud API transport, which is what a fresh deployment
 * (nothing linked yet) or a fully Tech-Provider-approved account uses.
 */
@Injectable()
export class WhatsAppSenderService {
  constructor(
    @Inject(forwardRef(() => WhatsAppService))
    private readonly official: WhatsAppService,
    @Inject(forwardRef(() => WhatsAppUnofficialService))
    private readonly unofficial: WhatsAppUnofficialService,
  ) {}

  private async active(): Promise<WhatsAppService | WhatsAppUnofficialService> {
    return (await this.unofficial.isConnected()) ? this.unofficial : this.official;
  }

  async sendMessage(userId: string, to: string, message: string) {
    return (await this.active()).sendMessage(userId, to, message);
  }

  async sendButtons(userId: string, to: string, body: string, buttons: WhatsAppButton[]) {
    return (await this.active()).sendButtons(userId, to, body, buttons);
  }

  async isWithinCustomerServiceWindow(userId: string, to: string): Promise<boolean> {
    const transport = await this.active();
    return transport === this.unofficial
      ? this.unofficial.isWithinCustomerServiceWindow()
      : this.official.isWithinCustomerServiceWindow(userId, to);
  }

  async sendTemplate(
    userId: string,
    to: string,
    template: {
      name: string;
      language: string;
      bodyParameters?: string[];
      quickReplyPayloads?: string[];
    },
  ) {
    return (await this.active()).sendTemplate(userId, to, template);
  }
}

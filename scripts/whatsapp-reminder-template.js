#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires -- plain CommonJS script run directly with node */
/**
 * Submits, or checks the approval status of, the WhatsApp message template
 * Zoorzio uses for reminders that fire outside the 24-hour customer service
 * window (when WhatsApp accepts nothing but an approved template).
 *
 *   npm run whatsapp:template -- create
 *   npm run whatsapp:template -- status
 *
 * Reads WHATSAPP_BUSINESS_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID, plus the
 * optional WHATSAPP_REMINDER_TEMPLATE_NAME, WHATSAPP_REMINDER_TEMPLATE_LANGUAGE
 * and WHATSAPP_GRAPH_API_VERSION, from the environment or apps/api/.env.
 */
const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', 'apps', 'api', '.env') });
} catch {
  // dotenv is optional - plain environment variables work too.
}

const token = process.env.WHATSAPP_BUSINESS_TOKEN;
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const name = process.env.WHATSAPP_REMINDER_TEMPLATE_NAME || 'zoorzio_reminder';
const language = process.env.WHATSAPP_REMINDER_TEMPLATE_LANGUAGE || 'en';
const version = process.env.WHATSAPP_GRAPH_API_VERSION || 'v25.0';

// Button order matters: RemindersService fills the quick-reply payloads in
// this same order (done, snooze, stop). Meta also rejects a template whose
// body starts or ends with a variable, hence the text around {{1}}.
const TEMPLATE = {
  name,
  language,
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: '🔔 Reminder: {{1}}\n\nWhat would you like to do?',
      example: { body_text: [['Submit your application']] },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Done' },
        { type: 'QUICK_REPLY', text: 'Remind me in an hour' },
        { type: 'QUICK_REPLY', text: "Don't remind me again" },
      ],
    },
  ],
};

async function graph(method, resource, body) {
  const response = await fetch(`https://graph.facebook.com/${version}/${resource}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.error_user_msg || data?.error?.message || response.statusText;
    throw new Error(`Meta returned ${response.status}: ${message}`);
  }
  return data;
}

async function create() {
  const result = await graph('POST', `${wabaId}/message_templates`, TEMPLATE);
  console.log(
    `Submitted template "${name}" (${language}): id ${result.id}, status ${result.status}.`,
  );
  console.log(
    'Meta reviews it before it can be sent. Check with: npm run whatsapp:template -- status',
  );
}

async function status() {
  const fields = 'name,language,status,category,rejected_reason';
  const result = await graph(
    'GET',
    `${wabaId}/message_templates?name=${encodeURIComponent(name)}&fields=${fields}`,
  );

  const templates = result.data || [];
  if (templates.length === 0) {
    console.log(
      `No template named "${name}" yet. Submit it with: npm run whatsapp:template -- create`,
    );
    return;
  }

  for (const template of templates) {
    const rejected =
      template.rejected_reason && template.rejected_reason !== 'NONE'
        ? ` (rejected: ${template.rejected_reason})`
        : '';
    console.log(
      `${template.name} [${template.language}, ${template.category}]: ${template.status}${rejected}`,
    );
  }
}

async function main() {
  const command = process.argv[2];
  if (command !== 'create' && command !== 'status') {
    console.error('Usage: npm run whatsapp:template -- <create|status>');
    process.exit(1);
  }

  if (!token || !wabaId) {
    console.error(
      'Set WHATSAPP_BUSINESS_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID first (in apps/api/.env or the environment).',
    );
    process.exit(1);
  }

  await (command === 'create' ? create() : status());
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

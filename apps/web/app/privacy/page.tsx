import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — Zoorzio',
  description: 'How Zoorzio collects, uses, and protects your data, including third-party messaging channels.',
};

const LAST_UPDATED = 'September 6, 2026';
const POLICY_VERSION = '1.0';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-anchor-50 text-anchor-800">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <Link href="/" className="text-sm text-primary-500 hover:text-primary-600 font-medium">
          ← Back to Zoorzio
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold text-anchor-900 mt-6 mb-2">Privacy Policy</h1>
        <p className="text-sm text-anchor-500 mb-10">
          Version {POLICY_VERSION} — Last updated {LAST_UPDATED}
        </p>

        <div className="max-w-none space-y-8 text-anchor-700 leading-relaxed">
          <section>
            <p>
              This Privacy Policy explains what information Zoorzio (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) collects when you use the
              Zoorzio application and related services (the &quot;Service&quot;), how we use it, and the choices you have. By
              creating a Zoorzio account, you confirm that you have read and accept this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-anchor-900 mb-3">1. Information we collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Account information:</strong> your name, email address, phone number, profile photo, and
                password (stored as a salted cryptographic hash — we never store your password in plain text).
              </li>
              <li>
                <strong>Content you give us:</strong> notes, tasks, reminders, lists, calendar events, and messages
                you send Zoorzio directly or through a connected channel (WhatsApp, Telegram, SMS, Email, Discord,
                Slack, voice notes) — this is the &quot;memory&quot; data the Service is built to store and recall for you.
              </li>
              <li>
                <strong>Connected-channel identifiers:</strong> the phone number, chat ID, or account handle needed
                to deliver messages back to you on WhatsApp, Telegram, and other channels you connect.
              </li>
              <li>
                <strong>Usage and device data:</strong> log data, IP address, browser/device type, and timestamps of
                account activity (including consent events — see Section 6).
              </li>
              <li>
                <strong>Cookies:</strong> see Section 7.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-anchor-900 mb-3">2. How we use your information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide the core Service — capturing, understanding, and recalling what you send us.</li>
              <li>Deliver reminders, daily/weekly briefings, and replies over the channels you&apos;ve connected.</li>
              <li>
                Process your content through AI providers (such as OpenAI) to generate summaries, answer questions,
                and power search over your own memory data.
              </li>
              <li>Maintain account security, detect abuse, and enforce rate limits.</li>
              <li>Improve the Service and fix bugs.</li>
            </ul>
            <p>We do not sell your personal data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-anchor-900 mb-3">
              3. Third-party channels and services — please read carefully
            </h2>
            <p>
              Zoorzio integrates with third-party platforms including but not limited to{' '}
              <strong>WhatsApp (Meta), Telegram, Twilio (SMS), Discord, Slack, Google Calendar, Microsoft Outlook,
              Notion, GitHub, and OpenAI</strong>. When you connect one of these channels, you are also subject to
              that platform&apos;s own terms of service and privacy policy, which we do not control.
            </p>
            <p className="mt-3">
              <strong>
                Zoorzio is not responsible or liable for anything that happens to your account on a third-party
                platform.
              </strong>{' '}
              This includes, without limitation: suspension, banning, or termination of your WhatsApp or Telegram
              account; security incidents, data breaches, or outages on the third-party&apos;s own systems; failed,
              delayed, or misdirected message delivery; or any consequence of your own violation of that platform&apos;s
              terms of service. You connect and use these third-party channels entirely at your own risk, and any
              dispute arising from them is between you and that third-party provider.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-anchor-900 mb-3">4. Data retention</h2>
            <p>
              We retain your account and content data for as long as your account is active. Audit logs related to
              account security and consent are retained for up to 365 days. You can request deletion of your account
              and associated data at any time from your account settings, or by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-anchor-900 mb-3">5. Security</h2>
            <p>
              We use industry-standard measures to protect your data, including password hashing (Argon2id), HTTPS
              in transit, rate limiting, and audit logging of security-relevant account activity. No system is
              perfectly secure, and we cannot guarantee absolute security of information transmitted to or stored by
              the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-anchor-900 mb-3">6. Your consent, and how we record it</h2>
            <p>
              Creating an account requires you to actively accept this Privacy Policy. When you do, we record the
              date and time of your acceptance, the policy version you accepted, and the IP address/browser used to
              accept it. This record is kept as proof of consent and is not used for any other purpose.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-anchor-900 mb-3">7. Cookies</h2>
            <p>
              We use a small number of cookies/local storage entries: strictly necessary ones to keep you signed in
              and remember your session, and a cookie-preference record of the choice you make in our cookie banner.
              We do not currently use third-party advertising or tracking cookies. You can control or clear cookies
              through your browser settings at any time; blocking strictly necessary cookies will prevent you from
              staying signed in.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-anchor-900 mb-3">8. Your rights</h2>
            <p>
              Depending on where you live, you may have the right to access, correct, export, or delete your
              personal data. You can manage most of this directly from your account settings, or contact us for
              assistance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-anchor-900 mb-3">9. Children&apos;s privacy</h2>
            <p>The Service is not directed to children under 13, and we do not knowingly collect their data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-anchor-900 mb-3">10. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Material changes will require existing users to review
              and re-accept the updated policy before continuing to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-anchor-900 mb-3">11. Contact</h2>
            <p>Questions about this policy can be sent to the Zoorzio support channel listed in the app.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

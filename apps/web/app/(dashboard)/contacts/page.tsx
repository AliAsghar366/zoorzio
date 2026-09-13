'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { ApiError, contactsApi, type Contact } from '@/lib/api';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    contactsApi
      .list()
      .then(setContacts)
      .catch(() => setError('Could not load your contacts.'))
      .finally(() => setLoading(false));
  }, []);

  const createContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!email.trim() && !phone.trim()) {
      setError('Add an email address or a phone number so Zoorzio can reach them.');
      return;
    }

    setError(null);
    try {
      const created = await contactsApi.create({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setContacts((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      setEmail('');
      setPhone('');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save that contact.');
    }
  };

  const removeContact = async (id: string) => {
    if (!confirm('Delete this contact?')) return;
    await contactsApi.remove(id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q),
    );
  }, [contacts, search]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="pb-4 text-white">
      <h1 className="text-3xl font-bold">Contacts</h1>
      <p className="mt-2 text-sm text-white/60">
        People Zoorzio can look up by name. Ask it to &ldquo;email Ahmed&rdquo; or &ldquo;set up a
        meeting with Ahmed&rdquo; and it uses the details saved here instead of guessing.
      </p>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search contacts"
        className="dashboard-input mt-4 w-full"
      />

      <button
        onClick={() => setShowForm((v) => !v)}
        className="dashboard-pill-primary mt-3 inline-flex items-center gap-2"
      >
        <Plus size={15} /> Add contact
      </button>

      {showForm && (
        <form onSubmit={createContact} className="dashboard-card mt-3 space-y-3 p-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="dashboard-input w-full"
            required
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            type="email"
            className="dashboard-input w-full"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number (e.g. +447848472822)"
            className="dashboard-input w-full"
          />
          <button type="submit" className="dashboard-pill-primary w-full">
            Save
          </button>
        </form>
      )}

      {visible.length === 0 ? (
        <div className="dashboard-card mt-4 p-8 text-center">
          <p className="text-sm text-white/50">
            {contacts.length === 0
              ? 'No contacts yet. Add one so Zoorzio knows who you mean by name.'
              : 'No contacts match that search.'}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((contact) => (
            <div key={contact.id} className="dashboard-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{contact.name}</p>
                  <p className="mt-0.5 text-xs text-white/50">
                    {[contact.email, contact.phone].filter(Boolean).join(' · ') ||
                      'No contact details'}
                  </p>
                </div>
                <button
                  onClick={() => removeContact(contact.id)}
                  className="shrink-0 text-xs text-white/40 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

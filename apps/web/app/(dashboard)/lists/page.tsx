'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { UpgradeBanner } from '@/components/UpgradeBanner';
import { ShareButton } from '@/components/ShareButton';

type ListType = 'TODO' | 'SHOPPING' | 'IDEAS' | 'CUSTOM';
type Tab = 'mine' | 'shared';

interface ListItem {
  id: string;
  content: string;
  isChecked: boolean;
  position: number;
}

interface ZoorzioList {
  id: string;
  name: string;
  type: ListType;
  isArchived: boolean;
  items: ListItem[];
}

interface SharedResource {
  shareId: string;
  resourceType: 'LIST' | 'REMINDER';
  permission: 'VIEW' | 'EDIT';
  owner: { id: string; email: string; name: string | null };
  resource: ZoorzioList;
}

const TYPE_LABEL: Record<ListType, string> = {
  TODO: 'To-do',
  SHOPPING: 'Shopping',
  IDEAS: 'Ideas',
  CUSTOM: 'Custom',
};

export default function ListsPage() {
  const [lists, setLists] = useState<ZoorzioList[]>([]);
  const [sharedLists, setSharedLists] = useState<SharedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('mine');
  const [search, setSearch] = useState('');
  const [newItemDrafts, setNewItemDrafts] = useState<Record<string, string>>({});
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchLists = async () => {
    const data = await api.get<ZoorzioList[]>('/lists');
    setLists(data);
  };

  const fetchSharedLists = async () => {
    const data = await api.get<SharedResource[]>('/sharing/shared-with-me?resourceType=LIST');
    setSharedLists(data);
  };

  useEffect(() => {
    Promise.all([fetchLists(), fetchSharedLists()]).finally(() => setLoading(false));
  }, []);

  const createList = async () => {
    const name = window.prompt('List name');
    if (!name) return;
    setCreateError(null);
    try {
      const created = await api.post<ZoorzioList>('/lists', { name });
      setLists((prev) => [created, ...prev]);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Failed to create list');
    }
  };

  const deleteList = async (id: string) => {
    if (!confirm('Delete this list?')) return;
    await api.delete(`/lists/${id}`);
    setLists((prev) => prev.filter((l) => l.id !== id));
  };

  const addItem = async (listId: string) => {
    const content = (newItemDrafts[listId] || '').trim();
    if (!content) return;
    const item = await api.post<ListItem>(`/lists/${listId}/items`, { content });
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, items: [...l.items, item] } : l)));
    setNewItemDrafts((prev) => ({ ...prev, [listId]: '' }));
  };

  const toggleItem = async (listId: string, item: ListItem) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId ? { ...l, items: l.items.map((i) => (i.id === item.id ? { ...i, isChecked: !i.isChecked } : i)) } : l,
      ),
    );
    try {
      await api.put(`/lists/${listId}/items/${item.id}`, { isChecked: !item.isChecked });
    } catch {
      fetchLists();
    }
  };

  const removeItem = async (listId: string, itemId: string) => {
    await api.delete(`/lists/${listId}/items/${itemId}`);
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, items: l.items.filter((i) => i.id !== itemId) } : l)));
  };

  const visibleLists = useMemo(() => {
    if (!search.trim()) return lists;
    const q = search.toLowerCase();
    return lists.filter((l) => l.name.toLowerCase().includes(q));
  }, [lists, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="text-white pb-4">
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-3xl font-bold">Lists</h1>
        <Image src="/zoorzio-icon.png" alt="" width={24} height={24} />
      </div>

      {shareError && <p className="text-red-300 text-sm mb-3">{shareError}</p>}
      {shareNotice && <p className="text-green-300 text-sm mb-3">{shareNotice}</p>}
      {createError && <UpgradeBanner message={createError} />}

      <input placeholder="Search lists" value={search} onChange={(e) => setSearch(e.target.value)} className="dashboard-input" />

      <button onClick={createList} className="dashboard-pill-primary mt-3">
        <Plus size={16} /> Create new list
      </button>

      <div className="flex gap-2 mt-4">
        <button onClick={() => setTab('mine')} className={tab === 'mine' ? 'dashboard-pill active text-xs py-1.5 px-4' : 'dashboard-pill text-xs py-1.5 px-4'}>
          My lists
        </button>
        <button onClick={() => setTab('shared')} className={tab === 'shared' ? 'dashboard-pill active text-xs py-1.5 px-4' : 'dashboard-pill text-xs py-1.5 px-4'}>
          Shared with me
        </button>
      </div>

      {tab === 'mine' ? (
        visibleLists.length === 0 ? (
          <div className="dashboard-card p-10 mt-4 text-center">
            <Image src="/zoorzio-icon.png" alt="" width={48} height={48} className="mx-auto mb-3 opacity-80" />
            <p className="font-semibold">No lists yet</p>
            <p className="text-sm text-white/50 mt-1 mb-4">Create your first list to get started.</p>
            <button onClick={createList} className="dashboard-pill-primary">
              <Plus size={16} /> Create new list
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {visibleLists.map((list) => (
              <div key={list.id} className="dashboard-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-sm">{list.name}</h3>
                    <span className="text-[10px] font-semibold bg-white/10 rounded-full px-2.5 py-0.5 mt-1 inline-block">
                      {TYPE_LABEL[list.type]}
                    </span>
                  </div>
                  <div className="flex gap-3 items-start">
                    <ShareButton
                      resourceType="LIST"
                      resourceId={list.id}
                      className="text-white/50 hover:text-white text-xs"
                      onShared={(email) => setShareNotice(`Shared with ${email}`)}
                      onError={setShareError}
                    />
                    <button onClick={() => deleteList(list.id)} className="text-white/50 hover:text-red-300 text-xs">
                      Delete
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  {list.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 group">
                      <input
                        type="checkbox"
                        checked={item.isChecked}
                        onChange={() => toggleItem(list.id, item)}
                        className="rounded border-white/30 text-[#ac84cc] focus:ring-[#ac84cc] bg-white/10"
                      />
                      <span className={item.isChecked ? 'flex-1 text-sm text-white/40 line-through' : 'flex-1 text-sm'}>{item.content}</span>
                      <button
                        onClick={() => removeItem(list.id, item.id)}
                        className="text-white/30 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {list.items.length === 0 && <p className="text-sm text-white/40">No items yet.</p>}
                </div>

                <div className="flex gap-2">
                  <input
                    placeholder="Add item..."
                    value={newItemDrafts[list.id] || ''}
                    onChange={(e) => setNewItemDrafts((prev) => ({ ...prev, [list.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && addItem(list.id)}
                    className="dashboard-input flex-1"
                  />
                  <button onClick={() => addItem(list.id)} className="dashboard-pill px-4 text-xs shrink-0">
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : sharedLists.length === 0 ? (
        <div className="dashboard-card p-10 mt-4 text-center">
          <p className="text-white/50 text-sm">No lists have been shared with you yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {sharedLists.map(({ shareId, owner, resource, permission }) => (
            <div key={shareId} className="dashboard-card p-5">
              <div className="mb-3">
                <h3 className="font-semibold text-sm">{resource.name}</h3>
                <span className="text-[10px] text-white/50 mt-1 inline-block">
                  From {owner.name || owner.email} · {permission}
                </span>
              </div>
              <div className="space-y-2">
                {resource.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={item.isChecked} disabled className="rounded border-white/30 bg-white/10" />
                    <span className={item.isChecked ? 'flex-1 text-sm text-white/40 line-through' : 'flex-1 text-sm'}>{item.content}</span>
                  </div>
                ))}
                {resource.items.length === 0 && <p className="text-sm text-white/40">No items yet.</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

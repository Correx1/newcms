/* eslint-disable react-hooks/purity */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Send, MessageSquare, Plus, Search, Loader2,
  FolderKanban, X, Users, Check, Pencil, Trash2, ArrowLeft
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface OtherUser { id: string; name: string; email: string; role: string }
interface Project { id: string; title: string }
interface Conversation {
  id: string
  title: string | null
  other_user: OtherUser | null
  other_users?: OtherUser[]
  last_message: any
  unread_count: number
}
interface Message {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
  project_id: string | null
  project?: { title: string } | null
  is_read: boolean
  is_deleted: boolean
  edited_at: string | null
  profiles?: { name: string; role: string }
}

const getStableColor = (id: string) => {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  const colors = [
    "text-blue-600 dark:text-blue-400", 
    "text-emerald-600 dark:text-emerald-400", 
    "text-violet-600 dark:text-violet-400", 
    "text-amber-600 dark:text-amber-400", 
    "text-rose-600 dark:text-rose-400", 
    "text-cyan-600 dark:text-cyan-400",
    "text-fuchsia-600 dark:text-fuchsia-400",
    "text-orange-600 dark:text-orange-400"
  ]
  return colors[Math.abs(hash) % colors.length]
}

export default function MessagesPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [taggedProject, setTaggedProject] = useState<Project | null>(null)
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [search, setSearch] = useState("")

  // Edit state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState("")

  // New conversation modal
  const [newConvOpen, setNewConvOpen] = useState(false)
  const [contactables, setContactables] = useState<OtherUser[]>([])
  const [selectedRecipients, setSelectedRecipients] = useState<OtherUser[]>([])
  const [firstMessage, setFirstMessage] = useState("")
  const [firstProjectTag, setFirstProjectTag] = useState<Project | null>(null)
  const [startingConv, setStartingConv] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [contactSearch, setContactSearch] = useState("")

  const bottomRef = useRef<HTMLDivElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const fetchConversations = useCallback(async () => {
    const res = await fetch('/api/messages', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setConversations(data.conversations || [])
    }
    setLoadingConvs(false)
  }, [])

  const fetchProjects = useCallback(async () => {
    // Try admin route first; fallback to direct supabase query for non-admins
    const res = await fetch('/api/admin/projects?limit=100', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setProjects((data.projects || []).map((p: any) => ({ id: p.id, title: p.title })))
    } else {
      const { data } = await supabase.from('projects').select('id, title').order('title')
      setProjects(data || [])
    }
  }, [supabase])

  useEffect(() => {
    fetchConversations()
    fetchProjects()
  }, [fetchConversations, fetchProjects])

  // Realtime: new messages in active conversation
  useEffect(() => {
    if (!activeConv || !user) return
    const channel = supabase
      .channel(`messages:${activeConv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConv.id}` }, (payload: any) => {
        setMessages(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new as Message])
        if (payload.new.sender_id !== user.id) fetchConversations()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConv.id}` }, (payload: any) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeConv, user, supabase, fetchConversations])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`conv-watch:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchConversations())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, supabase, fetchConversations])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (editingMsgId) editInputRef.current?.focus()
  }, [editingMsgId])

  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv)
    setTaggedProject(null)
    setEditingMsgId(null)
    setLoadingMsgs(true)
    const res = await fetch(`/api/messages/${conv.id}`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      const msgs: Message[] = data.messages || []
      const enriched = msgs.map(msg => ({
        ...msg,
        project: msg.project_id ? (projects.find(p => p.id === msg.project_id) ? { title: projects.find(p => p.id === msg.project_id)!.title } : null) : null
      }))
      setMessages(enriched)
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c))
    }
    setLoadingMsgs(false)
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeConv || sending) return
    setSending(true)
    const body = newMessage.trim()
    setNewMessage("")
    const prevTag = taggedProject
    setTaggedProject(null)

    const res = await fetch(`/api/messages/${activeConv.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ body, project_id: prevTag?.id || null })
    })

    if (!res.ok) {
      toast.error("Failed to send message")
      setNewMessage(body)
      setTaggedProject(prevTag)
    } else {
      const data = await res.json()
      const newMsg: Message = { ...data.message, project: prevTag ? { title: prevTag.title } : null }
      setMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
      fetchConversations()
    }
    setSending(false)
  }

  const submitEdit = async (msgId: string) => {
    if (!editingBody.trim()) return
    const res = await fetch(`/api/messages/msg/${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ body: editingBody.trim() })
    })
    if (res.ok) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, body: editingBody.trim(), edited_at: new Date().toISOString() } : m))
    } else {
      toast.error("Failed to edit message")
    }
    setEditingMsgId(null)
    setEditingBody("")
  }

  const deleteMessage = async (msgId: string) => {
    const res = await fetch(`/api/messages/msg/${msgId}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (res.ok) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: true, body: 'This message was deleted.' } : m))
    } else {
      toast.error("Failed to delete message")
    }
  }

  const loadContactables = async () => {
    const res = await fetch('/api/messages/contacts', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setContactables(data.contacts || [])
    }
  }

  const openNewConvModal = async () => {
    await loadContactables()
    setNewConvOpen(true)
    setSelectedRecipients([])
    setFirstMessage("")
    setFirstProjectTag(null)
    setContactSearch("")
  }

  const toggleRecipient = (c: OtherUser) => {
    setSelectedRecipients(prev =>
      prev.find(r => r.id === c.id) ? prev.filter(r => r.id !== c.id) : [...prev, c]
    )
  }

  const startConversation = async () => {
    if (!selectedRecipients.length || !firstMessage.trim()) return
    setStartingConv(true)
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        recipient_ids: selectedRecipients.map(r => r.id),
        body: firstMessage.trim(),
        project_id: firstProjectTag?.id || null,
        title: selectedRecipients.length > 1 ? selectedRecipients.map(r => r.name).join(', ') : null
      })
    })
    if (res.ok) {
      const data = await res.json()
      toast.success(`Sent to ${selectedRecipients.map(r => r.name).join(', ')}`)
      setNewConvOpen(false)
      await fetchConversations()
      const updated = await fetch('/api/messages', { credentials: 'include' }).then(r => r.json())
      const found = (updated.conversations || []).find((c: Conversation) => c.id === data.conversation_id)
      if (found) openConversation(found)
    } else {
      toast.error("Failed to start conversation")
    }
    setStartingConv(false)
  }

  const getConvLabel = (c: Conversation) => {
    if (c.title) return c.title
    if (c.other_users && c.other_users.length > 1) {
      return c.other_users.map(u => u?.name).join(', ')
    }
    return c.other_user?.name || 'Unknown'
  }
  const getConvInitial = (conv: Conversation) => (conv.title || conv.other_user?.name || '?').charAt(0).toUpperCase()
  const filteredConvs = conversations.filter(c => getConvLabel(c).toLowerCase().includes(search.toLowerCase()))
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
      case 'staff': return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
      case 'client': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const diff = Date.now() - d.getTime()
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  // Grouped contacts
  const staffContacts = contactables.filter(c => c.role === 'staff' || c.role === 'admin')
  const clientContacts = contactables.filter(c => c.role === 'client')
  const filteredStaff = staffContacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()))
  const filteredClients = clientContacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()))

  const ContactGroup = ({ label, contacts, color }: { label: string; contacts: OtherUser[]; color: string }) => (
    contacts.length > 0 ? (
      <div>
        <p className={cn("text-[10px] font-bold uppercase tracking-widest px-1 mb-1 mt-2", color)}>{label}</p>
        <div className="flex flex-col gap-1">
          {contacts.map(c => {
            const isSelected = !!selectedRecipients.find(r => r.id === c.id)
            return (
              <button key={c.id} onClick={() => toggleRecipient(c)}
                className={cn("flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors text-left",
                  isSelected ? "bg-primary/10 border-primary/30 text-primary" : "bg-background border-border/30 hover:bg-muted/40")}>
                <div className={cn("h-6 w-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0", getRoleColor(c.role))}>
                  {c.name?.charAt(0)?.toUpperCase()}
                </div>
                <span className="flex-1 truncate">{c.name}</span>
                {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
              </button>
            )
          })}
        </div>
      </div>
    ) : null
  )

  return (
    <div className="flex h-[calc(100dvh-6rem)] sm:h-[calc(100vh-4rem)] w-full gap-0 overflow-hidden rounded-xl border border-border/50 shadow-sm bg-background">
      {/* Sidebar */}
      <div className={cn(
        "w-full sm:w-80 flex flex-col border-border/50 bg-muted/10 shrink-0 transition-all h-full",
        activeConv ? "hidden sm:flex sm:border-r" : "flex-1 sm:h-auto sm:border-r"
      )}>
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base">Messages</h2>
              {totalUnread > 0 && (
                <span className="h-5 w-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </div>
            <Button size="sm" variant="outline" className="h-8 px-2 font-bold" onClick={openNewConvModal}>
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-8 h-8 text-sm bg-background/50" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loadingConvs ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filteredConvs.length === 0 ? (
            <div className="py-12 text-center px-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground font-medium">No conversations yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Click New to start messaging</p>
            </div>
          ) : (
            <div className="py-1">
              {filteredConvs.map(conv => (
                <button key={conv.id} onClick={() => openConversation(conv)}
                  className={cn("w-full flex items-start gap-3 px-3 py-3 border-b border-border/30 text-left transition-colors hover:bg-muted/30",
                    activeConv?.id === conv.id && "bg-primary/5 border-l-2 border-l-primary")}>
                  <div className={cn("h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ring-1",
                    conv.title ? "bg-violet-500/10 text-violet-600 ring-violet-500/20" : "bg-primary/10 text-primary ring-primary/20")}>
                    {conv.title ? <Users className="h-4 w-4" /> : getConvInitial(conv)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-sm truncate">
                        {conv.title || (conv.other_users && conv.other_users.length > 1 ? 'Group Conversation' : getConvLabel(conv))}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                        {conv.last_message ? formatTime(conv.last_message.created_at) : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs text-muted-foreground truncate">{conv.last_message?.body || 'Start the conversation'}</p>
                      {conv.unread_count > 0 && (
                        <span className="h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    {!conv.title && (!conv.other_users || conv.other_users.length <= 1) && conv.other_user && (
                      <span className={cn("inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded border mt-1 capitalize", getRoleColor(conv.other_user.role))}>
                        {conv.other_user.role}
                      </span>
                    )}
                    {(conv.title || (conv.other_users && conv.other_users.length > 1)) && <span className="text-[9px] text-violet-500 font-semibold mt-0.5 inline-block">Group</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Thread */}
      <div className={cn(
        "flex-col overflow-hidden bg-background h-full w-full",
        activeConv ? "flex flex-1" : "hidden sm:flex flex-1"
      )}>
        {activeConv ? (
          <>
            <div className="px-5 py-3 border-b border-border/50 bg-muted/5 flex items-center gap-3 shrink-0">
              <button 
                className="sm:hidden p-1.5 -ml-2 rounded-full hover:bg-muted text-muted-foreground mr-1"
                onClick={() => setActiveConv(null)}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className={cn("h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm ring-1",
                (activeConv.title || (activeConv.other_users && activeConv.other_users.length > 1)) ? "bg-violet-500/10 text-violet-600 ring-violet-500/20" : "bg-primary/10 text-primary ring-primary/20")}>
                {(activeConv.title || (activeConv.other_users && activeConv.other_users.length > 1)) ? <Users className="h-4 w-4" /> : getConvInitial(activeConv)}
              </div>
              <div className="flex-1 min-w-0">
                {(activeConv.title || (activeConv.other_users && activeConv.other_users.length > 1)) ? (
                  <>
                    <p className="font-bold text-sm truncate">{activeConv.title || 'Group conversation'}</p>
                    <p className="text-[10.5px] text-muted-foreground truncate font-medium uppercase tracking-tight mt-0.5">
                      {activeConv.other_users?.map(u => `${u.name} (${u.role})`).join(', ')}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-sm truncate uppercase">{getConvLabel(activeConv)}</p>
                    {activeConv.other_user && (
                      <span className={cn("inline-flex items-center text-[9px] font-semibold px-2 py-0.5 rounded border capitalize mt-1", getRoleColor(activeConv.other_user.role))}>
                        {activeConv.other_user.role}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0 px-4 py-4">
              {loadingMsgs ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No messages yet. Say hello! 👋</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {messages.map((msg, i) => {
                    const isMe = msg.sender_id === user?.id
                    const prevMsg = messages[i - 1]
                    const showTimestamp = !prevMsg || new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 5 * 60 * 1000
                    const isEditing = editingMsgId === msg.id
                    return (
                      <div key={msg.id}>
                        {showTimestamp && (
                          <div className="text-center my-3">
                            <span className="text-[10px] text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">{formatTime(msg.created_at)}</span>
                          </div>
                        )}
                        <div className={cn("flex items-end gap-1.5", isMe ? "justify-end" : "justify-start")}>
                          {/* Actions: always shown for my messages */}
                          {isMe && !msg.is_deleted && !isEditing && (
                            <div className="flex items-center gap-1 mb-1">
                              <button onClick={() => { setEditingMsgId(msg.id); setEditingBody(msg.body) }}
                                className="h-6 w-6 rounded-full bg-muted/60 border border-border/40 flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors"
                                title="Edit">
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button onClick={() => deleteMessage(msg.id)}
                                className="h-6 w-6 rounded-full bg-muted/60 border border-border/40 flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
                                title="Delete">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}

                          <div className={cn("flex flex-col gap-0.5", isMe ? "items-end" : "items-start")}>
                            {/* Project tag */}
                            {msg.project && !msg.is_deleted && (
                              <Link href={`/projects/${msg.project_id}`} className={cn("flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border hover:underline transition-all",
                                isMe ? "bg-primary/5 border-primary/20 text-primary" : "bg-muted/40 border-border/40 text-muted-foreground")}>
                                <FolderKanban className="h-2.5 w-2.5" />
                                {msg.project.title}
                              </Link>
                            )}

                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  ref={editInputRef}
                                  value={editingBody}
                                  onChange={e => setEditingBody(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit(msg.id) }
                                    if (e.key === 'Escape') { setEditingMsgId(null); setEditingBody("") }
                                  }}
                                  className="px-3 py-2 rounded-xl border border-primary/40 bg-primary/5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[200px]"
                                />
                                <Button size="sm" className="h-8 px-2" onClick={() => submitEdit(msg.id)}><Check className="h-3.5 w-3.5" /></Button>
                                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setEditingMsgId(null); setEditingBody("") }}><X className="h-3.5 w-3.5" /></Button>
                              </div>
                            ) : (
                              <div className={cn("max-w-[92%] sm:max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                                msg.is_deleted
                                  ? "bg-muted/30 text-muted-foreground italic border border-border/30 rounded-2xl"
                                  : isMe
                                    ? "bg-primary text-primary-foreground rounded-br-sm"
                                    : "bg-muted/50 text-foreground border border-border/30 rounded-bl-sm")}>
                                
                                {/* Sender name above message for groups */}
                                {!isMe && !msg.is_deleted && (activeConv?.title || (activeConv?.other_users && activeConv.other_users.length > 1)) && msg.profiles && (
                                  <div className="flex items-baseline gap-1.5 mb-1 opacity-90">
                                    <span className={cn("font-bold text-[10.5px] lowercase tracking-tight", getStableColor(msg.sender_id))}>{msg.profiles.name}</span>
                                    <span className="text-[8.5px] text-muted-foreground/80 font-bold lowercase tracking-wider">{msg.profiles.role}</span>
                                  </div>
                                )}
                                <div className="whitespace-pre-wrap word-break-words break-words">{msg.body}</div>
                              </div>
                            )}

                            {msg.edited_at && !msg.is_deleted && (
                              <span className="text-[9px] text-muted-foreground italic px-1">edited</span>
                            )}
                          </div>

                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </ScrollArea>

            {/* Tagged project chip */}
            {taggedProject && (
              <div className="px-3 pt-2 flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                  <FolderKanban className="h-3 w-3" />
                  {taggedProject.title}
                  <button onClick={() => setTaggedProject(null)} className="ml-1 hover:text-destructive transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={sendMessage} className="p-3 border-t border-border/50 bg-background/80 backdrop-blur-sm flex gap-2 shrink-0">
              <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" title="Tag a project" onClick={() => setProjectPickerOpen(true)}>
                <FolderKanban className="h-4 w-4" />
              </Button>
              <textarea
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (newMessage.trim() && !sending) {
                      e.currentTarget.form?.requestSubmit()
                    }
                  }
                }}
                placeholder="Type a message (Shift+Enter for new line)..."
                className="flex-1 bg-muted/20 border border-border/50 font-medium rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none max-h-32 min-h-[40px] leading-relaxed hidden-scrollbar"
                disabled={sending}
                autoFocus
                rows={Math.max(1, Math.min(newMessage.split('\n').length, 5))}
              />
              <Button type="submit" disabled={!newMessage.trim() || sending} className="h-10 px-4 shadow-sm">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8">
            <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center">
              <MessageSquare className="h-8 w-8 text-primary/40" />
            </div>
            <p className="font-semibold text-base">Select a conversation</p>
            <p className="text-sm text-muted-foreground/70 text-center max-w-xs">Pick from the left or start a new one.</p>
            <Button variant="outline" className="mt-2 font-bold" onClick={openNewConvModal}>
              <Plus className="mr-2 h-4 w-4" /> New Message
            </Button>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      <Dialog open={newConvOpen} onOpenChange={setNewConvOpen}>
        <DialogContent className="sm:max-w-[460px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2 flex-1 overflow-y-auto pr-1">
            {/* Recipients */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">
                To {selectedRecipients.length > 0 && <span className="text-primary font-bold">({selectedRecipients.length} selected)</span>}
              </Label>

              {/* Selected chips */}
              {selectedRecipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedRecipients.map(r => (
                    <span key={r.id} className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-primary text-primary-foreground">
                      {r.name}
                      <button onClick={() => toggleRecipient(r)}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}

              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search contacts..." className="pl-8 h-8 text-sm" value={contactSearch} onChange={e => setContactSearch(e.target.value)} />
              </div>

              {/* Grouped contact list */}
              <div className="border border-border/50 rounded-lg p-3 bg-muted/10 max-h-52 overflow-y-auto space-y-1">
                {contactables.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2 text-center">No contacts found</p>
                ) : (
                  <>
                    <ContactGroup label={user?.role === 'client' ? "👥 Admin" : "👥 Staff & Admin"} contacts={filteredStaff} color="text-blue-600" />
                    <ContactGroup label="🧑‍💼 Clients" contacts={filteredClients} color="text-emerald-600" />
                    {filteredStaff.length === 0 && filteredClients.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">No results</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Optional project tag */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">
                Tag a Project <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </Label>
              <select className="w-full rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={firstProjectTag?.id || ""}
                onChange={e => { const p = projects.find(p => p.id === e.target.value); setFirstProjectTag(p || null) }}>
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>

            {/* Message body */}
            <div>
              <Label htmlFor="firstMsg" className="text-sm font-semibold mb-2 block">Message</Label>
              <textarea id="firstMsg" value={firstMessage} onChange={e => setFirstMessage(e.target.value)}
                placeholder="Write your message..." rows={3}
                className="w-full resize-none rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/50 shrink-0">
            <Button variant="outline" onClick={() => setNewConvOpen(false)} disabled={startingConv} className="font-bold">Cancel</Button>
            <Button onClick={startConversation} disabled={!selectedRecipients.length || !firstMessage.trim() || startingConv} className="font-bold shadow-sm">
              {startingConv ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {selectedRecipients.length > 1 ? `Send to ${selectedRecipients.length} people` : selectedRecipients[0] ? `Send to ${selectedRecipients[0].name}` : 'Send'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Picker (in-chat) */}
      <Dialog open={projectPickerOpen} onOpenChange={setProjectPickerOpen}>
        <DialogContent className="sm:max-w-[340px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FolderKanban className="h-4 w-4" /> Tag a Project</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto py-2">
            <button onClick={() => { setTaggedProject(null); setProjectPickerOpen(false) }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/30 border border-border/30 border-dashed">
              <X className="h-4 w-4" /> No project tag
            </button>
            {projects.map(p => (
              <button key={p.id} onClick={() => { setTaggedProject(p); setProjectPickerOpen(false) }}
                className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors text-left",
                  taggedProject?.id === p.id ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/10 border-border/30 hover:bg-muted/30")}>
                <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
                {p.title}
                {taggedProject?.id === p.id && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

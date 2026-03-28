/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client"

import { useState, useEffect, useCallback } from "react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { Button } from "@/components/ui/button"
import { Plus, GripVertical, Trash2, User, Loader2, Check, Flag, ListChecks, Clock, Edit2, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Subtask {
  id: string
  title: string
  is_completed: boolean
}

interface Task {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done'
  assignee_id: string | null
  order: number
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  subtasks: Subtask[]
  assignee?: { name: string; email: string; avatar_url?: string } | null
}

interface StaffMember {
  id: string
  name: string
  email: string
  avatar_url: string | null
}

interface KanbanBoardProps {
  projectId: string
  userRole: string
  staffList?: StaffMember[]
  onProgressUpdate?: (progress: number) => void
  projectOverview?: string
  projectDeliverables?: string
}

export default function KanbanBoard({ projectId, userRole, staffList = [], onProgressUpdate, projectOverview, projectDeliverables }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Quick Add State
  const [addingTo, setAddingTo] = useState<'todo' | 'in_progress' | 'done' | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState("")

  // Edit Modal State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  
  // AI Generation State
  const [generatingAI, setGeneratingAI] = useState(false)

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/tasks`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setTasks(data.tasks || [])
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  useEffect(() => {
    if (onProgressUpdate) {
      if (tasks.length === 0) {
        onProgressUpdate(0)
      } else {
        const done = tasks.filter(t => t.status === 'done').length
        onProgressUpdate(Math.round((done / tasks.length) * 100))
      }
    }
  }, [tasks, onProgressUpdate])

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
      return
    }

    const destStatus = destination.droppableId as Task['status']

    const newTasks = Array.from(tasks)
    const draggedTask = newTasks.find(t => t.id === draggableId)
    if (!draggedTask) return

    draggedTask.status = destStatus
    newTasks.splice(newTasks.findIndex(t => t.id === draggableId), 1)

    const destTasks = newTasks.filter(t => t.status === destStatus).sort((a, b) => a.order - b.order)
    destTasks.splice(destination.index, 0, draggedTask)

    const updates: { id: string; status: string; order: number }[] = []
    destTasks.forEach((t, i) => {
      t.order = i
      updates.push({ id: t.id, status: destStatus, order: i })
    })

    setTasks([...newTasks.filter(t => t.status !== destStatus), ...destTasks])

    if (userRole === 'client') return
    
    await fetch(`/api/projects/${projectId}/tasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    })
  }

  const handleCreateTask = async (status: 'todo' | 'in_progress' | 'done') => {
    if (!newTaskTitle.trim()) {
      setAddingTo(null)
      return
    }
    setSaving(true)
    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTaskTitle, status, priority: 'medium', subtasks: [] })
    })

    if (res.ok) {
      const { task } = await res.json()
      setTasks(prev => [...prev, task])
      setNewTaskTitle("")
      setAddingTo(null)
    } else {
      toast.error("Failed to create task")
    }
    setSaving(false)
  }

  const handleAIGenerateTasks = async () => {
    if (!projectOverview) {
      toast.error("Project has no overview to generate tasks from.")
      return
    }
    setGeneratingAI(true)
    toast.loading("Analyzing project and generating tasks...", { id: "ai-gen" })
    
    try {
      const res = await fetch('/api/ai/generate-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overview: projectOverview, deliverables: projectDeliverables })
      })

      if (res.ok) {
        const { tasks: generatedTasks } = await res.json()
        
        let successCount = 0
        for (const t of generatedTasks) {
          const mappedSubtasks = Array.isArray(t.subtasks) ? t.subtasks.map((title: string, index: number) => ({
            id: `st-ai-${Date.now()}-${index}`,
            title: title,
            is_completed: false
          })) : []

          const createRes = await fetch(`/api/projects/${projectId}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: t.title, description: t.description, status: 'todo', priority: t.priority, subtasks: mappedSubtasks })
          })
          if (createRes.ok) successCount++
        }
        
        if (successCount > 0) {
          toast.success(`Generated and added ${successCount} tasks from AI!`, { id: "ai-gen" })
          fetchTasks()
        } else {
          toast.error("AI returned tasks but failed to save them.", { id: "ai-gen" })
        }
      } else {
        toast.error("Failed to generate AI tasks", { id: "ai-gen" })
      }
    } catch (e: any) {
      toast.error("An error occurred during AI generation", { id: "ai-gen" })
    } finally {
      setGeneratingAI(false)
    }
  }

  const handleDeleteTask = async (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!confirm("Are you sure you want to delete this task?")) return
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' })
    if (res.ok) {
      setTasks(prev => prev.filter(t => t.id !== taskId))
      setIsEditModalOpen(false)
    } else {
      toast.error("Failed to delete task")
    }
  }

  const saveTaskDetails = async () => {
    if (!selectedTask) return
    setSaving(true)
    
    // Assignee mapping for quick UI sync
    const assigneeObj = staffList.find(s => s.id === selectedTask.assignee_id) || null
    
    const taskUpdates = {
      title: selectedTask.title,
      description: selectedTask.description,
      priority: selectedTask.priority,
      due_date: selectedTask.due_date,
      assignee_id: selectedTask.assignee_id,
      subtasks: selectedTask.subtasks
    }

    const res = await fetch(`/api/projects/${projectId}/tasks/${selectedTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskUpdates)
    })

    if (res.ok) {
      const { task } = await res.json()
      setTasks(prev => prev.map(t => t.id === task.id ? task : t))
      toast.success("Task updated")
      setIsEditModalOpen(false)
    } else {
      toast.error("Failed to update task")
    }
    setSaving(false)
  }

  const addSubtask = () => {
    if (!selectedTask) return
    setSelectedTask({
      ...selectedTask,
      subtasks: [...(selectedTask.subtasks || []), { id: `st-${Date.now()}`, title: '', is_completed: false }]
    })
  }

  const updateSubtask = (id: string, field: keyof Subtask, value: any) => {
    if (!selectedTask) return
    setSelectedTask({
      ...selectedTask,
      subtasks: selectedTask.subtasks.map(st => st.id === id ? { ...st, [field]: value } : st)
    })
  }

  const removeSubtask = (id: string) => {
    if (!selectedTask) return
    setSelectedTask({
      ...selectedTask,
      subtasks: selectedTask.subtasks.filter(st => st.id !== id)
    })
  }

  const columns = [
    { id: 'todo', title: 'To Do', color: 'border-slate-200 bg-slate-50 dark:bg-slate-900/50' },
    { id: 'in_progress', title: 'In Progress', color: 'border-blue-200 bg-blue-50 dark:bg-blue-900/20' },
    { id: 'done', title: 'Done', color: 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20' }
  ] as const

  const getPriorityColor = (priority: string | undefined) => {
    if (priority === 'high') return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
    if (priority === 'low') return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' // medium
  }

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const isReadOnly = String(userRole).toLowerCase() === 'client'
  const canEditDetails = String(userRole).toLowerCase() === 'admin'


  return (
    <div className="space-y-4 pt-2">
      {canEditDetails && (
        <div className="flex justify-end">
           <Button variant="outline" size="sm" onClick={handleAIGenerateTasks} disabled={generatingAI} className="gap-2 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 border-indigo-200/60 shadow-sm transition-all text-xs font-bold tracking-tight">
             {generatingAI ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span>✨</span>}
             Auto-Generate AI Tasks
           </Button>
        </div>
      )}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start h-full">
          {columns.map(col => {
            const colTasks = tasks.filter(t => t.status === col.id).sort((a, b) => a.order - b.order)
            return (
              <div key={col.id} className={cn("rounded-xl border flex flex-col max-h-[70vh] overflow-hidden", col.color)}>
                <div className="px-4 py-3 flex items-center justify-between border-b bg-background/50 backdrop-blur-sm shrink-0">
                  <h3 className="font-bold text-sm text-foreground/80">{col.title}</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-background border shadow-sm">{colTasks.length}</span>
                </div>

                <Droppable droppableId={col.id} isDropDisabled={isReadOnly}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef} 
                      {...provided.droppableProps}
                      className={cn("p-3 flex-1 overflow-y-auto space-y-3 min-h-[150px] transition-colors scrollbar-none", snapshot.isDraggingOver && !isReadOnly ? "bg-primary/5" : "")}
                    >
                      {colTasks.map((task, index) => {
                        const completedSubtasks = task.subtasks?.filter(st => st.is_completed).length || 0
                        const totalSubtasks = task.subtasks?.length || 0
                        
                        return (
                        <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={isReadOnly}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              onClick={() => { setSelectedTask(task); setIsEditModalOpen(true); }}
                              className={cn("bg-background border rounded-lg shadow-sm transition-all relative group cursor-pointer hover:shadow-md", snapshot.isDragging ? "shadow-md ring-2 ring-primary/20 scale-[1.02]" : "hover:border-primary/40")}
                              style={provided.draggableProps.style}
                            >
                              <div className="p-3.5 flex flex-col gap-2.5">
                                <div className="flex gap-2 items-start justify-between">
                                  <div className="flex gap-2">
                                    {!isReadOnly && (
                                      <div {...provided.dragHandleProps} className="mt-0.5 text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" onClick={e => e.stopPropagation()}>
                                        <GripVertical className="h-4 w-4" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0 pr-4">
                                      <p className="text-[13.5px] font-semibold text-foreground/90 wrap-break-word leading-snug">{task.title}</p>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center flex-wrap gap-2 text-xs">
                                  {/* Priority Badge */}
                                  <span className={cn("px-1.5 py-0.5 border rounded-md font-semibold text-[10px] uppercase flex items-center gap-1", getPriorityColor(task.priority))}>
                                    <Flag className="h-2.5 w-2.5" />
                                    {task.priority || 'Medium'}
                                  </span>

                                  {/* Subtasks Tracker */}
                                  {totalSubtasks > 0 && (
                                    <span className={cn("flex items-center gap-1 font-medium", completedSubtasks === totalSubtasks ? "text-emerald-500" : "text-muted-foreground")}>
                                      <ListChecks className="h-3.5 w-3.5" />
                                      {completedSubtasks}/{totalSubtasks}
                                    </span>
                                  )}

                                  {/* Due Date Indicator */}
                                  {task.due_date && (
                                    <span className={cn("flex items-center gap-1 font-medium", new Date(task.due_date) < new Date() && col.id !== 'done' ? "text-destructive" : "text-muted-foreground")}>
                                      <Clock className="h-3.5 w-3.5" />
                                      {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                  
                                  {/* Assignee Avatar */}
                                  {task.assignee && (
                                    <div className="ml-auto flex items-center shrink-0">
                                      <Avatar className="h-5 w-5 border border-background ring-1 ring-border shadow-sm">
                                        <AvatarImage src={task.assignee.avatar_url} />
                                        <AvatarFallback className="text-[9px] bg-primary/10 font-bold text-primary">{getInitials(task.assignee.name)}</AvatarFallback>
                                      </Avatar>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      )})}
                      {provided.placeholder}
                      
                      {/* Quick Add Form */}
                      {canEditDetails && addingTo === col.id && (
                        <div className="bg-background border border-primary/40 rounded-lg p-2 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                          <input 
                            autoFocus
                            value={newTaskTitle}
                            onChange={e => setNewTaskTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleCreateTask(col.id)
                              if (e.key === 'Escape') setAddingTo(null)
                            }}
                            placeholder="What needs to be done?"
                            className="w-full text-sm font-medium border-none focus:ring-0 p-1 mb-2 bg-transparent outline-none"
                          />
                          <div className="flex items-center gap-1.5">
                            <Button size="sm" className="h-7 text-xs px-2" onClick={() => handleCreateTask(col.id)} disabled={saving}>
                              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />} Save
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => { setAddingTo(null); setNewTaskTitle("") }}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>

                {canEditDetails && addingTo !== col.id && (
                  <div className="p-2 border-t bg-background/50 backdrop-blur-sm shrink-0">
                    <Button variant="ghost" className="w-full justify-start text-xs font-semibold h-8 text-muted-foreground hover:text-foreground hover:bg-muted/50" onClick={() => setAddingTo(col.id)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Card
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {/* Task Edit Modal */}
      {selectedTask && (
        <Dialog open={isEditModalOpen} onOpenChange={(open) => {
          if(!open) setIsEditModalOpen(false)
        }}>
          <DialogContent className="sm:max-w-[600px] h-[90vh] sm:h-auto max-h-[85vh] flex flex-col p-0 overflow-hidden gap-0">
            <div className="flex items-start justify-between p-6 pb-4 border-b bg-muted/20 shrink-0">
              <div className="space-y-1.5 w-full pr-6">
                <Textarea 
                  value={selectedTask.title}
                  onChange={e => setSelectedTask({...selectedTask, title: e.target.value})}
                  className="text-lg font-bold border-none bg-transparent p-0 resize-none focus-visible:ring-0 shadow-none leading-snug min-h-[40px]"
                  placeholder="Task Title..."
                  disabled={!canEditDetails}
                />
                <p className="text-xs font-medium text-muted-foreground px-1">
                  in list <span className="underline decoration-muted-foreground/30 capitalize">{selectedTask.status.replace('_', ' ')}</span>
                </p>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8 scrollbar-thin">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5"><User className="h-3.5 w-3.5"/> Assignee</Label>
                  {canEditDetails ? (
                    <Select 
                      value={selectedTask.assignee_id || "none"} 
                      onValueChange={(val) => setSelectedTask({...selectedTask, assignee_id: val === "none" ? null : val})}
                    >
                      <SelectTrigger className="bg-background shadow-sm h-9">
                        <SelectValue placeholder="Unassigned">
                          {selectedTask.assignee_id && selectedTask.assignee_id !== "none" 
                             ? staffList.find(s => s.id === selectedTask.assignee_id)?.name || "Unknown User"
                             : "Unassigned"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-muted-foreground italic">Unassigned</SelectItem>
                        {staffList.map(staff => (
                          <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-9 px-3 flex items-center bg-muted/20 border border-border/50 rounded-md text-sm font-medium">
                      {staffList.find(s => s.id === selectedTask.assignee_id)?.name || 'Unassigned'}
                    </div>
                  )}
                </div>

                <div className="space-y-2.5">
                  <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Clock className="h-3.5 w-3.5"/> Due Date</Label>
                  {canEditDetails ? (
                    <Input 
                      type="date" 
                      value={selectedTask.due_date ? new Date(selectedTask.due_date).toISOString().split('T')[0] : ''}
                      onChange={(e) => setSelectedTask({...selectedTask, due_date: e.target.value || null})}
                      className="h-9 shadow-sm"
                    />
                  ) : (
                    <div className="h-9 px-3 flex items-center bg-muted/20 border border-border/50 rounded-md text-sm font-medium">
                      {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : 'No date set'}
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 col-span-2 sm:col-span-1">
                  <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Flag className="h-3.5 w-3.5"/> Priority</Label>
                  {canEditDetails ? (
                    <Select 
                      value={selectedTask.priority || 'medium'} 
                      onValueChange={(val: any) => setSelectedTask({...selectedTask, priority: val})}
                    >
                      <SelectTrigger className="bg-background shadow-sm h-9">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low Priority</SelectItem>
                        <SelectItem value="medium">Medium Priority</SelectItem>
                        <SelectItem value="high">High Priority</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-9 px-3 flex items-center bg-muted/20 border border-border/50 rounded-md text-sm font-semibold capitalize">
                      {selectedTask.priority || 'medium'} Priority
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-bold flex items-center gap-2"><Edit2 className="h-4 w-4 text-muted-foreground" /> Description</Label>
                {canEditDetails ? (
                  <Textarea 
                    value={selectedTask.description || ''}
                    onChange={e => setSelectedTask({...selectedTask, description: e.target.value})}
                    placeholder="Add a more detailed description..."
                    className="min-h-[120px] resize-y shadow-sm"
                  />
                ) : (
                  <div className="min-h-[120px] bg-muted/10 rounded-xl border border-border/50 p-4 text-sm whitespace-pre-wrap leading-relaxed">
                    {selectedTask.description || 'No description provided.'}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-bold flex items-center gap-2"><ListChecks className="h-4 w-4 text-muted-foreground" /> Checklists / Subtasks</Label>
                
                <div className="space-y-2 bg-muted/20 p-4 rounded-xl border border-border/50">
                  {/* Progress Bar for subtasks */}
                  {selectedTask.subtasks && selectedTask.subtasks.length > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs font-bold mb-1.5 text-muted-foreground">
                        <span>Progress</span>
                        <span>{Math.round((selectedTask.subtasks.filter(s => s.is_completed).length / selectedTask.subtasks.length) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-300" 
                          style={{ width: `${(selectedTask.subtasks.filter(s => s.is_completed).length / selectedTask.subtasks.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {selectedTask.subtasks && selectedTask.subtasks.map((st) => (
                    <div key={st.id} className="flex items-center gap-3 group relative">
                      <button 
                        disabled={isReadOnly}
                        onClick={() => updateSubtask(st.id, 'is_completed', !st.is_completed)}
                        className={cn("h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors", st.is_completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40 text-transparent")}
                      >
                         <Check className="h-3 w-3" />
                      </button>
                      <Input 
                        value={st.title}
                        onChange={e => updateSubtask(st.id, 'title', e.target.value)}
                        disabled={!canEditDetails}
                        className={cn("h-8 bg-background shadow-sm border-transparent hover:border-border focus-visible:ring-1 transition-all", st.is_completed ? "line-through text-muted-foreground" : "")}
                        placeholder="Task item..."
                      />
                      {!isReadOnly && canEditDetails && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0 text-destructive hover:bg-destructive/10 transition-opacity" onClick={() => removeSubtask(st.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}

                  {!isReadOnly && canEditDetails && (
                    <Button variant="secondary" size="sm" onClick={addSubtask} className="mt-2 text-xs font-semibold h-8 w-full bg-background border shadow-sm">
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Item
                    </Button>
                  )}
                </div>
              </div>
            </div>
            
            <DialogFooter className="p-4 border-t bg-muted/10 shrink-0 flex-row items-center justify-between sm:justify-between w-full">
              {!isReadOnly && canEditDetails ? (
                <Button variant="destructive" size="sm" onClick={() => handleDeleteTask(selectedTask.id)} className="h-9 shadow-sm gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              ) : <div/>}

              {!isReadOnly && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)} className="h-9">Cancel</Button>
                  <Button size="sm" onClick={saveTaskDetails} disabled={saving} className="h-9 shadow-sm font-semibold min-w-[80px]">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                  </Button>
                </div>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

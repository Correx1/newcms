/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client"

import { useState, useEffect, useCallback } from "react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { Button } from "@/components/ui/button"
import { FolderKanban, GripVertical, Trash2, Loader2, Check, Flag, ListChecks, Clock, Edit2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Subtask {
  id: string
  title: string
  is_completed: boolean
}

interface ProjectData {
  id: string
  title: string
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
  projects?: ProjectData | null
  project_id: string
}

export default function MyGlobalTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Edit Modal State
  const [userRole, setUserRole] = useState<string>('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/tasks`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setTasks(data.tasks || [])
      setUserRole(String(data.role || '').toLowerCase())
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

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
    
    // We send patches to EACH specific project endpoint since this is a global view
    for (const update of updates) {
      const taskObj = [...newTasks.filter(t => t.status !== destStatus), ...destTasks].find(t => t.id === update.id)
      if (!taskObj) continue
      
      // Hit the specific taskId PATCH endpoint for the update
      await fetch(`/api/projects/${taskObj.project_id}/tasks/${taskObj.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: update.status, order: update.order }) // only updating status and order here natively per drag
      })
    }
  }

  const handleDeleteTask = async (taskId: string, projectId: string, e?: React.MouseEvent) => {
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
    
    const taskUpdates = {
      title: selectedTask.title,
      description: selectedTask.description,
      priority: selectedTask.priority,
      due_date: selectedTask.due_date,
      subtasks: selectedTask.subtasks
    }

    const res = await fetch(`/api/projects/${selectedTask.project_id}/tasks/${selectedTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskUpdates)
    })

    if (res.ok) {
      const { task } = await res.json()
      // Preserve the joined project data which isn't returned from a standard row update
      task.projects = selectedTask.projects 
      setTasks(prev => prev.map(t => t.id === task.id ? task : t))
      toast.success("Task updated")
      setIsEditModalOpen(false)
    } else {
      toast.error("Failed to update task")
    }
    setSaving(false)
  }

  const updateSubtask = (id: string, field: keyof Subtask, value: any) => {
    if (!selectedTask) return
    setSelectedTask({
      ...selectedTask,
      subtasks: selectedTask.subtasks.map(st => st.id === id ? { ...st, [field]: value } : st)
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
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
  }

  const canEditDetails = userRole === 'admin'

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Tasks Board</h2>
          <p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
            <Check className="h-4 w-4 text-primary" /> Here is everything currently assigned to you across all active projects.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-4 text-muted-foreground">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
           <p className="text-sm font-semibold tracking-widest uppercase">Loading my tasks...</p>
        </div>
      ) : (
        <div className="pt-4 h-[calc(100vh-160px)]">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start h-full">
              {columns.map(col => {
                const colTasks = tasks.filter(t => t.status === col.id).sort((a, b) => a.order - b.order)
                return (
                  <div key={col.id} className={cn("rounded-xl border flex flex-col h-[75vh] min-h-[500px] overflow-hidden shadow-sm", col.color)}>
                    <div className="px-5 py-4 flex items-center justify-between border-b bg-background/60 backdrop-blur-sm shrink-0">
                      <h3 className="font-bold text-sm text-foreground/80">{col.title}</h3>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-background border shadow-sm">{colTasks.length}</span>
                    </div>

                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div 
                          ref={provided.innerRef} 
                          {...provided.droppableProps}
                          className={cn("p-4 flex-1 overflow-y-auto space-y-4 min-h-[150px] transition-colors scrollbar-none", snapshot.isDraggingOver ? "bg-primary/5" : "")}
                        >
                          {colTasks.map((task, index) => {
                            const completedSubtasks = task.subtasks?.filter(st => st.is_completed).length || 0
                            const totalSubtasks = task.subtasks?.length || 0
                            
                            return (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  onClick={() => { setSelectedTask(task); setIsEditModalOpen(true); }}
                                  className={cn("bg-background border rounded-lg shadow-sm transition-all relative group cursor-pointer hover:shadow-md", snapshot.isDragging ? "shadow-md ring-2 ring-primary/20 scale-[1.03]" : "hover:border-primary/40")}
                                  style={provided.draggableProps.style}
                                >
                                  <div className="p-4 flex flex-col gap-3">
                                    <div className="flex gap-2 items-start justify-between">
                                      <div className="flex gap-2">
                                        <div {...provided.dragHandleProps} className="mt-0.5 text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" onClick={e => e.stopPropagation()}>
                                          <GripVertical className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0 pr-4 space-y-1">
                                          <p className="text-[14px] font-bold text-foreground/90 wrap-break-word leading-snug">{task.title}</p>
                                          {task.projects && (
                                              <p className="text-[10px] font-bold uppercase tracking-wider text-primary/80 flex items-center gap-1.5 truncate pr-2">
                                                <FolderKanban className="h-3 w-3" /> {task.projects.title}
                                              </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center flex-wrap gap-2 text-xs">
                                      <span className={cn("px-1.5 py-0.5 border rounded-md font-semibold text-[10px] uppercase flex items-center gap-1", getPriorityColor(task.priority))}>
                                        <Flag className="h-2.5 w-2.5" />
                                        {task.priority || 'Medium'}
                                      </span>

                                      {totalSubtasks > 0 && (
                                        <span className={cn("flex items-center gap-1 font-medium", completedSubtasks === totalSubtasks ? "text-emerald-500" : "text-muted-foreground")}>
                                          <ListChecks className="h-3.5 w-3.5" />
                                          {completedSubtasks}/{totalSubtasks}
                                        </span>
                                      )}

                                      {task.due_date && (
                                        <span className={cn("flex items-center gap-1 font-medium bg-muted/40 px-1.5 py-0.5 rounded border border-border/50", new Date(task.due_date) < new Date() && col.id !== 'done' ? "text-destructive border-destructive/20 bg-destructive/5" : "text-muted-foreground")}>
                                          <Clock className="h-3 w-3" />
                                          {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          )})}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                )
              })}
            </div>
          </DragDropContext>
        </div>
      )}

      {/* Task Edit Modal */}
      {selectedTask && (
        <Dialog open={isEditModalOpen} onOpenChange={(open) => {
          if(!open) setIsEditModalOpen(false)
        }}>
          <DialogContent className="sm:max-w-[600px] h-[90vh] sm:h-auto max-h-[85vh] flex flex-col p-0 overflow-hidden gap-0 border-primary/20 shadow-2xl">
            <div className="flex items-start justify-between p-6 pb-4 border-b bg-muted/20 shrink-0">
              <div className="space-y-2 w-full pr-6">
                <Textarea 
                  value={selectedTask.title}
                  onChange={e => setSelectedTask({...selectedTask, title: e.target.value})}
                  className="text-xl font-bold border-none bg-transparent p-0 resize-none focus-visible:ring-0 shadow-none leading-snug min-h-[40px]"
                  placeholder="Task Title..."
                  disabled={!canEditDetails}
                />
                
                <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground px-1">
                  <p className="flex items-center gap-1.5"><FolderKanban className="h-3.5 w-3.5 text-primary/70" /> {selectedTask.projects?.title}</p>
                  <span className="h-1 w-1 rounded-full bg-border" />
                  <p className="capitalize text-foreground/70">List: {selectedTask.status.replace('_', ' ')}</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8 scrollbar-thin">
              <div className="grid grid-cols-2 gap-6">
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

                <div className="space-y-2.5">
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
                        onClick={() => updateSubtask(st.id, 'is_completed', !st.is_completed)}
                        className={cn("h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors shadow-sm", st.is_completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40 bg-background text-transparent")}
                      >
                         <Check className="h-3 w-3" />
                      </button>
                      <Input 
                        value={st.title}
                        onChange={e => updateSubtask(st.id, 'title', e.target.value)}
                        className={cn("h-8 bg-background shadow-sm border-transparent hover:border-border focus-visible:ring-1 transition-all", st.is_completed ? "line-through text-muted-foreground opacity-50" : "")}
                        disabled={!canEditDetails}
                        placeholder="Task item..."
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <DialogFooter className="p-4 border-t bg-muted/10 shrink-0 flex-row items-center justify-between sm:justify-between w-full">
              {canEditDetails ? (
                <Button variant="destructive" size="sm" onClick={() => handleDeleteTask(selectedTask.id, selectedTask.project_id)} className="h-9 shadow-sm gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              ) : <div/>}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)} className="h-9 bg-background">Cancel</Button>
                <Button size="sm" onClick={saveTaskDetails} disabled={saving} className="h-9 shadow-sm font-bold min-w-[80px]">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

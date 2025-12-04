import React from 'react';
import {
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Box,
  Typography,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { Task, TaskStatus, Priority, TaskServiceClient } from '../services/grpcClient';

interface TaskListProps {
  tasks: Task[];
  client: TaskServiceClient | null;
  onTaskUpdated: (task: Task) => void;
  onTaskDeleted: (taskId: string) => void;
}

/**
 * Task List Component
 *
 * Displays tasks with actions for update and delete
 * Demonstrates unary RPC calls for CRUD operations
 */
const TaskList: React.FC<TaskListProps> = ({
  tasks,
  client,
  onTaskUpdated,
  onTaskDeleted,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    title: '',
    description: '',
    status: TaskStatus.TASK_STATUS_TODO,
    priority: Priority.PRIORITY_MEDIUM,
  });

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, task: Task) => {
    setAnchorEl(event.currentTarget);
    setSelectedTask(task);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTask(null);
  };

  const handleEdit = () => {
    if (!selectedTask) return;

    setEditForm({
      title: selectedTask.getTitle(),
      description: selectedTask.getDescription(),
      status: selectedTask.getStatus(),
      priority: selectedTask.getPriority(),
    });
    setEditDialogOpen(true);
    handleMenuClose();
  };

  const handleUpdate = async () => {
    if (!client || !selectedTask) return;

    try {
      const updatedTask = await client.updateTask(selectedTask.getId(), {
        title: editForm.title,
        description: editForm.description,
        status: editForm.status,
        priority: editForm.priority,
      });
      onTaskUpdated(updatedTask);
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDelete = async () => {
    if (!client || !selectedTask) return;

    try {
      await client.deleteTask(selectedTask.getId());
      onTaskDeleted(selectedTask.getId());
      handleMenuClose();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.TASK_STATUS_TODO:
        return 'default';
      case TaskStatus.TASK_STATUS_IN_PROGRESS:
        return 'primary';
      case TaskStatus.TASK_STATUS_DONE:
        return 'success';
      case TaskStatus.TASK_STATUS_CANCELLED:
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.TASK_STATUS_TODO:
        return 'To Do';
      case TaskStatus.TASK_STATUS_IN_PROGRESS:
        return 'In Progress';
      case TaskStatus.TASK_STATUS_DONE:
        return 'Done';
      case TaskStatus.TASK_STATUS_CANCELLED:
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  };

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priority.PRIORITY_LOW:
        return 'info';
      case Priority.PRIORITY_MEDIUM:
        return 'warning';
      case Priority.PRIORITY_HIGH:
        return 'error';
      case Priority.PRIORITY_CRITICAL:
        return 'error';
      default:
        return 'default';
    }
  };

  const getPriorityLabel = (priority: Priority) => {
    switch (priority) {
      case Priority.PRIORITY_LOW:
        return 'Low';
      case Priority.PRIORITY_MEDIUM:
        return 'Medium';
      case Priority.PRIORITY_HIGH:
        return 'High';
      case Priority.PRIORITY_CRITICAL:
        return 'Critical';
      default:
        return 'Unknown';
    }
  };

  if (tasks.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', p: 3 }}>
        <Typography color="text.secondary">
          No tasks yet. Create your first task!
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <List>
        {tasks.map((task) => (
          <ListItem
            key={task.getId()}
            divider
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <ListItemText
              primary={
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography component="span" variant="subtitle1">{task.getTitle()}</Typography>
                  <Chip
                    label={getStatusLabel(task.getStatus())}
                    color={getStatusColor(task.getStatus())}
                    size="small"
                  />
                  <Chip
                    label={getPriorityLabel(task.getPriority())}
                    color={getPriorityColor(task.getPriority())}
                    size="small"
                  />
                </Box>
              }
              secondary={
                <Box component="span" sx={{ display: 'block' }}>
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block' }}>
                    {task.getDescription()}
                  </Typography>
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Created: {format(
                      task.getCreatedAt()?.toDate() || new Date(),
                      'MMM dd, yyyy HH:mm'
                    )}
                  </Typography>
                  {task.getLabelsList().length > 0 && (
                    <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                      {task.getLabelsList().map((label: string, index: number) => (
                        <Chip
                          key={index}
                          label={label}
                          size="small"
                          variant="outlined"
                          sx={{ mr: 0.5 }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              }
            />
            <ListItemSecondaryAction>
              <IconButton
                edge="end"
                onClick={(e) => handleMenuOpen(e, task)}
              >
                <MoreVertIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Task</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Title"
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Description"
            value={editForm.description}
            onChange={(e) =>
              setEditForm({ ...editForm, description: e.target.value })
            }
            margin="normal"
            multiline
            rows={3}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Status</InputLabel>
            <Select
              value={editForm.status}
              label="Status"
              onChange={(e) =>
                setEditForm({ ...editForm, status: e.target.value as TaskStatus })
              }
            >
              <MenuItem value={TaskStatus.TASK_STATUS_TODO}>To Do</MenuItem>
              <MenuItem value={TaskStatus.TASK_STATUS_IN_PROGRESS}>
                In Progress
              </MenuItem>
              <MenuItem value={TaskStatus.TASK_STATUS_DONE}>Done</MenuItem>
              <MenuItem value={TaskStatus.TASK_STATUS_CANCELLED}>
                Cancelled
              </MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Priority</InputLabel>
            <Select
              value={editForm.priority}
              label="Priority"
              onChange={(e) =>
                setEditForm({ ...editForm, priority: e.target.value as Priority })
              }
            >
              <MenuItem value={Priority.PRIORITY_LOW}>Low</MenuItem>
              <MenuItem value={Priority.PRIORITY_MEDIUM}>Medium</MenuItem>
              <MenuItem value={Priority.PRIORITY_HIGH}>High</MenuItem>
              <MenuItem value={Priority.PRIORITY_CRITICAL}>Critical</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdate} variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TaskList;
import React, { useState } from 'react';
import {
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Box,
  Stack,
  OutlinedInput,
  CircularProgress,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { Task, Priority, TaskServiceClient } from '../services/grpcClient';

interface CreateTaskFormProps {
  client: TaskServiceClient;
  onTaskCreated: (task: Task) => void;
}

/**
 * Create Task Form Component
 *
 * Demonstrates:
 * - Form validation
 * - Unary RPC call to create task
 * - Error handling
 * - Loading states
 */
const CreateTaskForm: React.FC<CreateTaskFormProps> = ({
  client,
  onTaskCreated,
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: Priority.PRIORITY_MEDIUM,
    labels: [] as string[],
  });
  const [labelInput, setLabelInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    title: '',
    description: '',
  });

  const validateForm = (): boolean => {
    const newErrors = {
      title: '',
      description: '',
    };

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (formData.title.length > 100) {
      newErrors.title = 'Title must be less than 100 characters';
    }

    if (formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    setErrors(newErrors);
    return !newErrors.title && !newErrors.description;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const task = await client.createTask(
        formData.title,
        formData.description,
        formData.priority,
        formData.labels
      );

      onTaskCreated(task);

      // Reset form
      setFormData({
        title: '',
        description: '',
        priority: Priority.PRIORITY_MEDIUM,
        labels: [],
      });
      setErrors({
        title: '',
        description: '',
      });
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLabel = () => {
    const trimmedLabel = labelInput.trim();
    if (trimmedLabel && !formData.labels.includes(trimmedLabel)) {
      setFormData({
        ...formData,
        labels: [...formData.labels, trimmedLabel],
      });
      setLabelInput('');
    }
  };

  const handleRemoveLabel = (labelToRemove: string) => {
    setFormData({
      ...formData,
      labels: formData.labels.filter((label) => label !== labelToRemove),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && labelInput.trim()) {
      e.preventDefault();
      handleAddLabel();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={2}>
        <TextField
          fullWidth
          label="Task Title"
          value={formData.title}
          onChange={(e) =>
            setFormData({ ...formData, title: e.target.value })
          }
          error={!!errors.title}
          helperText={errors.title}
          required
          disabled={loading}
          placeholder="Enter task title..."
        />

        <TextField
          fullWidth
          label="Description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          error={!!errors.description}
          helperText={errors.description}
          multiline
          rows={3}
          disabled={loading}
          placeholder="Enter task description..."
        />

        <FormControl fullWidth>
          <InputLabel>Priority</InputLabel>
          <Select
            value={formData.priority}
            label="Priority"
            onChange={(e) =>
              setFormData({
                ...formData,
                priority: e.target.value as Priority,
              })
            }
            disabled={loading}
          >
            <MenuItem value={Priority.PRIORITY_LOW}>Low</MenuItem>
            <MenuItem value={Priority.PRIORITY_MEDIUM}>Medium</MenuItem>
            <MenuItem value={Priority.PRIORITY_HIGH}>High</MenuItem>
            <MenuItem value={Priority.PRIORITY_CRITICAL}>Critical</MenuItem>
          </Select>
        </FormControl>

        <Box>
          <FormControl fullWidth>
            <InputLabel>Labels</InputLabel>
            <OutlinedInput
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyPress={handleKeyPress}
              label="Labels"
              placeholder="Press Enter to add label"
              disabled={loading}
              endAdornment={
                <Button
                  size="small"
                  onClick={handleAddLabel}
                  disabled={!labelInput.trim() || loading}
                >
                  Add
                </Button>
              }
            />
          </FormControl>

          {formData.labels.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {formData.labels.map((label) => (
                <Chip
                  key={label}
                  label={label}
                  onDelete={() => handleRemoveLabel(label)}
                  size="small"
                  disabled={loading}
                />
              ))}
            </Box>
          )}
        </Box>

        <Button
          type="submit"
          variant="contained"
          fullWidth
          startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create Task'}
        </Button>
      </Stack>
    </form>
  );
};

export default CreateTaskForm;
import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import {
  Circle as CircleIcon,
  WifiOff as WifiOffIcon,
  Wifi as WifiIcon,
} from '@mui/icons-material';

interface ConnectionStatusProps {
  connected: boolean;
}

/**
 * Connection Status Component
 *
 * Shows the current connection status to the gRPC server
 */
const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ connected }) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" color="inherit">
        Server:
      </Typography>
      <Chip
        icon={connected ? <WifiIcon /> : <WifiOffIcon />}
        label={connected ? 'Connected' : 'Disconnected'}
        color={connected ? 'success' : 'error'}
        size="small"
        sx={{
          '& .MuiChip-icon': {
            fontSize: 16,
            color: 'inherit',
          },
        }}
      />
      <CircleIcon
        sx={{
          fontSize: 8,
          color: connected ? 'success.main' : 'error.main',
          animation: connected ? 'pulse 2s infinite' : 'none',
          '@keyframes pulse': {
            '0%': {
              opacity: 1,
            },
            '50%': {
              opacity: 0.4,
            },
            '100%': {
              opacity: 1,
            },
          },
        }}
      />
    </Box>
  );
};

export default ConnectionStatus;
import { useEffect, useState } from 'react';
import {
  FormControl, InputLabel, Select, MenuItem, FormHelperText, CircularProgress, Alert,
} from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import axiosInstance from '../services/axiosInstance';

export default function WardSelect({ value, onChange, error, allLabel }) {
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    axiosInstance.get('/wards')
      .then((res) => {
        setWards(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setLoadError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <CircularProgress />;
  if (loadError) return <Alert severity="error">Error loading wards: {loadError}</Alert>;

  return (
    <div className="w-full">
      <FormControl fullWidth variant="outlined" error={!!error}>
        <InputLabel id="ward-select-label" shrink={!!allLabel}>Select Your Ward</InputLabel>
        <Select
          labelId="ward-select-label"
          value={value}
          displayEmpty={!!allLabel}
          notched={!!allLabel}
          onChange={(e) => {
            const id = e.target.value;
            const ward = wards.find((w) => w.WARD_ID === id);
            onChange(id, ward ? ward.WARD_NAME : '');
          }}
          label="Select Your Ward"
          startAdornment={<LocationOnIcon color="action" sx={{ mr: 1 }} />}
        >
          <MenuItem value="">
            <em>{allLabel || 'None'}</em>
          </MenuItem>
          {wards.map((w) => (
            <MenuItem key={w.WARD_ID} value={w.WARD_ID}>
              {w.WARD_NAME}
            </MenuItem>
          ))}
        </Select>
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    </div>
  );
}
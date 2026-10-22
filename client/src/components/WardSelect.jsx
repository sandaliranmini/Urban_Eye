import { useEffect, useState } from 'react';
import axios from 'axios';
import { FormControl, InputLabel, Select, MenuItem, CircularProgress, Alert } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';

export default function WardSelect({ value, onChange }) {
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get('http://localhost:5000/api/wards')
      .then((res) => {
        setWards(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">Error loading wards: {error}</Alert>;

  return (
    <div className="w-full">
      <FormControl fullWidth variant="outlined">
        <InputLabel id="ward-select-label">Select Your Ward</InputLabel>
        <Select
          labelId="ward-select-label"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          label="Select Your Ward"
          startAdornment={<LocationOnIcon color="action" sx={{ mr: 1 }} />}
        >
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          {wards.map((w) => (
            <MenuItem key={w.WARD_ID} value={w.WARD_ID}>
              {w.WARD_NAME} (Council ID: {w.COUNCIL_ID})
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
}
import { useState } from 'react';
import axios from 'axios';
import { 
  TextField, Button, MenuItem, Select, InputLabel, FormControl, 
  Box, Typography, Stepper, Step, StepLabel, Alert, CircularProgress 
} from '@mui/material';
import WardSelect from './WardSelect'; // Reusing your Card 3 component!

const categories = ['Road Hazard', 'Water Drainage', 'Waste Management', 'Street Lighting', 'Other'];
const steps = ['Title', 'Description', 'Category', 'Ward', 'Photo'];

export default function IssueForm() {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    ward_id: '',
    before_photo: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleNext = () => setActiveStep((prev) => prev + 1);
  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Hardcoding citizen_id as 1 for testing (we don't have login yet)
      const payload = { ...formData, citizen_id: 1 }; 
      
      await axios.post('http://localhost:5000/api/issues', payload);
      setMessage({ type: 'success', text: '✅ Issue reported successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: '❌ Error: ' + (err.response?.data?.error || err.message) });
    }
    setLoading(false);
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <TextField 
            fullWidth label="Issue Title" variant="outlined"
            value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Broken street light"
          />
        );
      case 1:
        return (
          <TextField 
            fullWidth label="Description" variant="outlined" multiline rows={4}
            value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the issue in detail..."
          />
        );
      case 2:
        return (
          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select 
              value={formData.category} label="Category"
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
        );
      case 3:
        return (
          <WardSelect 
            value={formData.ward_id} 
            onChange={(val) => setFormData({ ...formData, ward_id: val })} 
          />
        );
      case 4:
        return (
          <TextField 
            fullWidth label="Photo URL (Firebase upload coming later)" variant="outlined"
            value={formData.before_photo} onChange={(e) => setFormData({ ...formData, before_photo: e.target.value })}
            placeholder="https://example.com/photo.jpg"
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg mt-10">
      <Typography variant="h5" className="text-center font-bold mb-6 text-gray-800">
        Report an Issue
      </Typography>

      <Stepper activeStep={activeStep} alternativeLabel className="mb-8">
        {steps.map((label) => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>

      <Box className="min-h-[120px] mb-6">
        {renderStepContent(activeStep)}
      </Box>

      {message && (
        <Alert severity={message.type} className="mb-4">{message.text}</Alert>
      )}

      <div className="flex justify-between mt-4">
        <Button disabled={activeStep === 0} onClick={handleBack} variant="outlined">
          Back
        </Button>
        
        {activeStep === steps.length - 1 ? (
          <Button onClick={handleSubmit} variant="contained" color="primary" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Submit Issue'}
          </Button>
        ) : (
          <Button onClick={handleNext} variant="contained" color="primary">
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
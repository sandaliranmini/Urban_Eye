import axiosInstance from './axiosInstance';

export const triggerEmergency = async (data) => {
  const response = await axiosInstance.post('/emergency', data);
  return response.data;
};

export const getActiveAlerts = async () => {
  const response = await axiosInstance.get('/emergency/active');
  return response.data;
};

export const getAlertById = async (id) => {
  const response = await axiosInstance.get(`/emergency/${id}`);
  return response.data;
};

export const resolveAlert = async (id, notes) => {
  const response = await axiosInstance.put(`/emergency/${id}/resolve`, { notes });
  return response.data;
};

export const getEmergencyHistory = async (filters = {}) => {
  const response = await axiosInstance.get('/emergency/history', { params: filters });
  return response.data;
};

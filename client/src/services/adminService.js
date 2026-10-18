import axiosInstance from './axiosInstance';

// Dashboard stats
export const getAdminStats = async () => {
  const response = await axiosInstance.get('/admin/stats');
  return response.data;
};

// Officer management
export const getAllOfficers = async () => {
  const response = await axiosInstance.get('/admin/officers');
  return response.data;
};

export const createOfficer = async (data) => {
  const response = await axiosInstance.post('/admin/officers', data);
  return response.data;
};

export const updateOfficer = async (id, data) => {
  const response = await axiosInstance.put(`/admin/officers/${id}`, data);
  return response.data;
};

export const deleteOfficer = async (id) => {
  const response = await axiosInstance.delete(`/admin/officers/${id}`);
  return response.data;
};

// Ward + Council management
export const getAllWards = async () => {
  const response = await axiosInstance.get('/admin/wards');
  return response.data;
};

export const createWard = async (data) => {
  const response = await axiosInstance.post('/admin/wards', data);
  return response.data;
};

export const getAllCouncils = async () => {
  const response = await axiosInstance.get('/admin/councils');
  return response.data;
};

// Analytics
export const getIssueAnalytics = async (filters = {}) => {
  const response = await axiosInstance.get('/admin/analytics/issues', { params: filters });
  return response.data;
};
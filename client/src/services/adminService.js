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

// Export Analytics (CSV or JSON download)
export const exportAnalytics = async (filters = {}, format = 'csv', type = 'issues') => {
  const response = await axiosInstance.get('/admin/analytics/export', {
    params: { ...filters, format, type },
    responseType: 'blob',
  });

  const blob = new Blob([response.data], {
    type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8;',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `urban_eye_${type}_export_${Date.now()}.${format}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Audit Trail & Logging
export const getAuditLogs = async (filters = {}) => {
  const response = await axiosInstance.get('/audit-logs', { params: filters });
  return response.data;
};

export const getAuditStats = async (filters = {}) => {
  const response = await axiosInstance.get('/audit-logs/stats', { params: filters });
  return response.data;
};

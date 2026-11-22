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

export const patchOfficerStatus = async (id, isActive) => {
  const response = await axiosInstance.patch(`/admin/officers/${id}/status`, { is_active: isActive });
  return response.data;
};

export const resetOfficerPassword = async (id) => {
  const response = await axiosInstance.post(`/admin/officers/${id}/reset-password`);
  return response.data;
};

export const deleteOfficer = async (id, params = {}) => {
  const response = await axiosInstance.delete(`/admin/officers/${id}`, { params });
  return response.data;
};

// Ward + Council management
export const getAllWards = async (params = {}) => {
  const response = await axiosInstance.get('/admin/wards', { params });
  return response.data;
};

export const createWard = async (data) => {
  const response = await axiosInstance.post('/admin/wards', data);
  return response.data;
};

export const updateWard = async (id, data) => {
  const response = await axiosInstance.put(`/admin/wards/${id}`, data);
  return response.data;
};

export const deleteWard = async (id) => {
  const response = await axiosInstance.delete(`/admin/wards/${id}`);
  return response.data;
};

export const getAllCouncils = async () => {
  const response = await axiosInstance.get('/admin/councils');
  return response.data;
};

export const createCouncil = async (data) => {
  const response = await axiosInstance.post('/admin/councils', data);
  return response.data;
};

export const updateCouncil = async (id, data) => {
  const response = await axiosInstance.put(`/admin/councils/${id}`, data);
  return response.data;
};

export const deleteCouncil = async (id) => {
  const response = await axiosInstance.delete(`/admin/councils/${id}`);
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

// Verification Queue
export const getVerificationQueue = async (params = {}) => {
  const response = await axiosInstance.get('/admin/verifications', { params });
  return response.data;
};

export const approveVerification = async (id, data = {}) => {
  const response = await axiosInstance.post(`/admin/verifications/${id}/approve`, data);
  return response.data;
};

export const rejectVerification = async (id, data = {}) => {
  const response = await axiosInstance.post(`/admin/verifications/${id}/reject`, data);
  return response.data;
};

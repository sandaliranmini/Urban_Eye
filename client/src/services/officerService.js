import axiosInstance from './axiosInstance';

export const getAssignedIssues = async () => {
  const response = await axiosInstance.get('/officer/issues');
  return response.data;
};

export const getIssueDetails = async (id) => {
  const response = await axiosInstance.get(`/officer/issues/${id}`);
  return response.data;
};

export const updateStatus = async (id, status, notes) => {
  const response = await axiosInstance.put(`/officer/issues/${id}/status`, {
    status,
    notes,
  });
  return response.data;
};

export const getOfficerStats = async () => {
  const response = await axiosInstance.get('/officer/stats');
  return response.data;
};
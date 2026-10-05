import axiosInstance from './axiosInstance';

export const createIssue = async (formData) => {
  const response = await axiosInstance.post('/issues', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getAllIssues = async (filters = {}) => {
  const response = await axiosInstance.get('/issues', { params: filters });
  return response.data;
};

export const getIssueById = async (id) => {
  const response = await axiosInstance.get(`/issues/${id}`);
  return response.data;
};

export const updateIssueStatus = async (id, status, notes) => {
  const response = await axiosInstance.put(`/issues/${id}/status`, {
    status,
    notes,
  });
  return response.data;
};

export const uploadResolutionProof = async (id, formData) => {
  const response = await axiosInstance.post(
    `/issues/${id}/resolution`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return response.data;
};

export const getIssuesByWard = async (wardId) => {
  const response = await axiosInstance.get(`/issues/ward/${wardId}`);
  return response.data;
};

export const getMyIssues = async () => {
  const response = await axiosInstance.get('/issues/my-reports');
  return response.data;
};
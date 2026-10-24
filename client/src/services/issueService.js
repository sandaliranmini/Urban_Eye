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

export const buildIssueFormData = (form) => {
  const fd = new FormData();
  fd.append('title', form.title.trim());
  fd.append('description', form.description.trim());
  fd.append('category', form.category);
  fd.append('ward_id', String(form.ward_id));
  fd.append('is_emergency', form.is_emergency ? '1' : '0');
  if (MOCK_UPLOAD) {
    // until Firebase (card 6) exists, send a placeholder URL instead of the file
    fd.append('before_photo', 'https://placehold.co/600x400?text=Mock+photo');
  } else {
    fd.append('photo', form.photo); // multer field name on the server
  }
  return fd;
};
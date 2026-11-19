import axiosInstance from './axiosInstance';

export const getAnnouncementsByWard = async (wardId, params = {}) => {
  const response = await axiosInstance.get(`/announcements/ward/${wardId}`, { params });
  return response.data;
};

export const getAllAnnouncements = async (params = {}) => {
  const response = await axiosInstance.get('/announcements', { params });
  return response.data;
};

export const getAnnouncementById = async (id) => {
  const response = await axiosInstance.get(`/announcements/${id}`);
  return response.data;
};

export const createAnnouncement = async (data) => {
  const response = await axiosInstance.post('/announcements', data);
  return response.data;
};

export const updateAnnouncement = async (id, data) => {
  const response = await axiosInstance.put(`/announcements/${id}`, data);
  return response.data;
};

export const deleteAnnouncement = async (id) => {
  const response = await axiosInstance.delete(`/announcements/${id}`);
  return response.data;
};

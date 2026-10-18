import axiosInstance from './axiosInstance';

export const getAnnouncementsByWard = async (wardId) => {
  const response = await axiosInstance.get(`/announcements/ward/${wardId}`);
  return response.data;
};

export const getAllAnnouncements = async () => {
  const response = await axiosInstance.get('/announcements');
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
import axiosInstance from './axiosInstance';

export const register = async (data) => {
  const response = await axiosInstance.post('/auth/register', data);
  return response.data;
};

export const login = async (email, password) => {
  const response = await axiosInstance.post('/auth/login', { email, password });
  return response.data;
};

export const logout = async () => {
  const response = await axiosInstance.post('/auth/logout');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('role');
  return response.data;
};

export const getProfile = async () => {
  const response = await axiosInstance.get('/auth/profile');
  return response.data;
};

export const updateProfile = async (data) => {
  const response = await axiosInstance.put('/auth/profile', data);
  return response.data;
};

export const forgotPassword = async (email) => {
  const response = await axiosInstance.post('/auth/forgot-password', { email });
  return response.data;
};

export const resetPassword = async (token, newPassword) => {
  const response = await axiosInstance.post('/auth/reset-password', {
    token,
    newPassword,
  });
  return response.data;
};

export const verifyEmail = async (token) => {
  const response = await axiosInstance.post('/auth/verify-email', { token });
  return response.data;
};
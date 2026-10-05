import axiosInstance from './axiosInstance';

export const getComments = async (issueId) => {
  const response = await axiosInstance.get(`/issues/${issueId}/comments`);
  return response.data;
};

export const addComment = async (issueId, content, parentId = null) => {
  const response = await axiosInstance.post(`/issues/${issueId}/comments`, {
    content,
    parentId,
  });
  return response.data;
};

export const updateComment = async (commentId, content) => {
  const response = await axiosInstance.put(`/comments/${commentId}`, {
    content,
  });
  return response.data;
};

export const deleteComment = async (commentId) => {
  const response = await axiosInstance.delete(`/comments/${commentId}`);
  return response.data;
};

import axiosInstance from './axiosInstance';

export const voteOnIssue = async (issueId, type) => {
  const response = await axiosInstance.post(`/issues/${issueId}/vote`, {
    type,
  });
  return response.data;
};

export const removeVote = async (issueId) => {
  const response = await axiosInstance.delete(`/issues/${issueId}/vote`);
  return response.data;
};

export const getVoteCount = async (issueId) => {
  const response = await axiosInstance.get(`/issues/${issueId}/vote`);
  return response.data;
};

export const getUserVote = async (issueId) => {
  const response = await axiosInstance.get(`/issues/${issueId}/vote/me`);
  return response.data;
};
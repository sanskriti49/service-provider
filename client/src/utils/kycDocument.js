import api from '../api/axiosInstance';

// Fetch through the authenticated endpoint; the returned object URL is local to this browser.
export async function downloadKycDocument(providerId, side) {
  const response = await api.get(`/api/providers/v1/${encodeURIComponent(providerId)}/kyc/documents/${side}`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
	const extensions = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
	link.download = `verification-${side}.${extensions[response.headers['content-type']] || 'bin'}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

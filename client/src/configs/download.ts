import toast from "react-hot-toast";

// Cloudinary files live on another domain, so the HTML "download" attribute is ignored
// by the browser (it opens the file instead). We fetch the file and save it under a
// readable name; if that fails, Cloudinary's "fl_attachment" flag forces a download.
const attachmentUrl = (url: string) => url.replace('/upload/', '/upload/fl_attachment/');

export const downloadFile = async (url: string | undefined, name: string) => {
    if (!url) return;
    const ext = url.split('?')[0].split('.').pop() || '';
    const fileName = `${name.replace(/[^\w-]+/g, '_') || 'reelmerce'}${ext ? '.' + ext : ''}`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
        if (url.includes('res.cloudinary.com')) {
            window.location.href = attachmentUrl(url);
        } else {
            window.open(url, '_blank');
            toast.error('Download failed, the file was opened in a new tab');
        }
    }
};

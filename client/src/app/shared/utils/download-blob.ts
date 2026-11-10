export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Algunos navegadores cancelan la descarga si la URL se revoca de forma síncrona.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

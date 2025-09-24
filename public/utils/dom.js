export async function renderHTML(path) {
  const res = await fetch(path);
  return await res.text();
}

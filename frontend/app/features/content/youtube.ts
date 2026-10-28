const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
]);

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * O id do vídeo de um link do YouTube, ou `null` se não for um (BR-044). É a mesma regra do servidor
 * (`YouTubeUrl`): só os hosts do YouTube, com `https`, e um id de 11 caracteres. O servidor é a validação final; aqui é
 * para a tela avisar na hora ("Vídeo reconhecido" / "Use um link do YouTube").
 */
export function youtubeVideoId(value: string): string | null {
  const text = value.trim();
  if (!/^https?:\/\//i.test(text)) return null;

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }

  if (url.username !== "" || url.password !== "" || !HOSTS.has(url.hostname.toLowerCase())) {
    return null;
  }

  let id: string | null = null;
  if (url.hostname.toLowerCase() === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v");
  } else {
    id = /^\/(?:embed|shorts|live|v)\/([^/?]+)/.exec(url.pathname)?.[1] ?? null;
  }

  return id !== null && VIDEO_ID.test(id) ? id : null;
}

export const BULLETIN_LINK_MAX_LENGTH = 500;

const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])$/;

/**
 * O link de um boletim publicado fora do site, como um flipbook do Heyzine (BR-084). Mesmas regras de `BulletinLink` no
 * servidor, que é a validação final: só `https`, com um domínio de verdade e sem usuário ou senha no endereço.
 */
export function isBulletinLink(value: string): boolean {
  if (value.length > BULLETIN_LINK_MAX_LENGTH || !/^https:\/\/\S+$/i.test(value)) return false;

  try {
    const url = new URL(value);
    return url.username === "" && url.password === "" && DOMAIN.test(url.hostname);
  } catch {
    return false;
  }
}

/**
 * O `.htaccess` do docroot (deploy/htaccess/public_html.htaccess) adaptado para rodar em `http://localhost:8080`: sai só
 * o que presume HTTPS e o domínio real. Todo o resto (roteamento, cabeçalhos, cache) é o de produção, que é o ponto de
 * servir o build pelo Apache local.
 *
 *   - o redirecionamento HTTP → HTTPS (localhost não tem certificado);
 *   - o `upgrade-insecure-requests` do CSP (o navegador trocaria os recursos de `http://localhost` por https);
 *   - o `Strict-Transport-Security` (o navegador não deve "lembrar" que localhost exige HTTPS).
 */
export function toLocalHtaccess(source) {
  const withoutHttpsRedirect = source.replace(
    /^[ \t]*RewriteCond %\{HTTPS\} !=on\r?\n[ \t]*RewriteCond %\{HTTP:X-Forwarded-Proto\} !https \[NC\]\r?\n[ \t]*RewriteRule \^ https:\/\/%\{HTTP_HOST\}%\{REQUEST_URI\} \[L,R=301\]\r?\n/m,
    "",
  );
  const withoutUpgrade = withoutHttpsRedirect.replace(/;\s*upgrade-insecure-requests/, "");
  const withoutHsts = withoutUpgrade.replace(
    /^[ \t]*Header always set Strict-Transport-Security .*\r?\n/m,
    "",
  );

  if (withoutHsts === source)
    throw new Error("o .htaccess de produção mudou de forma: ajuste toLocalHtaccess");
  return withoutHsts;
}

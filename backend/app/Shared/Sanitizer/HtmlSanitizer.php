<?php

declare(strict_types=1);

namespace App\Shared\Sanitizer;

use DOMDocument;
use DOMElement;
use DOMXPath;
use HTMLPurifier;
use HTMLPurifier_Config;
use RuntimeException;

/**
 * Sanitização de HTML no servidor, antes de gravar (BR-046, ADR sobre `SanitizedHtml`).
 *
 * Lista de permissão: `p`, `br`, `strong`, `em`, `ul`, `ol`, `li`, `a[href]` (http, https ou mailto), `blockquote`,
 * `h2` e `h3`. Todo o resto (scripts, estilos, atributos de evento, `iframe`, `img`, `javascript:`…) é removido, e
 * todo link sai com `rel="noopener noreferrer"`. O HTMLPurifier é a barreira de segurança; a detecção de remoção
 * (`wasModified`) só serve para avisar quem escreve.
 */
final class HtmlSanitizer
{
    private const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'blockquote', 'h2', 'h3'];

    private const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];

    /** O TipTap e os navegadores acrescentam estes atributos aos links; descartá-los é esperado, não é aviso. */
    private const TOLERATED_LINK_ATTRIBUTES = ['href', 'rel', 'target'];

    private ?HTMLPurifier $purifier = null;

    /**
     * @param  string  $cachePath  diretório gravável onde o HTMLPurifier guarda a definição compilada
     */
    public function __construct(private readonly string $cachePath) {}

    public function sanitize(string $html): SanitizedHtml
    {
        $clean = trim($this->purifier()->purify($html));

        return new SanitizedHtml($this->forceRel($clean), $this->containsDisallowedMarkup($html));
    }

    /**
     * Todo link sai com `rel="noopener noreferrer"`. A saída do HTMLPurifier é normalizada (atributos entre aspas
     * duplas, `"`, `<` e `>` escapados no valor), e a lista de permissão só deixa o `href` no `<a>`,
     * então o padrão abaixo casa exatamente os links, sem ambiguidade.
     */
    private function forceRel(string $purified): string
    {
        return (string) preg_replace('/<a href="([^"]*)">/', '<a href="$1" rel="noopener noreferrer">', $purified);
    }

    private function purifier(): HTMLPurifier
    {
        if ($this->purifier !== null) {
            return $this->purifier;
        }

        if (! is_dir($this->cachePath) && ! @mkdir($this->cachePath, 0775, true) && ! is_dir($this->cachePath)) {
            throw new RuntimeException("Não foi possível criar o cache do HTMLPurifier em {$this->cachePath}.");
        }

        $config = HTMLPurifier_Config::createDefault();
        $config->set('Core.Encoding', 'UTF-8');
        $config->set('HTML.Doctype', 'HTML 4.01 Transitional');
        $config->set('HTML.Allowed', 'p,br,strong,em,ul,ol,li,a[href],blockquote,h2,h3');
        $config->set('URI.AllowedSchemes', array_fill_keys(self::ALLOWED_SCHEMES, true));
        $config->set('Cache.SerializerPath', $this->cachePath);

        return $this->purifier = new HTMLPurifier($config);
    }

    /**
     * Compara o que foi digitado com a lista de permissão. Percorre a árvore do HTML original: qualquer tag fora da
     * lista, atributo que não seja o `href` de um link, link com esquema proibido ou comentário conta como remoção.
     */
    private function containsDisallowedMarkup(string $html): bool
    {
        if (trim($html) === '') {
            return false;
        }

        // O analisador junta um `<body onload=…>` digitado ao `<body>` que o envolve e esconde o atributo; checa antes
        if (preg_match('/<\s*(?:html|head|body)\b|<!doctype/i', $html) === 1) {
            return true;
        }

        $previous = libxml_use_internal_errors(true);
        $document = new DOMDocument('1.0', 'UTF-8');
        $document->loadHTML('<?xml encoding="utf-8" ?><body>'.$html.'</body>', LIBXML_NOERROR | LIBXML_NOWARNING | LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $xpath = new DOMXPath($document);

        if ($xpath->query('//body//comment() | //body//processing-instruction()')->length > 0) {
            return true;
        }

        foreach ($xpath->query('//body//*') ?: [] as $element) {
            if (! $element instanceof DOMElement || $this->elementIsDisallowed($element)) {
                return true;
            }
        }

        return false;
    }

    private function elementIsDisallowed(DOMElement $element): bool
    {
        $tag = strtolower($element->tagName);

        if (! in_array($tag, self::ALLOWED_TAGS, true)) {
            return true;
        }

        foreach ($element->attributes as $attribute) {
            $name = strtolower($attribute->nodeName);

            if ($tag !== 'a' || ! in_array($name, self::TOLERATED_LINK_ATTRIBUTES, true)) {
                return true;
            }

            if ($name === 'href' && ! $this->hrefIsAllowed($attribute->nodeValue ?? '')) {
                return true;
            }
        }

        return false;
    }

    private function hrefIsAllowed(string $href): bool
    {
        // O navegador ignora espaços e caracteres de controle dentro do esquema (`java\tscript:`); a checagem também
        $compact = (string) preg_replace('/[\x00-\x20\x7F]+/', '', $href);

        if (preg_match('/^([a-z][a-z0-9+.\-]*):/i', $compact, $match) !== 1) {
            return true; // sem esquema: link relativo ou âncora
        }

        return in_array(strtolower($match[1]), self::ALLOWED_SCHEMES, true);
    }
}

<?php

declare(strict_types=1);

namespace App\Shared\ValueObjects;

use Stringable;

/**
 * Link do YouTube: host `youtube.com`, `www.youtube.com`, `m.youtube.com` ou `youtu.be` (BR-044), do qual se extrai o
 * `video_id`. O servidor nunca busca essa URL (A10 SSRF): ela só vira miniatura e player no navegador.
 */
final readonly class YoutubeUrl implements Stringable
{
    private const HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];

    private function __construct(
        private string $url,
        private string $videoId,
    ) {}

    public static function from(string $value): self
    {
        $url = trim($value);
        $parts = parse_url($url);

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));

        if ($parts === false
            || ! in_array($scheme, ['http', 'https'], true)
            || ! in_array($host, self::HOSTS, true)
            // https://youtube.com@outro-site.com/… tem usuário na URL: recusa
            || isset($parts['user']) || isset($parts['pass'])) {
            throw self::invalid();
        }

        $videoId = self::extractVideoId($host, (string) ($parts['path'] ?? ''), (string) ($parts['query'] ?? ''));
        if ($videoId === null) {
            throw self::invalid();
        }

        return new self($url, $videoId);
    }

    public static function tryFrom(?string $value): ?self
    {
        if ($value === null) {
            return null;
        }

        try {
            return self::from($value);
        } catch (InvalidValueObject) {
            return null;
        }
    }

    public function url(): string
    {
        return $this->url;
    }

    public function videoId(): string
    {
        return $this->videoId;
    }

    /** Miniatura para o Open Graph e para a fachada do player (o vídeo só carrega depois do clique). */
    public function thumbnailUrl(): string
    {
        return 'https://i.ytimg.com/vi/'.$this->videoId.'/hqdefault.jpg';
    }

    public function __toString(): string
    {
        return $this->url;
    }

    private static function extractVideoId(string $host, string $path, string $query): ?string
    {
        $candidate = null;

        if ($host === 'youtu.be') {
            $candidate = trim($path, '/');
        } elseif ($path === '/watch') {
            parse_str($query, $params);
            $candidate = is_string($params['v'] ?? null) ? $params['v'] : null;
        } elseif (preg_match('#^/(?:embed|shorts|live|v)/([^/?]+)/?$#', $path, $match) === 1) {
            $candidate = $match[1];
        }

        return $candidate !== null && preg_match('/^[A-Za-z0-9_-]{11}$/', $candidate) === 1 ? $candidate : null;
    }

    private static function invalid(): InvalidValueObject
    {
        return new InvalidValueObject('invalid_youtube_url', 'Informe um link do YouTube.');
    }
}

<?php

declare(strict_types=1);

namespace App\Modules\Content\Support;

/**
 * Link do YouTube e o id do vídeo (BR-044). Só os hosts do YouTube valem; qualquer outro endereço, ou um link do
 * YouTube sem vídeo (canal, busca), é recusado. A forma guardada é sempre a canônica, nunca o que foi colado.
 */
final readonly class YouTubeUrl
{
    private const HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'];

    private const VIDEO_ID = '/^[A-Za-z0-9_-]{11}$/';

    private function __construct(public string $videoId) {}

    public static function tryParse(?string $value): ?self
    {
        $value = trim((string) $value);
        if ($value === '' || preg_match('#^https?://#i', $value) !== 1) {
            return null;
        }

        $parts = parse_url($value);
        if ($parts === false || ! isset($parts['host']) || isset($parts['user']) || isset($parts['pass'])) {
            return null;
        }

        $host = strtolower($parts['host']);
        if (! in_array($host, self::HOSTS, true)) {
            return null;
        }

        $id = self::extractId($host, $parts['path'] ?? '', $parts['query'] ?? '');

        return $id !== null && preg_match(self::VIDEO_ID, $id) === 1 ? new self($id) : null;
    }

    /** `https://www.youtube.com/watch?v=<id>`: a forma que o banco guarda. */
    public function canonical(): string
    {
        return 'https://www.youtube.com/watch?v='.$this->videoId;
    }

    /** Miniatura do vídeo, usada como `og:image` da mensagem. */
    public function thumbnail(): string
    {
        return 'https://i.ytimg.com/vi/'.$this->videoId.'/hqdefault.jpg';
    }

    private static function extractId(string $host, string $path, string $query): ?string
    {
        if ($host === 'youtu.be') {
            return explode('/', ltrim($path, '/'))[0];
        }

        if ($path === '/watch') {
            parse_str($query, $params);

            return is_string($params['v'] ?? null) ? $params['v'] : null;
        }

        if (preg_match('#^/(?:embed|shorts|live|v)/([^/?]+)#', $path, $match) === 1) {
            return $match[1];
        }

        return null;
    }
}

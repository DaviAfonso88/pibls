<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            // Nada do disco privado é servido pelo Laravel: o projeto não usa URL temporária do disco local
            'serve' => false,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        // Arquivos públicos enviados pelo painel: public_html/uploads/{boletins,eventos,pix}/AAAA/<32 hex>.<ext>
        // (Security → Uploads). Em produção, UPLOADS_PATH aponta para fora das releases, para o deploy nunca tocá-los.
        'uploads' => [
            'driver' => 'local',
            'root' => env('UPLOADS_PATH', public_path('uploads')),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/uploads',
            'visibility' => 'public',
            'throw' => true,
            'report' => false,
        ],

        // Backblaze B2 (I-09), pela API S3: cópia dos backups fora da hospedagem. A chave de aplicação é restrita ao
        // bucket e SEM permissão de exclusão; o código também nunca apaga nada lá. Timeout de 60 s por requisição.
        'b2' => [
            'driver' => 's3',
            'key' => env('B2_KEY_ID'),
            'secret' => env('B2_APPLICATION_KEY'),
            'region' => env('B2_REGION', 'eu-central-003'),
            'bucket' => env('B2_BUCKET'),
            'endpoint' => env('B2_ENDPOINT', 'https://s3.eu-central-003.backblazeb2.com'),
            'use_path_style_endpoint' => true,
            'http' => ['timeout' => 60, 'connect_timeout' => 10],
            'throw' => true,
            'report' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
            'report' => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];

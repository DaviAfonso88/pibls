# Ambiente local: o mais próximo possível da HostGator (PHP 8.4, Apache, SEM OPcache).
# A imagem oficial já traz o OPcache embutido e ligado; o php.ini deste diretório o desativa.
FROM php:8.4-apache

# Extensões exigidas pelo projeto (conferidas por `php artisan pibls:doctor`):
# pdo_mysql, mbstring, openssl, sodium, gd (com WebP), fileinfo, curl, zip, intl, bcmath.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git unzip jq \
        libzip-dev libicu-dev libonig-dev libsodium-dev \
        libpng-dev libjpeg-dev libwebp-dev libfreetype6-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql mbstring gd zip intl bcmath sodium \
    # PCOV: cobertura de testes, só em local e no CI
    && pecl install pcov \
    && docker-php-ext-enable pcov \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/* /tmp/pear

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Mesmos limites mínimos desejados da produção (MultiPHP INI)
COPY php.ini /usr/local/etc/php/conf.d/zz-pibls.ini

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
    && sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

RUN echo "ServerName localhost" > /etc/apache2/conf-available/servername.conf \
    && a2enconf servername

COPY entrypoint.sh /usr/local/bin/pibls-entrypoint
RUN chmod +x /usr/local/bin/pibls-entrypoint

WORKDIR /var/www/html

ENTRYPOINT ["pibls-entrypoint"]
CMD ["apache2-foreground"]

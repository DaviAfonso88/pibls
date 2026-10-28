-- Banco separado para a suíte de testes (feature tests usam MySQL real, sem mock).
CREATE DATABASE IF NOT EXISTS `pibls_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `pibls_test`.* TO 'pibls_app'@'%';
FLUSH PRIVILEGES;

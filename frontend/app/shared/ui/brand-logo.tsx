/**
 * Símbolo da igreja (cruz sobre o morro, `public/logos/simbolo-96.png`), no cabeçalho e no rodapé do site. O tamanho vem
 * de `className` (`size-12`), sempre inteiro, porque aqui não há tailwind-merge. É decorativo (`alt=""`): o nome da
 * marca está no texto ao lado, e o link que envolve o símbolo cuida do nome acessível. Só do site público: o painel usa
 * um `<img>` próprio, porque um módulo compartilhado entre o site e o painel viraria um chunk à parte em toda rota
 * pública (orçamento de bundle).
 */
export function BrandSymbol({ className }: { className: string }) {
  return (
    <img
      src="/logos/simbolo-96.png"
      width={96}
      height={96}
      alt=""
      decoding="async"
      className={`block flex-none ${className}`}
    />
  );
}

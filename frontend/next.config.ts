import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empacota o servidor e só as dependências realmente usadas em
  // `.next/standalone`, que é o que o Dockerfile copia para a imagem final.
  // Sem isto o `.next/standalone` não é gerado e o build da imagem quebra no
  // COPY — e a alternativa (levar `node_modules` inteiro) multiplica o tamanho
  // por várias vezes sem ganho nenhum.
  output: "standalone",
};

export default nextConfig;

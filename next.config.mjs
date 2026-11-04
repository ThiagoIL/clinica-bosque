const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // anexos de contratos (até 10 MB por envio, com folga para o multipart)
    serverActions: { bodySizeLimit: "12mb" },
    proxyClientMaxBodySize: "12mb",
  },
  async redirects() {
    // "Fornecedores" e "Colaboradores" agora fazem parte de Profissionais
    return [
      { source: "/fornecedores", destination: "/profissionais", permanent: true },
      { source: "/colaboradores", destination: "/profissionais", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // o navegador precisa buscar sempre a versão nova do service worker
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;

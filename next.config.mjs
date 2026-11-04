/** @type {import('next').NextConfig} */
const nextConfig = {
  // Old addresses (bookmarks): the visa pages now live under Administration.
  async redirects() {
    return [
      { source: "/visas", destination: "/administration/visas", permanent: false },
      { source: "/visas/:path*", destination: "/administration/visas/:path*", permanent: false },
      { source: "/administration/mes-demandes", destination: "/administration/demandes", permanent: false },
    ];
  },
};

export default nextConfig;
